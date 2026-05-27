import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { buildLoginResponseForUser } from "./authService";
import { createGoogleRegisterToken } from "./googleRegisterToken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

export type GoogleOAuthMode = "login" | "register";

type OAuthStatePayload = {
  mode: GoogleOAuthMode;
  role?: "staff" | "customer";
  nonce: string;
};

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || "http://localhost:5500").replace(/\/+$/, "");
}

function getGoogleOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL?.trim() ||
    `http://localhost:${process.env.PORT || 5600}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new ServiceError(
      "Autentificarea Google nu este configurată (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      503
    );
  }

  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

function redirectToFrontend(path: string, params: Record<string, string>) {
  const url = new URL(`${getFrontendUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

function signOAuthState(mode: GoogleOAuthMode, role?: string): string {
  const payload: OAuthStatePayload = {
    mode,
    role: role === "staff" || role === "customer" ? role : undefined,
    nonce: randomUUID(),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

function verifyOAuthState(state: string): OAuthStatePayload {
  try {
    const decoded = jwt.verify(state, JWT_SECRET) as OAuthStatePayload;
    if (decoded.mode !== "login" && decoded.mode !== "register") {
      throw new Error("invalid mode");
    }
    return decoded;
  } catch {
    throw new ServiceError("Sesiunea Google a expirat. Încearcă din nou.", 400);
  }
}

const GOOGLE_BIRTHDAY_SCOPE = "https://www.googleapis.com/auth/user.birthday.read";

function oauthScopes(mode: GoogleOAuthMode): string[] {
  const base = ["openid", "email", "profile"];
  if (mode === "register") base.push(GOOGLE_BIRTHDAY_SCOPE);
  return base;
}

/** Reads birthday from Google People API (requires user.birthday.read scope). */
async function fetchGoogleBirthdayYmd(accessToken: string): Promise<string | null> {
  try {
    const url = new URL("https://people.googleapis.com/v1/people/me");
    url.searchParams.set("personFields", "birthdays");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      birthdays?: Array<{
        metadata?: { primary?: boolean };
        date?: { year?: number; month?: number; day?: number };
      }>;
    };
    const list = data.birthdays;
    if (!list?.length) return null;
    const entry = list.find((b) => b.metadata?.primary) ?? list[0];
    const d = entry?.date;
    if (!d?.year || !d?.month || !d?.day) return null;
    const m = String(d.month).padStart(2, "0");
    const day = String(d.day).padStart(2, "0");
    return `${d.year}-${m}-${day}`;
  } catch {
    return null;
  }
}

export function getGoogleAuthRedirectUrl(mode: GoogleOAuthMode, role?: string): string {
  const client = getGoogleOAuthClient();
  const state = signOAuthState(mode, role);
  return client.generateAuthUrl({
    access_type: "online",
    scope: oauthScopes(mode),
    prompt: mode === "register" ? "consent" : "consent",
    state,
  });
}

export async function handleGoogleOAuthCallback(code: string, state: string): Promise<string> {
  const oauthState = verifyOAuthState(state);
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new ServiceError("Google nu a returnat un token valid.", 400);
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email) {
    throw new ServiceError("Profil Google incomplet.", 400);
  }

  const googleId = profile.sub;
  const email = profile.email.trim().toLowerCase();
  const givenName = profile.given_name?.trim() || "";
  const familyName = profile.family_name?.trim() || "";
  const picture = profile.picture?.trim() || "";

  const existingByGoogle = await prisma.users.findFirst({
    where: { GoogleId: googleId },
    include: {
      employee_profiles: { select: { Name: true, Surname: true, ProfilePictureFileId: true } },
      business_profiles: { select: { CompanyName: true } },
    },
  });

  if (existingByGoogle) {
    const login = await buildLoginResponseForUser(existingByGoogle);
    return redirectToFrontend("/auth/google/callback", { token: login.token });
  }

  const existingByEmail = await prisma.users.findUnique({
    where: { Email: email },
    select: { Id: true, GoogleId: true, PasswordHash: true },
  });

  if (existingByEmail) {
    if (oauthState.mode === "login") {
      if (!existingByEmail.GoogleId) {
        return redirectToFrontend("/auth/google/callback", {
          error: "email_password_account",
        });
      }
      if (existingByEmail.GoogleId !== googleId) {
        return redirectToFrontend("/auth/google/callback", {
          error: "google_account_mismatch",
        });
      }
      const userByEmail = await prisma.users.findUnique({
        where: { Id: existingByEmail.Id },
        include: {
          employee_profiles: { select: { Name: true, Surname: true, ProfilePictureFileId: true } },
          business_profiles: { select: { CompanyName: true } },
        },
      });
      if (userByEmail) {
        const login = await buildLoginResponseForUser(userByEmail);
        return redirectToFrontend("/auth/google/callback", { token: login.token });
      }
    } else {
      return redirectToFrontend("/auth/google/callback", {
        error: "email_exists",
      });
    }
  }

  if (oauthState.mode === "login") {
    return redirectToFrontend("/auth/google/callback", {
      error: "no_account",
    });
  }

  const role = oauthState.role;
  if (role !== "staff" && role !== "customer") {
    return redirectToFrontend("/register", { error: "role_required" });
  }

  let dateOfBirth: string | undefined;
  if (tokens.access_token) {
    const dob = await fetchGoogleBirthdayYmd(tokens.access_token);
    if (dob) dateOfBirth = dob;
  }

  const googleRegisterToken = createGoogleRegisterToken({
    googleId,
    email,
    givenName,
    familyName,
    picture,
    dateOfBirth,
    role,
  });

  return redirectToFrontend(`/register/${role}`, {
    googleToken: googleRegisterToken,
  });
}
