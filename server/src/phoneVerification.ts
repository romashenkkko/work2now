import { randomBytes } from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

type VerificationEntry = {
  phone: string;
  expiresAt: number;
};

const verificationTokens = new Map<string, VerificationEntry>();

/** Normalize to E.164 with leading + and no spaces. */
export function normalizePhoneE164(raw: string): string {
  const trimmed = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/** Basic E.164 check (ITU-T), then Moldova (+373) national part when applicable. */
export function getPhoneValidationError(phone: string): string | null {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) return "Numărul de telefon este obligatoriu.";
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return "Format număr de telefon invalid. Folosește formatul internațional (ex: +37369123456).";
  }
  if (normalized.startsWith("+373")) {
    const national = normalized.slice(4);
    if (!/^\d{8}$/.test(national)) {
      return "Număr invalid pentru Moldova. Introduceți 8 cifre după +373 (ex: 69123456).";
    }
  }
  return null;
}

export function issuePhoneVerificationToken(phone: string): string {
  const normalized = normalizePhoneE164(phone);
  const token = randomBytes(24).toString("hex");
  verificationTokens.set(token, {
    phone: normalized,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export function consumePhoneVerificationToken(phone: string, token: string): boolean {
  const normalized = normalizePhoneE164(phone);
  const trimmedToken = String(token ?? "").trim();
  if (!normalized || !trimmedToken) return false;

  const entry = verificationTokens.get(trimmedToken);
  if (!entry) return false;
  verificationTokens.delete(trimmedToken);

  if (entry.expiresAt < Date.now()) return false;
  return entry.phone === normalized;
}

/** Dev/test helper – clear all pending tokens. */
export function clearPhoneVerificationTokens(): void {
  verificationTokens.clear();
}
