import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MessageCircle, Send } from "lucide-react";
import { authApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";

type ChatStatus = "open" | "accepted" | "closed";
type ChatPriority = "low" | "normal" | "high" | "urgent";
type EscalationLevel = "none" | "level_1" | "level_2" | "critical";
type ChatMessage = {
  id: string;
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

const SUPPORT_AVATAR_URL = "/Illustration/SupportAvatar.png";
const DEFAULT_AVATAR_URL = "/Illustration/AvatarWhiteGuy.png";

function nameFromEmail(email?: string | null): string {
  const raw = String(email ?? "").trim();
  if (!raw) return "User";
  const left = raw.split("@")[0] || raw;
  return left.replace(/[._-]+/g, " ").trim() || "User";
}

function avatarSrc(url?: string | null): string | undefined {
  const s = String(url ?? "").trim();
  if (!s) return undefined;
  // Ignore file ids/GUIDs that are not directly renderable as images.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return "/Illustration/AvatarWhiteGuy.png";
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return typeof window !== "undefined" ? `${window.location.origin}${s}` : s;
  if (s.startsWith("uploads/")) return typeof window !== "undefined" ? `${window.location.origin}/${s}` : `/${s}`;
  return s;
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

export default function DashboardChat() {
  const { user } = useAuth();
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  /** Inbox support: panou pliabil cu animație (doar rol support) */
  const [inboxSupportExpanded, setInboxSupportExpanded] = useState(true);
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  const [deliveredAtByMessageId, setDeliveredAtByMessageId] = useState<Record<string, number>>({});
  const [newMessagePulse, setNewMessagePulse] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
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
          for (const c of [...mineChats, ...inboxChatsData]) {
            const seenIso = isSupport ? c.lastSeenBySupportAt : c.lastSeenByRequesterAt;
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
          for (const c of mineChats) {
            const seenIso = c.lastSeenByRequesterAt;
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
        if (!last || last.senderEmail.toLowerCase() !== (user?.email ?? "").toLowerCase()) return false;
      }
      if (activeFilter === "waiting_support") {
        const last = c.messages?.[c.messages.length - 1];
        if (!last || last.senderEmail.toLowerCase() === (user?.email ?? "").toLowerCase()) return false;
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
  }, [sortedInbox, search, statusFilter, priorityFilter, activeFilter, selectedTags, user?.email, sortBySla]);

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
    const myEmail = (user?.email ?? "").toLowerCase().trim();
    const combined = [...myChats, ...inboxChats];
    const map: Record<string, number> = {};
    for (const c of combined) {
      if (selectedChatId && c.id === selectedChatId) {
        map[c.id] = 0;
        continue;
      }
      const seenTs = lastSeenMap[c.id] ?? 0;
      const unread = (c.messages ?? []).filter((m) => {
        const msgTs = new Date(m.createdAt).getTime();
        const sender = String(m.senderEmail ?? "").toLowerCase().trim();
        return Number.isFinite(msgTs) && msgTs > seenTs && sender !== myEmail;
      }).length;
      map[c.id] = unread;
    }
    return map;
  }, [myChats, inboxChats, lastSeenMap, user?.email, selectedChatId]);

  const totalUnread = useMemo(
    () => Object.values(unreadCountByChat).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [unreadCountByChat]
  );

  useEffect(() => {
    if (totalUnread <= 0) return;
    setNewMessagePulse(true);
    const t = window.setTimeout(() => setNewMessagePulse(false), 1200);
    if (audioEnabled) {
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
  }, [totalUnread, audioEnabled]);

  const selected = useMemo(() => {
    const fromMine = myChats.find((c) => c.id === selectedChatId);
    if (fromMine) return fromMine;
    return inboxChats.find((c) => c.id === selectedChatId) ?? null;
  }, [selectedChatId, myChats, inboxChats]);
  const selectedPeerEmail = selected
    ? isSupport
      ? selected.requesterEmail
      : selected.acceptedByEmail || selected.requesterEmail
    : "";
  const selectedPeerName = selected
    ? isSupport
      ? selected.requesterDisplayName || (selectedPeerEmail ? selectedPeerEmail.split("@")[0].replace(/[._-]+/g, " ") : "")
      : selected.acceptedByDisplayName || "Support"
    : "";
  const selectedPeerAvatar = selected
    ? isSupport
      ? selected.requesterAvatar || null
      : SUPPORT_AVATAR_URL
    : null;
  const isSelectedClosed = selected?.status === "closed";
  const isWaitingSupportAccept = !!selected && !isSupport && selected.status === "open" && !selected.acceptedByEmail;

  const unreadStartIndex = useMemo(() => {
    if (!selected?.messages || selected.messages.length === 0) return -1;
    const seenTs = lastSeenMap[selected.id] ?? 0;
    const myEmail = (user?.email ?? "").toLowerCase().trim();
    return selected.messages.findIndex((m) => {
      const msgTs = new Date(m.createdAt).getTime();
      if (!Number.isFinite(msgTs)) return false;
      return msgTs > seenTs && String(m.senderEmail ?? "").toLowerCase().trim() !== myEmail;
    });
  }, [selected, lastSeenMap, user?.email]);
  const peerSeenTs = useMemo(() => {
    if (!selected) return 0;
    const peerSeenIso = isSupport ? selected.lastSeenByRequesterAt : selected.lastSeenBySupportAt;
    const ts = peerSeenIso ? new Date(peerSeenIso).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  }, [selected, isSupport]);
  const lastMineMessageId = useMemo(() => {
    if (!selected?.messages?.length || !user?.email) return "";
    const myEmail = String(user.email).toLowerCase().trim();
    for (let i = selected.messages.length - 1; i >= 0; i -= 1) {
      const m = selected.messages[i];
      const sender = String(m.senderEmail ?? "").toLowerCase().trim();
      if (sender === myEmail) return String(m.id ?? "");
    }
    return "";
  }, [selected, user?.email]);

  useEffect(() => {
    if (!selected?.id) return;
    const latestMsgTs = Math.max(
      0,
      ...(selected.messages ?? [])
        .map((m) => new Date(m.createdAt).getTime())
        .filter((v) => Number.isFinite(v))
    );
    // Use max(local now, latest message timestamp) to avoid server/client clock skew.
    const nextSeenTs = Math.max(Date.now(), latestMsgTs);
    setLastSeenMap((prev) => ({ ...prev, [selected.id]: nextSeenTs }));
    void authApi.supportChatSeen(selected.id).catch(() => {});
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
    if (!selected?.id || !isSupport) {
      setTimelineEvents([]);
      return;
    }
    void authApi
      .supportChatTimeline(selected.id)
      .then((r) => setTimelineEvents((r as { events?: any[] }).events ?? []))
      .catch(() => setTimelineEvents([]));
  }, [selected?.id, isSupport]);

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

  const deleteSelectedChatForMe = async () => {
    if (!selected?.id) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatDelete(selected.id);
      await load();
      setSelectedChatId(null);
      setDeleteConfirmOpen(false);
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

  return (
    <div className="mt-4 h-[calc(100vh-156px)] min-h-[560px]">
      <style>{`
        @keyframes support-modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes support-modal-pop-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : null}
      <div className="h-full grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        <aside className="rounded-2xl border border-gray-200/80 p-3 overflow-y-auto bg-white shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`text-xs font-semibold tracking-wide ${newMessagePulse ? "text-primary" : "text-gray-500"}`}>
                  Chat support
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    sseStatus === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {sseStatus === "connected" ? "Realtime: connected" : "Realtime: reconnecting..."}
                </span>
              </div>
              <label className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Sound
              </label>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:border-primary/40 focus:outline-none"
            />
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-haspopup="listbox"
                aria-expanded={statusDropdownOpen}
              >
                <span>{selectedStatusLabel}</span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {statusDropdownOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
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
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          active ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"
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
            {isSupport && (
              <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px]" ref={supportFilterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSupportFilterDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-haspopup="listbox"
                    aria-expanded={supportFilterDropdownOpen}
                  >
                    <span className="truncate">{selectedSupportFilterLabel}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${supportFilterDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {supportFilterDropdownOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dropdown-open-anim">
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
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                              active ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"
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
                <label className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                  <input type="checkbox" checked={sortBySla} onChange={(e) => setSortBySla(e.target.checked)} />
                  sort SLA
                </label>
                <div className="relative min-w-[168px]" ref={priorityDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setPriorityDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-haspopup="listbox"
                    aria-expanded={priorityDropdownOpen}
                  >
                    <span className="truncate">{selectedPriorityLabel}</span>
                    <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${priorityDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {priorityDropdownOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dropdown-open-anim">
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
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                              active ? "bg-primary/10 text-primary" : "text-gray-700 hover:bg-gray-50"
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
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        active ? "border-primary text-primary bg-primary/10" : "border-gray-200 text-gray-600"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
              </>
            )}
            {!isSupport && (
              <>
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Descrie problema ta pentru support (minim 5 caractere)..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-primary/40 focus:outline-none"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => void requestSupport()}
                  disabled={loading || requestDescription.trim().length < 5}
                  className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:brightness-95 disabled:opacity-60"
                >
                  Solicitare support
                </button>
              </>
            )}
          </div>

          {isSupport && (
            <div className="mt-4 rounded-2xl border border-gray-200/80 bg-white/60 shadow-sm overflow-hidden">
              <button
                type="button"
                aria-expanded={inboxSupportExpanded}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50/90"
                onClick={() => setInboxSupportExpanded((v) => !v)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold tracking-wide text-gray-600">Inbox support</span>
                  <span className="inline-flex shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {filteredInbox.length}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-gray-400 transition-transform duration-300 ease-out ${inboxSupportExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  inboxSupportExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 border-t border-gray-100/90 px-2 pb-3 pt-2">
                    {loading && filteredInbox.length === 0 && (
                      <>
                        <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                        <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                      </>
                    )}
                    {filteredInbox.map((c) => (
                      <div
                        key={`inbox-${c.id}`}
                        className={`rounded-xl border p-3 transition-all ${selectedChatId === c.id ? "border-primary/35 bg-primary/[0.04] shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}
                      >
                        <button className="w-full text-left" onClick={() => setSelectedChatId(c.id)}>
                          <div className="flex items-start gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center overflow-hidden">
                              <img src={avatarSrc(c.requesterAvatar) || DEFAULT_AVATAR_URL} alt={c.requesterEmail || "avatar"} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[13px] font-semibold text-gray-900 truncate">
                                  {c.requesterDisplayName || nameFromEmail(c.requesterEmail) || "User"}
                                </div>
                                {(unreadCountByChat[c.id] ?? 0) > 0 && (
                                  <span className="inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
                                    {unreadCountByChat[c.id]}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusChipClass(c.status)}`}>
                                  {c.status}
                                </span>
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700">
                                  {c.priority ?? "normal"}
                                </span>
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                                  {c.requesterRole || "staff"}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] text-gray-400">{formatRelativeTime(c.updatedAt)}</div>
                              <div className="mt-1 text-[11px] text-gray-500 truncate">
                                {c.messages && c.messages.length > 0
                                  ? c.messages[c.messages.length - 1].message
                                  : "Fără mesaje încă"}
                              </div>
                            </div>
                          </div>
                        </button>
                        {c.status === "open" && (
                          <button
                            type="button"
                            onClick={() => void acceptChat(c.id)}
                            className="mt-2 rounded-lg border border-primary/30 px-2 py-1 text-xs text-primary"
                          >
                            Acceptă
                          </button>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button type="button" onClick={() => void assignToMe(c.id)} className="rounded border border-gray-200 px-2 py-1 text-[10px]">
                            Assign me
                          </button>
                          <button type="button" onClick={() => void setPriority(c.id, "urgent")} className="rounded border border-gray-200 px-2 py-1 text-[10px]">
                            Urgent
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredInbox.length === 0 && !loading && (
                      <div className="px-1 py-2 text-xs text-gray-500">Nicio solicitare în inbox.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="px-1 mb-2 text-xs font-semibold tracking-wide text-gray-500">My chats</p>
            <div className="space-y-2">
              {loading && filteredMine.length === 0 && (
                <>
                  <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                  <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                </>
              )}
              {filteredMine.map((c) => (
                <button
                  key={`mine-${c.id}`}
                  onClick={() => setSelectedChatId(c.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    selectedChatId === c.id ? "border-primary/35 bg-primary/[0.04] shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center overflow-hidden">
                      <img
                        src={avatarSrc(isSupport ? c.requesterAvatar : SUPPORT_AVATAR_URL) || DEFAULT_AVATAR_URL}
                        alt={(isSupport ? c.requesterEmail : c.acceptedByEmail) || "avatar"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-gray-900 truncate">
                          {isSupport ? c.requesterDisplayName || nameFromEmail(c.requesterEmail) : c.acceptedByDisplayName || nameFromEmail(c.acceptedByEmail) || "Support"}
                        </div>
                        {(unreadCountByChat[c.id] ?? 0) > 0 && (
                          <span className="inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
                            {unreadCountByChat[c.id]}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusChipClass(c.status)}`}>
                          {c.status}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700">
                          {c.priority ?? "normal"}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                          {isSupport ? (c.requesterRole || "staff") : "support"}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400">{formatRelativeTime(c.updatedAt)}</div>
                      <div className="mt-1 text-[11px] text-gray-500 truncate">
                        {c.messages && c.messages.length > 0
                          ? c.messages[c.messages.length - 1].message
                          : "Fără mesaje încă"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredMine.length === 0 && <div className="text-xs text-gray-500">Nu există conversații.</div>}
            </div>
          </div>
        </aside>

        <section className="flex flex-col min-h-0 bg-[#F5F6F8] rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-200/80 bg-[#F5F6F8]">
            <div className="flex items-center gap-3">
              {selected && (
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center overflow-hidden">
                  <img src={avatarSrc(selectedPeerAvatar) || DEFAULT_AVATAR_URL} alt={selectedPeerEmail || "avatar"} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-[22px] leading-6 font-semibold text-gray-900 capitalize tracking-tight">
                  {selected ? selectedPeerName || selectedPeerEmail || `Chat #${selected.id}` : "Selectează o conversație"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {selected ? selectedPeerEmail : "Alege un chat din stânga."}
                </p>
              </div>
              {selected && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {selected.requesterRole || "staff"}
                  </span>
                  <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    {selected.priority ?? "normal"}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    assignee: {selected.assignedToEmail || "unassigned"}
                  </span>
                  <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                    {selected.escalationLevel ?? "none"}
                  </span>
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {selected.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div
            key={selected?.id ?? "chat-empty"}
            className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]"
            style={{ animation: "modal-element-enter 0.24s ease-out" }}
            ref={messageListRef}
          >
            {!selected ? (
              <div className="flex h-full min-h-[260px] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200/70 text-gray-400">
                    <MessageCircle size={24} />
                  </div>
                  <p className="text-base text-gray-600">Nicio solicitare.</p>
                </div>
              </div>
            ) : (selected.messages ?? []).length === 0 ? (
              <div className="text-sm text-gray-500">Niciun mesaj încă.</div>
            ) : (
              <div className="space-y-4">
                {(selected.messages ?? []).map((m, idx) => {
                  const mine = m.senderEmail === user?.email;
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
                        <div className="sticky top-2 z-10 mb-2 flex items-center gap-2">
                          <div className="h-px flex-1 bg-primary/20" />
                          <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-medium">
                            Mesaje noi
                          </span>
                          <div className="h-px flex-1 bg-primary/20" />
                        </div>
                      )}
                      <div className={`flex items-end gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine && (
                          <div className="h-7 w-7 rounded-full bg-gray-300 text-[10px] text-gray-700 flex items-center justify-center font-semibold overflow-hidden">
                            <img src={avatarSrc(selectedPeerAvatar) || DEFAULT_AVATAR_URL} alt={m.senderEmail} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className={`max-w-[74%] rounded-2xl px-4 py-2.5 shadow-sm ring-1 ${mine ? "bg-gradient-to-r from-[#6655F4] to-[#7C6CF6] text-white ring-primary/20" : "bg-[#ECEEF1] text-gray-800 ring-gray-200/60"} ${hasMatch ? "ring-2 ring-amber-300" : ""}`}>
                          <div className="text-[14px] leading-5 whitespace-pre-wrap">{shownText}</div>
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
                          <div className={`mt-1 text-[11px] ${mine ? "text-white/80" : "text-gray-500"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {messageStatus && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/85">{messageStatus}</div>}
                        </div>
                        {mine && (
                          <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-semibold overflow-hidden">
                            <img
                              src={avatarSrc(isSupport ? SUPPORT_AVATAR_URL : user?.avatar) || (isSupport ? SUPPORT_AVATAR_URL : DEFAULT_AVATAR_URL)}
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
              <div className="mt-2 text-xs text-gray-500">{selectedPeerName || "User"} scrie...</div>
            )}
            {sending && (
              <div className="mt-3 flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-3 py-2 border border-primary/20 bg-primary/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200/80 bg-[#F5F6F8]">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Caută în conversație..."
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
              >
                Jump latest
              </button>
              {isSupport && (
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                  onClick={() => setTemplatesOpen((v) => !v)}
                >
                  Template-uri
                </button>
              )}
              {selected && isSupport && (
                <>
                  <button type="button" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" onClick={() => void assignToMe(selected.id)}>
                    Assign me
                  </button>
                  <button type="button" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" onClick={() => void setPriority(selected.id, "high")}>
                    Priority high
                  </button>
                  <button type="button" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" onClick={() => void setPriority(selected.id, "urgent")}>
                    Priority urgent
                  </button>
                  <button type="button" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" onClick={() => void escalateSelected("level_1")}>
                    Escalate L1
                  </button>
                  <button type="button" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs" onClick={() => void setReminderIn30m()}>
                    Reminder 30m
                  </button>
                </>
              )}
              {selected && (
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs text-red-600"
                  onClick={() => void closeSelectedChat()}
                >
                  Închide chat
                </button>
              )}
              {selected && (
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Șterge din lista mea
                </button>
              )}
              {selected && selected.status === "closed" && isSupport && (
                <button
                  type="button"
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs text-emerald-700"
                  onClick={() => void reopenChat(selected.id)}
                >
                  Redeschide chat
                </button>
              )}
              {selected && isSupport && (
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                  onClick={() => void saveTagsForSelected()}
                >
                  Save tags
                </button>
              )}
            </div>
            {isSupport && templatesOpen && (
              <div className="mb-2 flex flex-wrap gap-1">
                {[...quickTemplates, ...macros.map((m) => m.content)].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700"
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
            {selected && (
              <div className="mb-2 rounded-lg border border-gray-200 bg-white p-2 max-h-24 overflow-auto">
                <div className="text-[11px] font-semibold text-gray-600 mb-1">Timeline</div>
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
            {selected && (
              <div className="mb-2">
                <textarea
                  value={internalNote}
                  onChange={(e) => {
                    setInternalNote(e.target.value);
                    persistInternalNote(selected.id, e.target.value);
                  }}
                  placeholder="Notițe interne (vizibile doar intern)"
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs"
                  rows={2}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
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
                className="flex-1 min-h-[42px] max-h-32 resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-primary/40 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
                rows={1}
              />
              <label
                className={`rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs ${
                  !selected || isSelectedClosed || isWaitingSupportAccept ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                📎
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
                className="rounded-xl bg-primary text-white px-3 py-2 shadow-sm transition-all hover:brightness-95 disabled:opacity-60"
                aria-label="Trimite"
              >
                <Send size={16} />
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
        </section>
      </div>
      {deleteConfirmOpen && selected && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
          style={{ animation: "support-modal-fade-in 180ms ease-out both" }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            style={{ animation: "support-modal-pop-in 220ms ease-out both" }}
          >
            <h3 className="text-base font-semibold text-gray-900">Confirmare ștergere</h3>
            <p className="mt-2 text-sm text-gray-600">Sigur vrei să ștergi acest chat din lista ta?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={loading}
              >
                Renunță
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                onClick={() => void deleteSelectedChatForMe()}
                disabled={loading}
              >
                {loading ? "Se șterge..." : "Șterge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

