import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { authApi } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import {
  DEFAULT_AVATAR_URL,
  SUPPORT_AVATAR_URL,
  avatarSrc,
  isSupportTicketChat,
  peerAvatarUrlForSidebar,
} from "../lib/supportChatPeerUi";
import { maybePlayIncomingMessageSound } from "../lib/playChatSounds";

type ChatMessage = {
  id: string;
  senderRole: string;
  senderEmail: string;
  message: string;
  createdAt: string;
};

type ChatItem = {
  id: string;
  requesterUserId?: string;
  requesterEmail: string;
  requesterDisplayName?: string;
  requesterRole: string;
  requesterAvatar?: string | null;
  status: "open" | "accepted" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  escalationLevel?: "none" | "level_1" | "level_2" | "critical";
  acceptedByUserId?: string | null;
  acceptedByEmail?: string | null;
  acceptedByDisplayName?: string | null;
  acceptedByAvatar?: string | null;
  acceptedByRole?: string | null;
  messages?: ChatMessage[];
  updatedAt?: string | null;
};

function nameFromEmail(email?: string | null): string {
  const raw = String(email ?? "").trim();
  if (!raw) return "User";
  const left = raw.split("@")[0] || raw;
  return left.replace(/[._-]+/g, " ").trim() || "User";
}

export default function SupportChatWidget({ forceOpen = false, hideFloatingButton = false }: { forceOpen?: boolean; hideFloatingButton?: boolean }) {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase?.() ?? "";
  const isSupport = role === "support" || role === "admin";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<"connected" | "reconnecting">("reconnecting");
  const [myChats, setMyChats] = useState<ChatItem[]>([]);
  const [inboxChats, setInboxChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const selectedChat = useMemo(() => {
    const fromMine = myChats.find((c) => c.id === selectedChatId);
    if (fromMine) return fromMine;
    return inboxChats.find((c) => c.id === selectedChatId) ?? null;
  }, [selectedChatId, myChats, inboxChats]);
  const isSelectedClosed = selectedChat?.status === "closed";
  const isWaitingSupportAccept = !!selectedChat && !isSupport && selectedChat.status === "open" && !selectedChat.acceptedByEmail;
  const selectedIsSupportTicket = useMemo(
    () => (selectedChat ? isSupportTicketChat(selectedChat) : false),
    [selectedChat]
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const mine = await authApi.supportChatMy();
      setMyChats((mine as any).chats ?? []);
      if (isSupport) {
        const inbox = await authApi.supportChatInbox();
        setInboxChats((inbox as any).chats ?? []);
      } else {
        setInboxChats([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare chat.");
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
    const url = authApi.supportChatStreamUrl();
    if (!url) return;

    let disposed = false;
    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let retryDelayMs = 1000;
    const MAX_RETRY_DELAY_MS = 15000;

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
          if (payload?.type === "chat_updated" && payload?.reason === "message") {
            maybePlayIncomingMessageSound(payload, user?.id !== undefined ? String(user.id) : undefined);
          }
        } catch {
          // ignore
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
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (es) {
        es.close();
        es = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const requestSupport = async () => {
    const description = requestDescription.trim();
    if (description.length < 5) {
      setError("Adaugă o descriere (minim 5 caractere).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.supportChatRequest(description);
      const chatId = String((res as any).chatId ?? "");
      await load();
      if (chatId) setSelectedChatId(chatId);
      setRequestDescription("");
      setOpen(true);
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

  const sendMessage = async () => {
    if (!selectedChatId) return;
    if (isSelectedClosed) return;
    const msg = messageDraft.trim();
    if (!msg) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatMessage(selectedChatId, msg);
      setMessageDraft("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut trimite mesajul.");
    } finally {
      setLoading(false);
    }
  };

  const closeSelectedChat = async () => {
    if (!selectedChatId) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatClose(selectedChatId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut închide chatul.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedChatForMe = async () => {
    if (!selectedChatId) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.supportChatDelete(selectedChatId);
      await load();
      setSelectedChatId(null);
      setDeleteConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut șterge chatul.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
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
      {!hideFloatingButton && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition flex items-center justify-center"
          aria-label="Support chat"
        >
          <MessageCircle size={20} />
        </button>
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[92vw] max-w-md bg-white border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">{isSupport ? "Support chat" : "Mesaje"}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    sseStatus === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {sseStatus === "connected" ? "connected" : "reconnecting..."}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {isSupport ? "Inbox support + chaturi active" : "Conversații cu prietenii și solicitări către echipa de support"}
              </p>
              <button
                type="button"
                className="mt-1 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.href = "/dashboard/chat";
                }}
              >
                Open full console
              </button>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900" onClick={() => setOpen(false)}>
              Închide
            </button>
          </div>

          {error ? (
            <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          ) : null}

          <div className="p-4 border-b border-gray-100">
            {!isSupport ? (
              <div className="space-y-2">
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Descrie problema ta pentru support..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => void requestSupport()}
                  disabled={loading || requestDescription.trim().length < 5}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Solicitare support
                </button>
              </div>
            ) : (
              <div className="text-xs text-gray-600">
                Selectează din lista de mai jos un chat deschis și apasă „Acceptă”.
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1">
            <div className="h-full overflow-y-auto p-3 space-y-2">
              {isSupport && (
                <>
                  <div className="text-xs font-semibold text-gray-500 px-1">Inbox support</div>
                  {inboxChats.length === 0 && <div className="text-xs text-gray-500 px-1">Nicio solicitare.</div>}
                  {inboxChats.map((c) => (
                    <div key={`inbox-${c.id}`} className="rounded-xl border border-gray-100 p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center overflow-hidden">
                          <img src={avatarSrc(c.requesterAvatar) || DEFAULT_AVATAR_URL} alt={c.requesterEmail || "avatar"} className="h-full w-full object-cover" />
                        </div>
                        <div className="text-xs text-gray-700 truncate">{c.requesterDisplayName || nameFromEmail(c.requesterEmail) || "user"}</div>
                      </div>
                      {(isSupportTicketChat(c) || c.status === "closed") && (
                        <div className="text-[11px] text-gray-500">Status: {c.status}</div>
                      )}
                      {isSupportTicketChat(c) && (
                        <>
                          <div className="text-[11px] text-gray-500">Priority: {c.priority ?? "normal"}</div>
                          <div className="text-[11px] text-gray-500">Escalation: {c.escalationLevel ?? "none"}</div>
                        </>
                      )}
                      <div className="mt-1 flex gap-2">
                        <button className="rounded border border-gray-200 px-2 py-1 text-[11px]" onClick={() => setSelectedChatId(c.id)}>
                          Deschide
                        </button>
                        {c.status === "open" && isSupportTicketChat(c) && (
                          <button className="rounded border border-primary/30 px-2 py-1 text-[11px] text-primary" onClick={() => void acceptChat(c.id)}>
                            Acceptă
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div className="text-xs font-semibold text-gray-500 px-1 mt-3">Chaturile mele</div>
              {myChats.length === 0 && <div className="text-xs text-gray-500 px-1">Nu există conversații încă.</div>}
              {myChats.map((c) => (
                <div
                  key={`my-${c.id}`}
                  className={`w-full text-left rounded-xl border p-2 ${
                    selectedChatId === c.id ? "border-primary/40 bg-primary/5" : "border-gray-100"
                  }`}
                >
                  <button className="w-full text-left" onClick={() => setSelectedChatId(c.id)}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center overflow-hidden">
                      <img
                        src={
                          avatarSrc(
                            isSupport
                              ? c.requesterAvatar
                              : peerAvatarUrlForSidebar(c, String(user?.id ?? ""), false)
                          ) || DEFAULT_AVATAR_URL
                        }
                        alt={(isSupport ? c.requesterEmail : c.acceptedByEmail) || "avatar"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="text-xs text-gray-700 truncate">
                      #{c.id}{" "}
                      {isSupport
                        ? c.requesterDisplayName || nameFromEmail(c.requesterEmail)
                        : c.acceptedByDisplayName || nameFromEmail(c.acceptedByEmail) || (isSupportTicketChat(c) ? "Support" : "Utilizator")}
                    </div>
                  </div>
                  {(isSupportTicketChat(c) || c.status === "closed") && (
                    <div className="text-[11px] text-gray-500">Status: {c.status}</div>
                  )}
                  {isSupportTicketChat(c) && (
                    <div className="text-[11px] text-gray-500">Priority: {c.priority ?? "normal"}</div>
                  )}
                  </button>
                  {isSupport && c.status === "closed" && (
                    <button
                      type="button"
                      className="mt-1 rounded border border-emerald-200 px-2 py-1 text-[11px] text-emerald-700"
                      onClick={async () => {
                        await authApi.supportChatReopen(c.id).catch(() => {});
                        await load();
                      }}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 p-3 space-y-2">
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 p-2 bg-gray-50">
              {!selectedChat ? (
                <div className="text-xs text-gray-500">Selectează un chat pentru mesaje.</div>
              ) : (selectedChat.messages ?? []).length === 0 ? (
                <div className="text-xs text-gray-500">Niciun mesaj încă.</div>
              ) : (
                (selectedChat.messages ?? []).map((m) => (
                  <div key={m.id} className="mb-2">
                    <div className="flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full bg-gray-200 text-gray-600 text-[10px] font-semibold flex items-center justify-center overflow-hidden">
                        {(() => {
                          const mine = m.senderEmail.toLowerCase() === (user?.email ?? "").toLowerCase();
                          const src = mine
                            ? avatarSrc(isSupport && selectedIsSupportTicket ? SUPPORT_AVATAR_URL : user?.avatar) ||
                              (isSupport && selectedIsSupportTicket ? SUPPORT_AVATAR_URL : DEFAULT_AVATAR_URL)
                            : avatarSrc(
                                isSupport
                                  ? selectedChat?.requesterAvatar
                                  : selectedChat
                                    ? peerAvatarUrlForSidebar(selectedChat, String(user?.id ?? ""), false)
                                    : undefined
                              ) || DEFAULT_AVATAR_URL;
                          return <img src={src} alt={m.senderEmail || "avatar"} className="h-full w-full object-cover" />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-gray-500">{m.senderRole} - {m.senderEmail}</div>
                        <div className="text-sm text-gray-800">{m.message}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {selectedChatId && (
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600"
                  onClick={() => void closeSelectedChat()}
                >
                  Închide chat
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Șterge din lista mea
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder={
                  isSelectedClosed
                    ? "Chat închis. Nu mai poți trimite mesaje."
                    : isWaitingSupportAccept
                      ? "Așteaptă acceptarea de către support."
                      : "Scrie mesaj..."
                }
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={!selectedChatId || isSelectedClosed || isWaitingSupportAccept}
              />
              <button
                type="button"
                className="rounded-lg bg-primary text-white px-3 py-2 disabled:opacity-60"
                onClick={() => void sendMessage()}
                disabled={!selectedChatId || isSelectedClosed || isWaitingSupportAccept || !messageDraft.trim() || loading}
              >
                <Send size={16} />
              </button>
            </div>
            {isSelectedClosed && <div className="text-[11px] text-amber-700">Chat închis: trimiterea de mesaje este dezactivată.</div>}
            {isWaitingSupportAccept && (
              <div className="text-[11px] text-amber-700">Solicitarea este în așteptare. Vei putea scrie după ce un agent support acceptă chatul.</div>
            )}
          </div>
        </div>
      </div>
      {deleteConfirmOpen && selectedChatId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          style={{ animation: "support-modal-fade-in 180ms ease-out both" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            style={{ animation: "support-modal-pop-in 220ms ease-out both" }}
          >
            <h3 className="text-base font-semibold text-gray-900">Confirmare ștergere</h3>
            <p className="mt-2 text-sm text-gray-600">Sigur vrei să ștergi acest chat din lista ta?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={loading}
              >
                Renunță
              </button>
              <button
                type="button"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                onClick={() => void deleteSelectedChatForMe()}
                disabled={loading}
              >
                {loading ? "Se șterge..." : "Șterge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

