import twilio from "twilio";
import { normalizePhoneE164 } from "./phoneVerification";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_SERVICE_SID = process.env.TWILIO_SERVICE_SID ?? "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM?.trim() ?? "";
const IS_DEV = (process.env.NODE_ENV || "development") !== "production";

const OTP_TTL_MS = 10 * 60 * 1000;

/** Cod fix doar când TWILIO_TEST_MODE=true (fără SMS). */
export const OTP_TEST_CODE = "123456";

/** OTP trimis prin Messages API (trial → numere verificate). */
const messagingOtpStore = new Map<string, { code: string; expiresAt: number }>();

function hasTwilioCredentials(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

function hasVerifyConfig(): boolean {
  return hasTwilioCredentials() && Boolean(TWILIO_SERVICE_SID);
}

function hasMessagingConfig(): boolean {
  return hasTwilioCredentials() && Boolean(TWILIO_SMS_FROM);
}

function useTestOtpMode(): boolean {
  return process.env.TWILIO_TEST_MODE === "true" || process.env.TWILIO_TEST_MODE === "1";
}

function getAllowedTrialPhones(): Set<string> | null {
  const raw = process.env.TWILIO_ALLOWED_PHONES?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((p) => normalizePhoneE164(p))
      .filter(Boolean)
  );
}

function assertPhoneAllowedForTrial(phoneE164: string): string | null {
  const allowed = getAllowedTrialPhones();
  if (!allowed) return null;
  if (allowed.has(phoneE164)) return null;
  return `Pe cont trial, SMS este permis doar către: ${[...allowed].join(", ")}.`;
}

let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio | null {
  if (useTestOtpMode() || !hasTwilioCredentials()) return null;
  if (twilioClient) return twilioClient;
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

export function logOtpModeAtStartup(): void {
  if (useTestOtpMode()) {
    console.log(`[Twilio] Mod TEST — cod ${OTP_TEST_CODE}, fără SMS.`);
    return;
  }
  if (!hasTwilioCredentials()) {
    console.warn("[Twilio] Credențiale lipsă — OTP SMS dezactivat.");
    return;
  }
  const parts: string[] = [];
  if (hasVerifyConfig()) parts.push("Verify API");
  if (hasMessagingConfig()) parts.push(`SMS din ${TWILIO_SMS_FROM}`);
  const allowed = getAllowedTrialPhones();
  console.log(
    `[Twilio] SMS activ: ${parts.join(" + ") || "config incompletă"}.${allowed ? ` Trial: ${[...allowed].join(", ")}` : ""}`
  );
  if (!hasMessagingConfig() && !hasVerifyConfig()) {
    console.warn("[Twilio] Setează TWILIO_SERVICE_SID sau TWILIO_SMS_FROM (număr Twilio).");
  }
}

function testSendOtp(phoneNumber: string): { ok: boolean; smsSent: boolean } {
  console.log(`[Twilio Test] ${normalizePhoneE164(phoneNumber)} → cod ${OTP_TEST_CODE}`);
  return { ok: true, smsSent: false };
}

function testVerifyOtp(code: string): { ok: boolean; verified: boolean; error?: string } {
  if (code.trim() === OTP_TEST_CODE) return { ok: true, verified: true };
  return { ok: true, verified: false, error: "Cod invalid. Mod test: 123456." };
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeMessagingOtp(phoneE164: string, code: string): void {
  messagingOtpStore.set(phoneE164, { code, expiresAt: Date.now() + OTP_TTL_MS });
}

function verifyMessagingOtp(phoneE164: string, code: string): { ok: boolean; verified: boolean; error?: string } {
  const entry = messagingOtpStore.get(phoneE164);
  if (!entry) {
    return { ok: true, verified: false, error: "Cod OTP invalid sau expirat." };
  }
  if (entry.expiresAt < Date.now()) {
    messagingOtpStore.delete(phoneE164);
    return { ok: true, verified: false, error: "Cod OTP expirat. Retrimite codul." };
  }
  if (entry.code !== code.trim()) {
    return { ok: true, verified: false, error: "Cod OTP invalid." };
  }
  messagingOtpStore.delete(phoneE164);
  return { ok: true, verified: true };
}

function isVerifyTrialError(message: string): boolean {
  return /unverified|trial account|21608|21610/i.test(message);
}

export type SendOtpResult = { ok: boolean; error?: string; smsSent?: boolean };

function mapSendError(message: string): string {
  if (/unverified|trial account/i.test(message)) {
    return (
      "Număr neverificat pe cont trial. Adaugă +37368826532 în Verified Caller IDs și setează TWILIO_SMS_FROM cu numărul tău Twilio."
    );
  }
  if (/geo|permission|21612|21408/i.test(message)) {
    return "Activează Moldova la Twilio → Messaging → Settings → Geo permissions.";
  }
  if (/not found|20404/i.test(message)) {
    return "TWILIO_SERVICE_SID sau TWILIO_SMS_FROM invalid — verifică consola Twilio.";
  }
  return message || "Eroare la trimiterea SMS.";
}

/** SMS clasic (funcționează pe trial către numere Verified Caller ID). */
async function sendOtpViaMessaging(
  client: twilio.Twilio,
  phoneE164: string
): Promise<SendOtpResult> {
  if (!TWILIO_SMS_FROM) {
    return { ok: false, error: "TWILIO_SMS_FROM lipsește — pune numărul Twilio din Phone Numbers → Active numbers." };
  }
  const code = generateOtpCode();
  try {
    await client.messages.create({
      to: phoneE164,
      from: TWILIO_SMS_FROM,
      body: `Codul tău Work2Now: ${code}. Valabil 10 minute.`,
    });
    storeMessagingOtp(phoneE164, code);
    console.log(`[Twilio SMS] Cod trimis la ${phoneE164} de la ${TWILIO_SMS_FROM}`);
    return { ok: true, smsSent: true };
  } catch (err) {
    const error = err as Error;
    console.error("[Twilio SMS] Eroare:", error.message);
    return { ok: false, error: mapSendError(error.message) };
  }
}

async function sendOtpViaVerify(client: twilio.Twilio, phoneE164: string): Promise<SendOtpResult> {
  const verification = await client.verify.v2
    .services(TWILIO_SERVICE_SID)
    .verifications.create({ to: phoneE164, channel: "sms" });

  if (verification.status === "pending" || verification.status === "approved") {
    console.log(`[Twilio Verify] OTP trimis la ${phoneE164}`);
    return { ok: true, smsSent: true };
  }
  return { ok: false, error: `Status neașteptat: ${verification.status}` };
}

export async function sendOTP(phoneNumber: string): Promise<SendOtpResult> {
  const phoneE164 = normalizePhoneE164(phoneNumber);

  if (useTestOtpMode()) return testSendOtp(phoneNumber);

  if (!hasTwilioCredentials()) {
    return {
      ok: false,
      error: IS_DEV
        ? "Completează TWILIO_ACCOUNT_SID și TWILIO_AUTH_TOKEN în server/.env"
        : "Serviciul SMS nu este configurat.",
    };
  }

  const trialBlock = assertPhoneAllowedForTrial(phoneE164);
  if (trialBlock) return { ok: false, error: trialBlock };

  const client = getTwilioClient();
  if (!client) return { ok: false, error: "Client Twilio indisponibil." };

  // Trial: Messages API e mai fiabil decât Verify pentru numere verificate manual
  if (hasMessagingConfig()) {
    return sendOtpViaMessaging(client, phoneE164);
  }

  if (!hasVerifyConfig()) {
    return {
      ok: false,
      error: "Setează TWILIO_SMS_FROM (recomandat trial) sau TWILIO_SERVICE_SID în .env",
    };
  }

  try {
    return await sendOtpViaVerify(client, phoneE164);
  } catch (err) {
    const error = err as Error;
    console.error("[Twilio Verify] Eroare:", error.message);
    if (hasMessagingConfig() && isVerifyTrialError(error.message)) {
      console.warn("[Twilio] Verify eșuat — încerc SMS clasic...");
      return sendOtpViaMessaging(client, phoneE164);
    }
    return { ok: false, error: mapSendError(error.message) };
  }
}

export async function verifyOTP(
  phoneNumber: string,
  code: string
): Promise<{ ok: boolean; verified: boolean; error?: string }> {
  if (useTestOtpMode()) return testVerifyOtp(code);

  const phoneE164 = normalizePhoneE164(phoneNumber);

  if (messagingOtpStore.has(phoneE164)) {
    return verifyMessagingOtp(phoneE164, code);
  }

  if (!hasVerifyConfig()) {
    return { ok: false, verified: false, error: "Twilio Verify neconfigurat." };
  }

  const client = getTwilioClient();
  if (!client) return { ok: false, verified: false, error: "Client Twilio indisponibil." };

  try {
    const check = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verificationChecks.create({ to: phoneE164, code: code.trim() });

    if (check.status === "approved") {
      return { ok: true, verified: true };
    }
    return { ok: true, verified: false, error: "Cod OTP invalid sau expirat." };
  } catch (err) {
    const error = err as Error;
    console.error("[Twilio Verify] Eroare verify:", error.message);
    return { ok: false, verified: false, error: mapSendError(error.message) };
  }
}
