import crypto from "crypto";
import type { CreatePayoutParams, CreatePayoutResult, PayoutProvider, PayoutWebhookNormalized } from "./payoutProvider.types";

const MOCK_SECRET = process.env.PAYOUT_WEBHOOK_SECRET?.trim() || "work2now-payout-mock-local-only";

export function signPayoutMockWebhookBody(rawBody: string): string {
  return crypto.createHmac("sha256", MOCK_SECRET).update(rawBody, "utf8").digest("hex");
}

function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const v = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(v)) return v[0]?.trim() || null;
  return v?.trim() || null;
}

export class MockPayoutProvider implements PayoutProvider {
  readonly id = "mock";

  async createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult> {
    const providerPayoutId = `MOCK-PAYOUT-${params.applicationPayoutId}-${Date.now()}`;
    console.info("[Payout MOCK] createPayout", {
      applicationPayoutId: params.applicationPayoutId,
      providerPayoutId,
      amount: params.amount.toFixed(2),
      currency: params.currency,
    });
    return {
      providerPayoutId,
      immediatePaid: true,
      raw: { mock: true },
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
    const sig = getHeader(headers, "x-payout-signature");
    if (!sig) return false;
    const normalized = sig.replace(/^sha256=/i, "").trim();
    const expected = signPayoutMockWebhookBody(rawBody);
    const a = Buffer.from(normalized, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseWebhookEvent(rawBody: string): PayoutWebhookNormalized {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      providerEventId: String(parsed.eventId ?? parsed.providerEventId ?? ""),
      providerPayoutId: String(parsed.providerPayoutId ?? parsed.payoutId ?? ""),
      status: String(parsed.status ?? "paid").toLowerCase(),
      eventType: String(parsed.eventType ?? "payout_status"),
    };
  }
}

export class DisabledPayoutProvider implements PayoutProvider {
  readonly id = "disabled";

  async createPayout(_params: CreatePayoutParams): Promise<CreatePayoutResult> {
    throw new Error("PAYOUT_PROVIDER is disabled or not configured.");
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhookEvent(): PayoutWebhookNormalized {
    throw new Error("Payout provider disabled.");
  }
}

export function getPayoutProviderFromEnv(): PayoutProvider {
  const raw = (process.env.PAYOUT_PROVIDER || "mock").trim().toLowerCase();
  if (raw === "mock") return new MockPayoutProvider();
  if (raw === "disabled" || raw === "none" || raw === "") return new DisabledPayoutProvider();
  return new DisabledPayoutProvider();
}

export function getPayoutProviderByRouteId(routeId: string): PayoutProvider {
  const id = String(routeId || "").trim().toLowerCase();
  if (id === "mock") return new MockPayoutProvider();
  return new DisabledPayoutProvider();
}
