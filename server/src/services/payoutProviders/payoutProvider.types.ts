import type { Prisma } from "@prisma/client";

export type PayoutWebhookNormalized = Readonly<{
  providerEventId: string;
  providerPayoutId: string;
  /** paid | failed | reversed | processing */
  status: string;
  eventType: string;
}>;

export type CreatePayoutParams = Readonly<{
  applicationPayoutId: number;
  applicationId: number;
  staffUserId: string;
  amount: Prisma.Decimal;
  currency: string;
  providerReference: string;
  payoutAccountId: number;
}>;

export type CreatePayoutResult = Readonly<{
  providerPayoutId: string;
  /** If true, worker sets paid immediately without waiting for webhook. */
  immediatePaid: boolean;
  raw?: unknown;
}>;

export interface PayoutProvider {
  readonly id: string;
  createPayout(params: CreatePayoutParams): Promise<CreatePayoutResult>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhookEvent(rawBody: string): PayoutWebhookNormalized;
}
