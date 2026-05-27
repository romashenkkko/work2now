import type { Response } from "express";

type SupportRealtimeEvent =
  | {
      type: "chat_updated";
      chatId: string;
      reason: "request" | "accept" | "message" | "message_deleted" | "close" | "seen" | "deleted";
      /** La reason === "message": cine a trimis mesajul (pentru sunet notificare la destinatar). */
      fromUserId?: string;
    }
  | { type: "typing"; chatId: string; userId: string; isTyping: boolean; at: string }
  | { type: "delivered"; chatId: string; messageId: string; deliveredToUserId: string; at: string }
  | { type: "assigned"; chatId: string; assignedToUserId: string; assignedToEmail: string; at: string }
  | { type: "reassigned"; chatId: string; assignedToUserId: string; assignedToEmail: string; reason?: string; at: string }
  | { type: "reopened"; chatId: string; reason?: string; at: string }
  | { type: "priority_changed"; chatId: string; priority: "low" | "normal" | "high" | "urgent"; at: string }
  | { type: "tags_changed"; chatId: string; tags: string[]; at: string }
  | { type: "escalated"; chatId: string; level: "none" | "level_1" | "level_2" | "critical"; note?: string; at: string }
  | { type: "reminder_due"; chatId: string; reminderId: number; dueAt: string; at: string }
  | { type: "csat_submitted"; chatId: string; rating: number; at: string }
  | { type: "bulk_updated"; chatIds: string[]; operation: string; at: string }
  | { type: "friend_request_received"; fromUserId: string; at: string }
  | {
      type: "voice_call_signal";
      chatId: string;
      fromUserId: string;
      signalType: "offer" | "answer" | "ice" | "hangup" | "reject";
      payload: unknown;
      at: string;
    };

type Client = {
  userId: string;
  res: Response;
};

const clients = new Set<Client>();

function writeSse(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function subscribeSupportChatEvents(userId: string, res: Response) {
  const client: Client = { userId, res };
  clients.add(client);

  writeSse(res, "connected", { ok: true, at: new Date().toISOString() });
  const heartbeat = setInterval(() => {
    try {
      writeSse(res, "heartbeat", { at: new Date().toISOString() });
    } catch {
      // noop
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };
  res.on("close", cleanup);
  res.on("finish", cleanup);
}

export function publishSupportChatEvent(event: SupportRealtimeEvent, targetUserIds?: string[]) {
  const filter = targetUserIds?.length ? new Set(targetUserIds.map(String)) : null;
  for (const c of clients) {
    if (filter && !filter.has(String(c.userId))) continue;
    writeSse(c.res, "support_chat_event", event);
  }
}

