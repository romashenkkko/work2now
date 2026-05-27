import jwt from "jsonwebtoken";
import { ServiceError } from "./ServiceError";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

export type GoogleRegisterTokenPayload = {
  type: "google_register";
  googleId: string;
  email: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  /** YYYY-MM-DD from Google People API (if user shared birthday) */
  dateOfBirth?: string;
  role: "staff" | "customer";
};

export function createGoogleRegisterToken(payload: Omit<GoogleRegisterTokenPayload, "type">): string {
  const full: GoogleRegisterTokenPayload = { type: "google_register", ...payload };
  return jwt.sign(full, JWT_SECRET, { expiresIn: "30m" });
}

export function verifyGoogleRegisterToken(token: string): GoogleRegisterTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as GoogleRegisterTokenPayload;
    if (decoded.type !== "google_register" || !decoded.googleId || !decoded.email) {
      throw new Error("invalid");
    }
    if (decoded.role !== "staff" && decoded.role !== "customer") {
      throw new ServiceError("Rol invalid pentru înregistrarea Google.", 400);
    }
    return decoded;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError("Token Google invalid sau expirat. Autentifică-te din nou cu Google.", 400);
  }
}

export function resolveGoogleRegisterPrefill(token: string) {
  const p = verifyGoogleRegisterToken(token);
  return {
    email: p.email,
    firstName: p.givenName || "",
    lastName: p.familyName || "",
    picture: p.picture || "",
    dateOfBirth: p.dateOfBirth || "",
    role: p.role,
  };
}
