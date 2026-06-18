import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VoiceCallOverlay } from "../components/VoiceCallOverlay";
import { useVoiceCall } from "../hooks/useVoiceCall";
import { Link } from "react-router-dom";
import {
  Bell,
  Check,
  Copy,
  ChevronDown,
  Headphones,
  Inbox,
  MessageCircle,
  Paperclip,
  Phone,
  Search,
  Send,
  Moon,
  Settings,
  Smile,
  Sun,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from "lucide-react";
import { authApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useDashboardTheme } from "../context/DashboardThemeContext";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "../lib/copyToClipboard";
import {
  CHAT_SOUND_SETTINGS_CHANGED,
  isChatMessageSoundEnabled,
  maybePlayIncomingMessageSound,
} from "../lib/playChatSounds";
import {
  DEFAULT_AVATAR_URL,
  SUPPORT_AVATAR_URL,
  avatarSrc,
  isSupportTicketChat,
  peerAvatarUrlForSidebar,
  peerDisplayNameForSidebar,
  peerRoleLabelForSidebar,
  peerSidebarBadgeText,
  peerSideForViewer,
} from "../lib/supportChatPeerUi";

type ChatStatus = "open" | "accepted" | "closed";
type ChatPriority = "low" | "normal" | "high" | "urgent";
type EscalationLevel = "none" | "level_1" | "level_2" | "critical";
type ChatMessage = {
  id: string;
  /** Preferat pentru „mesajul meu” (aliniat cu serverul); fallback la senderEmail dacă lipsește. */
  senderUserId?: string | null;
  senderRole: string;
  senderEmail: string;
  message: string;
  createdAt: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
};
type ChatItem = {
  id: string;
  requesterUserId?: string;
  requesterEmail: string;
  requesterDisplayName?: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  requesterOnline?: boolean;
  requesterLastActiveAt?: string | null;
  status: ChatStatus;
  priority?: ChatPriority;
  assignedToUserId?: string | null;
  assignedToEmail?: string | null;
  reopenedCount?: number;
  escalationLevel?: EscalationLevel;
  escalatedAt?: string | null;
  acceptedByUserId?: string | null;
  /** Rolul utilizatorului din accepted_by (din profil), pentru UI corect (avatar support doar la support). */
  acceptedByRole?: string | null;
  acceptedByEmail?: string | null;
  acceptedByDisplayName?: string | null;
  acceptedByAvatar?: string | null;
  acceptedByOnline?: boolean;
  acceptedByLastActiveAt?: string | null;
  updatedAt?: string | null;
  messages?: ChatMessage[];
  lastSeenByRequesterAt?: string | null;
  lastSeenBySupportAt?: string | null;
};

function messageIsMine(
  m: Pick<ChatMessage, "senderUserId" | "senderEmail">,
  user: { id?: string | number; email?: string } | null | undefined
): boolean {
  const uid = String(user?.id ?? "").trim().toLowerCase();
  const sid = String(m.senderUserId ?? "").trim().toLowerCase();
  if (uid && sid && sid === uid) return true;
  if (!sid) {
    const a = String(m.senderEmail ?? "").toLowerCase().trim();
    const b = String(user?.email ?? "").toLowerCase().trim();
    return a !== "" && a === b;
  }
  return false;
}

/** Inbox API nu trimite mesaje; același chat poate fi și în „mesajele mele” cu istoric — păstrăm copia cu mai multe mesaje pentru badge. */
function mergeChatsPreferringMoreMessages(lists: ChatItem[][]): ChatItem[] {
  const byId = new Map<string, ChatItem>();
  for (const list of lists) {
    for (const c of list) {
      const prev = byId.get(c.id);
      if (!prev) {
        byId.set(c.id, c);
        continue;
      }
      const lenP = prev.messages?.length ?? 0;
      const lenC = c.messages?.length ?? 0;
      if (lenC > lenP) byId.set(c.id, c);
    }
  }
  return [...byId.values()];
}

/**
 * Coloana „ultima citire” pentru viewer (aceeași logică ca markSupportChat pe server).
 * În chat prieten: requester → lastSeenByRequesterAt, peer accepted → lastSeenBySupportAt.
 * Fără asta, un staff (rol „staff”) folosea doar coloana requester-ului și badge-ul dispărea la refresh.
 */
function lastSeenIsoForViewer(c: ChatItem, myUserId: string, isSupportModerator: boolean): string | null {
  const me = String(myUserId ?? "").trim();
  const req = String(c.requesterUserId ?? "").trim();
  const acc = c.acceptedByUserId ? String(c.acceptedByUserId).trim() : "";
  if (me && req === me) return c.lastSeenByRequesterAt ?? null;
  if (me && acc && acc === me) return c.lastSeenBySupportAt ?? null;
  if (isSupportModerator && (!acc || acc === me)) return c.lastSeenBySupportAt ?? null;
  return c.lastSeenByRequesterAt ?? null;
}

function nameFromEmail(email?: string | null): string {
  const raw = String(email ?? "").trim();
  if (!raw) return "User";
  const left = raw.split("@")[0] || raw;
  return left.replace(/[._-]+/g, " ").trim() || "User";
}

function chatConnectsPeer(chat: ChatItem, myUserId: string, peerId: string): boolean {
  const req = String(chat.requesterUserId ?? "").trim();
  const acc = String(chat.acceptedByUserId ?? "").trim();
  if (!req || !acc) return false;
  const my = String(myUserId).trim();
  return (req === peerId && acc === my) || (acc === peerId && req === my);
}

/** Emoji-uri în picker: imagini Noto (Google Fonts); în mesaj se inserează `char` (Unicode). Adaugă rânduri cu codepoint-ul din URL. */
type ChatPickerEmoji = {
  /** Segment din URL Noto, ex. "1f600" → …/latest/1f600/512.webp */
  codepoint: string;
  /** Caracterul inserat în câmpul de mesaj (același ca în alt pe imagine). */
  char: string;
};

const NOTO_EMOJI_BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest";

function notoEmojiSrc(codepoint: string, kind: "webp" | "gif"): string {
  return `${NOTO_EMOJI_BASE}/${codepoint}/512.${kind}`;
}

const CHAT_CUSTOM_EMOJIS: ChatPickerEmoji[] = [
  { codepoint: "1f600", char: "😀" },
  { codepoint: "1f603", char: "😃" },
  { codepoint: "1f604", char: "😄" },
  { codepoint: "1f601", char: "😁" },
  { codepoint: "1f606", char: "😆" },
  { codepoint: "1f605", char: "😅" },
  { codepoint: "1f602", char: "😂" },
  { codepoint: "1f923", char: "🤣" },
  { codepoint: "1f62d", char: "😭" },
  { codepoint: "1f609", char: "😉" },
];

const EMOJI_CHAR_TO_NOTO_CODE = new Map(CHAT_CUSTOM_EMOJIS.map((e) => [e.char, e.codepoint]));

/** În bule: emoji din listă → GIF Noto animat; restul rămân caractere normale. */
function renderMessageWithNotoEmojis(text: string, keyPrefix: string): ReactNode {
  const parts: ReactNode[] = [];
  let run = "";
  let seg = 0;
  const flush = () => {
    if (run.length) {
      parts.push(
        <span key={`${keyPrefix}-s-${seg++}`} className="inline">
          {run}
        </span>
      );
      run = "";
    }
  };
  for (const ch of text) {
    const codepoint = EMOJI_CHAR_TO_NOTO_CODE.get(ch);
    if (codepoint) {
      flush();
      parts.push(
        <img
          key={`${keyPrefix}-e-${seg++}`}
          src={notoEmojiSrc(codepoint, "gif")}
          alt={ch}
          className="inline-block h-[1.35em] w-[1.35em] max-h-[22px] max-w-[22px] align-[-0.2em] object-contain [image-rendering:auto]"
          loading="lazy"
          draggable={false}
        />
      );
    } else {
      run += ch;
    }
  }
  flush();
  return parts.length > 0 ? <>{parts}</> : null;
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "acum";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "acum";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "acum";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `acum ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.floor(h / 24);
  return `acum ${d} z`;
}

function ChatThemeSwitch({
  isDark,
  onToggle,
  lightLabel,
  darkLabel,
}: {
  isDark: boolean;
  onToggle: () => void;
  lightLabel: string;
  darkLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? darkLabel : lightLabel}
      title={isDark ? lightLabel : darkLabel}
      onClick={onToggle}
      className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border p-0.5 shadow-sm transition-colors duration-200 ${
        isDark
          ? "border-slate-600 bg-slate-800/90"
          : "border-slate-200/90 bg-white/95"
      }`}
    >
      <Sun
        className={`pointer-events-none absolute left-1.5 h-3.5 w-3.5 transition-opacity ${
          isDark ? "text-slate-500 opacity-35" : "text-amber-500 opacity-100"
        }`}
        aria-hidden
      />
      <Moon
        className={`pointer-events-none absolute right-1.5 h-3.5 w-3.5 transition-opacity ${
          isDark ? "text-violet-300 opacity-100" : "text-slate-400 opacity-35"
        }`}
        aria-hidden
      />
      <span
        className={`pointer-events-none h-6 w-6 rounded-full shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-out ${
          isDark ? "translate-x-[22px] bg-slate-700" : "translate-x-0 bg-white"
        }`}
      />
    </button>
  );
}

export default function DashboardChat() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useDashboardTheme();
  const isDark = resolvedTheme === "dark";
  const chatUi = useMemo(
    () =>
      isDark
        ? {
            aside:
              "flex max-h-[min(42vh,400px)] flex-col overflow-y-auto rounded-2xl border border-slate-700/55 bg-slate-900/95 p-4 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:max-h-none lg:min-h-0",
            sidebarHeader:
              "flex items-center justify-between gap-2 rounded-2xl border border-slate-600/40 bg-slate-800/60 px-3 py-2.5 shadow-sm backdrop-blur-sm",
            myConversationsPanel:
              "mt-4 rounded-2xl border border-slate-700/40 bg-slate-900/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
            myConversationsLabel:
              "mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400",
            emptyConversationCard:
              "flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/95 via-slate-900/90 to-slate-950/95 px-4 py-8 text-center shadow-[0_8px_32px_-16px_rgba(0,0,0,0.35)]",
            emptyConversationIcon:
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-900/50 to-blue-900/40 shadow-[0_4px_14px_-4px_rgba(124,58,237,0.35)] ring-1 ring-slate-700/50",
            emptyConversationIconColor: "h-6 w-6 text-violet-400",
            emptyConversationTitle: "text-sm font-medium text-slate-200",
            emptyConversationBody: "text-xs leading-relaxed text-slate-400",
            mainSection:
              "flex min-h-0 min-h-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/55 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-slate-950 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.4)] lg:min-h-0",
            mainHeader:
              "border-b border-slate-700/50 bg-slate-900/60 px-5 py-4 shadow-sm backdrop-blur-lg",
            messagesArea:
              "relative flex-1 overflow-y-auto bg-gradient-to-b from-slate-950/60 via-slate-900/50 to-slate-950/60 p-6 shadow-[inset_0_8px_28px_-12px_rgba(0,0,0,0.35)]",
            welcomeCard:
              "flex max-w-sm flex-col items-center gap-6 rounded-2xl border border-slate-600/50 bg-slate-800/90 p-8 text-center shadow-[0_20px_56px_-16px_rgba(0,0,0,0.45)] ring-1 ring-slate-700/40 backdrop-blur-sm",
            welcomeIconWrap:
              "flex h-20 w-20 items-center justify-center rounded-full border border-violet-500/30 bg-gradient-to-br from-slate-800 to-violet-950/50 shadow-[0_8px_28px_-8px_rgba(124,58,237,0.35)]",
            welcomeIcon: "h-10 w-10 text-violet-400",
            welcomeTitle: "text-base font-semibold text-slate-100",
            welcomeBody: "mt-2 text-sm leading-relaxed text-slate-400",
            searchIcon:
              "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500",
            searchInput:
              "w-full rounded-[14px] border border-slate-600 bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-slate-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)] transition-all duration-200 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
            sidebarTitle: "text-sm font-semibold tracking-tight text-slate-300",
            sidebarTitlePulse:
              "text-sm font-semibold tracking-tight bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent",
            liveOk: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20",
            liveWait: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25",
            iconActive:
              "border-violet-500/60 bg-gradient-to-br from-violet-500/20 to-blue-500/15 text-violet-300 ring-2 ring-violet-500/25",
            iconIdle:
              "border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-blue-500/10 text-violet-400 hover:border-violet-400/60 hover:text-violet-300",
            settingsBtn:
              "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 text-slate-400 shadow-sm transition-all duration-200 hover:border-violet-500/40 hover:text-violet-300 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]",
            panelCard:
              "overflow-hidden rounded-2xl border border-slate-600/70 bg-slate-900 p-4 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)]",
            panelTitle: "text-[13px] font-semibold tracking-tight text-slate-100",
            panelBody: "mt-1 text-[11px] leading-relaxed text-slate-400",
            panelCloseBtn:
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 text-slate-400 transition hover:border-slate-500 hover:bg-slate-700 hover:text-slate-200",
            mainTitle:
              "text-lg font-semibold capitalize leading-tight tracking-tight text-slate-50 sm:text-xl",
            mainSubtitle: "mt-0.5 truncate text-xs text-slate-400",
            skeleton: "h-[72px] animate-pulse rounded-[14px] bg-slate-800",
            convSelected:
              "border-violet-500/35 bg-gradient-to-r from-violet-500/10 to-blue-500/8 shadow-[0_4px_18px_-6px_rgba(124,58,237,0.22)] ring-1 ring-violet-500/10",
            convIdle:
              "border border-transparent bg-slate-800/50 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.2)] hover:border-slate-600",
            convAvatar:
              "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-900/50 to-blue-900/40 text-xs font-semibold text-violet-200 ring-2 ring-slate-900 shadow-sm",
            convName: "truncate text-[13px] font-semibold text-slate-100",
            convMeta: "mt-1 text-[11px] text-slate-500 truncate",
            convTime: "mt-1 text-[10px] text-slate-500",
            composerWrap:
              "flex items-end gap-2 rounded-[16px] border border-slate-600 bg-slate-800/90 p-2 shadow-[0_10px_36px_-10px_rgba(0,0,0,0.45)] backdrop-blur-md transition-shadow focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20",
            composerText:
              "min-h-[44px] max-h-32 min-w-0 flex-1 resize-y rounded-[14px] border-0 bg-transparent px-2 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-0 disabled:bg-transparent disabled:text-slate-500",
            composerToolBtn:
              "inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-600 bg-slate-700/80 text-slate-400 shadow-sm transition-all hover:border-violet-500/40 hover:bg-violet-900/30 hover:text-violet-300",
            emojiPanel:
              "absolute bottom-full right-0 z-[80] mb-2 w-[min(calc(100vw-2rem),288px)] rounded-2xl border border-slate-600 bg-slate-900 p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]",
            errorBanner:
              "mb-3 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-xs text-red-200 shadow-sm backdrop-blur-sm",
            mutedText: "text-slate-400",
            friendSearchInput:
              "w-full rounded-xl border border-slate-600 bg-slate-800/50 py-2.5 pl-10 pr-3 text-[13px] text-slate-100 shadow-inner transition placeholder:text-slate-500 focus:border-violet-500/40 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/15",
            friendSearchIcon:
              "pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500",
          }
        : {
            aside:
              "flex max-h-[min(42vh,400px)] flex-col overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1),0_0_0_1px_rgba(255,255,255,0.95)_inset] lg:max-h-none lg:min-h-0 lg:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]",
            sidebarHeader:
              "flex items-center justify-between gap-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm",
            myConversationsPanel:
              "mt-4 rounded-2xl border border-slate-200/60 bg-slate-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]",
            myConversationsLabel:
              "mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
            emptyConversationCard:
              "flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 py-8 text-center shadow-[0_4px_24px_-12px_rgba(15,23,42,0.1)]",
            emptyConversationIcon:
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 shadow-[0_4px_14px_-4px_rgba(124,58,237,0.2)] ring-1 ring-white",
            emptyConversationIconColor: "h-6 w-6 text-violet-600",
            emptyConversationTitle: "text-sm font-medium text-slate-800",
            emptyConversationBody: "text-xs leading-relaxed text-slate-600",
            mainSection:
              "flex min-h-0 min-h-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-slate-100 shadow-[0_4px_24px_-10px_rgba(15,23,42,0.08)] lg:min-h-0",
            mainHeader:
              "border-b border-slate-200/70 bg-white px-5 py-4 shadow-sm",
            messagesArea:
              "relative flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-100/90 p-6 shadow-[inset_0_6px_20px_-12px_rgba(15,23,42,0.06)]",
            welcomeCard:
              "flex max-w-sm flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_16px_48px_-16px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/50",
            welcomeIconWrap:
              "flex h-20 w-20 items-center justify-center rounded-full border border-violet-200/60 bg-gradient-to-br from-white to-violet-50 shadow-[0_8px_28px_-8px_rgba(124,58,237,0.2)]",
            welcomeIcon: "h-10 w-10 text-violet-600",
            welcomeTitle: "text-base font-semibold text-slate-900",
            welcomeBody: "mt-2 text-sm leading-relaxed text-slate-600",
            searchIcon:
              "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
            searchInput:
              "w-full rounded-[14px] border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] transition-all duration-200 placeholder:text-slate-400 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20",
            sidebarTitle: "text-sm font-semibold tracking-tight text-slate-600",
            sidebarTitlePulse:
              "text-sm font-semibold tracking-tight bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent",
            liveOk: "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20",
            liveWait: "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25",
            iconActive:
              "border-violet-400/80 bg-gradient-to-br from-violet-500/20 to-blue-500/15 text-violet-700 ring-2 ring-violet-400/30",
            iconIdle:
              "border-violet-200/80 bg-gradient-to-br from-violet-500/10 to-blue-500/10 text-violet-600 hover:border-violet-400/60 hover:text-violet-700",
            settingsBtn:
              "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-violet-300/60 hover:text-violet-600 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]",
            panelCard:
              "overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_28px_-6px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.04)]",
            panelTitle: "text-[13px] font-semibold tracking-tight text-slate-800",
            panelBody: "mt-1 text-[11px] leading-relaxed text-slate-500",
            panelCloseBtn:
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50/90 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700",
            mainTitle:
              "text-lg font-semibold capitalize leading-tight tracking-tight text-slate-900 sm:text-xl",
            mainSubtitle: "mt-0.5 truncate text-xs text-slate-500",
            skeleton: "h-[72px] animate-pulse rounded-[14px] bg-slate-100",
            convSelected:
              "border-violet-300/50 bg-gradient-to-r from-violet-500/10 to-blue-500/8 shadow-[0_4px_18px_-6px_rgba(124,58,237,0.22)] ring-1 ring-violet-500/10",
            convIdle:
              "border border-transparent bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)] hover:border-slate-200/90 hover:shadow-md",
            convAvatar:
              "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-xs font-semibold text-violet-700 ring-2 ring-white shadow-sm",
            convName: "truncate text-[13px] font-semibold text-slate-900",
            convMeta: "mt-1 text-[11px] text-slate-500 truncate",
            convTime: "mt-1 text-[10px] text-slate-400",
            composerWrap:
              "flex items-end gap-2 rounded-[16px] border border-slate-200/80 bg-white p-2 shadow-[0_8px_32px_-10px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.03)] backdrop-blur-md transition-shadow focus-within:border-violet-400/40 focus-within:shadow-[0_12px_40px_-12px_rgba(124,58,237,0.18)] focus-within:ring-2 focus-within:ring-violet-500/15",
            composerText:
              "min-h-[44px] max-h-32 min-w-0 flex-1 resize-y rounded-[14px] border-0 bg-transparent px-2 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-0 disabled:bg-transparent disabled:text-slate-400",
            composerToolBtn:
              "inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200/80 bg-slate-50/90 text-slate-500 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600",
            emojiPanel:
              "absolute bottom-full right-0 z-[80] mb-2 w-[min(calc(100vw-2rem),288px)] rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.2)]",
            errorBanner:
              "mb-3 rounded-xl border border-red-200/80 bg-red-50/95 px-4 py-2.5 text-xs text-red-700 shadow-sm backdrop-blur-sm",
            mutedText: "text-slate-500",
            friendSearchInput:
              "w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pl-10 pr-3 text-[13px] text-slate-800 shadow-inner transition placeholder:text-slate-400 focus:border-violet-400/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/15",
            friendSearchIcon:
              "pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400",
          },
    [isDark]
  );
  const role = user?.role?.toLowerCase?.() ?? "";
  const isSupport = role === "support" || role === "admin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<"connected" | "reconnecting">("reconnecting");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChatStatus>("all");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [supportFilterDropdownOpen, setSupportFilterDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [myChats, setMyChats] = useState<ChatItem[]>([]);
  const [inboxChats, setInboxChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [typingByChat, setTypingByChat] = useState<Record<string, { userId: string; isTyping: boolean; at: string }>>({});
  const [activeFilter, setActiveFilter] = useState<"all" | "unassigned" | "open" | "waiting_user" | "waiting_support" | "closed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ChatPriority>("all");
  const [sortBySla, setSortBySla] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [macros, setMacros] = useState<Array<{ id: number; title: string; content: string; isActive: boolean }>>([]);
  const [tagsCatalog, setTagsCatalog] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<Array<{ id: number; eventType: string; actorEmail?: string | null; createdAt?: string | null; details?: any }>>([]);
  const [internalNote, setInternalNote] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; type: string; dataUrl: string } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(null);
  const [pendingRemoveFriendId, setPendingRemoveFriendId] = useState<string | null>(null);
  const [conversationMenu, setConversationMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);
  const [sentMessageMenu, setSentMessageMenu] = useState<{
    x: number;
    y: number;
    chatId: string;
    messageId: string;
    copyText: string;
  } | null>(null);
  const sentMessageMenuRef = useRef<HTMLDivElement | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  /** Inbox support: panou pliabil cu animație (doar rol support) */
  const [inboxSupportExpanded, setInboxSupportExpanded] = useState(true);
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  const [deliveredAtByMessageId, setDeliveredAtByMessageId] = useState<Record<string, number>>({});
  const [newMessagePulse, setNewMessagePulse] = useState(false);
  const [soundSettingsTick, setSoundSettingsTick] = useState(0);
  const [addFriendMode, setAddFriendMode] = useState(false);
  const [supportRequestMode, setSupportRequestMode] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<Array<{ id: string; email: string; role: string; displayName: string; avatar?: string | null }>>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friends, setFriends] = useState<Array<{ id: string; email: string; role: string; displayName: string; avatar?: string | null }>>([]);
  const [friendIncomingRequests, setFriendIncomingRequests] = useState<
    Array<{ id: string; email: string; role: string; displayName: string; avatar?: string | null; requestedAt: string }>
  >([]);
  const [friendPanelNotice, setFriendPanelNotice] = useState<string | null>(null);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [friendRequestActionId, setFriendRequestActionId] = useState<string | null>(null);
  const [openingFriendChatId, setOpeningFriendChatId] = useState<string | null>(null);
  const [chatInfoOpen, setChatInfoOpen] = useState(false);
  const [sidebarMainEnterTick, setSidebarMainEnterTick] = useState(0);
  const friendSearchTimerRef = useRef<number | null>(null);
  const voiceCallSignalHandlerRef = useRef<(raw: unknown) => void>(() => {});
  const statusDropdownRef = useRef<HTMLDivElement | null>(null);
  const supportFilterDropdownRef = useRef<HTMLDivElement | null>(null);
  const priorityDropdownRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingHeartbeatRef = useRef<number | null>(null);
  const draftStorageKey = `work2now_support_chat_drafts_${user?.id ?? "anon"}`;
  const notesStorageKey = `work2now_support_chat_notes_${user?.id ?? "anon"}`;

  const quickTemplates = [
    "Salut! Te rog descrie problema în 2-3 pași.",
    "Mulțumesc. Verific acum și revin imediat.",
    "Te rog trimite un screenshot cu eroarea + ora exactă.",
    "Am aplicat o soluție. Te rog verifică acum.",
    "Ticket închis. Dacă reapare, revino în acest chat."
  ];
  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

  useEffect(() => {
    const sync = () => setSoundSettingsTick((n) => n + 1);
    window.addEventListener(CHAT_SOUND_SETTINGS_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHAT_SOUND_SETTINGS_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    try {
      if (selectedChatId) {
        sessionStorage.setItem("work2now_dashboard_selected_chat_id", selectedChatId);
      } else {
        sessionStorage.removeItem("work2now_dashboard_selected_chat_id");
      }
    } catch {
      // ignore
    }
  }, [selectedChatId]);

  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem("work2now_dashboard_selected_chat_id");
      } catch {
        // ignore
      }
    };
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const mine = await authApi.supportChatMy();
      const mineChats = (mine as { chats?: ChatItem[] }).chats ?? [];
      setMyChats(mineChats);
      if (isSupport) {
        const [inbox, tagsRes, macrosRes] = await Promise.all([
          authApi.supportChatInbox(),
          authApi.supportChatTags().catch(() => ({ tags: [] })),
          authApi.supportChatMacros().catch(() => ({ macros: [] })),
        ]);
        const inboxChatsData = (inbox as { chats?: ChatItem[] }).chats ?? [];
        setTagsCatalog((tagsRes as { tags?: string[] }).tags ?? []);
        setMacros(((macrosRes as { macros?: Array<{ id: number; title: string; content: string; isActive: boolean }> }).macros ?? []).filter((m) => m.isActive));
        setInboxChats(inboxChatsData);
        setLastSeenMap((prev) => {
          const next = { ...prev };
          const uid = String(user?.id ?? "");
          for (const c of [...mineChats, ...inboxChatsData]) {
            const seenIso = lastSeenIsoForViewer(c, uid, isSupport);
            const seenTs = seenIso ? new Date(seenIso).getTime() : 0;
            if (Number.isFinite(seenTs)) {
              next[c.id] = Math.max(next[c.id] ?? 0, seenTs);
            }
          }
          return next;
        });
      } else {
        setInboxChats([]);
        setTagsCatalog([]);
        setMacros([]);
        setLastSeenMap((prev) => {
          const next = { ...prev };
          const uid = String(user?.id ?? "");
          for (const c of mineChats) {
            const seenIso = lastSeenIsoForViewer(c, uid, isSupport);
            const seenTs = seenIso ? new Date(seenIso).getTime() : 0;
            if (Number.isFinite(seenTs)) {
              next[c.id] = Math.max(next[c.id] ?? 0, seenTs);
            }
          }
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcarea conversațiilor.");
    } finally {
      setLoading(false);
    }
    void loadFriends();
    void loadFriendIncomingRequests();
  };

  const stripMessageFromChats = (chatId: string, messageId: string) => {
    const strip = (list: ChatItem[]) =>
      list.map((c) =>
        c.id !== chatId
          ? c
          : { ...c, messages: (c.messages ?? []).filter((m) => String(m.id) !== String(messageId)) }
      );
    setMyChats(strip);
    setInboxChats(strip);
  };

  const loadFriends = async () => {
    if (!user) return;
    try {
      const res = await authApi.friendsList();
      setFriends((res as { friends?: typeof friends }).friends ?? []);
    } catch {
      setFriends([]);
    }
  };

  const loadFriendIncomingRequests = async () => {
    if (!user) return;
    try {
      const res = await authApi.friendsIncomingRequests();
      setFriendIncomingRequests(res.requests ?? []);
    } catch {
      setFriendIncomingRequests([]);
    }
  };

  useEffect(() => {
    if (!addFriendMode && !supportRequestMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (addFriendMode) {
        setAddFriendMode(false);
        setFriendSearchQuery("");
        setFriendSearchResults([]);
        setFriendPanelNotice(null);
        setSidebarMainEnterTick((n) => n + 1);
      } else if (supportRequestMode) {
        setSupportRequestMode(false);
        setSidebarMainEnterTick((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addFriendMode, supportRequestMode]);

  useEffect(() => {
    if (!addFriendMode) return;
    if (friendSearchTimerRef.current !== null) window.clearTimeout(friendSearchTimerRef.current);
    const q = friendSearchQuery.trim();
    if (q.length < 2) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      return;
    }
    setFriendSearchLoading(true);
    friendSearchTimerRef.current = window.setTimeout(() => {
      void authApi
        .friendsSearch(q)
        .then((res) => setFriendSearchResults((res as { users?: typeof friendSearchResults }).users ?? []))
        .catch(() => setFriendSearchResults([]))
        .finally(() => setFriendSearchLoading(false));
    }, 320);
    return () => {
      if (friendSearchTimerRef.current !== null) window.clearTimeout(friendSearchTimerRef.current);
    };
  }, [addFriendMode, friendSearchQuery]);

  useEffect(() => {
    if (!addFriendMode) return;
    void loadFriendIncomingRequests();
  }, [addFriendMode, user?.id]);

  useEffect(() => {
    setChatInfoOpen(false);
    setEmojiPickerOpen(false);
    setSentMessageMenu(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (!sentMessageMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSentMessageMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      if (sentMessageMenuRef.current?.contains(e.target as Node)) return;
      setSentMessageMenu(null);
    };
    const onScroll = () => setSentMessageMenu(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [sentMessageMenu]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (emojiPickerRef.current?.contains(e.target as Node)) return;
      setEmojiPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!pendingRemoveFriendId && !pendingDeleteChatId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (loading && pendingDeleteChatId) return;
      if (friendActionId && pendingRemoveFriendId) return;
      setPendingRemoveFriendId(null);
      setPendingDeleteChatId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pendingRemoveFriendId, pendingDeleteChatId, loading, friendActionId]);

  useEffect(() => {
    if (!conversationMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConversationMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      if (conversationMenuRef.current?.contains(e.target as Node)) return;
      setConversationMenu(null);
    };
    const onScroll = () => setConversationMenu(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [conversationMenu]);

  const exitAddFriendMode = () => {
    setAddFriendMode(false);
    setFriendSearchQuery("");
    setFriendSearchResults([]);
    setFriendPanelNotice(null);
    setSidebarMainEnterTick((n) => n + 1);
  };

  const exitSupportRequestMode = () => {
    setSupportRequestMode(false);
    setSidebarMainEnterTick((n) => n + 1);
  };

  const addFriendById = async (targetUserId: string) => {
    setFriendActionId(targetUserId);
    setError(null);
    setFriendPanelNotice(null);
    try {
      const out = await authApi.friendsAdd(targetUserId);
      await loadFriends();
      setFriendSearchResults((prev) => prev.filter((u) => u.id !== targetUserId));
      if (out.state === "connected") {
        setFriendPanelNotice("Acum sunteți prieteni.");
      } else {
        setFriendPanelNotice("Cerere trimisă. După acceptare veți fi conectați.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut trimite cererea.");
    } finally {
      setFriendActionId(null);
    }
  };

  const acceptIncomingFriendRequest = async (fromUserId: string) => {
    setFriendRequestActionId(fromUserId);
    setError(null);
    try {
      await authApi.friendsAcceptRequest(fromUserId);
      await loadFriends();
      await loadFriendIncomingRequests();
      setFriendPanelNotice("Cerere acceptată.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut accepta cererea.");
    } finally {
      setFriendRequestActionId(null);
    }
  };

  const declineIncomingFriendRequest = async (fromUserId: string) => {
    setFriendRequestActionId(fromUserId);
    setError(null);
    try {
      await authApi.friendsDeclineRequest(fromUserId);
      await loadFriendIncomingRequests();
      setFriendPanelNotice("Cerere respinsă.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut respinge cererea.");
    } finally {
      setFriendRequestActionId(null);
    }
  };

  const openChatWithFriend = async (friendId: string) => {
    const myId = String(user?.id ?? "").trim();
    if (!myId) return;
    const pool = [...myChats, ...inboxChats];
    const existing = pool.find((c) => chatConnectsPeer(c, myId, friendId));
    if (existing) {
      setSelectedChatId(existing.id);
      return;
    }
    setOpeningFriendChatId(friendId);
    setError(null);
    try {
      const res = await authApi.supportChatWithFriend(friendId);
      await load();
      setSelectedChatId(res.chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut deschide chatul.");
    } finally {
      setOpeningFriendChatId(null);
    }
  };

  const removeFriendById = async (targetUserId: string): Promise<boolean> => {
    setFriendActionId(targetUserId);
    setError(null);
    try {
      await authApi.friendsRemove(targetUserId);
      await loadFriends();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut elimina prietenul.");
      return false;
    } finally {
      setFriendActionId(null);
    }
  };

  const confirmRemoveFriend = async () => {
    if (!pendingRemoveFriendId) return;
    const id = pendingRemoveFriendId;
    const ok = await removeFriendById(id);
    if (ok) setPendingRemoveFriendId(null);
  };

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  useEffect(() => {
    const now = Date.now();
    setTypingByChat((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [chatId, info] of Object.entries(prev)) {
        const ts = new Date(info.at).getTime();
        if (!Number.isFinite(ts) || now - ts > 5000) {
          delete next[chatId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [myChats, inboxChats, selectedChatId]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
      if (typingHeartbeatRef.current !== null) window.clearInterval(typingHeartbeatRef.current);
    };
  }, []);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!statusDropdownRef.current) return;
      if (!statusDropdownRef.current.contains(ev.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [statusDropdownOpen]);

  useEffect(() => {
    if (!supportFilterDropdownOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!supportFilterDropdownRef.current) return;
      if (!supportFilterDropdownRef.current.contains(ev.target as Node)) {
        setSupportFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [supportFilterDropdownOpen]);

  useEffect(() => {
    if (!priorityDropdownOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!priorityDropdownRef.current) return;
      if (!priorityDropdownRef.current.contains(ev.target as Node)) {
        setPriorityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [priorityDropdownOpen]);

  useEffect(() => {
    const url = authApi.supportChatStreamUrl();
    if (!url) return;
    let disposed = false;
    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let retryDelayMs = 1000;
    const MAX_RETRY_DELAY_MS = 15000;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (disposed) return;
      setSseStatus("reconnecting");
      es = new EventSource(url);
      es.onopen = () => {
        setSseStatus("connected");
        retryDelayMs = 1000;
      };
      es.addEventListener("support_chat_event", (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data || "{}");
          if (payload?.type === "voice_call_signal") {
            voiceCallSignalHandlerRef.current(payload);
            return;
          }
          if (payload?.type === "typing" && payload.chatId) {
            setTypingByChat((prev) => ({
              ...prev,
              [String(payload.chatId)]: {
                userId: String(payload.userId ?? ""),
                isTyping: !!payload.isTyping,
                at: String(payload.at ?? new Date().toISOString()),
              },
            }));
            return;
          }
          if (payload?.type === "delivered" && payload.messageId) {
            const deliveredTs = new Date(String(payload.at ?? "")).getTime();
            if (Number.isFinite(deliveredTs)) {
              setDeliveredAtByMessageId((prev) => ({ ...prev, [String(payload.messageId)]: deliveredTs }));
            }
            return;
          }
          if (payload?.type === "chat_updated" && payload?.reason === "seen") {
            // Seen updates are already handled locally; avoid full list reload flicker.
            return;
          }
          if (payload?.type === "friend_request_received") {
            void loadFriendIncomingRequests();
            if (
              typeof document !== "undefined" &&
              document.visibilityState !== "visible" &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              try {
                new Notification("Cerere de prietenie", {
                  body: "Ai primit o cerere nouă. Deschide Mesaje → Adaugă prieten pentru a o accepta.",
                });
              } catch {
                // ignore
              }
            }
            return;
          }
          if (payload?.type === "chat_updated" && payload?.reason === "message") {
            maybePlayIncomingMessageSound(payload, String(user?.id ?? ""));
          }
        } catch {
          // ignore parse
        }
        void load();
      });
      es.onerror = () => {
        setSseStatus("reconnecting");
        if (es) {
          es.close();
          es = null;
        }
        if (disposed || reconnectTimer !== null) return;
        const wait = retryDelayMs;
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, wait);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      if (es) {
        es.close();
        es = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  const sortedInbox = useMemo(() => {
    return [...inboxChats].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.messages?.[a.messages.length - 1]?.createdAt ?? "").getTime();
      const tb = new Date(b.updatedAt ?? b.messages?.[b.messages.length - 1]?.createdAt ?? "").getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [inboxChats]);
  const sortedMine = useMemo(() => {
    return [...myChats].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.messages?.[a.messages.length - 1]?.createdAt ?? "").getTime();
      const tb = new Date(b.updatedAt ?? b.messages?.[b.messages.length - 1]?.createdAt ?? "").getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [myChats]);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byFilter = sortedInbox.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (priorityFilter !== "all" && (c.priority ?? "normal") !== priorityFilter) return false;
      if (activeFilter === "unassigned" && c.status !== "open") return false;
      if (activeFilter === "open" && c.status !== "open") return false;
      if (activeFilter === "closed" && c.status !== "closed") return false;
      if (selectedTags.length > 0) {
        const tags = ((c as any).tags ?? []) as string[];
        if (!selectedTags.every((t) => tags.includes(t))) return false;
      }
      if (activeFilter === "waiting_user") {
        const last = c.messages?.[c.messages.length - 1];
        if (!last || !messageIsMine(last, user)) return false;
      }
      if (activeFilter === "waiting_support") {
        const last = c.messages?.[c.messages.length - 1];
        if (!last || messageIsMine(last, user)) return false;
      }
      if (!q) return true;
      return (
        (c.requesterEmail ?? "").toLowerCase().includes(q) ||
        (c.requesterDisplayName ?? "").toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    });
    if (!sortBySla) return byFilter;
    return [...byFilter].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? "").getTime() || 0;
      const tb = new Date(b.updatedAt ?? "").getTime() || 0;
      return ta - tb;
    });
  }, [sortedInbox, search, statusFilter, priorityFilter, activeFilter, selectedTags, user?.email, user?.id, sortBySla]);

  const filteredMine = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byFilter = sortedMine.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (priorityFilter !== "all" && (c.priority ?? "normal") !== priorityFilter) return false;
      if (activeFilter === "open" && c.status !== "open") return false;
      if (activeFilter === "closed" && c.status !== "closed") return false;
      if (selectedTags.length > 0) {
        const tags = ((c as any).tags ?? []) as string[];
        if (!selectedTags.every((t) => tags.includes(t))) return false;
      }
      if (!q) return true;
      return (
        (c.requesterEmail ?? "").toLowerCase().includes(q) ||
        (c.requesterDisplayName ?? "").toLowerCase().includes(q) ||
        (c.acceptedByDisplayName ?? "").toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    });
    if (!sortBySla) return byFilter;
    return [...byFilter].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? "").getTime() || 0;
      const tb = new Date(b.updatedAt ?? "").getTime() || 0;
      return ta - tb;
    });
  }, [sortedMine, search, statusFilter, priorityFilter, activeFilter, selectedTags, sortBySla]);

  const unreadCountByChat = useMemo(() => {
    const combined = mergeChatsPreferringMoreMessages([inboxChats, myChats]);
    const map: Record<string, number> = {};
    for (const c of combined) {
      if (selectedChatId && c.id === selectedChatId) {
        map[c.id] = 0;
        continue;
      }
      const seenTs = lastSeenMap[c.id] ?? 0;
      const unread = (c.messages ?? []).filter((m) => {
        const msgTs = new Date(m.createdAt).getTime();
        return Number.isFinite(msgTs) && msgTs > seenTs && !messageIsMine(m, user);
      }).length;
      map[c.id] = unread;
    }
    return map;
  }, [myChats, inboxChats, lastSeenMap, user, selectedChatId]);

  const totalUnread = useMemo(
    () => Object.values(unreadCountByChat).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [unreadCountByChat]
  );

  useEffect(() => {
    if (totalUnread <= 0) return;
    setNewMessagePulse(true);
    const t = window.setTimeout(() => setNewMessagePulse(false), 1200);
    if (isChatMessageSoundEnabled()) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.02;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch {
        // ignore audio restrictions
      }
    }
    return () => window.clearTimeout(t);
  }, [totalUnread, soundSettingsTick]);

  const selected = useMemo(() => {
    const fromMine = myChats.find((c) => c.id === selectedChatId);
    if (fromMine) return fromMine;
    return inboxChats.find((c) => c.id === selectedChatId) ?? null;
  }, [selectedChatId, myChats, inboxChats]);
  const selectedPeerEmail = useMemo(() => {
    if (!selected) return "";
    if (isSupport) return selected.requesterEmail;
    const myId = String(user?.id ?? "");
    const side = peerSideForViewer(selected, myId);
    if (side === "peer_is_accepted") return selected.acceptedByEmail || selected.requesterEmail;
    if (side === "peer_is_requester") return selected.requesterEmail || selected.acceptedByEmail || "";
    return selected.acceptedByEmail || selected.requesterEmail;
  }, [selected, isSupport, user?.id]);

  const selectedPeerName = useMemo(() => {
    if (!selected) return "";
    if (isSupport) {
      return (
        selected.requesterDisplayName ||
        (selected.requesterEmail ? selected.requesterEmail.split("@")[0].replace(/[._-]+/g, " ") : "")
      );
    }
    const myId = String(user?.id ?? "");
    const side = peerSideForViewer(selected, myId);
    if (side === "peer_is_accepted") {
      return selected.acceptedByDisplayName || nameFromEmail(selected.acceptedByEmail) || "User";
    }
    if (side === "peer_is_requester") {
      return selected.requesterDisplayName || nameFromEmail(selected.requesterEmail) || "User";
    }
    return selected.acceptedByDisplayName || selected.requesterDisplayName || "User";
  }, [selected, isSupport, user?.id]);

  const selectedPeerAvatar = useMemo(() => {
    if (!selected) return null;
    return peerAvatarUrlForSidebar(selected, String(user?.id ?? ""), isSupport);
  }, [selected, isSupport, user?.id]);
  const selectedIsSupportTicket = useMemo(
    () => (selected ? isSupportTicketChat(selected) : false),
    [selected]
  );
  const voiceCallEligible = useMemo(
    () => !isSupport && !selectedIsSupportTicket && !!selected && selected.status !== "closed",
    [isSupport, selectedIsSupportTicket, selected]
  );
  const voiceCallChatId = voiceCallEligible && selectedChatId ? selectedChatId : null;
  const voiceCall = useVoiceCall(voiceCallChatId, String(user?.id ?? ""), voiceCallEligible);
  voiceCallSignalHandlerRef.current = voiceCall.handleRemoteSignal;
  const isSelectedClosed = selected?.status === "closed";
  const isWaitingSupportAccept = !!selected && !isSupport && selected.status === "open" && !selected.acceptedByEmail;

  const unreadStartIndex = useMemo(() => {
    if (!selected?.messages || selected.messages.length === 0) return -1;
    const seenTs = lastSeenMap[selected.id] ?? 0;
    return selected.messages.findIndex((m) => {
      const msgTs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(msgTs)) return false;
      return msgTs > seenTs && !messageIsMine(m, user);
    });
  }, [selected, lastSeenMap, user]);
  const peerSeenTs = useMemo(() => {
    if (!selected) return 0;
    let peerSeenIso: string | null | undefined;
    if (isSupport) {
      peerSeenIso = selected.lastSeenByRequesterAt;
    } else if (isSupportTicketChat(selected)) {
      peerSeenIso = selected.lastSeenBySupportAt;
    } else {
      const ta = selected.lastSeenByRequesterAt ? new Date(selected.lastSeenByRequesterAt).getTime() : 0;
      const tb = selected.lastSeenBySupportAt ? new Date(selected.lastSeenBySupportAt).getTime() : 0;
      peerSeenIso =
        ta >= tb ? selected.lastSeenByRequesterAt : selected.lastSeenBySupportAt;
    }
    const ts = peerSeenIso ? new Date(peerSeenIso).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  }, [selected, isSupport]);
  const lastMineMessageId = useMemo(() => {
    if (!selected?.messages?.length || !user) return "";
    for (let i = selected.messages.length - 1; i >= 0; i -= 1) {
      const m = selected.messages[i];
      if (messageIsMine(m, user)) return String(m.id ?? "");
    }
    return "";
  }, [selected, user]);

  useEffect(() => {
    if (!selected?.id) return;
    const msgs = selected.messages ?? [];
    const latestMsgTs =
      msgs.length === 0
        ? 0
        : Math.max(
            0,
            ...msgs.map((m) => new Date(m.createdAt).getTime()).filter((v) => Number.isFinite(v))
          );
    void authApi.supportChatSeen(selected.id).catch(() => {});
    // Fără mesaje încă încărcate, nu setăm lastSeen la Date.now() — ar ascunde necitite reale.
    if (latestMsgTs <= 0) return;
    const nextSeenTs = Math.max(Date.now(), latestMsgTs);
    setLastSeenMap((prev) => ({ ...prev, [selected.id]: nextSeenTs }));
  }, [selected?.id, selected?.messages?.length]);

  useEffect(() => {
    if (!selected?.id) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, string>;
      setDraft(map[selected.id] ?? "");
    } catch {
      // ignore
    }
  }, [selected?.id, draftStorageKey]);

  useEffect(() => {
    if (!selected?.id) return;
    try {
      const raw = localStorage.getItem(notesStorageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      setInternalNote(map[selected.id] ?? "");
    } catch {
      setInternalNote("");
    }
  }, [selected?.id, notesStorageKey]);

  useEffect(() => {
    if (!selected) {
      setSelectedTags([]);
      return;
    }
    setSelectedTags(((selected as any).tags ?? []) as string[]);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id || !isSupport || !isSupportTicketChat(selected)) {
      setTimelineEvents([]);
      return;
    }
    void authApi
      .supportChatTimeline(selected.id)
      .then((r) => setTimelineEvents((r as { events?: any[] }).events ?? []))
      .catch(() => setTimelineEvents([]));
  }, [selected?.id, isSupport, selectedIsSupportTicket]);

  const requestSupport = async () => {
    const description = requestDescription.trim();
    if (description.length < 5) {
      setError("Te rugăm adaugă o descriere (minim 5 caractere).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.supportChatRequest(description);
      const chatId = String((res as { chatId?: string }).chatId ?? "");
      await load();
      if (chatId) setSelectedChatId(chatId);
      setRequestDescription("");
      setSupportRequestMode(false);
      setSidebarMainEnterTick((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut crea solicitarea.");
    } finally {
      setLoading(false);
    }
  };

  const acceptChat = async (chatId: string) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatAccept(chatId);
      await load();
      setSelectedChatId(chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut accepta chatul.");
    } finally {
      setLoading(false);
    }
  };

  const closeSelectedChat = async () => {
    if (!selected?.id) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatClose(selected.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut închide chatul.");
    } finally {
      setLoading(false);
    }
  };

  const deleteChatForMe = async (chatId: string) => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatDelete(chatId);
      await load();
      if (selectedChatId === chatId) setSelectedChatId(null);
      setPendingDeleteChatId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut șterge chatul.");
    } finally {
      setLoading(false);
    }
  };

  const setPriority = async (chatId: string, priority: ChatPriority) => {
    setLoading(true);
    try {
      await authApi.supportChatPriority(chatId, priority);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut seta prioritatea.");
    } finally {
      setLoading(false);
    }
  };

  const assignToMe = async (chatId: string) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await authApi.supportChatAssign(chatId, String(user.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut asigna chatul.");
    } finally {
      setLoading(false);
    }
  };

  const reopenChat = async (chatId: string) => {
    setLoading(true);
    try {
      await authApi.supportChatReopen(chatId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut redeschide chatul.");
    } finally {
      setLoading(false);
    }
  };

  const saveTagsForSelected = async () => {
    if (!selected?.id) return;
    setLoading(true);
    try {
      await authApi.supportChatSetTags(selected.id, selectedTags);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut salva tagurile.");
    } finally {
      setLoading(false);
    }
  };

  const escalateSelected = async (level: EscalationLevel) => {
    if (!selected?.id) return;
    setLoading(true);
    try {
      await authApi.supportChatEscalate(selected.id, level);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut escalada chatul.");
    } finally {
      setLoading(false);
    }
  };

  const setReminderIn30m = async () => {
    if (!selected?.id) return;
    const dueAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setLoading(true);
    try {
      await authApi.supportChatReminder(selected.id, dueAt, "Follow-up");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut seta reminder-ul.");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!selectedChatId) return;
    if (isSelectedClosed) return;
    const message = draft.trim();
    if (!message) return;
    setLoading(true);
    setSending(true);
    setError(null);
    try {
      void authApi.supportChatTyping(selectedChatId, false).catch(() => {});
      const payload = attachment
        ? `${message}\n\n[attachment:${attachment.name}|${attachment.type}|${attachment.dataUrl}]`
        : message;
      const sendRes = await authApi.supportChatMessage(selectedChatId, payload);
      const deliveredTs = new Date(String(sendRes.deliveredAt ?? "")).getTime();
      if (sendRes.messageId && Number.isFinite(deliveredTs)) {
        setDeliveredAtByMessageId((prev) => ({ ...prev, [String(sendRes.messageId)]: deliveredTs }));
      }
      setDraft("");
      setAttachment(null);
      setAttachmentError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut trimite mesajul.");
    } finally {
      setLoading(false);
      setSending(false);
    }
  };

  const pushTyping = (chatId: string, isTyping: boolean) => {
    void authApi.supportChatTyping(chatId, isTyping).catch(() => {});
  };

  const persistDraft = (chatId: string, value: string) => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[chatId] = value;
      localStorage.setItem(draftStorageKey, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const persistInternalNote = (chatId: string, value: string) => {
    try {
      const raw = localStorage.getItem(notesStorageKey);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[chatId] = value;
      localStorage.setItem(notesStorageKey, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const statusChipClass = (status: ChatStatus) =>
    status === "open"
      ? "bg-amber-100 text-amber-800"
      : status === "accepted"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-gray-100 text-gray-700";
  const statusOptions: Array<{ value: "all" | ChatStatus; label: string }> = [
    { value: "all", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "accepted", label: "Accepted" },
    { value: "closed", label: "Closed" },
  ];
  const supportFilterOptions: Array<{ value: "all" | "unassigned" | "open" | "waiting_user" | "waiting_support" | "closed"; label: string }> = [
    { value: "all", label: "All conversations" },
    { value: "unassigned", label: "Unassigned" },
    { value: "open", label: "Open" },
    { value: "waiting_user", label: "Waiting for user" },
    { value: "waiting_support", label: "Waiting for support" },
    { value: "closed", label: "Closed" },
  ];
  const priorityFilterOptions: Array<{ value: "all" | ChatPriority; label: string }> = [
    { value: "all", label: "All priorities" },
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ];
  const selectedStatusLabel = statusOptions.find((opt) => opt.value === statusFilter)?.label ?? "All statuses";
  const selectedSupportFilterLabel = supportFilterOptions.find((opt) => opt.value === activeFilter)?.label ?? "All conversations";
  const selectedPriorityLabel = priorityFilterOptions.find((opt) => opt.value === priorityFilter)?.label ?? "All priorities";

  const conversationSearchField = (
    <div className="relative">
      <Search className={chatUi.searchIcon} strokeWidth={1.75} aria-hidden />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Caută conversații…"
        className={chatUi.searchInput}
      />
    </div>
  );

  return (
    <div
      className={`mt-4 h-[calc(100vh-156px)] min-h-[560px] font-sans antialiased transition-colors duration-300 ease-out ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      <style>{`
        @keyframes support-modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes support-modal-pop-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chat-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chat-typing-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .chat-msg-enter { animation: chat-msg-in 0.28s ease-out both; }
        .chat-typing-dot { animation: chat-typing-dot 1.2s ease-in-out infinite; }
        @keyframes chat-dropdown-open {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .chat-dropdown-panel {
          transform-origin: top center;
          animation: chat-dropdown-open 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes sidebar-default-row-in {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .sidebar-default-stagger > * {
          animation: sidebar-default-row-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        .sidebar-default-stagger > *:nth-child(1) { animation-delay: 0.03s; }
        .sidebar-default-stagger > *:nth-child(2) { animation-delay: 0.09s; }
        .sidebar-default-stagger > *:nth-child(3) { animation-delay: 0.15s; }
        .sidebar-default-stagger > *:nth-child(4) { animation-delay: 0.21s; }
        .sidebar-default-stagger > *:nth-child(5) { animation-delay: 0.27s; }
        .sidebar-default-stagger > *:nth-child(6) { animation-delay: 0.33s; }
        .sidebar-default-stagger > *:nth-child(7) { animation-delay: 0.39s; }
        .sidebar-default-stagger > *:nth-child(8) { animation-delay: 0.45s; }
        .sidebar-default-stagger > *:nth-child(9) { animation-delay: 0.51s; }
        .sidebar-default-stagger > *:nth-child(10) { animation-delay: 0.57s; }
        .sidebar-default-stagger > *:nth-child(11) { animation-delay: 0.63s; }
        .sidebar-default-stagger > *:nth-child(12) { animation-delay: 0.69s; }
        @media (prefers-reduced-motion: reduce) {
          .sidebar-default-stagger > * {
            animation: none !important;
          }
        }
        @keyframes conversations-panel-enter {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .conversations-panel-enter {
          animation: conversations-panel-enter 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .conversations-panel-enter {
            animation: none !important;
          }
        }
      `}</style>
      {error ? (
        <div className={chatUi.errorBanner}>{error}</div>
      ) : null}
      <div className="flex h-full min-h-0 flex-col gap-4 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(300px,380px)_1fr] lg:gap-5 lg:overflow-hidden">
        <aside className={chatUi.aside}>
          <div className="space-y-3">
            <div className={chatUi.sidebarHeader}>
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={newMessagePulse ? chatUi.sidebarTitlePulse : chatUi.sidebarTitle}
                >
                  Mesaje
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all duration-300 ${
                    sseStatus === "connected" ? chatUi.liveOk : chatUi.liveWait
                  }`}
                >
                  {sseStatus === "connected" ? "Live" : "…"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddFriendMode(true);
                    setSupportRequestMode(false);
                    setFriendSearchQuery("");
                    setFriendSearchResults([]);
                    setFriendPanelNotice(null);
                    void loadFriendIncomingRequests();
                  }}
                  className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md ${
                    addFriendMode ? chatUi.iconActive : chatUi.iconIdle
                  }`}
                  title="Adaugă prieten"
                  aria-label="Adaugă prieten"
                >
                  <UserPlus className="h-4 w-4" strokeWidth={1.75} />
                  {friendIncomingRequests.length > 0 ? (
                    <span
                      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                      aria-hidden
                    >
                      {friendIncomingRequests.length > 9 ? "9+" : friendIncomingRequests.length}
                    </span>
                  ) : null}
                </button>
                {!isSupport && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupportRequestMode(true);
                      setAddFriendMode(false);
                    }}
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md ${
                      supportRequestMode ? chatUi.iconActive : chatUi.iconIdle
                    }`}
                    title="Solicitare support"
                    aria-label="Solicitare support"
                  >
                    <Headphones className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
                <ChatThemeSwitch
                  isDark={isDark}
                  onToggle={() => setTheme(isDark ? "light" : "dark")}
                  lightLabel={t("dashboard.chatThemeLight", "Mod luminos (alb)")}
                  darkLabel={t("dashboard.chatThemeDark", "Mod întunecat (negru)")}
                />
                <Link
                  to="/dashboard/settings"
                  className={chatUi.settingsBtn}
                  aria-label="Setări"
                  title="Setări profil"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
            {addFriendMode ? (
              <div
                className={chatUi.panelCard}
                style={{ animation: "modal-element-enter 0.28s ease-out" }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 pt-0.5">
                    <p className={chatUi.panelTitle}>Adaugă prieten</p>
                    <p className={chatUi.panelBody}>
                      Trimite o cerere sau acceptă cereri primite. Caută după email sau nume (min. 2 caractere). Staff și customer se pot conecta; support poate adăuga orice tip de cont.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={exitAddFriendMode}
                    className={chatUi.panelCloseBtn}
                    aria-label="Închide"
                    title="Închide"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                {friendPanelNotice ? (
                  <div className="mb-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/35 dark:text-emerald-100">
                    {friendPanelNotice}
                  </div>
                ) : null}
                <div className="mb-3 rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-slate-50/50 p-3 dark:border-violet-500/20 dark:from-violet-950/30 dark:to-slate-900/40">
                  <div className="mb-2 flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" strokeWidth={2} aria-hidden />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-200">Cereri primite</p>
                    {friendIncomingRequests.length > 0 ? (
                      <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:text-violet-200">
                        {friendIncomingRequests.length}
                      </span>
                    ) : null}
                  </div>
                  {friendIncomingRequests.length === 0 ? (
                    <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">Nicio cerere în așteptare.</p>
                  ) : (
                    <ul className="max-h-[min(200px,32vh)] space-y-2 overflow-y-auto pr-0.5">
                      {friendIncomingRequests.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/90 px-2 py-2 shadow-sm dark:border-slate-600/50 dark:bg-slate-800/70"
                        >
                          <img
                            src={avatarSrc(r.avatar) || DEFAULT_AVATAR_URL}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80 dark:ring-slate-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">{r.displayName}</div>
                            <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {r.email} · {formatRelativeTime(r.requestedAt)}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => void acceptIncomingFriendRequest(r.id)}
                              disabled={friendRequestActionId !== null}
                              className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:brightness-[1.06] disabled:opacity-50"
                            >
                              {friendRequestActionId === r.id ? "…" : "Acceptă"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void declineIncomingFriendRequest(r.id)}
                              disabled={friendRequestActionId !== null}
                              className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                              {friendRequestActionId === r.id ? "…" : "Refuză"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="relative">
                  <Search className={chatUi.friendSearchIcon} strokeWidth={2} aria-hidden />
                  <input
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    placeholder="Email sau nume (prenume / nume)…"
                    autoFocus
                    className={chatUi.friendSearchInput}
                  />
                </div>
                <div className="mt-3 max-h-[min(220px,40vh)] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/40 dark:border-slate-700/60 dark:bg-slate-800/30">
                  {friendSearchLoading && (
                    <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent dark:border-violet-500" />
                      Se caută…
                    </div>
                  )}
                  {!friendSearchLoading &&
                    friendSearchQuery.trim().length >= 2 &&
                    friendSearchResults.length === 0 && (
                      <div className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">Niciun rezultat pentru această căutare.</div>
                    )}
                  {friendSearchQuery.trim().length < 2 && !friendSearchLoading && (
                    <div className="px-3 py-6 text-center text-[11px] text-slate-400 dark:text-slate-500">Scrie cel puțin 2 caractere pentru a căuta.</div>
                  )}
                  {friendSearchResults.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 border-b border-slate-100/90 px-3 py-2.5 last:border-0 hover:bg-white/80 dark:border-slate-700/50 dark:hover:bg-slate-800/60"
                    >
                      <img
                        src={avatarSrc(u.avatar) || DEFAULT_AVATAR_URL}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-slate-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{u.displayName}</div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {u.email} · <span className="capitalize">{u.role}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void addFriendById(u.id)}
                        disabled={friendActionId === u.id || friendRequestActionId !== null}
                        className="shrink-0 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-50"
                      >
                        {friendActionId === u.id ? "…" : "Trimite cerere"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : supportRequestMode && !isSupport ? (
              <div
                className={chatUi.panelCard}
                style={{ animation: "modal-element-enter 0.28s ease-out" }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className={chatUi.panelTitle}>Solicitare support</p>
                  <button
                    type="button"
                    onClick={exitSupportRequestMode}
                    className={chatUi.panelCloseBtn}
                    aria-label="Închide"
                    title="Închide"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Descrie problema ta pentru support (minim 5 caractere)…"
                  className={chatUi.friendSearchInput}
                  rows={4}
                />
                <button
                  type="button"
                  onClick={() => void requestSupport()}
                  disabled={loading || requestDescription.trim().length < 5}
                  className="mt-3 w-full rounded-[14px] bg-gradient-to-r from-violet-600 via-violet-500 to-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(124,58,237,0.45)] transition-all duration-200 ease-out hover:brightness-[1.03] hover:shadow-[0_6px_24px_-4px_rgba(124,58,237,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Trimite solicitarea
                </button>
              </div>
            ) : (
              <div
                key={sidebarMainEnterTick}
                className={`space-y-3 ${sidebarMainEnterTick > 0 ? "sidebar-default-stagger" : ""}`}
              >
            {isSupport && conversationSearchField}
            {isSupport && (
              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-[14px] border border-slate-200/80 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:border-violet-200/80 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
                  aria-haspopup="listbox"
                  aria-expanded={statusDropdownOpen}
                >
                  <span>{selectedStatusLabel}</span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${statusDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {statusDropdownOpen && (
                  <div className="chat-dropdown-panel absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-[14px] border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-200/40 dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40">
                    {statusOptions.map((opt) => {
                      const active = statusFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setStatusFilter(opt.value);
                            setStatusDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition-all duration-200 ease-out ${
                            active
                              ? "bg-gradient-to-r from-violet-500/12 to-blue-500/10 text-violet-700 dark:text-violet-300"
                              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                          }`}
                          role="option"
                          aria-selected={active}
                        >
                          <span>{opt.label}</span>
                          {active ? <Check size={14} /> : <span className="w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {isSupport && (
              <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px]" ref={supportFilterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSupportFilterDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-[14px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
                    aria-haspopup="listbox"
                    aria-expanded={supportFilterDropdownOpen}
                  >
                    <span className="truncate">{selectedSupportFilterLabel}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${supportFilterDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {supportFilterDropdownOpen && (
                    <div className="chat-dropdown-panel absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-[14px] border border-slate-200/80 bg-white p-1 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                      {supportFilterOptions.map((opt) => {
                        const active = activeFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setActiveFilter(opt.value);
                              setSupportFilterDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-xs transition-all duration-200 ${
                              active
                                ? "bg-gradient-to-r from-violet-500/12 to-blue-500/10 text-violet-700 dark:text-violet-300"
                                : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                            }`}
                            role="option"
                            aria-selected={active}
                          >
                            <span>{opt.label}</span>
                            {active ? <Check size={12} /> : <span className="w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={sortBySla} onChange={(e) => setSortBySla(e.target.checked)} className="rounded border-slate-300 text-violet-600" />
                  sort SLA
                </label>
                <div className="relative min-w-[168px]" ref={priorityDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setPriorityDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-[14px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
                    aria-haspopup="listbox"
                    aria-expanded={priorityDropdownOpen}
                  >
                    <span className="truncate">{selectedPriorityLabel}</span>
                    <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-200 ${priorityDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {priorityDropdownOpen && (
                    <div className="chat-dropdown-panel absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-[14px] border border-slate-200/80 bg-white p-1 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                      {priorityFilterOptions.map((opt) => {
                        const active = priorityFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setPriorityFilter(opt.value);
                              setPriorityDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-xs transition-all duration-200 ${
                              active
                                ? "bg-gradient-to-r from-violet-500/12 to-blue-500/10 text-violet-700 dark:text-violet-300"
                                : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                            }`}
                            role="option"
                            aria-selected={active}
                          >
                            <span>{opt.label}</span>
                            {active ? <Check size={12} /> : <span className="w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {tagsCatalog.slice(0, 8).map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-all duration-200 ${
                        active
                          ? "border-violet-400/50 bg-gradient-to-r from-violet-500/15 to-blue-500/10 text-violet-700 dark:text-violet-300"
                          : "border-slate-200/80 text-slate-600 hover:border-violet-200 dark:border-slate-600 dark:text-slate-400"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
              </>
            )}
            {!isSupport && conversationSearchField}
              </div>
            )}
            {!addFriendMode && !supportRequestMode && friends.length > 0 && (
              <div className="rounded-[14px] border border-slate-200/60 bg-white/60 p-2 dark:border-slate-700/50 dark:bg-slate-800/40">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prietenii mei</p>
                <div className="space-y-1">
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-1 rounded-[10px] px-1 py-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => void openChatWithFriend(f.id)}
                        disabled={openingFriendChatId !== null}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-violet-50/80 dark:hover:bg-slate-800/80 disabled:opacity-60"
                        title="Deschide conversația"
                      >
                        <img
                          src={avatarSrc(f.avatar) || DEFAULT_AVATAR_URL}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80 dark:ring-slate-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{f.displayName}</div>
                          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">{f.role}</div>
                        </div>
                        {openingFriendChatId === f.id ? (
                          <span className="shrink-0 text-[10px] text-slate-400">…</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingRemoveFriendId(f.id);
                        }}
                        disabled={friendActionId === f.id}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label="Elimină prieten"
                        title="Elimină"
                      >
                        {friendActionId === f.id ? <span className="text-[10px]">…</span> : <X className="h-3.5 w-3.5" strokeWidth={2} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isSupport && !addFriendMode && !supportRequestMode && (
            <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200/70 bg-white/70 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-slate-600/50 dark:bg-slate-800/60 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                aria-expanded={inboxSupportExpanded}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/80 dark:hover:bg-slate-800/70"
                onClick={() => setInboxSupportExpanded((v) => !v)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">Inbox support</span>
                  <span className="inline-flex shrink-0 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                    {filteredInbox.length}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-slate-400 transition-transform duration-300 ease-out ${inboxSupportExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  inboxSupportExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 border-t border-slate-100/90 px-2 pb-3 pt-2 dark:border-slate-700/50">
                    {loading && filteredInbox.length === 0 && (
                      <>
                        <div className="h-16 animate-pulse rounded-[14px] bg-slate-100 dark:bg-slate-800" />
                        <div className="h-16 animate-pulse rounded-[14px] bg-slate-100 dark:bg-slate-800" />
                      </>
                    )}
                    {filteredInbox.map((c) => (
                      <div
                        key={`inbox-${c.id}`}
                        className={`rounded-[14px] border p-3 transition-all duration-200 ease-out ${
                          selectedChatId === c.id
                            ? "border-violet-300/50 bg-gradient-to-r from-violet-500/10 to-blue-500/8 shadow-[0_4px_16px_-6px_rgba(124,58,237,0.2)] dark:border-violet-500/35"
                            : "border-slate-100/90 bg-white/90 hover:border-violet-200/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50"
                        }`}
                      >
                        <button
                          className="w-full text-left"
                          onClick={() => setSelectedChatId(c.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const w = 220;
                            const h = 52;
                            const x = Math.min(Math.max(8, e.clientX), window.innerWidth - w - 8);
                            const y = Math.min(Math.max(8, e.clientY), window.innerHeight - h - 8);
                            setConversationMenu({ x, y, chatId: c.id });
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-xs font-semibold text-violet-700 ring-2 ring-white shadow-sm dark:from-violet-900/50 dark:to-blue-900/40 dark:text-violet-200 dark:ring-slate-800">
                              <img src={avatarSrc(c.requesterAvatar) || DEFAULT_AVATAR_URL} alt={c.requesterEmail || "avatar"} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                                  {c.requesterDisplayName || nameFromEmail(c.requesterEmail) || "User"}
                                </div>
                                {(unreadCountByChat[c.id] ?? 0) > 0 && (
                                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                                    {unreadCountByChat[c.id]}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {(isSupportTicketChat(c) || c.status === "closed") && (
                                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusChipClass(c.status)}`}>
                                    {c.status}
                                  </span>
                                )}
                                {isSupportTicketChat(c) && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                                    {c.priority ?? "normal"}
                                  </span>
                                )}
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                                  {c.requesterRole || "staff"}
                                </span>
                              </div>
                              <div className={chatUi.convTime}>{formatRelativeTime(c.updatedAt)}</div>
                              <div className={chatUi.convMeta}>
                                {c.messages && c.messages.length > 0
                                  ? c.messages[c.messages.length - 1].message
                                  : "Fără mesaje încă"}
                              </div>
                            </div>
                          </div>
                        </button>
                        {c.status === "open" && isSupportTicketChat(c) && (
                          <button
                            type="button"
                            onClick={() => void acceptChat(c.id)}
                            className="mt-2 rounded-[10px] border border-violet-300/50 bg-gradient-to-r from-violet-500/10 to-blue-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 transition-all duration-200 hover:shadow-sm dark:text-violet-300"
                          >
                            Acceptă
                          </button>
                        )}
                        {isSupportTicketChat(c) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => void assignToMe(c.id)}
                              className="rounded-[10px] border border-slate-200/80 px-2.5 py-1 text-[10px] transition-all duration-200 hover:border-violet-200 dark:border-slate-600"
                            >
                              Assign me
                            </button>
                            <button
                              type="button"
                              onClick={() => void setPriority(c.id, "urgent")}
                              className="rounded-[10px] border border-slate-200/80 px-2.5 py-1 text-[10px] transition-all duration-200 hover:border-rose-200 dark:border-slate-600"
                            >
                              Urgent
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredInbox.length === 0 && !loading && (
                      <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-3 py-4 text-center dark:border-slate-700/50 dark:bg-slate-800/30">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Inbox gol</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">Nicio solicitare de procesat.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!addFriendMode && !supportRequestMode && (
          <div
            key={sidebarMainEnterTick}
            className={`${chatUi.myConversationsPanel} ${
              sidebarMainEnterTick > 0 ? "conversations-panel-enter" : ""
            }`}
          >
            <p className={chatUi.myConversationsLabel}>Conversațiile mele</p>
            <div className="space-y-2">
              {loading && filteredMine.length === 0 && (
                <>
                  <div className={chatUi.skeleton} />
                  <div className={chatUi.skeleton} />
                </>
              )}
              {filteredMine.map((c) => {
                const myUid = String(user?.id ?? "");
                const sidebarBadgeText = peerSidebarBadgeText(c, myUid, isSupport);
                return (
                <button
                  key={`mine-${c.id}`}
                  onClick={() => setSelectedChatId(c.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const w = 220;
                    const h = 52;
                    const x = Math.min(Math.max(8, e.clientX), window.innerWidth - w - 8);
                    const y = Math.min(Math.max(8, e.clientY), window.innerHeight - h - 8);
                    setConversationMenu({ x, y, chatId: c.id });
                  }}
                  className={`w-full rounded-[14px] border p-3 text-left transition-all duration-200 ease-out ${
                    selectedChatId === c.id ? chatUi.convSelected : chatUi.convIdle
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={chatUi.convAvatar}>
                      <img
                        src={peerAvatarUrlForSidebar(c, myUid, isSupport)}
                        alt={(isSupport ? c.requesterEmail : c.acceptedByEmail) || "avatar"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className={chatUi.convName}>
                          {peerDisplayNameForSidebar(c, myUid, isSupport)}
                        </div>
                        {(unreadCountByChat[c.id] ?? 0) > 0 && (
                          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                            {unreadCountByChat[c.id]}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {(isSupportTicketChat(c) || c.status === "closed") && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusChipClass(c.status)}`}>
                            {c.status}
                          </span>
                        )}
                        {isSupportTicketChat(c) && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                            {c.priority ?? "normal"}
                          </span>
                        )}
                        <span
                          className="inline-flex max-w-[min(100%,200px)] truncate px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                          title={sidebarBadgeText}
                        >
                          {sidebarBadgeText}
                        </span>
                      </div>
                      <div className={chatUi.convTime}>{formatRelativeTime(c.updatedAt)}</div>
                      <div className={chatUi.convMeta}>
                        {c.messages && c.messages.length > 0
                          ? c.messages[c.messages.length - 1].message
                          : "Fără mesaje încă"}
                      </div>
                    </div>
                  </div>
                </button>
                );
              })}
              {filteredMine.length === 0 && !loading && (
                <div className={chatUi.emptyConversationCard}>
                  <div className={chatUi.emptyConversationIcon}>
                    <Inbox className={chatUi.emptyConversationIconColor} strokeWidth={1.5} aria-hidden />
                  </div>
                  <div className="max-w-[220px] space-y-1">
                    <p className={chatUi.emptyConversationTitle}>Nicio conversație încă</p>
                    <p className={chatUi.emptyConversationBody}>
                      Mesajele tale vor apărea aici. Poți adăuga prieteni sau trimite o solicitare către echipa de support din zona de mai sus.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </aside>

        <section className={chatUi.mainSection}>
          <div className={chatUi.mainHeader}>
            <div className="flex items-center gap-3">
              {selected && (
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-blue-100 shadow-md ring-2 ring-white dark:from-violet-900/60 dark:to-blue-900/50 dark:ring-slate-800">
                  <img src={selectedPeerAvatar || DEFAULT_AVATAR_URL} alt={selectedPeerEmail || "avatar"} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className={chatUi.mainTitle}>
                    {selected ? selectedPeerName || selectedPeerEmail || `Chat #${selected.id}` : "Selectează o conversație"}
                  </h2>
                  <p className={chatUi.mainSubtitle}>
                    {selected ? selectedPeerEmail : "Alege o conversație din listă"}
                  </p>
                </div>
                {selected ? (
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const name = (selectedPeerName || "").trim();
                        const email = (selectedPeerEmail || "").trim();
                        const text = [name, email].filter(Boolean).join("\n");
                        if (!text) return;
                        const ok = await copyTextToClipboard(text);
                        if (!ok) setError("Nu am putut copia în clipboard.");
                        else setError(null);
                      })();
                    }}
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-violet-600 active:scale-[0.97] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-violet-400"
                    title="Copiază nume și email"
                    aria-label="Copiază nume și email"
                  >
                    <Copy className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
              {selected && (
                <div className="relative ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                  {voiceCallEligible ? (
                    <button
                      type="button"
                      onClick={() => void voiceCall.startCall()}
                      disabled={voiceCall.phase !== "idle" && voiceCall.phase !== "ended"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800/90"
                      title="Apel audio în aplicație"
                      aria-label="Apel audio în aplicație"
                    >
                      <Phone className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setChatInfoOpen((v) => !v)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.97] dark:text-slate-300 dark:hover:bg-slate-800/90"
                    title="Detalii conversație"
                    aria-label="Detalii conversație"
                    aria-expanded={chatInfoOpen}
                  >
                    <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/90 dark:bg-white dark:ring-white/20">
                      <span className="font-serif text-[13px] font-semibold leading-none tracking-tight text-black">i</span>
                    </span>
                  </button>
                  {chatInfoOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-[45] cursor-default bg-transparent"
                        aria-label="Închide"
                        onClick={() => setChatInfoOpen(false)}
                      />
                      <div
                        className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left shadow-xl ring-1 ring-slate-200/50 backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/95 dark:ring-slate-700/50"
                        style={{ animation: "modal-element-enter 0.2s ease-out" }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conversație</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {selectedPeerName || selectedPeerEmail || "Utilizator"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">{selectedPeerEmail}</p>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const name = (selectedPeerName || "").trim();
                              const email = (selectedPeerEmail || "").trim();
                              const text = [name, email, `ID chat: ${selected.id}`].filter(Boolean).join("\n");
                              const ok = await copyTextToClipboard(text);
                              if (!ok) setError("Nu am putut copia în clipboard.");
                              else {
                                setError(null);
                                setChatInfoOpen(false);
                              }
                            })();
                          }}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-950/40"
                        >
                          <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          Copiază datele utilizatorului
                        </button>
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          ID chat: <span className="font-mono text-slate-700 dark:text-slate-300">{selected.id}</span>
                        </p>
                      </div>
                    </>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="inline-flex rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-800 ring-1 ring-blue-500/15 dark:text-blue-300">
                    {peerRoleLabelForSidebar(selected, String(user?.id ?? ""), isSupport)}
                  </span>
                  {selectedIsSupportTicket ? (
                    <>
                      <span className="inline-flex rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-500/15 dark:text-violet-300">
                        {selected.priority ?? "normal"}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-500/15 dark:text-slate-300">
                        assignee: {selected.assignedToEmail || "unassigned"}
                      </span>
                      <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-800 ring-1 ring-rose-500/15 dark:text-rose-300">
                        {selected.escalationLevel ?? "none"}
                      </span>
                      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/15 dark:text-amber-200">
                        {selected.status}
                      </span>
                    </>
                  ) : selected.status === "closed" ? (
                    <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/15 dark:text-amber-200">
                      {selected.status}
                    </span>
                  ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            key={selected?.id ?? "chat-empty"}
            className={chatUi.messagesArea}
            style={{ animation: "modal-element-enter 0.24s ease-out" }}
            ref={messageListRef}
          >
            {!selected ? (
              <div className="flex h-full min-h-[280px] items-center justify-center px-4">
                <div className={chatUi.welcomeCard}>
                  <div className={chatUi.welcomeIconWrap}>
                    <MessageCircle className={chatUi.welcomeIcon} strokeWidth={1.35} />
                  </div>
                  <div>
                    <p className={chatUi.welcomeTitle}>Bine ai venit</p>
                    <p className={chatUi.welcomeBody}>
                      Selectează o conversație din listă sau pornește una nouă (prieteni sau solicitare către echipa de support).
                    </p>
                  </div>
                </div>
              </div>
            ) : (selected.messages ?? []).length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-[14px] border border-dashed border-slate-200/80 bg-white/50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-400">
                Niciun mesaj încă — spune „salut” 👋
              </div>
            ) : (
              <div className="space-y-4">
                {(selected.messages ?? []).map((m, idx) => {
                  const mine = messageIsMine(m, user);
                  const msgText = m.message ?? "";
                  const q = messageSearch.trim();
                  const hasMatch = q.length > 0 && msgText.toLowerCase().includes(q.toLowerCase());
                  const shownText = msgText.replace(/\[attachment:[^\]]+\]/g, "").trim();
                  const attachmentMeta = (msgText.match(/\[attachment:([^\|\]]+)\|([^\|\]]+)\|([^\]]+)\]/) ?? []);
                  const attachmentName = attachmentMeta[1];
                  const attachmentType = attachmentMeta[2];
                  const attachmentDataUrl = attachmentMeta[3];
                  const msgTs = new Date(m.createdAt).getTime();
                  const seen = mine && Number.isFinite(msgTs) && msgTs > 0 && msgTs <= peerSeenTs;
                  const delivered = mine && !seen && !!deliveredAtByMessageId[m.id];
                  const isLastMineMessage = mine && String(m.id ?? "") === lastMineMessageId;
                  const messageStatus = isLastMineMessage ? (seen ? "seen" : delivered ? "delivered" : "sent") : null;
                  return (
                    <div key={m.id}>
                      {unreadStartIndex >= 0 && idx === unreadStartIndex && (
                        <div className="sticky top-2 z-10 mb-3 flex items-center gap-2">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-300/50 to-transparent dark:via-violet-600/40" />
                          <span className="rounded-full bg-gradient-to-r from-violet-500/15 to-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                            Mesaje noi
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-300/50 to-transparent dark:via-violet-600/40" />
                        </div>
                      )}
                      <div className={`chat-msg-enter flex items-end gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200/90 text-[10px] font-semibold text-slate-700 shadow-sm ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-800">
                            <img src={avatarSrc(selectedPeerAvatar) || DEFAULT_AVATAR_URL} alt={m.senderEmail} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div
                          className={`max-w-[min(74%,520px)] rounded-[20px] px-4 py-2.5 shadow-md transition-shadow duration-200 ${
                            mine
                              ? "bg-gradient-to-br from-violet-600 via-violet-500 to-blue-600 text-white shadow-violet-500/25 ring-1 ring-white/10"
                              : "border border-slate-200/80 bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100 dark:ring-slate-600/40"
                          } ${hasMatch ? "ring-2 ring-amber-400/90" : ""}`}
                          onContextMenu={
                            mine
                              ? (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const w = 240;
                                  const h = 96;
                                  const x = Math.min(Math.max(8, e.clientX), window.innerWidth - w - 8);
                                  const y = Math.min(Math.max(8, e.clientY), window.innerHeight - h - 8);
                                  const copyText =
                                    shownText + (attachmentName ? `${shownText ? "\n" : ""}📎 ${attachmentName}` : "");
                                  setSentMessageMenu({
                                    x,
                                    y,
                                    chatId: selected.id,
                                    messageId: m.id,
                                    copyText,
                                  });
                                }
                              : undefined
                          }
                        >
                          <div className="text-[14px] leading-5 whitespace-pre-wrap break-words">
                            {renderMessageWithNotoEmojis(shownText, String(m.id))}
                          </div>
                          {attachmentName && attachmentDataUrl && (
                            <div className="mt-2 text-[12px]">
                              {attachmentType?.startsWith("image/") ? (
                                <a href={attachmentDataUrl} target="_blank" rel="noreferrer" className={mine ? "text-white underline" : "text-primary underline"}>
                                  📎 {attachmentName}
                                </a>
                              ) : (
                                <a href={attachmentDataUrl} download={attachmentName} className={mine ? "text-white underline" : "text-primary underline"}>
                                  📎 {attachmentName}
                                </a>
                              )}
                            </div>
                          )}
                          <div className={`mt-1 text-[11px] tabular-nums ${mine ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {messageStatus && (
                            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/85">{messageStatus}</div>
                          )}
                        </div>
                        {mine && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-200 to-blue-200 text-[10px] font-semibold text-violet-800 shadow-sm ring-2 ring-white dark:from-violet-900 dark:to-blue-900 dark:text-violet-200 dark:ring-slate-800">
                            <img
                              src={
                                avatarSrc(isSupport && selectedIsSupportTicket ? SUPPORT_AVATAR_URL : user?.avatar) ||
                                (isSupport && selectedIsSupportTicket ? SUPPORT_AVATAR_URL : DEFAULT_AVATAR_URL)
                              }
                              alt={user?.email || "avatar"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
            {selected && typingByChat[selected.id]?.isTyping && typingByChat[selected.id]?.userId !== String(user?.id ?? "") && (
              <div className="mt-4 flex items-center gap-2 px-1">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                  <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-violet-500 [animation-delay:0ms]" />
                  <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-violet-500 [animation-delay:150ms]" />
                  <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-violet-500 [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedPeerName || "User"}</span> scrie…
                </span>
              </div>
            )}
            {sending && (
              <div className="mt-3 flex justify-end">
                <div className="max-w-[80%] rounded-[18px] border border-violet-200/60 bg-gradient-to-r from-violet-500/10 to-blue-500/10 px-4 py-2.5 shadow-sm dark:border-violet-500/30">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {selected && (
          <div className="border-t border-slate-200/60 bg-white/75 p-4 shadow-[0_-10px_40px_-12px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/65 dark:shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.4)]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Caută în conversație…"
                className="min-w-[140px] flex-1 rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm transition-all duration-200 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-slate-600 dark:bg-slate-800/80"
              />
              <button
                type="button"
                className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-violet-200 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
              >
                Ultimul mesaj
              </button>
              {isSupport && selectedIsSupportTicket && (
                <button
                  type="button"
                  className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium shadow-sm transition-all duration-200 hover:border-violet-200 dark:border-slate-600 dark:bg-slate-800/80"
                  onClick={() => setTemplatesOpen((v) => !v)}
                >
                  Template-uri
                </button>
              )}
              {selected && isSupport && selectedIsSupportTicket && (
                <>
                  <button type="button" className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80" onClick={() => void assignToMe(selected.id)}>
                    Assign me
                  </button>
                  <button type="button" className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80" onClick={() => void setPriority(selected.id, "high")}>
                    Priority high
                  </button>
                  <button type="button" className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80" onClick={() => void setPriority(selected.id, "urgent")}>
                    Priority urgent
                  </button>
                  <button type="button" className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80" onClick={() => void escalateSelected("level_1")}>
                    Escalate L1
                  </button>
                  <button type="button" className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80" onClick={() => void setReminderIn30m()}>
                    Reminder 30m
                  </button>
                </>
              )}
              {selected && isSupport && (
                <button
                  type="button"
                  className="rounded-[12px] border border-red-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800/80 dark:hover:bg-red-950/30"
                  onClick={() => void closeSelectedChat()}
                >
                  Închide chat
                </button>
              )}
              {selected && isSupport && (
                <button
                  type="button"
                  className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-200 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                  onClick={() => selected && setPendingDeleteChatId(selected.id)}
                >
                  Șterge din lista mea
                </button>
              )}
              {selected && selected.status === "closed" && isSupport && selectedIsSupportTicket && (
                <button
                  type="button"
                  className="rounded-[12px] border border-emerald-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-slate-800/80 dark:text-emerald-400"
                  onClick={() => void reopenChat(selected.id)}
                >
                  Redeschide chat
                </button>
              )}
              {selected && isSupport && selectedIsSupportTicket && (
                <button
                  type="button"
                  className="rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/80"
                  onClick={() => void saveTagsForSelected()}
                >
                  Save tags
                </button>
              )}
            </div>
            {isSupport && selectedIsSupportTicket && templatesOpen && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[...quickTemplates, ...macros.map((m) => m.content)].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="rounded-full border border-slate-200/80 bg-white/95 px-3 py-1.5 text-[11px] text-slate-700 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                    onClick={() => {
                      const next = draft ? `${draft}\n${tpl}` : tpl;
                      setDraft(next);
                      if (selectedChatId) persistDraft(selectedChatId, next);
                    }}
                  >
                    {tpl.slice(0, 28)}...
                  </button>
                ))}
              </div>
            )}
            {selected && isSupport && selectedIsSupportTicket && (
              <div className="mb-3 max-h-24 overflow-auto rounded-[14px] border border-slate-200/70 bg-white/90 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/50">
                <div className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Timeline</div>
                {timelineEvents.length === 0 ? (
                  <div className="text-[11px] text-gray-500">Fără evenimente.</div>
                ) : (
                  timelineEvents.slice(0, 8).map((ev) => (
                    <div key={ev.id} className="text-[11px] text-gray-600">
                      {ev.eventType} - {ev.actorEmail || "system"} - {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  ))
                )}
              </div>
            )}
            {selected && isSupport && selectedIsSupportTicket && (
              <div className="mb-3">
                <textarea
                  value={internalNote}
                  onChange={(e) => {
                    setInternalNote(e.target.value);
                    persistInternalNote(selected.id, e.target.value);
                  }}
                  placeholder="Notițe interne (vizibile doar intern)"
                  className="w-full rounded-[14px] border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs shadow-inner transition-shadow placeholder:text-amber-900/40 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-amber-900/40 dark:bg-amber-950/30"
                  rows={2}
                />
              </div>
            )}
            <div className={chatUi.composerWrap}>
              <textarea
                value={draft}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setDraft(nextValue);
                  if (selectedChatId) persistDraft(selectedChatId, nextValue);
                  if (!selectedChatId) return;
                  const shouldType = nextValue.trim().length > 0;
                  if (shouldType) {
                    pushTyping(selectedChatId, true);
                    if (typingHeartbeatRef.current !== null) window.clearInterval(typingHeartbeatRef.current);
                    typingHeartbeatRef.current = window.setInterval(() => pushTyping(selectedChatId, true), 2500);
                    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
                    typingStopTimerRef.current = window.setTimeout(() => {
                      pushTyping(selectedChatId, false);
                      if (typingHeartbeatRef.current !== null) {
                        window.clearInterval(typingHeartbeatRef.current);
                        typingHeartbeatRef.current = null;
                      }
                    }, 2800);
                  } else {
                    pushTyping(selectedChatId, false);
                    if (typingStopTimerRef.current !== null) {
                      window.clearTimeout(typingStopTimerRef.current);
                      typingStopTimerRef.current = null;
                    }
                    if (typingHeartbeatRef.current !== null) {
                      window.clearInterval(typingHeartbeatRef.current);
                      typingHeartbeatRef.current = null;
                    }
                  }
                }}
                onBlur={() => {
                  if (!selectedChatId) return;
                  pushTyping(selectedChatId, false);
                  if (typingStopTimerRef.current !== null) {
                    window.clearTimeout(typingStopTimerRef.current);
                    typingStopTimerRef.current = null;
                  }
                  if (typingHeartbeatRef.current !== null) {
                    window.clearInterval(typingHeartbeatRef.current);
                    typingHeartbeatRef.current = null;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                disabled={!selected || isSelectedClosed || isWaitingSupportAccept}
                placeholder={
                  !selected
                    ? "Selectează mai întâi un chat"
                    : isSelectedClosed
                      ? "Chat închis. Nu mai poți trimite mesaje."
                      : isWaitingSupportAccept
                        ? "Așteaptă: un agent support trebuie să accepte solicitarea."
                      : "Scrie mesaj... (Shift+Enter newline, Ctrl+Enter send)"
                }
                className={chatUi.composerText}
                rows={1}
              />
              <div className="relative shrink-0 self-end" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen((v) => !v)}
                  disabled={!selected || isSelectedClosed || isWaitingSupportAccept}
                  className={`${chatUi.composerToolBtn} ${
                    !selected || isSelectedClosed || isWaitingSupportAccept ? "pointer-events-none cursor-not-allowed opacity-50" : ""
                  }`}
                  title="Emoji"
                  aria-label="Emoji"
                  aria-expanded={emojiPickerOpen}
                >
                  <Smile className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                </button>
                {emojiPickerOpen && !(!selected || isSelectedClosed || isWaitingSupportAccept) ? (
                  <div className={chatUi.emojiPanel} role="listbox">
                    <div className="grid max-h-[min(40vh,220px)] grid-cols-8 gap-0.5 overflow-y-auto overflow-x-hidden p-1">
                      {CHAT_CUSTOM_EMOJIS.length === 0 ? (
                        <div className="col-span-8 px-2 py-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
                          Adaugă emoji în lista <span className="font-mono text-[10px]">CHAT_CUSTOM_EMOJIS</span> (codepoint + char).
                        </div>
                      ) : null}
                      {CHAT_CUSTOM_EMOJIS.map((item) => (
                        <button
                          key={item.codepoint}
                          type="button"
                          role="option"
                          aria-label={item.char}
                          title={item.char}
                          className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-violet-100/90 dark:hover:bg-violet-900/40"
                          onClick={() => {
                            setDraft((prev) => {
                              const next = prev + item.char;
                              if (selectedChatId) persistDraft(selectedChatId, next);
                              return next;
                            });
                            setEmojiPickerOpen(false);
                          }}
                        >
                          <picture className="pointer-events-none flex h-8 w-8 items-center justify-center">
                            <source srcSet={notoEmojiSrc(item.codepoint, "webp")} type="image/webp" />
                            <img
                              src={notoEmojiSrc(item.codepoint, "gif")}
                              alt={item.char}
                              width={32}
                              height={32}
                              className="h-8 w-8 select-none object-contain"
                              loading="lazy"
                              draggable={false}
                            />
                          </picture>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <label
                className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-slate-200/80 bg-slate-50/90 text-slate-500 shadow-sm transition-all duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-400 dark:hover:border-violet-500/40 ${
                  !selected || isSelectedClosed || isWaitingSupportAccept ? "pointer-events-none cursor-not-allowed opacity-50" : ""
                }`}
              >
                <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf,.log,.txt"
                  disabled={!selected || isSelectedClosed || isWaitingSupportAccept}
                  onChange={(e) => {
                    if (!selected || isSelectedClosed || isWaitingSupportAccept) return;
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > MAX_ATTACHMENT_BYTES) {
                      setAttachment(null);
                      setAttachmentError(`Fișier prea mare. Limita este ${(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAttachment({ name: f.name, type: f.type || "application/octet-stream", dataUrl: String(reader.result || "") });
                      setAttachmentError(null);
                    };
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!selected || isSelectedClosed || isWaitingSupportAccept || !draft.trim() || loading}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-[0_4px_16px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/15 transition-all duration-200 ease-out hover:brightness-[1.05] hover:shadow-[0_6px_22px_-2px_rgba(124,58,237,0.55)] hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                aria-label="Trimite"
              >
                <Send size={18} strokeWidth={1.75} />
              </button>
            </div>
            {isSelectedClosed && <div className="mt-1 text-[11px] text-amber-700">Chat închis: trimiterea de mesaje este dezactivată.</div>}
            {isWaitingSupportAccept && (
              <div className="mt-1 text-[11px] text-amber-700">Solicitarea este în așteptare. Poți trimite mesaje după ce un agent support acceptă chatul.</div>
            )}
            {attachment && (
              <div className="mt-1 text-[11px] text-gray-600">
                Atașat: {attachment.name}{" "}
                <button type="button" className="text-red-600" onClick={() => setAttachment(null)}>
                  elimină
                </button>
              </div>
            )}
            {attachmentError && (
              <div className="mt-1 text-[11px] text-red-600">{attachmentError}</div>
            )}
            <div className="mt-1 text-[11px] text-gray-500">Limită fișier: {(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)} MB</div>
          </div>
          )}
        </section>
      </div>
      {pendingDeleteChatId && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
          style={{ animation: "support-modal-fade-in 180ms ease-out both" }}
          onClick={() => {
            if (!loading) setPendingDeleteChatId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-600 dark:bg-slate-900/95"
            style={{ animation: "support-modal-pop-in 220ms ease-out both" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-chat-title"
          >
            <h3 id="confirm-delete-chat-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Confirmare ștergere conversație
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sigur vrei să elimini această conversație din lista ta? Acțiunea nu poate fi anulată din interfață.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setPendingDeleteChatId(null)}
                disabled={loading}
              >
                Renunță
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow-md disabled:opacity-60"
                onClick={() => void deleteChatForMe(pendingDeleteChatId)}
                disabled={loading}
              >
                {loading ? "Se șterge..." : "Șterge conversația"}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingRemoveFriendId && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
          style={{ animation: "support-modal-fade-in 180ms ease-out both" }}
          onClick={() => {
            if (!friendActionId) setPendingRemoveFriendId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-600 dark:bg-slate-900/95"
            style={{ animation: "support-modal-pop-in 220ms ease-out both" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-remove-friend-title"
          >
            <h3 id="confirm-remove-friend-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Confirmare eliminare prieten
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sigur vrei să elimini pe{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {friends.find((x) => x.id === pendingRemoveFriendId)?.displayName ||
                  friends.find((x) => x.id === pendingRemoveFriendId)?.email ||
                  "acest contact"}
              </span>{" "}
              din lista ta de prieteni?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setPendingRemoveFriendId(null)}
                disabled={friendActionId !== null}
              >
                Renunță
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-700 hover:shadow-md disabled:opacity-60"
                onClick={() => void confirmRemoveFriend()}
                disabled={friendActionId !== null}
              >
                {friendActionId === pendingRemoveFriendId ? "Se elimină..." : "Elimină prietenul"}
              </button>
            </div>
          </div>
        </div>
      )}
      {conversationMenu
        ? createPortal(
            <div
              ref={conversationMenuRef}
              className="fixed z-[9999] min-w-[208px] overflow-hidden rounded-[14px] border border-slate-200/90 bg-white py-1 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/40 dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] dark:ring-slate-700/50"
              style={{ left: conversationMenu.x, top: conversationMenu.y }}
              role="menu"
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/35"
                onClick={() => {
                  const id = conversationMenu.chatId;
                  setConversationMenu(null);
                  setSelectedChatId(id);
                  setPendingDeleteChatId(id);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                Șterge conversație
              </button>
            </div>,
            document.body
          )
        : null}
      {sentMessageMenu
        ? createPortal(
            <div
              ref={sentMessageMenuRef}
              className="fixed z-[9999] min-w-[220px] overflow-hidden rounded-[14px] border border-slate-200/90 bg-white py-1 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/40 dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] dark:ring-slate-700/50"
              style={{ left: sentMessageMenu.x, top: sentMessageMenu.y }}
              role="menu"
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-slate-800 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/90"
                onClick={() => {
                  const t = sentMessageMenu.copyText;
                  setSentMessageMenu(null);
                  void (async () => {
                    const ok = await copyTextToClipboard(t);
                    if (!ok) setError("Nu am putut copia în clipboard.");
                    else setError(null);
                  })();
                }}
              >
                <Copy className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                Copiază
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/35"
                disabled={loading}
                onClick={async () => {
                  const { chatId, messageId } = sentMessageMenu;
                  setSentMessageMenu(null);
                  const mid = String(messageId ?? "").trim();
                  if (!mid || mid === "undefined") {
                    setError("Mesaj invalid. Reîncarcă conversația și încearcă din nou.");
                    return;
                  }
                  setLoading(true);
                  setError(null);
                  try {
                    await authApi.supportChatDeleteMessage(chatId, mid);
                    stripMessageFromChats(String(chatId), mid);
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Nu am putut anula mesajul.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Undo2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                Anulează trimiterea
              </button>
            </div>,
            document.body
          )
        : null}
      <VoiceCallOverlay
        phase={voiceCall.phase}
        error={voiceCall.error}
        peerName={selectedPeerName || selectedPeerEmail || "Utilizator"}
        peerAvatar={selectedPeerAvatar}
        isMuted={voiceCall.isMuted}
        settingsOpen={voiceCall.settingsOpen}
        setSettingsOpen={voiceCall.setSettingsOpen}
        audioInputs={voiceCall.audioInputs}
        audioOutputs={voiceCall.audioOutputs}
        selectedInputId={voiceCall.selectedInputId}
        setSelectedInputId={voiceCall.setSelectedInputId}
        selectedOutputId={voiceCall.selectedOutputId}
        setSelectedOutputId={voiceCall.setSelectedOutputId}
        refreshDevices={voiceCall.refreshDevices}
        applyMicFromSettings={voiceCall.applyMicFromSettings}
        remoteAudioRef={voiceCall.remoteAudioRef}
        toggleMute={voiceCall.toggleMute}
        endCall={voiceCall.endCall}
        acceptCall={voiceCall.acceptCall}
        rejectCall={voiceCall.rejectCall}
      />
    </div>
  );
}

