import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_SERVICE_SID = process.env.TWILIO_SERVICE_SID ?? "";
const IS_DEV = (process.env.NODE_ENV || "development") !== "production";

let twilioClient: twilio.Twilio | null = null;

// Simple in-memory OTP store for development fallback (no Twilio SMS needed).
const devOtpStore = new Map<string, string>();

function getTwilioClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_SERVICE_SID) {
    console.warn("[Twilio] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SERVICE_SID neconfigurate.");
    return null;
  }
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

/**
 * Send OTP verification code to phone number using Twilio Verify service.
 * RESTRICTED TO SMS ONLY - no other channels (call, email, etc.) are allowed.
 * Returns { ok: true } on success, { ok: false, error: string } on failure.
 */
export async function sendOTP(phoneNumber: string): Promise<{ ok: boolean; error?: string }> {
  const client = getTwilioClient();
  // Development fallback – no real SMS, just log a code in console.
  if (!client) {
    if (IS_DEV) {
      const normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
      const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
      const code = "1234";
      devOtpStore.set(phoneWithPlus, code);
      console.log(`[Twilio Dev] OTP pentru ${phoneWithPlus} este ${code}. (Nu se trimite SMS real)`);
      return { ok: true };
    }
    return { ok: false, error: "Twilio nu este configurat. Verifica variabilele de mediu." };
  }

  try {
    // Normalize phone number (remove spaces, ensure it starts with +)
    const normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
    const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;

    // RESTRICTED TO SMS ONLY - channel is hardcoded to "sms"
    const verification = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verifications
      .create({
        to: phoneWithPlus,
        channel: "sms", // SMS only - no calls, email, or other channels
      });

    // Status should be "pending" when OTP is sent successfully
    if (verification.status === "pending" || verification.status === "approved") {
      console.log(`[Twilio] OTP sent successfully to ${phoneWithPlus}. Status: ${verification.status}`);
      return { ok: true };
    }
    console.warn(`[Twilio] Unexpected verification status: ${verification.status}`);
    return { ok: false, error: `Status neașteptat: ${verification.status}` };
  } catch (err) {
    const error = err as Error;
    console.error("[Twilio] Eroare la trimiterea OTP:", error.message);
    return { ok: false, error: error.message || "Eroare la trimiterea codului OTP." };
  }
}

/**
 * Verify OTP code for phone number using Twilio Verify service.
 * Returns { ok: true, verified: true } on success, { ok: false, error: string } on failure.
 */
export async function verifyOTP(phoneNumber: string, code: string): Promise<{ ok: boolean; verified: boolean; error?: string }> {
  const client = getTwilioClient();
  // Development fallback – use in-memory OTP instead of real Twilio verification.
  if (!client) {
    if (IS_DEV) {
      const normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
      const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
      const expected = devOtpStore.get(phoneWithPlus) ?? "1234";
      if (code.trim() === expected) {
        console.log(`[Twilio Dev] OTP verificat local pentru ${phoneWithPlus}`);
        return { ok: true, verified: true };
      }
      return { ok: true, verified: false, error: "Cod OTP invalid sau expirat." };
    }
    return { ok: false, verified: false, error: "Twilio nu este configurat. Verifica variabilele de mediu." };
  }

  try {
    // Normalize phone number (remove spaces, ensure it starts with +)
    const normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
    const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;

    const verificationCheck = await client.verify.v2
      .services(TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phoneWithPlus, code: code.trim() });

    // Check both status and valid fields as per Twilio documentation
    // Response: { status: "approved", valid: true, ... }
    if (verificationCheck.status === "approved" && verificationCheck.valid === true) {
      console.log(`[Twilio] OTP verified successfully for ${phoneWithPlus}`);
      return { ok: true, verified: true };
    }
    
    console.log(`[Twilio] OTP verification failed. Status: ${verificationCheck.status}, Valid: ${verificationCheck.valid}`);
    return { ok: true, verified: false, error: "Cod OTP invalid sau expirat." };
  } catch (err) {
    const error = err as Error;
    console.error("[Twilio] Eroare la verificarea OTP:", error.message);
    return { ok: false, verified: false, error: error.message || "Eroare la verificarea codului OTP." };
  }
}

