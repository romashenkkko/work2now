/**
 * Fișiere sursă: copiază manual în `client/public/sounds/` din
 * `New folder/Sounds notification and call/` → `notification.mp3` și `call.mp3`.
 * După ce înlocuiești fișierele, mărește SOUND_ASSET_VERSION ca browserul să nu folosească cache vechi.
 */
const SOUND_ASSET_VERSION = "4";

function soundUrl(file: "notification" | "call"): string {
  const name = file === "notification" ? "notification" : "call";
  return `/sounds/${name}.mp3?v=${SOUND_ASSET_VERSION}`;
}

export const CHAT_SOUND_NOTIFICATION = `/sounds/notification.mp3?v=${SOUND_ASSET_VERSION}`;
export const CHAT_SOUND_CALL = `/sounds/call.mp3?v=${SOUND_ASSET_VERSION}`;

function playSoundUrl(url: string): void {
  try {
    const a = new Audio(url);
    a.preload = "auto";
    void a.play().catch(() => {});
  } catch {
    // ignore
  }
}

function normId(v: string | undefined | null): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

const LS_MSG = "work2now_chat_message_sound_enabled";
const LS_CALL = "work2now_chat_call_sound_enabled";
/** @deprecated Folosit doar ca fallback pentru migrare de la un singur toggle. */
const LS_LEGACY = "work2now_chat_sound_enabled";

function readSoundFlag(specificKey: string): boolean {
  try {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(specificKey);
    if (v === "0") return false;
    if (v === "1") return true;
    const legacy = localStorage.getItem(LS_LEGACY);
    if (legacy === "0") return false;
    if (legacy === "1") return true;
    return true;
  } catch {
    return true;
  }
}

export function isChatMessageSoundEnabled(): boolean {
  return readSoundFlag(LS_MSG);
}

export function isChatCallSoundEnabled(): boolean {
  return readSoundFlag(LS_CALL);
}

export const CHAT_SOUND_SETTINGS_CHANGED = "work2now-chat-sounds-changed";

export function dispatchChatSoundSettingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHAT_SOUND_SETTINGS_CHANGED));
}

export function setChatMessageSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_MSG, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  dispatchChatSoundSettingsChanged();
}

export function setChatCallSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_CALL, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  dispatchChatSoundSettingsChanged();
}

/** Sunet scurt la mesaj nou (pentru destinatar). */
export function playNotificationSound(): void {
  if (!isChatMessageSoundEnabled()) return;
  playSoundUrl(soundUrl("notification"));
}

let callRingAudio: HTMLAudioElement | null = null;

/** Sunet de apel în buclă până la `stopCallRingLoop` (apel primit / în curs). */
export function startCallRingLoop(): void {
  stopCallRingLoop();
  if (!isChatCallSoundEnabled()) return;
  try {
    const a = new Audio(soundUrl("call"));
    a.loop = true;
    a.volume = 1;
    callRingAudio = a;
    void a.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function stopCallRingLoop(): void {
  if (!callRingAudio) return;
  try {
    callRingAudio.pause();
    callRingAudio.currentTime = 0;
    callRingAudio.src = "";
    callRingAudio.load();
  } catch {
    // ignore
  }
  callRingAudio = null;
}

let lastNotifyAt = 0;
let lastNotifyChatId = "";

/**
 * Evită dublarea când SSE rulează din două componente (widget + pagină chat).
 * Nu se redă dacă utilizatorul este pe /dashboard/chat cu același chat deschis.
 */
export function maybePlayIncomingMessageSound(
  payload: { type?: string; chatId?: string; reason?: string; fromUserId?: string },
  myUserId: string | undefined
): void {
  if (!isChatMessageSoundEnabled()) return;
  if (payload.type !== "chat_updated" || payload.reason !== "message" || !payload.fromUserId) return;

  const me = normId(myUserId);
  if (!me) return;
  if (normId(payload.fromUserId) === me) return;

  const chatId = String(payload.chatId ?? "");
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/dashboard/chat") {
    try {
      const sel = sessionStorage.getItem("work2now_dashboard_selected_chat_id") ?? "";
      if (sel && chatId && sel === chatId) return;
    } catch {
      // ignore
    }
  }

  const now = Date.now();
  if (lastNotifyChatId === chatId && now - lastNotifyAt < 600) return;
  lastNotifyAt = now;
  lastNotifyChatId = chatId;

  playNotificationSound();
}
