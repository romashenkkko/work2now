import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "../api/client";
import { startCallRingLoop, stopCallRingLoop } from "../lib/playChatSounds";

export type VoiceCallPhase = "idle" | "requesting_media" | "outgoing" | "incoming" | "connecting" | "connected" | "ended";

export type VoiceCallRemotePayload = {
  type: "voice_call_signal";
  chatId: string;
  fromUserId: string;
  signalType: "offer" | "answer" | "ice" | "hangup" | "reject";
  payload: unknown;
  at?: string;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function isVoicePayload(x: unknown): x is VoiceCallRemotePayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.type === "voice_call_signal" && typeof o.chatId === "string" && typeof o.fromUserId === "string";
}

async function postSignal(chatId: string, signalType: string, payload: unknown) {
  await authApi.supportChatVoiceSignal(chatId, signalType, payload);
}

export function useVoiceCall(
  chatId: string | null,
  myUserId: string,
  enabled: boolean
) {
  const [phase, setPhase] = useState<VoiceCallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const makingRef = useRef(false);

  const cleanup = useCallback(() => {
    stopCallRingLoop();
    iceQueueRef.current = [];
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStream(null);
    setPendingOffer(null);
    makingRef.current = false;
  }, []);

  const endCall = useCallback(
    async (sendHangup: boolean) => {
      if (sendHangup && chatId && phase !== "idle" && phase !== "ended") {
        try {
          await postSignal(chatId, "hangup", {});
        } catch {
          // ignore
        }
      }
      cleanup();
      setPhase("idle");
      setError(null);
      setIsMuted(false);
    },
    [chatId, phase, cleanup]
  );

  useEffect(() => {
    if (!chatId) void endCall(false);
  }, [chatId, endCall]);

  useEffect(() => {
    if (phase === "incoming" || phase === "outgoing") {
      startCallRingLoop();
    } else {
      stopCallRingLoop();
    }
    return () => {
      stopCallRingLoop();
    };
  }, [phase]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(list.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(list.filter((d) => d.kind === "audiooutput"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (enabled && chatId) void refreshDevices();
  }, [enabled, chatId, refreshDevices]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      const sid = selectedOutputId;
      if (sid && "setSinkId" in remoteAudioRef.current) {
        (remoteAudioRef.current as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(sid)
          .catch(() => {});
      }
    }
  }, [remoteStream, selectedOutputId]);

  const flushIceQueue = useCallback(async (pc: RTCPeerConnection) => {
    const q = [...iceQueueRef.current];
    iceQueueRef.current = [];
    for (const c of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore
      }
    }
  }, []);

  const handleRemoteSignal = useCallback(
    async (raw: unknown) => {
      if (!enabled || !chatId || !isVoicePayload(raw)) return;
      if (raw.chatId !== chatId) return;
      if (raw.fromUserId === myUserId) return;

      const { signalType, payload } = raw;

      if (signalType === "hangup" || signalType === "reject") {
        cleanup();
        setPhase("idle");
        setError(null);
        return;
      }

      if (signalType === "offer" && payload && typeof payload === "object") {
        const sdp = (payload as { sdp?: RTCSessionDescriptionInit }).sdp;
        if (sdp?.sdp) {
          setPendingOffer(sdp);
          setPhase("incoming");
        }
        return;
      }

      const pc = pcRef.current;
      if (!pc) return;

      if (signalType === "answer" && payload && typeof payload === "object") {
        const sdp = (payload as { sdp?: RTCSessionDescriptionInit }).sdp;
        if (sdp?.sdp) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushIceQueue(pc);
            setPhase("connected");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Eroare answer");
          }
        }
        return;
      }

      if (signalType === "ice" && payload && typeof payload === "object") {
        const cand = (payload as { candidate?: RTCIceCandidateInit }).candidate;
        if (cand && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {
            // ignore
          }
        } else if (cand) {
          iceQueueRef.current.push(cand);
        }
      }
    },
    [enabled, chatId, myUserId, cleanup, flushIceQueue]
  );

  const startCall = useCallback(async () => {
    if (!chatId || !enabled || makingRef.current) return;
    makingRef.current = true;
    setError(null);
    setPhase("requesting_media");
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && chatId) {
          void postSignal(chatId, "ice", { candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await postSignal(chatId, "offer", { sdp: { type: offer.type, sdp: offer.sdp } });
      setPhase("outgoing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut accesa microfonul.");
      cleanup();
      setPhase("idle");
    } finally {
      makingRef.current = false;
    }
  }, [chatId, enabled, selectedInputId, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!chatId || !pendingOffer) return;
    setPhase("connecting");
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInputId ? { deviceId: { exact: selectedInputId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && chatId) {
          void postSignal(chatId, "ice", { candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      await flushIceQueue(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await postSignal(chatId, "answer", { sdp: { type: answer.type, sdp: answer.sdp } });
      setPendingOffer(null);
      setPhase("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la acceptare.");
      cleanup();
      setPhase("idle");
    }
  }, [chatId, pendingOffer, selectedInputId, cleanup, flushIceQueue]);

  const rejectCall = useCallback(async () => {
    if (chatId) {
      try {
        await postSignal(chatId, "reject", {});
      } catch {
        // ignore
      }
    }
    cleanup();
    setPhase("idle");
    setPendingOffer(null);
  }, [chatId, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const t = stream.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setIsMuted(!t.enabled);
    }
  }, []);

  const applyMicFromSettings = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || !selectedInputId) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedInputId } },
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
        stream.getTracks().forEach((t) => t.stop());
        localStreamRef.current = new MediaStream([newTrack]);
      }
    } catch {
      // ignore
    }
  }, [selectedInputId]);

  return {
    phase,
    error,
    isMuted,
    settingsOpen,
    setSettingsOpen,
    remoteStream,
    pendingOffer,
    audioInputs,
    audioOutputs,
    selectedInputId,
    setSelectedInputId,
    selectedOutputId,
    setSelectedOutputId,
    remoteAudioRef,
    startCall,
    endCall: () => void endCall(true),
    acceptCall,
    rejectCall,
    toggleMute,
    handleRemoteSignal,
    refreshDevices,
    applyMicFromSettings,
  };
}
