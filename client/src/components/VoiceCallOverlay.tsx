import { Headphones, Mic, MicOff, PhoneOff, Settings, X } from "lucide-react";
import { useEffect, type RefObject } from "react";
import type { VoiceCallPhase } from "../hooks/useVoiceCall";
import { DEFAULT_AVATAR_URL, avatarSrc } from "../lib/supportChatPeerUi";

type Props = {
  phase: VoiceCallPhase;
  error: string | null;
  peerName: string;
  peerAvatar?: string | null;
  isMuted: boolean;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  selectedOutputId: string;
  setSelectedOutputId: (id: string) => void;
  refreshDevices: () => void | Promise<void>;
  applyMicFromSettings: () => void | Promise<void>;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  toggleMute: () => void;
  endCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
};

function AudioBarsActive() {
  return (
    <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="voice-call-bar w-1 rounded-full bg-emerald-400/90"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function VoiceCallOverlay({
  phase,
  error,
  peerName,
  peerAvatar,
  isMuted,
  settingsOpen,
  setSettingsOpen,
  audioInputs,
  audioOutputs,
  selectedInputId,
  setSelectedInputId,
  selectedOutputId,
  setSelectedOutputId,
  refreshDevices,
  applyMicFromSettings,
  remoteAudioRef,
  toggleMute,
  endCall,
  acceptCall,
  rejectCall,
}: Props) {
  const visible = phase !== "idle" && phase !== "ended";

  useEffect(() => {
    if (settingsOpen) void refreshDevices();
  }, [settingsOpen, refreshDevices]);

  if (!visible) return null;

  const avatarUrl = avatarSrc(peerAvatar) || DEFAULT_AVATAR_URL;

  const showPulseRings =
    phase === "requesting_media" || phase === "outgoing" || phase === "connecting" || phase === "incoming";
  const showActiveBars = phase === "connected";

  const headline = (() => {
    switch (phase) {
      case "requesting_media":
        return "Acces microfon";
      case "outgoing":
        return `Apelezi pe ${peerName}`;
      case "incoming":
        return peerName;
      case "connecting":
        return "Se conectează…";
      case "connected":
        return peerName;
      default:
        return peerName;
    }
  })();

  const subline = (() => {
    switch (phase) {
      case "requesting_media":
        return "Permite accesul în dialogul browserului — apel doar audio.";
      case "outgoing":
        return "Sună…";
      case "incoming":
        return "Apel audio primit";
      case "connecting":
        return "Stabilim conexiunea securizată";
      case "connected":
        return "Apel audio activ";
      default:
        return "";
    }
  })();

  const sidebarHint = (() => {
    switch (phase) {
      case "connected":
        return "În conversație";
      case "outgoing":
      case "connecting":
      case "requesting_media":
        return "Se stabilește apelul…";
      case "incoming":
        return "Dorești să răspunzi?";
      default:
        return "Gata pentru apel?";
    }
  })();

  return (
    <div
      className="voice-call-root fixed inset-0 z-[100] flex items-stretch justify-center bg-[#0a0a0c]/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Apel audio"
    >
      <style>{`
        @keyframes voice-call-bar {
          0%, 100% { height: 6px; opacity: 0.5; }
          50% { height: 28px; opacity: 1; }
        }
        .voice-call-bar {
          animation: voice-call-bar 0.9s ease-in-out infinite;
        }
        @keyframes voice-call-ring {
          0% { transform: scale(0.92); opacity: 0.45; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .voice-call-ring {
          animation: voice-call-ring 2.2s ease-out infinite;
        }
        .voice-call-ring-delay {
          animation-delay: 0.7s;
        }
      `}</style>
      <audio ref={remoteAudioRef as never} autoPlay playsInline className="hidden" />

      <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-8">
        {/* Main stage */}
        <div className="relative flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black shadow-[0_32px_80px_-24px_rgba(0,0,0,0.75)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,92,246,0.12),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(59,130,246,0.06),transparent_50%)]" />

          <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-10 text-center sm:pb-32 sm:pt-14">
            <div className="relative mb-8 flex items-center justify-center">
              {showPulseRings && (
                <>
                  <div className="voice-call-ring absolute h-44 w-44 rounded-full border border-violet-500/25" />
                  <div className="voice-call-ring voice-call-ring-delay absolute h-44 w-44 rounded-full border border-violet-400/20" />
                </>
              )}
              <div
                className={`relative h-36 w-36 overflow-hidden rounded-full shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65)] ring-2 sm:h-40 sm:w-40 ${
                  showActiveBars ? "ring-emerald-500/35" : "ring-white/15"
                }`}
              >
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </div>
            </div>

            <h2 className="max-w-md text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl">{headline}</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{subline}</p>

            {showActiveBars && !error && (
              <div className="mt-8">
                <AudioBarsActive />
                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Audio</p>
              </div>
            )}

            {error ? (
              <p className="mt-6 max-w-md rounded-2xl border border-rose-500/25 bg-rose-950/40 px-4 py-3 text-sm text-rose-200/95">{error}</p>
            ) : null}
          </div>

          {(phase === "connected" || phase === "outgoing" || phase === "connecting" || phase === "requesting_media") && (
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] bg-black px-4 py-5 sm:px-8">
              <div className="mx-auto flex max-w-md items-center justify-center gap-5 sm:gap-8">
                {(phase === "connected" || phase === "outgoing" || phase === "connecting") && (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 active:scale-95 ${
                          isMuted
                            ? "bg-amber-500/25 ring-2 ring-amber-400/60 hover:bg-amber-500/35"
                            : "bg-zinc-800/95 ring-1 ring-white/10 hover:bg-zinc-700 hover:ring-white/20"
                        }`}
                        title={isMuted ? "Pornește microfonul" : "Închide microfonul"}
                        aria-label={isMuted ? "Pornește microfonul" : "Închide microfonul"}
                        aria-pressed={isMuted}
                      >
                        {isMuted ? <MicOff className="h-6 w-6 text-amber-200" /> : <Mic className="h-6 w-6" />}
                      </button>
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${isMuted ? "text-amber-400/90" : "text-zinc-500"}`}>
                        {isMuted ? "Oprit" : "Microfon"}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/95 text-white shadow-lg ring-1 ring-white/10 transition-all duration-200 hover:bg-zinc-700 hover:ring-white/20 active:scale-95"
                        title="Setări audio"
                        aria-label="Setări audio"
                      >
                        <Settings className="h-6 w-6" />
                      </button>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Setări</span>
                    </div>
                  </>
                )}
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={endCall}
                    className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_8px_24px_-4px_rgba(220,38,38,0.55)] transition-all duration-200 hover:bg-red-500 hover:shadow-[0_12px_28px_-4px_rgba(220,38,38,0.6)] active:scale-95"
                    title="Închide apelul"
                    aria-label="Închide apelul"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Închide</span>
                </div>
              </div>
            </div>
          )}

          {phase === "incoming" && (
            <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] bg-black/95 px-4 py-5 backdrop-blur-sm sm:px-8">
              <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={rejectCall}
                  className="min-w-[120px] rounded-full border border-white/15 bg-zinc-900/80 px-8 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-zinc-800"
                >
                  Respinge
                </button>
                <button
                  type="button"
                  onClick={acceptCall}
                  className="min-w-[120px] rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                >
                  Răspunde
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex w-full shrink-0 flex-col justify-between rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] sm:w-[min(100%,280px)]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/20 opacity-80 blur-md" />
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/20">
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">{peerName}</div>
              <div className="mt-1.5 text-sm text-zinc-400">{sidebarHint}</div>
            </div>
          </div>
          <div className="mt-8 hidden text-center sm:block">
            <div className="mx-auto h-px w-16 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">Apel vocal prin browser, fără video.</p>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl shadow-black/60">
            <div className="border-b border-white/[0.06] bg-white/[0.03] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Setări audio</h3>
                  <p className="mt-1 text-xs text-zinc-500">Microfon și difuzor pentru acest apel</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="shrink-0 rounded-full p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Închide"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-zinc-300">
                  <Mic className="h-4 w-4 text-violet-400" strokeWidth={2} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Microfon</span>
                </div>
                <select
                  value={selectedInputId}
                  onChange={(e) => setSelectedInputId(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-white/10 bg-zinc-900/80 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                >
                  {audioInputs.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Microfon"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-zinc-300">
                  <Headphones className="h-4 w-4 text-blue-400" strokeWidth={2} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Ieșire audio</span>
                </div>
                <select
                  value={selectedOutputId}
                  onChange={(e) => setSelectedOutputId(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-white/10 bg-zinc-900/80 px-3.5 py-3 text-sm text-white outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                >
                  {audioOutputs.length === 0 ? (
                    <option value="">Implicit</option>
                  ) : (
                    audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Difuzor"}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-black/20 px-6 py-4">
              <button
                type="button"
                onClick={() => void applyMicFromSettings()}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500"
              >
                Aplică microfonul
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              >
                Gata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
