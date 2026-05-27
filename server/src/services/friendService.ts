import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole, userRoleToString } from "../enums";
import { publishSupportChatEvent } from "./supportChatRealtimeService";

let tableReady = false;
let requestsTableReady = false;

/** Coloane reale din DB (pot diferi de user_id / friend_user_id). */
let cachedFriendshipCols: { u: string; f: string } | null = null;

function escapeSqlIdent(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new ServiceError("Structură invalidă pentru tabelul user_friendships.", 500);
  }
  return `\`${name.replace(/`/g, "``")}\``;
}

/**
 * Citește numele coloanelor din user_friendships (baze vechi / casing diferit).
 * Prima coloană = primul user din perechea ordonată (lexicografic), a doua = al doilea.
 */
async function resolveFriendshipColumnNames(): Promise<{ u: string; f: string }> {
  if (cachedFriendshipCols) return cachedFriendshipCols;

  const rows = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; ORDINAL_POSITION: number; DATA_TYPE: string }>>`
    SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_friendships'
    ORDER BY ORDINAL_POSITION
  `;

  if (rows.length === 0) {
    cachedFriendshipCols = { u: "user_id", f: "friend_user_id" };
    return cachedFriendshipCols;
  }

  const names = new Set(rows.map((r) => r.COLUMN_NAME));
  if (names.has("user_id") && names.has("friend_user_id")) {
    cachedFriendshipCols = { u: "user_id", f: "friend_user_id" };
    return cachedFriendshipCols;
  }

  const canon = new Map<string, string>();
  for (const r of rows) {
    const k = r.COLUMN_NAME.toLowerCase().replace(/_/g, "");
    if (!canon.has(k)) canon.set(k, r.COLUMN_NAME);
  }
  const byUserId = canon.get("userid");
  const byFriendUserId = canon.get("frienduserid");
  if (byUserId && byFriendUserId && byUserId !== byFriendUserId) {
    cachedFriendshipCols = { u: byUserId, f: byFriendUserId };
    return cachedFriendshipCols;
  }

  const stringCols = rows.filter(
    (r) =>
      (String(r.DATA_TYPE).includes("char") || r.DATA_TYPE === "varchar") &&
      r.COLUMN_NAME.toLowerCase() !== "id" &&
      !r.COLUMN_NAME.toLowerCase().includes("created")
  );
  if (stringCols.length >= 2) {
    cachedFriendshipCols = { u: stringCols[0].COLUMN_NAME, f: stringCols[1].COLUMN_NAME };
    return cachedFriendshipCols;
  }

  throw new ServiceError(
    "Tabelul user_friendships nu are coloanele așteptate. Rulează în MySQL: SHOW COLUMNS FROM user_friendships;",
    500
  );
}

async function ensureFriendshipTable(): Promise<void> {
  if (tableReady) {
    await ensureFriendRequestsTable();
    return;
  }
  cachedFriendshipCols = null;
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS user_friendships (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  friend_user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_friend_pair (user_id, friend_user_id),
  KEY idx_user_id (user_id),
  KEY idx_friend_user_id (friend_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
  await resolveFriendshipColumnNames();
  tableReady = true;
  await ensureFriendRequestsTable();
}

async function ensureFriendRequestsTable(): Promise<void> {
  if (requestsTableReady) return;
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS user_friend_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_friend_req_dir (from_user_id, to_user_id),
  KEY idx_to (to_user_id),
  KEY idx_from (from_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
  requestsTableReady = true;
}

function pairOrdered(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function requireUserId(actorUserId?: string): string {
  if (!actorUserId) throw new ServiceError("Unauthorized", 401);
  return actorUserId;
}

/** Staff ↔ customer; support/admin ↔ staff sau customer (nu între ei). */
function canFriendPair(actor: UserRole, target: UserRole): boolean {
  if (actor === target) return false;
  const actorIsSupport = actor === UserRole.Admin || actor === UserRole.Support;
  const targetIsSupport = target === UserRole.Admin || target === UserRole.Support;
  if (actorIsSupport && targetIsSupport) return false;
  if (actorIsSupport) {
    return target === UserRole.Employee || target === UserRole.Business;
  }
  if (targetIsSupport) {
    return actor === UserRole.Employee || actor === UserRole.Business;
  }
  return (
    (actor === UserRole.Employee && target === UserRole.Business) ||
    (actor === UserRole.Business && target === UserRole.Employee)
  );
}

export type FriendUserRow = {
  id: string;
  email: string;
  role: "staff" | "customer" | "support";
  displayName: string;
  avatar?: string | null;
};

export type FriendIncomingRequestRow = FriendUserRow & { requestedAt: string };

function mapUserToFriendRow(u: {
  Id: string;
  Email: string;
  Role: number;
  Avatar?: string | null;
  employee_profiles?: { Name: string | null; Surname: string | null } | null;
  business_profiles?: { CompanyName: string | null } | null;
}): FriendUserRow {
  const roleStr = userRoleToString(u.Role as UserRole) as FriendUserRow["role"];
  let displayName = u.Email;
  if (u.Role === UserRole.Business) {
    displayName = u.business_profiles?.CompanyName?.trim() || u.Email;
  } else if (u.Role === UserRole.Employee) {
    const ep = u.employee_profiles;
    const fn = ep?.Name?.trim() || "";
    const ln = ep?.Surname?.trim() || "";
    displayName = [fn, ln].filter(Boolean).join(" ") || u.Email;
  }
  return {
    id: u.Id,
    email: u.Email,
    role: roleStr,
    displayName,
    avatar: u.Avatar ?? null,
  };
}

export async function areUsersFriends(userIdA: string | undefined, userIdB: string | undefined): Promise<boolean> {
  const a = String(userIdA ?? "").trim();
  const b = String(userIdB ?? "").trim();
  if (!a || !b || a === b) return false;
  await ensureFriendshipTable();
  const peers = await getFriendPeerIds(a);
  return peers.has(b);
}

async function getFriendPeerIds(actorId: string): Promise<Set<string>> {
  const { u, f } = await resolveFriendshipColumnNames();
  const qu = escapeSqlIdent(u);
  const qf = escapeSqlIdent(f);
  const sql = `SELECT ${qu} AS c1, ${qf} AS c2 FROM user_friendships WHERE ${qu} = ? OR ${qf} = ?`;
  const pairRows = await prisma.$queryRawUnsafe<Array<{ c1: string; c2: string }>>(sql, actorId, actorId);
  const friendIds = new Set<string>();
  for (const r of pairRows) {
    friendIds.add(r.c1 === actorId ? r.c2 : r.c1);
  }
  return friendIds;
}

/** Utilizatori implicați într-o cerere în așteptare (trimisă sau primită). */
async function getPendingRequestPeerIds(actorId: string): Promise<Set<string>> {
  await ensureFriendRequestsTable();
  const rows = await prisma.$queryRaw<Array<{ from_user_id: string; to_user_id: string }>>`
    SELECT from_user_id, to_user_id FROM user_friend_requests WHERE from_user_id = ${actorId} OR to_user_id = ${actorId}
  `;
  const peers = new Set<string>();
  for (const r of rows) {
    peers.add(r.from_user_id === actorId ? r.to_user_id : r.from_user_id);
  }
  return peers;
}

async function insertFriendship(actorId: string, targetId: string): Promise<void> {
  const [low, high] = pairOrdered(actorId, targetId);
  const { u, f } = await resolveFriendshipColumnNames();
  const qu = escapeSqlIdent(u);
  const qf = escapeSqlIdent(f);
  const sql = `INSERT IGNORE INTO user_friendships (${qu}, ${qf}) VALUES (?, ?)`;
  await prisma.$executeRawUnsafe(sql, low, high);
}

async function deleteRequestsBetween(a: string, b: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM user_friend_requests WHERE (from_user_id = ${a} AND to_user_id = ${b}) OR (from_user_id = ${b} AND to_user_id = ${a})
  `;
}

export async function searchFriendCandidates(actorUserId: string | undefined, qRaw: string): Promise<{ users: FriendUserRow[] }> {
  const actorId = requireUserId(actorUserId);
  await ensureFriendshipTable();
  const q = String(qRaw ?? "").trim();
  if (q.length < 2) return { users: [] };

  const actor = await prisma.users.findUnique({ where: { Id: actorId }, select: { Role: true } });
  if (!actor) throw new ServiceError("Utilizator negăsit.", 404);
  const actorRole = actor.Role as UserRole;
  let roleFilter: UserRole[] = [];
  if (actorRole === UserRole.Employee) roleFilter = [UserRole.Business];
  else if (actorRole === UserRole.Business) roleFilter = [UserRole.Employee];
  else if (actorRole === UserRole.Support || actorRole === UserRole.Admin) {
    roleFilter = [UserRole.Employee, UserRole.Business];
  } else {
    throw new ServiceError("Rolul tău nu poate adăuga prieteni.", 403);
  }

  const users = await prisma.users.findMany({
    where: {
      Id: { not: actorId },
      IsActive: true,
      Role: { in: roleFilter },
      OR: [
        { Email: { contains: q } },
        { employee_profiles: { Name: { contains: q } } },
        { employee_profiles: { Surname: { contains: q } } },
        { business_profiles: { ContactPersonName: { contains: q } } },
        { business_profiles: { ContactPersonSurname: { contains: q } } },
      ],
    },
    include: {
      employee_profiles: { select: { Name: true, Surname: true } },
      business_profiles: { select: { CompanyName: true } },
    },
    take: 25,
    orderBy: { CreatedAt: "desc" },
  });

  const friendIds = await getFriendPeerIds(actorId);
  const pendingPeers = await getPendingRequestPeerIds(actorId);

  return {
    users: users
      .filter((u) => !friendIds.has(u.Id) && !pendingPeers.has(u.Id))
      .map((u) => mapUserToFriendRow(u)),
  };
}

export async function listFriends(actorUserId: string | undefined): Promise<{ friends: FriendUserRow[] }> {
  const actorId = requireUserId(actorUserId);
  await ensureFriendshipTable();
  const { u, f } = await resolveFriendshipColumnNames();
  const qu = escapeSqlIdent(u);
  const qf = escapeSqlIdent(f);
  const sql = `SELECT ${qu} AS c1, ${qf} AS c2 FROM user_friendships WHERE ${qu} = ? OR ${qf} = ?`;
  const pairRows = await prisma.$queryRawUnsafe<Array<{ c1: string; c2: string }>>(sql, actorId, actorId);
  const peerIds = pairRows.map((r) => (r.c1 === actorId ? r.c2 : r.c1));
  if (peerIds.length === 0) return { friends: [] };

  const users = await prisma.users.findMany({
    where: { Id: { in: peerIds } },
    include: {
      employee_profiles: { select: { Name: true, Surname: true } },
      business_profiles: { select: { CompanyName: true } },
    },
  });
  return { friends: users.map((u) => mapUserToFriendRow(u)) };
}

export async function listIncomingFriendRequests(actorUserId: string | undefined): Promise<{ requests: FriendIncomingRequestRow[] }> {
  const actorId = requireUserId(actorUserId);
  await ensureFriendshipTable();
  const rows = await prisma.$queryRaw<Array<{ from_user_id: string; created_at: Date }>>`
    SELECT from_user_id, created_at FROM user_friend_requests WHERE to_user_id = ${actorId} ORDER BY created_at DESC
  `;
  if (rows.length === 0) return { requests: [] };
  const fromIds = rows.map((r) => r.from_user_id);
  const users = await prisma.users.findMany({
    where: { Id: { in: fromIds } },
    include: {
      employee_profiles: { select: { Name: true, Surname: true } },
      business_profiles: { select: { CompanyName: true } },
    },
  });
  const byId = new Map(users.map((u) => [u.Id, u]));
  const requests: FriendIncomingRequestRow[] = [];
  for (const r of rows) {
    const u = byId.get(r.from_user_id);
    if (!u) continue;
    const base = mapUserToFriendRow(u);
    requests.push({
      ...base,
      requestedAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    });
  }
  return { requests };
}

/** Trimite cerere sau, dacă există cerere inversă, acceptă reciproc și creează prietenia. */
export async function addFriend(
  actorUserId: string | undefined,
  targetUserId?: string
): Promise<{ ok: true; state: "pending" | "connected" }> {
  const actorId = requireUserId(actorUserId);
  const targetId = String(targetUserId ?? "").trim();
  if (!targetId) throw new ServiceError("ID lipsă.", 400);
  if (targetId === actorId) throw new ServiceError("Nu te poți adăuga pe tine.", 400);
  await ensureFriendshipTable();

  const actor = await prisma.users.findUnique({ where: { Id: actorId }, select: { Role: true } });
  const target = await prisma.users.findUnique({ where: { Id: targetId }, select: { Role: true, IsActive: true } });
  if (!actor || !target) throw new ServiceError("Utilizator negăsit.", 404);
  if (!target.IsActive) throw new ServiceError("Utilizator inactiv.", 400);
  if (!canFriendPair(actor.Role as UserRole, target.Role as UserRole)) {
    throw new ServiceError("Nu poți adăuga acest utilizator ca prieten.", 400);
  }

  const friends = await getFriendPeerIds(actorId);
  if (friends.has(targetId)) {
    return { ok: true, state: "connected" };
  }

  const reverseRows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM user_friend_requests WHERE from_user_id = ${targetId} AND to_user_id = ${actorId}
  `;
  const hasReverse = Number(reverseRows[0]?.c ?? 0) > 0;
  if (hasReverse) {
    await insertFriendship(actorId, targetId);
    await deleteRequestsBetween(actorId, targetId);
    return { ok: true, state: "connected" };
  }

  const existingOut = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM user_friend_requests WHERE from_user_id = ${actorId} AND to_user_id = ${targetId}
  `;
  if (Number(existingOut[0]?.c ?? 0) > 0) {
    return { ok: true, state: "pending" };
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO user_friend_requests (from_user_id, to_user_id) VALUES (${actorId}, ${targetId})
    `;
  } catch {
    return { ok: true, state: "pending" };
  }

  publishSupportChatEvent(
    { type: "friend_request_received", fromUserId: actorId, at: new Date().toISOString() },
    [targetId]
  );

  return { ok: true, state: "pending" };
}

export async function acceptFriendRequest(actorUserId: string | undefined, fromUserId?: string): Promise<{ ok: true }> {
  const actorId = requireUserId(actorUserId);
  const fromId = String(fromUserId ?? "").trim();
  if (!fromId) throw new ServiceError("ID lipsă.", 400);
  await ensureFriendshipTable();

  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM user_friend_requests WHERE from_user_id = ${fromId} AND to_user_id = ${actorId}
  `;
  if (Number(rows[0]?.c ?? 0) === 0) throw new ServiceError("Cererea nu există sau a expirat.", 404);

  const actor = await prisma.users.findUnique({ where: { Id: actorId }, select: { Role: true } });
  const fromU = await prisma.users.findUnique({ where: { Id: fromId }, select: { Role: true, IsActive: true } });
  if (!actor || !fromU?.IsActive) throw new ServiceError("Utilizator negăsit.", 404);
  if (!canFriendPair(actor.Role as UserRole, fromU.Role as UserRole)) {
    throw new ServiceError("Nu poți accepta această cerere.", 400);
  }

  await insertFriendship(actorId, fromId);
  await deleteRequestsBetween(actorId, fromId);

  return { ok: true };
}

export async function declineFriendRequest(actorUserId: string | undefined, fromUserId?: string): Promise<{ ok: true }> {
  const actorId = requireUserId(actorUserId);
  const fromId = String(fromUserId ?? "").trim();
  if (!fromId) throw new ServiceError("ID lipsă.", 400);
  await ensureFriendshipTable();
  await prisma.$executeRaw`
    DELETE FROM user_friend_requests WHERE from_user_id = ${fromId} AND to_user_id = ${actorId}
  `;
  return { ok: true };
}

export async function removeFriend(actorUserId: string | undefined, targetUserId?: string): Promise<{ ok: true }> {
  const actorId = requireUserId(actorUserId);
  const targetId = String(targetUserId ?? "").trim();
  if (!targetId) throw new ServiceError("ID lipsă.", 400);
  await ensureFriendshipTable();
  const [low, high] = pairOrdered(actorId, targetId);
  const { u, f } = await resolveFriendshipColumnNames();
  const qu = escapeSqlIdent(u);
  const qf = escapeSqlIdent(f);
  const sql = `DELETE FROM user_friendships WHERE ${qu} = ? AND ${qf} = ?`;
  await prisma.$executeRawUnsafe(sql, low, high);
  return { ok: true };
}
