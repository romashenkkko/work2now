import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole, userRoleToString } from "../enums";
import { publishSupportChatEvent } from "./supportChatRealtimeService";

type ChatStatus = "open" | "accepted" | "closed";
type ChatPriority = "low" | "normal" | "high" | "urgent";
type EscalationLevel = "none" | "level_1" | "level_2" | "critical";

function normalizeStatus(raw: unknown): ChatStatus {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "accepted") return "accepted";
  if (s === "closed") return "closed";
  return "open";
}

function normalizePriority(raw: unknown): ChatPriority {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "low" || s === "high" || s === "urgent") return s;
  return "normal";
}

function normalizeEscalationLevel(raw: unknown): EscalationLevel {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "level_1" || s === "level_2" || s === "critical") return s;
  return "none";
}

async function getActor(userId?: string): Promise<{ id: string; email: string; role: string }> {
  const id = String(userId ?? "").trim();
  if (!id) throw new ServiceError("Unauthorized", 401);
  const user = await prisma.users.findUnique({ where: { Id: id }, select: { Email: true, Role: true } });
  if (!user) throw new ServiceError("Unauthorized", 401);
  return {
    id,
    email: user.Email ?? "",
    role: userRoleToString(user.Role as UserRole),
  };
}

function canModerate(role: string): boolean {
  return role === "support" || role === "admin";
}

function isOnlineByLastActive(lastActiveAt: unknown, isActive: unknown): boolean {
  if (isActive === false || Number(isActive) === 0) return false;
  if (!lastActiveAt) return false;
  const ts = new Date(String(lastActiveAt)).getTime();
  if (!Number.isFinite(ts)) return false;
  // If no heartbeat in last 90s, consider offline.
  return Date.now() - ts <= 90_000;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emailToName(email?: string | null): string {
  const raw = String(email ?? "").trim();
  if (!raw) return "User";
  const left = raw.split("@")[0] || raw;
  return left.replace(/[._-]+/g, " ").trim() || "User";
}

async function logSupportChatAudit(chatId: number, actor: { id: string; email: string }, eventType: string, details?: unknown) {
  const payload = details == null ? null : JSON.stringify(details);
  await prisma.$executeRaw`
    INSERT INTO support_chat_audit_logs (
      chat_id,
      actor_user_id,
      actor_email,
      event_type,
      details
    ) VALUES (
      ${chatId},
      ${actor.id},
      ${actor.email},
      ${eventType},
      ${payload}
    )
  `;
}

async function getChatById(chatId: number) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, requester_user_id, accepted_by_user_id, status, assigned_to_user_id
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function requestSupportChat(userId?: string, descriptionRaw?: unknown) {
  const actor = await getActor(userId);
  if (canModerate(actor.role)) {
    throw new ServiceError("Doar staff/customer poate crea solicitare support.", 403);
  }
  const description = String(descriptionRaw ?? "").trim().slice(0, 2000);
  if (description.length < 5) {
    throw new ServiceError("Descrierea este obligatorie (minim 5 caractere).", 400);
  }
  const existing = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM support_chats
    WHERE requester_user_id = ${actor.id}
      AND status IN ('open', 'accepted')
    ORDER BY id DESC
    LIMIT 1
  `;
  if (existing.length > 0) {
    const chatId = Number(existing[0].id);
    await prisma.$executeRaw`
      INSERT INTO support_chat_messages (
        chat_id,
        sender_user_id,
        sender_email,
        sender_role,
        message
      ) VALUES (
        ${chatId},
        ${actor.id},
        ${actor.email},
        ${actor.role},
        ${description}
      )
    `;
    await prisma.$executeRaw`
      UPDATE support_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ${chatId}
    `;
    await logSupportChatAudit(chatId, actor, "request_description", { reused: true });
    publishSupportChatEvent({ type: "chat_updated", chatId: String(existing[0].id), reason: "request" });
    return { ok: true as const, chatId: String(existing[0].id), reused: true };
  }

  await prisma.$executeRaw`
    INSERT INTO support_chats (
      requester_user_id,
      requester_email,
      requester_role,
      status
    ) VALUES (
      ${actor.id},
      ${actor.email},
      ${actor.role},
      ${"open"}
    )
  `;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() AS id`;
  const chatId = Number(rows[0]?.id ?? 0);
  if (chatId > 0) {
    await prisma.$executeRaw`
      INSERT INTO support_chat_messages (
        chat_id,
        sender_user_id,
        sender_email,
        sender_role,
        message
      ) VALUES (
        ${chatId},
        ${actor.id},
        ${actor.email},
        ${actor.role},
        ${description}
      )
    `;
    await logSupportChatAudit(chatId, actor, "request_description", { reused: false });
  }
  publishSupportChatEvent({ type: "chat_updated", chatId: String(rows[0]?.id ?? 0), reason: "request" });
  return { ok: true as const, chatId: String(rows[0]?.id ?? 0), reused: false };
}

export async function listMySupportChats(userId?: string) {
  const actor = await getActor(userId);
  const chats = canModerate(actor.role)
    ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id,
          requester_user_id,
          requester_email,
          requester_role,
          status,
          accepted_by_user_id,
          accepted_by_email,
          priority,
          assigned_to_user_id,
          assigned_to_email,
          reopened_count,
          escalation_level,
          escalated_at,
          last_seen_by_requester_at,
          last_seen_by_support_at,
          created_at,
          updated_at
        FROM support_chats
        WHERE (requester_user_id = ${actor.id} OR accepted_by_user_id = ${actor.id})
          AND deleted_by_support_at IS NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 100
      `
    : await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id,
          requester_user_id,
          requester_email,
          requester_role,
          status,
          accepted_by_user_id,
          accepted_by_email,
          priority,
          assigned_to_user_id,
          assigned_to_email,
          reopened_count,
          escalation_level,
          escalated_at,
          last_seen_by_requester_at,
          last_seen_by_support_at,
          created_at,
          updated_at
        FROM support_chats
        WHERE (requester_user_id = ${actor.id} OR accepted_by_user_id = ${actor.id})
          AND deleted_by_requester_at IS NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 100
      `;

  const chatIds = chats.map((c) => Number(c.id)).filter((v) => Number.isFinite(v));
  let messages: Array<Record<string, unknown>> = [];
  if (chatIds.length > 0) {
    const idList = chatIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0).join(",");
    messages = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, chat_id, sender_user_id, sender_email, sender_role, message, created_at
       FROM support_chat_messages
       WHERE chat_id IN (${idList})
       ORDER BY id ASC
       LIMIT 5000`
    );
  }
  const byChat: Record<string, Array<Record<string, unknown>>> = {};
  for (const m of messages) {
    const cid = String(m.chat_id ?? "");
    if (!byChat[cid]) byChat[cid] = [];
    byChat[cid].push(m);
  }
  const tagsByChat: Record<string, string[]> = {};
  if (chatIds.length > 0) {
    const idList = chatIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0).join(",");
    const tagRows = await prisma.$queryRawUnsafe<Array<{ chat_id: number; tag_name: string }>>(
      `SELECT m.chat_id, t.name AS tag_name
       FROM support_chat_tag_map m
       INNER JOIN support_chat_tags t ON t.id = m.tag_id
       WHERE m.chat_id IN (${idList})`
    );
    for (const r of tagRows) {
      const key = String(r.chat_id);
      if (!tagsByChat[key]) tagsByChat[key] = [];
      tagsByChat[key].push(String(r.tag_name ?? ""));
    }
  }

  const userIds = [...new Set(
    chats
      .flatMap((c) => [c.requester_user_id, c.accepted_by_user_id])
      .filter(Boolean)
      .map((id) => String(id))
  )];
  const onlineByUserId: Record<string, boolean> = {};
  const avatarByUserId: Record<string, string | null> = {};
  const displayNameByUserId: Record<string, string> = {};
  if (userIds.length > 0) {
    const users = await prisma.users.findMany({
      where: { Id: { in: userIds } },
      select: {
        Id: true,
        Email: true,
        Role: true,
        LastActiveAt: true,
        IsActive: true,
        Avatar: true,
        employee_profiles: { select: { Name: true, Surname: true, ProfilePictureFileId: true } },
        business_profiles: { select: { CompanyName: true } },
      },
    });
    for (const u of users) {
      onlineByUserId[u.Id] = isOnlineByLastActive(u.LastActiveAt, u.IsActive);
      avatarByUserId[u.Id] = u.Avatar ?? u.employee_profiles?.ProfilePictureFileId ?? null;
      const resolvedRole = userRoleToString(u.Role as UserRole);
      const employeeName = `${u.employee_profiles?.Name ?? ""} ${u.employee_profiles?.Surname ?? ""}`.trim();
      displayNameByUserId[u.Id] =
        resolvedRole === "support"
          ? "Support"
          : resolvedRole === "admin"
            ? "Admin"
            : (u.business_profiles?.CompanyName?.trim() || employeeName || emailToName(u.Email));
    }
    const lastByUserId = users.reduce((acc, u) => {
      acc[u.Id] = toIso(u.LastActiveAt);
      return acc;
    }, {} as Record<string, string | null>);
    return {
      chats: chats.map((c) => ({
        id: String(c.id ?? ""),
        requesterUserId: c.requester_user_id ? String(c.requester_user_id) : "",
        requesterEmail: c.requester_email ? String(c.requester_email) : "",
        requesterDisplayName: c.requester_user_id
          ? (displayNameByUserId[String(c.requester_user_id)] ?? emailToName(c.requester_email ? String(c.requester_email) : ""))
          : emailToName(c.requester_email ? String(c.requester_email) : ""),
        requesterRole: c.requester_role ? String(c.requester_role) : "unknown",
        requesterAvatar: c.requester_user_id ? (avatarByUserId[String(c.requester_user_id)] ?? null) : null,
        requesterOnline: c.requester_user_id ? !!onlineByUserId[String(c.requester_user_id)] : false,
        requesterLastActiveAt: c.requester_user_id ? (lastByUserId[String(c.requester_user_id)] ?? null) : null,
        status: normalizeStatus(c.status),
        priority: normalizePriority(c.priority),
        assignedToUserId: c.assigned_to_user_id ? String(c.assigned_to_user_id) : null,
        assignedToEmail: c.assigned_to_email ? String(c.assigned_to_email) : null,
        reopenedCount: Number(c.reopened_count ?? 0),
        escalationLevel: normalizeEscalationLevel(c.escalation_level),
        escalatedAt: c.escalated_at ? new Date(String(c.escalated_at)).toISOString() : null,
        tags: tagsByChat[String(c.id ?? "")] ?? [],
        lastSeenByRequesterAt: c.last_seen_by_requester_at ? new Date(String(c.last_seen_by_requester_at)).toISOString() : null,
        lastSeenBySupportAt: c.last_seen_by_support_at ? new Date(String(c.last_seen_by_support_at)).toISOString() : null,
        acceptedByUserId: c.accepted_by_user_id ? String(c.accepted_by_user_id) : null,
        acceptedByEmail: c.accepted_by_email ? String(c.accepted_by_email) : null,
        acceptedByDisplayName: c.accepted_by_user_id
          ? (displayNameByUserId[String(c.accepted_by_user_id)] ?? emailToName(c.accepted_by_email ? String(c.accepted_by_email) : ""))
          : (c.accepted_by_email ? emailToName(String(c.accepted_by_email)) : null),
        acceptedByAvatar: c.accepted_by_user_id ? (avatarByUserId[String(c.accepted_by_user_id)] ?? null) : null,
        acceptedByOnline: c.accepted_by_user_id ? !!onlineByUserId[String(c.accepted_by_user_id)] : false,
        acceptedByLastActiveAt: c.accepted_by_user_id ? (lastByUserId[String(c.accepted_by_user_id)] ?? null) : null,
        createdAt: c.created_at ? new Date(String(c.created_at)).toISOString() : null,
        updatedAt: c.updated_at ? new Date(String(c.updated_at)).toISOString() : null,
        messages: (byChat[String(c.id ?? "")] ?? []).map((m) => ({
          id: String(m.id ?? ""),
          chatId: String(m.chat_id ?? ""),
          senderUserId: m.sender_user_id ? String(m.sender_user_id) : null,
          senderEmail: m.sender_email ? String(m.sender_email) : "",
          senderRole: m.sender_role ? String(m.sender_role) : "unknown",
          message: String(m.message ?? ""),
          createdAt: m.created_at ? new Date(String(m.created_at)).toISOString() : null,
        })),
      })),
    };
  }
  return {
    chats: chats.map((c) => ({
      id: String(c.id ?? ""),
      requesterUserId: c.requester_user_id ? String(c.requester_user_id) : "",
      requesterEmail: c.requester_email ? String(c.requester_email) : "",
      requesterDisplayName: emailToName(c.requester_email ? String(c.requester_email) : ""),
      requesterRole: c.requester_role ? String(c.requester_role) : "unknown",
      requesterAvatar: null,
      requesterOnline: false,
      requesterLastActiveAt: null,
      status: normalizeStatus(c.status),
      priority: normalizePriority(c.priority),
      assignedToUserId: c.assigned_to_user_id ? String(c.assigned_to_user_id) : null,
      assignedToEmail: c.assigned_to_email ? String(c.assigned_to_email) : null,
      reopenedCount: Number(c.reopened_count ?? 0),
      escalationLevel: normalizeEscalationLevel(c.escalation_level),
      escalatedAt: c.escalated_at ? new Date(String(c.escalated_at)).toISOString() : null,
      tags: tagsByChat[String(c.id ?? "")] ?? [],
      lastSeenByRequesterAt: c.last_seen_by_requester_at ? new Date(String(c.last_seen_by_requester_at)).toISOString() : null,
      lastSeenBySupportAt: c.last_seen_by_support_at ? new Date(String(c.last_seen_by_support_at)).toISOString() : null,
      acceptedByUserId: c.accepted_by_user_id ? String(c.accepted_by_user_id) : null,
      acceptedByEmail: c.accepted_by_email ? String(c.accepted_by_email) : null,
      acceptedByDisplayName: c.accepted_by_email ? emailToName(String(c.accepted_by_email)) : null,
      acceptedByAvatar: null,
      acceptedByOnline: false,
      acceptedByLastActiveAt: null,
      createdAt: c.created_at ? new Date(String(c.created_at)).toISOString() : null,
      updatedAt: c.updated_at ? new Date(String(c.updated_at)).toISOString() : null,
      messages: (byChat[String(c.id ?? "")] ?? []).map((m) => ({
        id: String(m.id ?? ""),
        chatId: String(m.chat_id ?? ""),
        senderUserId: m.sender_user_id ? String(m.sender_user_id) : null,
        senderEmail: m.sender_email ? String(m.sender_email) : "",
        senderRole: m.sender_role ? String(m.sender_role) : "unknown",
        message: String(m.message ?? ""),
        createdAt: m.created_at ? new Date(String(m.created_at)).toISOString() : null,
      })),
    })),
  };
}

export async function listSupportInbox(userId?: string) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate vedea inbox-ul.", 403);
  const chats = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      id,
      requester_user_id,
      requester_email,
      requester_role,
      status,
      accepted_by_user_id,
      accepted_by_email,
      priority,
      assigned_to_user_id,
      assigned_to_email,
      reopened_count,
      escalation_level,
      escalated_at,
      last_seen_by_requester_at,
      last_seen_by_support_at,
      created_at,
      updated_at
    FROM support_chats
    WHERE status IN ('open', 'accepted')
      AND deleted_by_support_at IS NULL
    ORDER BY
      CASE WHEN status = 'open' THEN 0 ELSE 1 END,
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END,
      updated_at DESC
    LIMIT 200
  `;
  const tagsByChat: Record<string, string[]> = {};
  const inboxChatIds = chats.map((c) => Number(c.id)).filter((id) => Number.isFinite(id) && id > 0);
  if (inboxChatIds.length > 0) {
    const idList = inboxChatIds.join(",");
    const tagRows = await prisma.$queryRawUnsafe<Array<{ chat_id: number; tag_name: string }>>(
      `SELECT m.chat_id, t.name AS tag_name
       FROM support_chat_tag_map m
       INNER JOIN support_chat_tags t ON t.id = m.tag_id
       WHERE m.chat_id IN (${idList})`
    );
    for (const r of tagRows) {
      const key = String(r.chat_id);
      if (!tagsByChat[key]) tagsByChat[key] = [];
      tagsByChat[key].push(String(r.tag_name ?? ""));
    }
  }
  const userIds = [...new Set(
    chats
      .flatMap((c) => [c.requester_user_id, c.accepted_by_user_id])
      .filter(Boolean)
      .map((id) => String(id))
  )];
  const onlineByUserId: Record<string, boolean> = {};
  const avatarByUserId: Record<string, string | null> = {};
  const displayNameByUserId: Record<string, string> = {};
  if (userIds.length > 0) {
    const users = await prisma.users.findMany({
      where: { Id: { in: userIds } },
      select: {
        Id: true,
        Email: true,
        Role: true,
        LastActiveAt: true,
        IsActive: true,
        Avatar: true,
        employee_profiles: { select: { Name: true, Surname: true, ProfilePictureFileId: true } },
        business_profiles: { select: { CompanyName: true } },
      },
    });
    for (const u of users) {
      onlineByUserId[u.Id] = isOnlineByLastActive(u.LastActiveAt, u.IsActive);
      avatarByUserId[u.Id] = u.Avatar ?? u.employee_profiles?.ProfilePictureFileId ?? null;
      const resolvedRole = userRoleToString(u.Role as UserRole);
      const employeeName = `${u.employee_profiles?.Name ?? ""} ${u.employee_profiles?.Surname ?? ""}`.trim();
      displayNameByUserId[u.Id] =
        resolvedRole === "support"
          ? "Support"
          : resolvedRole === "admin"
            ? "Admin"
            : (u.business_profiles?.CompanyName?.trim() || employeeName || emailToName(u.Email));
    }
    const lastByUserId = users.reduce((acc, u) => {
      acc[u.Id] = toIso(u.LastActiveAt);
      return acc;
    }, {} as Record<string, string | null>);
    return {
      chats: chats.map((c) => ({
        id: String(c.id ?? ""),
        requesterUserId: c.requester_user_id ? String(c.requester_user_id) : "",
        requesterEmail: c.requester_email ? String(c.requester_email) : "",
        requesterDisplayName: c.requester_user_id
          ? (displayNameByUserId[String(c.requester_user_id)] ?? emailToName(c.requester_email ? String(c.requester_email) : ""))
          : emailToName(c.requester_email ? String(c.requester_email) : ""),
        requesterRole: c.requester_role ? String(c.requester_role) : "unknown",
        requesterAvatar: c.requester_user_id ? (avatarByUserId[String(c.requester_user_id)] ?? null) : null,
        requesterOnline: c.requester_user_id ? !!onlineByUserId[String(c.requester_user_id)] : false,
        requesterLastActiveAt: c.requester_user_id ? (lastByUserId[String(c.requester_user_id)] ?? null) : null,
        status: normalizeStatus(c.status),
        priority: normalizePriority(c.priority),
        assignedToUserId: c.assigned_to_user_id ? String(c.assigned_to_user_id) : null,
        assignedToEmail: c.assigned_to_email ? String(c.assigned_to_email) : null,
        reopenedCount: Number(c.reopened_count ?? 0),
        escalationLevel: normalizeEscalationLevel(c.escalation_level),
        escalatedAt: c.escalated_at ? new Date(String(c.escalated_at)).toISOString() : null,
        tags: tagsByChat[String(c.id ?? "")] ?? [],
        lastSeenByRequesterAt: c.last_seen_by_requester_at ? new Date(String(c.last_seen_by_requester_at)).toISOString() : null,
        lastSeenBySupportAt: c.last_seen_by_support_at ? new Date(String(c.last_seen_by_support_at)).toISOString() : null,
        acceptedByUserId: c.accepted_by_user_id ? String(c.accepted_by_user_id) : null,
        acceptedByEmail: c.accepted_by_email ? String(c.accepted_by_email) : null,
        acceptedByDisplayName: c.accepted_by_user_id
          ? (displayNameByUserId[String(c.accepted_by_user_id)] ?? emailToName(c.accepted_by_email ? String(c.accepted_by_email) : ""))
          : (c.accepted_by_email ? emailToName(String(c.accepted_by_email)) : null),
        acceptedByAvatar: c.accepted_by_user_id ? (avatarByUserId[String(c.accepted_by_user_id)] ?? null) : null,
        acceptedByOnline: c.accepted_by_user_id ? !!onlineByUserId[String(c.accepted_by_user_id)] : false,
        acceptedByLastActiveAt: c.accepted_by_user_id ? (lastByUserId[String(c.accepted_by_user_id)] ?? null) : null,
        createdAt: c.created_at ? new Date(String(c.created_at)).toISOString() : null,
        updatedAt: c.updated_at ? new Date(String(c.updated_at)).toISOString() : null,
      })),
    };
  }
  return {
    chats: chats.map((c) => ({
      id: String(c.id ?? ""),
      requesterUserId: c.requester_user_id ? String(c.requester_user_id) : "",
      requesterEmail: c.requester_email ? String(c.requester_email) : "",
      requesterDisplayName: emailToName(c.requester_email ? String(c.requester_email) : ""),
      requesterRole: c.requester_role ? String(c.requester_role) : "unknown",
      requesterAvatar: null,
      requesterOnline: false,
      requesterLastActiveAt: null,
      status: normalizeStatus(c.status),
      priority: normalizePriority(c.priority),
      assignedToUserId: c.assigned_to_user_id ? String(c.assigned_to_user_id) : null,
      assignedToEmail: c.assigned_to_email ? String(c.assigned_to_email) : null,
      reopenedCount: Number(c.reopened_count ?? 0),
      escalationLevel: normalizeEscalationLevel(c.escalation_level),
      escalatedAt: c.escalated_at ? new Date(String(c.escalated_at)).toISOString() : null,
      tags: tagsByChat[String(c.id ?? "")] ?? [],
      lastSeenByRequesterAt: c.last_seen_by_requester_at ? new Date(String(c.last_seen_by_requester_at)).toISOString() : null,
      lastSeenBySupportAt: c.last_seen_by_support_at ? new Date(String(c.last_seen_by_support_at)).toISOString() : null,
      acceptedByUserId: c.accepted_by_user_id ? String(c.accepted_by_user_id) : null,
      acceptedByEmail: c.accepted_by_email ? String(c.accepted_by_email) : null,
      acceptedByDisplayName: c.accepted_by_email ? emailToName(String(c.accepted_by_email)) : null,
      acceptedByAvatar: null,
      acceptedByOnline: false,
      acceptedByLastActiveAt: null,
      createdAt: c.created_at ? new Date(String(c.created_at)).toISOString() : null,
      updatedAt: c.updated_at ? new Date(String(c.updated_at)).toISOString() : null,
    })),
  };
}

export async function acceptSupportChat(userId: string | undefined, chatIdRaw: string | undefined) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate accepta chat.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, status, accepted_by_user_id
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  if (!rows.length) throw new ServiceError("Chat negăsit.", 404);
  const current = rows[0];
  const status = normalizeStatus(current.status);
  if (status === "closed") throw new ServiceError("Chat închis.", 400);
  const acceptedBy = current.accepted_by_user_id ? String(current.accepted_by_user_id) : "";
  if (acceptedBy && acceptedBy !== actor.id) {
    throw new ServiceError("Chatul a fost deja preluat de alt support.", 409);
  }

  await prisma.$executeRaw`
    UPDATE support_chats
    SET status = ${"accepted"},
        accepted_by_user_id = ${actor.id},
        accepted_by_email = ${actor.email},
        assigned_to_user_id = ${actor.id},
        assigned_to_email = ${actor.email},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "assigned", { assignedToUserId: actor.id });
  publishSupportChatEvent({ type: "assigned", chatId: String(chatId), assignedToUserId: actor.id, assignedToEmail: actor.email, at: new Date().toISOString() });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "accept" });
  return { ok: true as const };
}

export async function postSupportChatMessage(userId: string | undefined, chatIdRaw: string | undefined, messageRaw: unknown) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const message = String(messageRaw ?? "").trim().slice(0, 4000);
  if (!message) throw new ServiceError("Mesajul este obligatoriu.", 400);

  const chats = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, requester_user_id, accepted_by_user_id, status
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  if (!chats.length) throw new ServiceError("Chat negăsit.", 404);
  const chat = chats[0];
  const requesterId = chat.requester_user_id ? String(chat.requester_user_id) : "";
  const acceptedBy = chat.accepted_by_user_id ? String(chat.accepted_by_user_id) : "";
  const status = normalizeStatus(chat.status);
  if (status === "closed") throw new ServiceError("Chat închis.", 400);

  const isRequester = requesterId === actor.id;
  const isModerator = canModerate(actor.role);
  const isAssignedSupport = acceptedBy === actor.id || (!acceptedBy && isModerator);
  if (!isRequester && !isAssignedSupport) {
    throw new ServiceError("Nu ai acces la acest chat.", 403);
  }
  if (isRequester && status === "open" && !acceptedBy) {
    throw new ServiceError("Solicitarea este în așteptare. Poți scrie după ce un agent support acceptă chatul.", 400);
  }

  await prisma.$executeRaw`
    INSERT INTO support_chat_messages (
      chat_id,
      sender_user_id,
      sender_email,
      sender_role,
      message
    ) VALUES (
      ${chatId},
      ${actor.id},
      ${actor.email},
      ${actor.role},
      ${message}
    )
  `;
  const inserted = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() AS id`;
  const messageId = String(inserted[0]?.id ?? "");
  await prisma.$executeRaw`
    UPDATE support_chats
    SET updated_at = CURRENT_TIMESTAMP,
        first_response_at = CASE
          WHEN first_response_at IS NULL AND ${isModerator ? 1 : 0} = 1 THEN CURRENT_TIMESTAMP
          ELSE first_response_at
        END
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "message_posted");
  const deliveredAt = new Date().toISOString();
  const deliveredToUserId = isRequester ? acceptedBy : requesterId;
  if (messageId) {
    publishSupportChatEvent(
      {
        type: "delivered",
        chatId: String(chatId),
        messageId,
        deliveredToUserId,
        at: deliveredAt,
      },
      [actor.id]
    );
  }
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "message" });
  return { ok: true as const, messageId, deliveredAt };
}

export async function closeSupportChat(userId: string | undefined, chatIdRaw: string | undefined) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, requester_user_id, status
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  if (!rows.length) throw new ServiceError("Chat negăsit.", 404);
  const chat = rows[0];
  const requesterId = chat.requester_user_id ? String(chat.requester_user_id) : "";
  const isModerator = canModerate(actor.role);
  const isRequester = requesterId === actor.id;
  if (!isModerator && !isRequester) {
    throw new ServiceError("Nu ai acces la acest chat.", 403);
  }
  const reason = isModerator ? "closed_by_support" : "closed_by_requester";
  await prisma.$executeRaw`
    UPDATE support_chats
    SET status = ${"closed"},
        resolved_at = CURRENT_TIMESTAMP,
        closed_reason = ${reason},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "closed", { reason });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "close" });
  return { ok: true as const };
}

export async function deleteSupportChatForActor(userId: string | undefined, chatIdRaw: string | undefined) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, requester_user_id
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  if (!rows.length) throw new ServiceError("Chat negăsit.", 404);
  const chat = rows[0];
  const requesterId = chat.requester_user_id ? String(chat.requester_user_id) : "";
  const isModerator = canModerate(actor.role);
  const isRequester = requesterId === actor.id;
  if (!isModerator && !isRequester) throw new ServiceError("Nu ai acces la acest chat.", 403);
  const column = isModerator ? "deleted_by_support_at" : "deleted_by_requester_at";
  await prisma.$executeRawUnsafe(`UPDATE support_chats SET ${column} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, chatId);
  await logSupportChatAudit(chatId, actor, "deleted_for_actor", { scope: isModerator ? "support" : "requester" });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "deleted" });
  return { ok: true as const };
}

export async function setSupportChatTyping(
  userId: string | undefined,
  chatIdRaw: string | undefined,
  isTypingRaw: unknown
) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const isTyping = !!isTypingRaw;
  publishSupportChatEvent({
    type: "typing",
    chatId: String(chatId),
    userId: actor.id,
    isTyping,
    at: new Date().toISOString(),
  });
  return { ok: true as const };
}

export async function markSupportChatSeen(userId: string | undefined, chatIdRaw: string | undefined) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, requester_user_id, accepted_by_user_id
    FROM support_chats
    WHERE id = ${chatId}
    LIMIT 1
  `;
  if (!rows.length) throw new ServiceError("Chat negăsit.", 404);
  const chat = rows[0];
  const requesterId = chat.requester_user_id ? String(chat.requester_user_id) : "";
  const acceptedById = chat.accepted_by_user_id ? String(chat.accepted_by_user_id) : "";
  let seenColumn: "last_seen_by_requester_at" | "last_seen_by_support_at" = "last_seen_by_requester_at";
  if (actor.id === requesterId) {
    seenColumn = "last_seen_by_requester_at";
  } else if (canModerate(actor.role) && (!acceptedById || acceptedById === actor.id)) {
    seenColumn = "last_seen_by_support_at";
  } else {
    throw new ServiceError("Nu ai acces la acest chat.", 403);
  }
  await prisma.$executeRawUnsafe(
    `UPDATE support_chats SET ${seenColumn} = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ?`,
    chatId
  );
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "seen" });
  return { ok: true as const, seenByUserId: actor.id, seenAt: new Date().toISOString() };
}

export async function setSupportChatPriority(userId: string | undefined, chatIdRaw: string | undefined, priorityRaw: unknown) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate seta prioritatea.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const priority = normalizePriority(priorityRaw);
  await prisma.$executeRaw`
    UPDATE support_chats SET priority = ${priority}, updated_at = CURRENT_TIMESTAMP WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "priority_changed", { priority });
  publishSupportChatEvent({ type: "priority_changed", chatId: String(chatId), priority, at: new Date().toISOString() });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "message" });
  return { ok: true as const, priority };
}

export async function assignSupportChat(userId: string | undefined, chatIdRaw: string | undefined, targetUserIdRaw: unknown) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate asigna chat.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const targetUserId = String(targetUserIdRaw ?? "").trim();
  if (!targetUserId) throw new ServiceError("Utilizator țintă invalid.", 400);
  const target = await prisma.users.findUnique({ where: { Id: targetUserId }, select: { Email: true, Role: true } });
  if (!target) throw new ServiceError("Utilizator negăsit.", 404);
  const role = userRoleToString(target.Role as UserRole);
  if (!canModerate(role)) throw new ServiceError("Chatul poate fi asignat doar support/admin.", 400);
  const targetEmail = String(target.Email ?? "");
  await prisma.$executeRaw`
    UPDATE support_chats
    SET assigned_to_user_id = ${targetUserId},
        assigned_to_email = ${targetEmail},
        accepted_by_user_id = COALESCE(accepted_by_user_id, ${targetUserId}),
        accepted_by_email = COALESCE(accepted_by_email, ${targetEmail}),
        status = CASE WHEN status = 'open' THEN 'accepted' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "assigned", { assignedToUserId: targetUserId, assignedToEmail: targetEmail });
  publishSupportChatEvent({ type: "assigned", chatId: String(chatId), assignedToUserId: targetUserId, assignedToEmail: targetEmail, at: new Date().toISOString() });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "accept" });
  return { ok: true as const, assignedToUserId: targetUserId, assignedToEmail: targetEmail };
}

export async function reassignSupportChat(
  userId: string | undefined,
  chatIdRaw: string | undefined,
  targetUserIdRaw: unknown,
  reasonRaw: unknown
) {
  const result = await assignSupportChat(userId, chatIdRaw, targetUserIdRaw);
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  const reason = String(reasonRaw ?? "").trim();
  await logSupportChatAudit(chatId, actor, "reassigned", { reason, assignedToUserId: result.assignedToUserId });
  publishSupportChatEvent({
    type: "reassigned",
    chatId: String(chatId),
    assignedToUserId: result.assignedToUserId,
    assignedToEmail: result.assignedToEmail,
    reason,
    at: new Date().toISOString(),
  });
  return { ...result, reason };
}

export async function reopenSupportChat(userId: string | undefined, chatIdRaw: string | undefined, reasonRaw: unknown) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate redeschide chat.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const reason = String(reasonRaw ?? "").trim().slice(0, 255);
  const chat = await getChatById(chatId);
  if (!chat) throw new ServiceError("Chat negăsit.", 404);
  if (normalizeStatus(chat.status) !== "closed") throw new ServiceError("Doar chaturile închise pot fi redeschise.", 400);
  await prisma.$executeRaw`
    UPDATE support_chats
    SET status = ${"open"},
        reopened_count = COALESCE(reopened_count, 0) + 1,
        last_reopened_at = CURRENT_TIMESTAMP,
        last_reopen_reason = ${reason || null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "reopened", { reason });
  publishSupportChatEvent({ type: "reopened", chatId: String(chatId), reason, at: new Date().toISOString() });
  publishSupportChatEvent({ type: "chat_updated", chatId: String(chatId), reason: "request" });
  return { ok: true as const };
}

export async function setSupportChatTags(userId: string | undefined, chatIdRaw: string | undefined, tagsRaw: unknown) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate edita tagurile.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const tags = Array.from(new Set((Array.isArray(tagsRaw) ? tagsRaw : []).map((t) => String(t ?? "").trim().toLowerCase()).filter(Boolean))).slice(0, 20);
  await prisma.$executeRaw`DELETE FROM support_chat_tag_map WHERE chat_id = ${chatId}`;
  for (const name of tags) {
    await prisma.$executeRaw`
      INSERT INTO support_chat_tags (name) VALUES (${name})
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `;
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM support_chat_tags WHERE name = ${name} LIMIT 1`;
    const tagId = Number(rows[0]?.id ?? 0);
    if (tagId > 0) {
      await prisma.$executeRaw`
        INSERT INTO support_chat_tag_map (chat_id, tag_id, created_by_user_id)
        VALUES (${chatId}, ${tagId}, ${actor.id})
      `;
    }
  }
  await logSupportChatAudit(chatId, actor, "tags_changed", { tags });
  publishSupportChatEvent({ type: "tags_changed", chatId: String(chatId), tags, at: new Date().toISOString() });
  return { ok: true as const, tags };
}

export async function listSupportChatTags(userId: string | undefined) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate vedea tagurile.", 403);
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM support_chat_tags ORDER BY name ASC LIMIT 500
  `;
  return { tags: rows.map((r) => String(r.name ?? "")).filter(Boolean) };
}

export async function listSupportChatMacros(userId: string | undefined) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate vedea macro-urile.", 403);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, title, content, is_active, created_at, updated_at
    FROM support_chat_macros
    ORDER BY updated_at DESC, id DESC
    LIMIT 500
  `;
  return {
    macros: rows.map((m) => ({
      id: Number(m.id ?? 0),
      title: String(m.title ?? ""),
      content: String(m.content ?? ""),
      isActive: Number(m.is_active ?? 1) === 1,
      createdAt: m.created_at ? new Date(String(m.created_at)).toISOString() : null,
      updatedAt: m.updated_at ? new Date(String(m.updated_at)).toISOString() : null,
    })),
  };
}

export async function saveSupportChatMacro(userId: string | undefined, payload: { id?: unknown; title?: unknown; content?: unknown; isActive?: unknown }) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate salva macro-uri.", 403);
  const id = Number(payload.id);
  const title = String(payload.title ?? "").trim().slice(0, 120);
  const content = String(payload.content ?? "").trim().slice(0, 4000);
  const isActive = payload.isActive == null ? true : !!payload.isActive;
  if (!title || !content) throw new ServiceError("Titlu și conținut obligatorii.", 400);
  if (Number.isFinite(id) && id > 0) {
    await prisma.$executeRaw`
      UPDATE support_chat_macros
      SET title = ${title}, content = ${content}, is_active = ${isActive ? 1 : 0}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    return { ok: true as const, id };
  }
  await prisma.$executeRaw`
    INSERT INTO support_chat_macros (title, content, created_by_user_id, is_active)
    VALUES (${title}, ${content}, ${actor.id}, ${isActive ? 1 : 0})
  `;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() AS id`;
  return { ok: true as const, id: Number(rows[0]?.id ?? 0) };
}

export async function deleteSupportChatMacro(userId: string | undefined, macroIdRaw: string | undefined) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate șterge macro-uri.", 403);
  const macroId = Number(macroIdRaw);
  if (!Number.isFinite(macroId) || macroId <= 0) throw new ServiceError("Macro invalid.", 400);
  await prisma.$executeRaw`DELETE FROM support_chat_macros WHERE id = ${macroId}`;
  return { ok: true as const };
}

export async function setSupportChatReminder(
  userId: string | undefined,
  chatIdRaw: string | undefined,
  dueAtRaw: unknown,
  noteRaw: unknown
) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate seta reminder.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const dueAt = new Date(String(dueAtRaw ?? ""));
  if (!Number.isFinite(dueAt.getTime())) throw new ServiceError("Data reminder invalidă.", 400);
  const note = String(noteRaw ?? "").trim().slice(0, 255);
  await prisma.$executeRaw`
    INSERT INTO support_chat_reminders (chat_id, assigned_to_user_id, note, due_at)
    VALUES (${chatId}, ${actor.id}, ${note || null}, ${dueAt.toISOString()})
  `;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() AS id`;
  const reminderId = Number(rows[0]?.id ?? 0);
  await logSupportChatAudit(chatId, actor, "reminder_set", { reminderId, dueAt: dueAt.toISOString(), note });
  publishSupportChatEvent({ type: "reminder_due", chatId: String(chatId), reminderId, dueAt: dueAt.toISOString(), at: new Date().toISOString() });
  return { ok: true as const, reminderId };
}

export async function resolveSupportChatReminder(userId: string | undefined, reminderIdRaw: string | undefined) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate rezolva reminder.", 403);
  const reminderId = Number(reminderIdRaw);
  if (!Number.isFinite(reminderId) || reminderId <= 0) throw new ServiceError("Reminder invalid.", 400);
  const rows = await prisma.$queryRaw<Array<{ chat_id: number }>>`
    SELECT chat_id FROM support_chat_reminders WHERE id = ${reminderId} LIMIT 1
  `;
  if (!rows.length) throw new ServiceError("Reminder negăsit.", 404);
  const chatId = Number(rows[0].chat_id);
  await prisma.$executeRaw`
    UPDATE support_chat_reminders SET resolved_at = CURRENT_TIMESTAMP WHERE id = ${reminderId}
  `;
  await logSupportChatAudit(chatId, actor, "reminder_resolved", { reminderId });
  return { ok: true as const };
}

export async function escalateSupportChat(userId: string | undefined, chatIdRaw: string | undefined, levelRaw: unknown, noteRaw: unknown) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate escalada.", 403);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const level = normalizeEscalationLevel(levelRaw);
  const note = String(noteRaw ?? "").trim().slice(0, 255);
  await prisma.$executeRaw`
    UPDATE support_chats
    SET escalation_level = ${level},
        escalated_at = CASE WHEN ${level} = 'none' THEN NULL ELSE CURRENT_TIMESTAMP END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${chatId}
  `;
  await logSupportChatAudit(chatId, actor, "escalated", { level, note });
  publishSupportChatEvent({ type: "escalated", chatId: String(chatId), level, note, at: new Date().toISOString() });
  return { ok: true as const, level };
}

export async function submitSupportChatCsat(userId: string | undefined, chatIdRaw: string | undefined, ratingRaw: unknown, commentRaw: unknown) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  const rating = Number(ratingRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new ServiceError("Rating invalid.", 400);
  const comment = String(commentRaw ?? "").trim().slice(0, 500);
  await prisma.$executeRaw`
    INSERT INTO support_chat_csat (chat_id, rating, comment, created_by_user_id)
    VALUES (${chatId}, ${rating}, ${comment || null}, ${actor.id})
    ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_by_user_id = VALUES(created_by_user_id), created_at = CURRENT_TIMESTAMP
  `;
  await logSupportChatAudit(chatId, actor, "csat_submitted", { rating });
  publishSupportChatEvent({ type: "csat_submitted", chatId: String(chatId), rating, at: new Date().toISOString() });
  return { ok: true as const };
}

export async function getSupportChatTimeline(userId: string | undefined, chatIdRaw: string | undefined) {
  const actor = await getActor(userId);
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId) || chatId <= 0) throw new ServiceError("Chat invalid.", 400);
  const chat = await getChatById(chatId);
  if (!chat) throw new ServiceError("Chat negăsit.", 404);
  const requesterId = String(chat.requester_user_id ?? "");
  if (!canModerate(actor.role) && actor.id !== requesterId) throw new ServiceError("Nu ai acces la timeline.", 403);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, event_type, actor_user_id, actor_email, details, created_at
    FROM support_chat_audit_logs
    WHERE chat_id = ${chatId}
    ORDER BY id DESC
    LIMIT 200
  `;
  return {
    events: rows.map((r) => ({
      id: Number(r.id ?? 0),
      eventType: String(r.event_type ?? ""),
      actorUserId: r.actor_user_id ? String(r.actor_user_id) : null,
      actorEmail: r.actor_email ? String(r.actor_email) : null,
      details: r.details ? (() => { try { return JSON.parse(String(r.details)); } catch { return String(r.details); } })() : null,
      createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : null,
    })),
  };
}

export async function bulkSupportChatUpdate(
  userId: string | undefined,
  payload: { chatIds?: unknown; operation?: unknown; value?: unknown }
) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate face bulk update.", 403);
  const chatIds = (Array.isArray(payload.chatIds) ? payload.chatIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0).slice(0, 200);
  const operation = String(payload.operation ?? "").trim();
  if (!chatIds.length) throw new ServiceError("Nicio conversație selectată.", 400);
  if (!operation) throw new ServiceError("Operație invalidă.", 400);
  const idList = chatIds.join(",");
  if (operation === "close") {
    await prisma.$executeRawUnsafe(`UPDATE support_chats SET status = 'closed', resolved_at = CURRENT_TIMESTAMP WHERE id IN (${idList})`);
  } else if (operation === "reopen") {
    await prisma.$executeRawUnsafe(`UPDATE support_chats SET status = 'open', reopened_count = COALESCE(reopened_count, 0) + 1 WHERE id IN (${idList})`);
  } else if (operation === "priority") {
    const priority = normalizePriority(payload.value);
    await prisma.$executeRawUnsafe(`UPDATE support_chats SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${idList})`, priority);
  } else {
    throw new ServiceError("Operație bulk neacceptată.", 400);
  }
  for (const chatId of chatIds) {
    await logSupportChatAudit(chatId, actor, "bulk_updated", { operation, value: payload.value ?? null });
  }
  publishSupportChatEvent({ type: "bulk_updated", chatIds: chatIds.map(String), operation, at: new Date().toISOString() });
  return { ok: true as const, updatedCount: chatIds.length };
}

export async function getSupportChatMetrics(userId?: string) {
  const actor = await getActor(userId);
  if (!canModerate(actor.role)) throw new ServiceError("Doar support/admin poate vedea metricile.", 403);

  const SLA_MINUTES = 15;
  const now = Date.now();

  const chats = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      c.id,
      c.status,
      c.created_at,
      c.updated_at,
      c.accepted_by_email,
      c.reopened_count,
      c.escalation_level,
      c.priority,
      (
        SELECT m.sender_email
        FROM support_chat_messages m
        WHERE m.chat_id = c.id
        ORDER BY m.id DESC
        LIMIT 1
      ) AS last_sender_email
    FROM support_chats c
    ORDER BY c.id DESC
    LIMIT 2000
  `;

  const firstResponseRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      c.id,
      c.created_at,
      (
        SELECT m.created_at
        FROM support_chat_messages m
        WHERE m.chat_id = c.id
          AND LOWER(TRIM(m.sender_role)) IN ('support', 'admin')
        ORDER BY m.id ASC
        LIMIT 1
      ) AS first_support_at
    FROM support_chats c
    ORDER BY c.id DESC
    LIMIT 2000
  `;

  const closedBySupport = await prisma.$queryRaw<Array<{ support_email: string | null; closed_count: number }>>`
    SELECT
      accepted_by_email AS support_email,
      COUNT(*) AS closed_count
    FROM support_chats
    WHERE status = 'closed'
      AND accepted_by_email IS NOT NULL
    GROUP BY accepted_by_email
    ORDER BY closed_count DESC
    LIMIT 5
  `;
  const csatRows = await prisma.$queryRaw<Array<{ avg_rating: number | null; responses: number }>>`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS responses
    FROM support_chat_csat
  `;
  const reassignedRows = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT COUNT(*) AS cnt
    FROM support_chat_audit_logs
    WHERE event_type = 'reassigned'
  `;

  let openCount = 0;
  let acceptedCount = 0;
  let closedCount = 0;
  let waitingUserCount = 0;
  let waitingSupportCount = 0;
  let slaBreachedCount = 0;
  let resolutionSumMs = 0;
  let resolutionCount = 0;
  let reopenedChats = 0;
  let escalatedCount = 0;
  let highPriorityOpenCount = 0;

  for (const c of chats) {
    const status = normalizeStatus(c.status);
    const createdTs = new Date(String(c.created_at ?? "")).getTime();
    const updatedTs = new Date(String(c.updated_at ?? "")).getTime();
    const acceptedByEmail = String(c.accepted_by_email ?? "").trim().toLowerCase();
    const lastSenderEmail = String(c.last_sender_email ?? "").trim().toLowerCase();
    const reopenedCount = Number(c.reopened_count ?? 0);
    const escalationLevel = normalizeEscalationLevel(c.escalation_level);
    const priority = normalizePriority(c.priority);

    if (status === "open") openCount += 1;
    if (status === "accepted") acceptedCount += 1;
    if (status === "closed") closedCount += 1;
    if (reopenedCount > 0) reopenedChats += 1;
    if (escalationLevel !== "none") escalatedCount += 1;
    if ((status === "open" || status === "accepted") && (priority === "high" || priority === "urgent")) highPriorityOpenCount += 1;

    if (status === "accepted" || status === "open") {
      if (updatedTs > 0 && now - updatedTs > SLA_MINUTES * 60_000) {
        slaBreachedCount += 1;
      }
      if (!lastSenderEmail) {
        waitingSupportCount += 1;
      } else if (acceptedByEmail && lastSenderEmail === acceptedByEmail) {
        waitingUserCount += 1;
      } else {
        waitingSupportCount += 1;
      }
    }

    if (status === "closed" && createdTs > 0 && updatedTs > createdTs) {
      resolutionSumMs += updatedTs - createdTs;
      resolutionCount += 1;
    }
  }

  let firstResponseSumMs = 0;
  let firstResponseCount = 0;
  for (const r of firstResponseRows) {
    const createdTs = new Date(String(r.created_at ?? "")).getTime();
    const firstSupportTs = new Date(String(r.first_support_at ?? "")).getTime();
    if (createdTs > 0 && Number.isFinite(firstSupportTs) && firstSupportTs > createdTs) {
      firstResponseSumMs += firstSupportTs - createdTs;
      firstResponseCount += 1;
    }
  }

  const firstResponseAvgMinutes =
    firstResponseCount > 0 ? Number((firstResponseSumMs / firstResponseCount / 60_000).toFixed(1)) : 0;
  const resolutionAvgMinutes =
    resolutionCount > 0 ? Number((resolutionSumMs / resolutionCount / 60_000).toFixed(1)) : 0;
  const csatAvg = Number(csatRows[0]?.avg_rating ?? 0);
  const csatResponses = Number(csatRows[0]?.responses ?? 0);
  const reassignedCount = Number(reassignedRows[0]?.cnt ?? 0);
  const reopenRate = closedCount > 0 ? Number(((reopenedChats / closedCount) * 100).toFixed(1)) : 0;

  return {
    kpi: {
      openCount,
      acceptedCount,
      closedCount,
      waitingUserCount,
      waitingSupportCount,
      slaBreachedCount,
      firstResponseAvgMinutes,
      resolutionAvgMinutes,
      reopenRate,
      csatAvg: Number.isFinite(csatAvg) ? Number(csatAvg.toFixed(2)) : 0,
      csatResponses,
      escalatedCount,
      reassignedCount,
      highPriorityOpenCount,
    },
    topAgents: closedBySupport.map((r) => ({
      supportEmail: String(r.support_email ?? ""),
      closedCount: Number(r.closed_count ?? 0),
    })),
    slaMinutes: SLA_MINUTES,
  };
}

