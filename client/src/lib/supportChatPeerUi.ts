/** Shared UI helpers: peer vs support ticket, avatars (headset only for real support context). */

export const SUPPORT_AVATAR_URL = "/Illustration/SupportAvatar.png";
export const DEFAULT_AVATAR_URL = "/Illustration/AvatarWhiteGuy.png";

export type SupportChatPeerRow = {
  requesterUserId?: string;
  requesterEmail: string;
  requesterDisplayName?: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  acceptedByUserId?: string | null;
  acceptedByEmail?: string | null;
  acceptedByDisplayName?: string | null;
  acceptedByAvatar?: string | null;
  acceptedByRole?: string | null;
  status: string;
};

export function avatarSrc(url?: string | null): string | undefined {
  const s = String(url ?? "").trim();
  if (!s) return undefined;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return "/Illustration/AvatarWhiteGuy.png";
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return typeof window !== "undefined" ? `${window.location.origin}${s}` : s;
  if (s.startsWith("uploads/")) return typeof window !== "undefined" ? `${window.location.origin}/${s}` : `/${s}`;
  return s;
}

export function isSupportLikeRole(role?: string | null): boolean {
  const r = String(role ?? "").toLowerCase().trim();
  return r === "support" || r === "admin";
}

/** Ticket support (sau în așteptare agent), nu chat direct prieten–prieten (staff/customer). */
export function isSupportTicketChat(c: SupportChatPeerRow): boolean {
  if (!c.acceptedByUserId) return true;
  return isSupportLikeRole(c.requesterRole) || isSupportLikeRole(c.acceptedByRole);
}

export function peerSideForViewer(
  c: SupportChatPeerRow,
  myId: string
): "peer_is_accepted" | "peer_is_requester" | null {
  const my = String(myId).trim();
  const req = String(c.requesterUserId ?? "").trim();
  const acc = String(c.acceptedByUserId ?? "").trim();
  if (!my || !req) return null;
  if (my === req) return "peer_is_accepted";
  if (acc && my === acc) return "peer_is_requester";
  return null;
}

export function peerAvatarUrlForSidebar(c: SupportChatPeerRow, myId: string, viewerIsSupport: boolean): string {
  if (viewerIsSupport) {
    const url = avatarSrc(c.requesterAvatar);
    if (url) return url;
    return isSupportLikeRole(c.requesterRole) ? SUPPORT_AVATAR_URL : DEFAULT_AVATAR_URL;
  }
  const side = peerSideForViewer(c, myId);
  let raw: string | null | undefined;
  let roleForFallback: string | undefined;
  if (side === "peer_is_accepted") {
    raw = c.acceptedByAvatar ?? undefined;
    roleForFallback = c.acceptedByRole ?? undefined;
  } else if (side === "peer_is_requester") {
    raw = c.requesterAvatar ?? undefined;
    roleForFallback = c.requesterRole;
  } else {
    raw = c.acceptedByAvatar ?? undefined;
    roleForFallback = c.acceptedByRole ?? undefined;
  }
  const url = avatarSrc(raw);
  if (url) return url;
  return isSupportLikeRole(roleForFallback) ? SUPPORT_AVATAR_URL : DEFAULT_AVATAR_URL;
}

export function peerRoleLabelForSidebar(c: SupportChatPeerRow, myId: string, viewerIsSupport: boolean): string {
  if (viewerIsSupport) return c.requesterRole || "staff";
  const side = peerSideForViewer(c, myId);
  if (side === "peer_is_accepted") return c.acceptedByRole || "user";
  if (side === "peer_is_requester") return c.requesterRole || "staff";
  return c.acceptedByRole || c.requesterRole || "user";
}

function fallbackNameFromEmail(email: string | null | undefined): string {
  const raw = String(email ?? "").trim();
  if (!raw) return "Utilizator";
  const left = raw.split("@")[0] || raw;
  return left.replace(/[._-]+/g, " ").trim() || "Utilizator";
}

/** Numele afișat al celuilalt participant (același criteriu ca în header-ul chatului). */
export function peerDisplayNameForSidebar(c: SupportChatPeerRow, myId: string, viewerIsSupport: boolean): string {
  if (viewerIsSupport) {
    return (c.requesterDisplayName ?? "").trim() || fallbackNameFromEmail(c.requesterEmail);
  }
  const side = peerSideForViewer(c, myId);
  if (side === "peer_is_accepted") {
    return (c.acceptedByDisplayName ?? "").trim() || fallbackNameFromEmail(c.acceptedByEmail);
  }
  if (side === "peer_is_requester") {
    return (c.requesterDisplayName ?? "").trim() || fallbackNameFromEmail(c.requesterEmail);
  }
  return (
    (c.acceptedByDisplayName ?? "").trim() ||
    (c.requesterDisplayName ?? "").trim() ||
    fallbackNameFromEmail(c.acceptedByEmail) ||
    fallbackNameFromEmail(c.requesterEmail)
  );
}

/** Email-ul celuilalt participant (subtitlu / badge). */
export function peerPeerEmailForSidebar(c: SupportChatPeerRow, myId: string, viewerIsSupport: boolean): string {
  if (viewerIsSupport) return (c.requesterEmail ?? "").trim();
  const side = peerSideForViewer(c, myId);
  if (side === "peer_is_accepted") return (c.acceptedByEmail ?? c.requesterEmail ?? "").trim();
  if (side === "peer_is_requester") return (c.requesterEmail ?? c.acceptedByEmail ?? "").trim();
  return (c.acceptedByEmail ?? c.requesterEmail ?? "").trim();
}

function formatRoleLabelRo(role: string): string {
  const r = String(role ?? "").toLowerCase().trim();
  if (r === "customer") return "Client";
  if (r === "staff") return "Staff";
  if (r === "support") return "Support";
  if (r === "admin") return "Admin";
  if (r === "employee") return "Angajat";
  if (r === "business") return "Business";
  if (!r) return "Utilizator";
  return role;
}

/**
 * Linia secundară din listă: la chat prieten–prieten = email (nu rolul tehnic „customer”).
 * La ticket support = rol în română.
 */
export function peerSidebarBadgeText(c: SupportChatPeerRow, myId: string, viewerIsSupport: boolean): string {
  if (viewerIsSupport) {
    return formatRoleLabelRo(c.requesterRole || "staff");
  }
  if (isSupportTicketChat(c)) {
    const side = peerSideForViewer(c, myId);
    const raw =
      side === "peer_is_accepted"
        ? c.acceptedByRole
        : side === "peer_is_requester"
          ? c.requesterRole
          : c.acceptedByRole || c.requesterRole;
    return formatRoleLabelRo(String(raw ?? ""));
  }
  const email = peerPeerEmailForSidebar(c, myId, false);
  if (email) return email.length > 36 ? `${email.slice(0, 33)}…` : email;
  return formatRoleLabelRo(peerRoleLabelForSidebar(c, myId, viewerIsSupport));
}
