import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import { sendOTP, verifyOTP } from "../twilio";
import { sendTermsAcceptanceEmail } from "../email";
import { stringToUserRole, UserRole, userRoleToString } from "../enums";
import { ServiceError } from "./ServiceError";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

type MemoryUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "staff" | "customer" | "admin";
  avatar?: string | null;
};

const memoryUsers: MemoryUser[] = [];
const DEFAULT_ADMIN = {
  email: "admin@admin.com",
  password: "admin1",
  name: "Admin",
  role: "admin" as const,
};

type ValidateRegistrationInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  employeeProfile?: { firstName?: string; lastName?: string; dateOfBirth?: string; aboutMe?: string };
  businessProfile?: {
    companyName?: string;
    contactFirstName?: string;
    contactLastName?: string;
    companyCategory?: number;
    infoForStaff?: string;
  };
  branch?: { name?: string; address?: string; city?: string; country?: string; phoneNumber?: string; raionId?: number };
  contactDateOfBirth?: string;
};

type RegisterInput = ValidateRegistrationInput & {
  employeeProfile?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    aboutMe?: string;
    profilePictureFileId?: string | null;
  };
};

type LoginInput = { email?: string; password?: string };
type ChangePasswordInput = { currentPassword?: string; newPassword?: string };
type UpdateProfileInput = { name?: string; avatar?: string | null };
type SetUserStatusInput = { userId?: string; id?: string; active?: boolean };
type SetUserBoosterInput = { userId?: string; id?: string; boosterUntil?: string | null };
type OtpInput = { phoneNumber?: string };
type VerifyOtpInput = { phoneNumber?: string; code?: string };

function calculateAgeFromIsoOrYmd(value: string | undefined | null): number | null {
  if (!value) return null;
  const [datePart] = String(value).split("T");
  const [yStr, mStr, dStr] = datePart.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return null;
  const dob = new Date(y, m - 1, d);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function isDbConnectionError(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException & { code?: string; message?: string };
  const code = err?.code ?? "";
  const message = err?.message ?? "";
  return (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET"].includes(String(code)) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|prisma|database|connection/i.test(message)
  );
}

function useMemoryFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function requireUserId(userId?: string): string {
  if (!userId) throw new ServiceError("Unauthorized", 401);
  return userId;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim();
}

function getResolvedRole(role: UserRole): "staff" | "customer" | "admin" {
  return userRoleToString(role) as "staff" | "customer" | "admin";
}

function buildDisplayName(user: {
  Role: number;
  business_profiles?: { CompanyName: string } | null;
  employee_profiles?: { Name: string; Surname: string; ProfilePictureFileId?: string | null } | null;
  Avatar?: string | null;
}) {
  if (user.Role === UserRole.Business) {
    return {
      name: user.business_profiles?.CompanyName?.trim() || "User",
      avatar: user.Avatar ?? undefined,
      role: getResolvedRole(UserRole.Business),
    };
  }

  if (user.Role === UserRole.Admin) {
    return {
      name: DEFAULT_ADMIN.name,
      avatar: user.Avatar ?? undefined,
      role: getResolvedRole(UserRole.Admin),
    };
  }

  const firstName = user.employee_profiles?.Name?.trim() || "";
  const lastName = user.employee_profiles?.Surname?.trim() || "";
  return {
    name: `${firstName} ${lastName}`.trim() || "User",
    avatar: user.Avatar ?? user.employee_profiles?.ProfilePictureFileId ?? undefined,
    role: getResolvedRole(UserRole.Employee),
  };
}

async function ensureAdminInMemory(): Promise<void> {
  const exists = memoryUsers.some((u) => u.email.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase());
  if (exists) return;
  memoryUsers.push({
    id: `memory-${randomUUID()}`,
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
    role: DEFAULT_ADMIN.role,
  });
  console.log("[Auth] Cont admin implicit disponibil (memorie): " + DEFAULT_ADMIN.email);
}

function validateCommonRegistrationFields(input: ValidateRegistrationInput) {
  const nameTrim = String(input.name ?? "").trim();
  const emailTrim = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const allowedRole = ["user", "staff", "customer", "admin"].includes(String(input.role)) ? String(input.role) : "user";

  if (!nameTrim || nameTrim.length < 2) {
    throw new ServiceError("Numele este prea scurt.", 400);
  }
  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    throw new ServiceError("Email invalid.", 400);
  }
  if (!password || password.length < 6) {
    throw new ServiceError("Parola trebuie sa aiba minim 6 caractere.", 400);
  }
  if (allowedRole === "user") {
    throw new ServiceError("Selectează un rol valid: staff sau customer.", 400);
  }

  if (allowedRole === "staff") {
    const employeeProfile = input.employeeProfile;
    if (!employeeProfile) throw new ServiceError("Profilul staff este obligatoriu.", 400);
    if (!employeeProfile.firstName?.trim() || !employeeProfile.lastName?.trim()) {
      throw new ServiceError("Prenumele și numele sunt obligatorii pentru staff.", 400);
    }
    if (!employeeProfile.dateOfBirth) {
      throw new ServiceError("Data nașterii este obligatorie pentru staff.", 400);
    }
    const age = calculateAgeFromIsoOrYmd(employeeProfile.dateOfBirth);
    if (age === null || age < 18) {
      throw new ServiceError("Trebuie să ai cel puțin 18 ani pentru a crea un cont de staff (18+).", 400);
    }
  }

  if (allowedRole === "customer") {
    const businessProfile = input.businessProfile;
    const branch = input.branch;
    if (!businessProfile) throw new ServiceError("Profilul business este obligatoriu pentru customer.", 400);
    if (!businessProfile.companyName?.trim()) {
      throw new ServiceError("Numele companiei este obligatoriu.", 400);
    }
    if (!businessProfile.contactFirstName?.trim() || !businessProfile.contactLastName?.trim()) {
      throw new ServiceError("Numele și prenumele persoanei de contact sunt obligatorii.", 400);
    }
    if (!branch || !branch.name?.trim() || !branch.address?.trim() || !branch.city?.trim() || !branch.phoneNumber?.trim()) {
      throw new ServiceError("Toate câmpurile filialei sunt obligatorii.", 400);
    }
    if (!branch.raionId || branch.raionId <= 0) {
      throw new ServiceError("Raionul este obligatoriu.", 400);
    }
    const age = calculateAgeFromIsoOrYmd(input.contactDateOfBirth);
    if (age === null) {
      throw new ServiceError("Data nașterii este obligatorie pentru customer.", 400);
    }
    if (age < 18) {
      throw new ServiceError("Trebuie să ai cel puțin 18 ani pentru a crea un cont de customer (18+).", 400);
    }
  }

  return {
    nameTrim,
    emailTrim,
    password,
    allowedRole,
  };
}

async function ensureEmailAvailable(email: string) {
  const existing = await prisma.users.findUnique({
    where: { Email: email },
    select: { Id: true },
  });
  if (existing) throw new ServiceError("Email deja folosit.", 400);
}

async function loadUserProfile(userId: string) {
  return prisma.users.findUnique({
    where: { Id: userId },
    include: {
      employee_profiles: {
        select: { Name: true, Surname: true, ProfilePictureFileId: true },
      },
      business_profiles: {
        select: {
          CompanyName: true,
          ContactPersonName: true,
          ContactPersonSurname: true,
          branches: {
            take: 1,
            orderBy: { CreatedAt: "asc" },
            select: { PhoneNumber: true },
          },
        },
      },
    },
  });
}

async function requireAdmin(adminUserId?: string) {
  const resolvedUserId = requireUserId(adminUserId);
  const user = await prisma.users.findUnique({
    where: { Id: resolvedUserId },
    select: { Role: true },
  });
  if (!user || user.Role !== UserRole.Admin) {
    const mem = memoryUsers.find((entry) => entry.id === resolvedUserId);
    if (mem?.role === "admin") return resolvedUserId;
    throw new ServiceError("Doar administratorii pot realiza această acțiune.", 403);
  }
  return resolvedUserId;
}

export async function ensureDefaultAdmin(): Promise<void> {
  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  try {
    const existing = await prisma.users.findUnique({
      where: { Email: DEFAULT_ADMIN.email },
      select: { Id: true },
    });
    if (!existing) {
      await prisma.users.create({
        data: {
          Id: randomUUID(),
          Email: DEFAULT_ADMIN.email,
          PasswordHash: hash,
          Role: UserRole.Admin,
          CreatedAt: new Date(),
        },
      });
      console.log("[Auth] Cont admin implicit creat în DB (Prisma): " + DEFAULT_ADMIN.email);
    }
  } catch (_) {
    // ignore DB issues in dev fallback path
  }
  await ensureAdminInMemory();
}

export async function validateRegistration(input: ValidateRegistrationInput) {
  const { emailTrim } = validateCommonRegistrationFields(input);
  await ensureEmailAvailable(emailTrim);
  return { valid: true };
}

export async function registerUser(input: RegisterInput) {
  const { nameTrim, emailTrim, password, allowedRole } = validateCommonRegistrationFields(input);

  try {
    await ensureEmailAvailable(emailTrim);
    const passwordHash = await bcrypt.hash(password, 10);
    const roleEnum = stringToUserRole(allowedRole);
    const userId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.users.create({
        data: {
          Id: userId,
          Email: emailTrim,
          PasswordHash: passwordHash,
          Role: roleEnum,
          CreatedAt: new Date(),
        },
      });

      if (roleEnum === UserRole.Employee && input.employeeProfile) {
        await tx.employee_profiles.create({
          data: {
            Id: randomUUID(),
            UserId: userId,
            IDNP: "",
            Name: input.employeeProfile.firstName?.trim() || nameTrim.split(" ")[0] || "User",
            Surname: input.employeeProfile.lastName?.trim() || nameTrim.split(" ").slice(1).join(" ") || "User",
            DateOfBirth: new Date(input.employeeProfile.dateOfBirth!),
            AboutMe: input.employeeProfile.aboutMe?.trim() || "",
            ProfilePictureFileId: input.employeeProfile.profilePictureFileId || null,
          },
        });
      }

      if (roleEnum === UserRole.Business && input.businessProfile) {
        const businessProfileId = randomUUID();
        await tx.business_profiles.create({
          data: {
            Id: businessProfileId,
            UserId: userId,
            CompanyName: input.businessProfile.companyName!.trim(),
            ContactPersonName: input.businessProfile.contactFirstName!.trim(),
            ContactPersonSurname: input.businessProfile.contactLastName!.trim(),
            CompanyCategory: input.businessProfile.companyCategory || 1,
            InfoForStaff: input.businessProfile.infoForStaff?.trim() || "",
          },
        });

        if (input.branch) {
          await tx.branches.create({
            data: {
              Id: randomUUID(),
              BusinessProfileId: businessProfileId,
              Name: input.branch.name!.trim(),
              Address: input.branch.address!.trim(),
              City: input.branch.city!.trim(),
              Country: input.branch.country?.trim() || "Moldova",
              PhoneNumber: input.branch.phoneNumber!.trim(),
              ContactPersonName: input.businessProfile.contactFirstName!.trim(),
              ContactPersonSurname: input.businessProfile.contactLastName!.trim(),
              IsActive: true,
              CreatedAt: new Date(),
            },
          });
        }
      }
    });

    const displayName =
      allowedRole === "staff" && input.employeeProfile
        ? `${input.employeeProfile.firstName || ""} ${input.employeeProfile.lastName || ""}`.trim()
        : allowedRole === "customer" && input.businessProfile
          ? `${input.businessProfile.contactFirstName || ""} ${input.businessProfile.contactLastName || ""}`.trim()
          : nameTrim;

    await sendTermsAcceptanceEmail(emailTrim, displayName || nameTrim);
    return { message: "Cont creat cu succes. Acum te poti autentifica." };
  } catch (error) {
    // In development we previously fell back to an in-memory user list when Prisma failed.
    // That made the UI show success while data was NOT saved to the real database.
    // To keep behavior predictable and ensure persistence, we now always surface the real DB error.
    console.error("[Auth] registerUser failed (no memory fallback):", error);
    throw error;
  }
}

export async function loginUser(input: LoginInput) {
  const emailTrim = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    throw new ServiceError("Email invalid.", 400);
  }
  if (!password) {
    throw new ServiceError("Parola este obligatorie.", 400);
  }

  try {
    const user = await prisma.users.findUnique({
      where: { Email: emailTrim },
      include: {
        employee_profiles: {
          select: { Name: true, Surname: true, ProfilePictureFileId: true },
        },
        business_profiles: {
          select: { CompanyName: true },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.PasswordHash))) {
      throw new ServiceError("Email sau parola incorecta.", 401);
    }

    const publicUser = buildDisplayName(user);
    const token = jwt.sign({ userId: user.Id, email: emailTrim }, JWT_SECRET, { expiresIn: "7d" });

    return {
      token,
      user: {
        id: user.Id,
        name: publicUser.name,
        email: user.Email,
        role: publicUser.role,
        avatar: publicUser.avatar,
        isActive: user.IsActive,
      },
    };
  } catch (error) {
    if (useMemoryFallback() && isDbConnectionError(error)) {
      await ensureAdminInMemory();
      const memoryUser = memoryUsers.find((u) => u.email.toLowerCase() === emailTrim.toLowerCase());
      if (!memoryUser || !(await bcrypt.compare(password, memoryUser.passwordHash))) {
        throw new ServiceError("Email sau parola incorecta.", 401);
      }
      const token = jwt.sign({ userId: memoryUser.id, email: memoryUser.email }, JWT_SECRET, { expiresIn: "7d" });
      return {
        token,
        user: {
          id: memoryUser.id,
          name: memoryUser.name,
          email: memoryUser.email,
          role: memoryUser.role,
          avatar: memoryUser.avatar ?? undefined,
        },
      };
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("Baza de date este indisponibila. Porneste MySQL (XAMPP). Pentru test: admin@admin.com / admin1", 503);
  }
}

export async function changePassword(userId: string | undefined, input: ChangePasswordInput) {
  const resolvedUserId = requireUserId(userId);
  const currentPassword = String(input.currentPassword ?? "").trim();
  const newPassword = String(input.newPassword ?? "").trim();

  if (!currentPassword) throw new ServiceError("Parola curentă este obligatorie.", 400);
  if (!newPassword || newPassword.length < 6) {
    throw new ServiceError("Parola nouă trebuie să aibă minim 6 caractere.", 400);
  }

  try {
    const user = await prisma.users.findUnique({
      where: { Id: resolvedUserId },
      select: { PasswordHash: true },
    });
    if (!user) throw new ServiceError("Utilizator negăsit.", 404);
    const valid = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!valid) throw new ServiceError("Parola curentă este incorectă.", 400);

    await prisma.users.update({
      where: { Id: resolvedUserId },
      data: { PasswordHash: await bcrypt.hash(newPassword, 10) },
    });

    return { message: "Parola a fost schimbată cu succes." };
  } catch (error) {
    if (useMemoryFallback() && isDbConnectionError(error)) {
      const mem = memoryUsers.find((entry) => entry.id === resolvedUserId);
      if (!mem) throw new ServiceError("Utilizator negăsit.", 404);
      const valid = await bcrypt.compare(currentPassword, mem.passwordHash);
      if (!valid) throw new ServiceError("Parola curentă este incorectă.", 400);
      mem.passwordHash = await bcrypt.hash(newPassword, 10);
      return { message: "Parola a fost schimbată cu succes." };
    }
    throw error;
  }
}

export async function getCurrentUser(userId?: string) {
  const resolvedUserId = requireUserId(userId);
  try {
    const user = await loadUserProfile(resolvedUserId);
    if (!user) throw new ServiceError("Utilizator negasit.", 404);

    const publicUser = buildDisplayName(user);
    return {
      id: user.Id,
      name: publicUser.name,
      email: user.Email,
      role: publicUser.role,
      avatar: publicUser.avatar,
      isActive: user.IsActive,
      boosterUntil: user.BoosterUntil?.toISOString?.() ?? undefined,
    };
  } catch (error) {
    if (useMemoryFallback() && isDbConnectionError(error)) {
      const mem = memoryUsers.find((entry) => entry.id === resolvedUserId);
      if (!mem) throw new ServiceError("Utilizator negasit.", 404);
      return {
        id: mem.id,
        name: mem.name,
        email: mem.email,
        role: mem.role,
        avatar: mem.avatar ?? undefined,
        isActive: true,
      };
    }
    throw error;
  }
}

export async function updateCurrentUser(userId?: string, input: UpdateProfileInput = {}) {
  const resolvedUserId = requireUserId(userId);
  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const avatar = typeof input.avatar === "string" ? input.avatar.trim() || null : input.avatar;

  if (avatar && avatar.length > 1024 * 1024) {
    throw new ServiceError("Imaginea este prea mare. Alege o imagine mai mică (max. ~1MB).", 400);
  }
  if (name !== undefined && name.length < 2) {
    throw new ServiceError("Numele trebuie să aibă minim 2 caractere.", 400);
  }
  if (name === undefined && avatar === undefined) {
    throw new ServiceError("Trimite name sau avatar.", 400);
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { Id: resolvedUserId },
      include: {
        employee_profiles: { select: { UserId: true } },
        business_profiles: { select: { UserId: true } },
      },
    });

    if (!user) throw new ServiceError("Utilizator negasit.", 404);

    if (avatar !== undefined) {
      await tx.users.update({
        where: { Id: resolvedUserId },
        data: { Avatar: avatar },
      });
    }

    if (user.Role === UserRole.Employee) {
      if (name !== undefined) {
        const [firstName, ...rest] = name.split(" ");
        await tx.employee_profiles.update({
          where: { UserId: resolvedUserId },
          data: {
            Name: firstName || name,
            Surname: rest.join(" ") || name,
          },
        });
      }

      if (avatar !== undefined) {
        await tx.employee_profiles.update({
          where: { UserId: resolvedUserId },
          data: {
            ProfilePictureFileId: typeof avatar === "string" && avatar.length <= 36 ? avatar : null,
          },
        });
      }
    }

    if (user.Role === UserRole.Business && name !== undefined) {
      const [firstName, ...rest] = name.split(" ");
      await tx.business_profiles.update({
        where: { UserId: resolvedUserId },
        data: {
          ContactPersonName: firstName || name,
          ContactPersonSurname: rest.join(" ") || name,
        },
      });
    }
  });

  return getCurrentUser(resolvedUserId);
}

export async function listUsers(adminUserId?: string) {
  await requireAdmin(adminUserId);

  try {
    const users = await prisma.users.findMany({
      include: {
        employee_profiles: {
          select: { Name: true, Surname: true },
        },
        business_profiles: {
          select: {
            CompanyName: true,
            branches: {
              take: 1,
              orderBy: { CreatedAt: "asc" },
              select: { PhoneNumber: true },
            },
          },
        },
      },
      orderBy: { CreatedAt: "asc" },
    });

    return {
      users: users.map((user) => {
        const publicUser = buildDisplayName(user);
        const phone = user.business_profiles?.branches?.[0]?.PhoneNumber?.trim() || undefined;
        return {
          id: user.Id,
          name: publicUser.name,
          email: user.Email,
          role: publicUser.role,
          isActive: user.IsActive,
          phone,
          boosterUntil: user.BoosterUntil?.toISOString?.() ?? undefined,
        };
      }),
    };
  } catch (error) {
    if (useMemoryFallback() && isDbConnectionError(error)) {
      return {
        users: memoryUsers.map((entry) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          role: entry.role,
          isActive: true,
        })),
      };
    }
    throw error;
  }
}

export async function setUserStatus(adminUserId: string | undefined, input: SetUserStatusInput) {
  const resolvedAdminId = await requireAdmin(adminUserId);
  const targetId = String(input.userId ?? input.id ?? "").trim();
  const active = input.active === true;

  if (!targetId) throw new ServiceError("ID utilizator lipsă. Trimite userId în body.", 400);
  if (targetId === resolvedAdminId) throw new ServiceError("Nu vă puteți bloca contul propriu.", 400);

  const existing = await prisma.users.findUnique({
    where: { Id: targetId },
    select: { Id: true },
  });
  if (!existing) throw new ServiceError("Utilizator negăsit.", 404);

  await prisma.users.update({
    where: { Id: targetId },
    data: { IsActive: active },
  });

  return { ok: true, active };
}

export async function setUserBooster(adminUserId: string | undefined, input: SetUserBoosterInput) {
  await requireAdmin(adminUserId);
  const targetId = String(input.userId ?? input.id ?? "").trim();
  if (!targetId) throw new ServiceError("ID utilizator lipsă. Trimite userId în body.", 400);

  const existing = await prisma.users.findUnique({
    where: { Id: targetId },
    select: { Id: true },
  });
  if (!existing) throw new ServiceError("Utilizator negăsit.", 404);

  let boosterUntil: Date | null = null;
  if (input.boosterUntil !== undefined && input.boosterUntil !== null) {
    if (typeof input.boosterUntil !== "string" || !input.boosterUntil.trim()) {
      throw new ServiceError("boosterUntil trebuie să fie o dată ISO validă.", 400);
    }
    const parsed = new Date(input.boosterUntil.trim());
    if (Number.isNaN(parsed.getTime())) {
      throw new ServiceError("boosterUntil trebuie să fie o dată ISO validă.", 400);
    }
    boosterUntil = parsed;
  }

  await prisma.users.update({
    where: { Id: targetId },
    data: { BoosterUntil: boosterUntil },
  });

  return {
    ok: true,
    boosterUntil: boosterUntil?.toISOString?.(),
  };
}

export async function sendOtpCode(input: OtpInput) {
  const phoneNumber = String(input.phoneNumber ?? "").trim();
  if (!phoneNumber) throw new ServiceError("Numărul de telefon este obligatoriu.", 400);

  const normalizedPhone = phoneNumber.replace(/\s+/g, "");
  if (!/^\+?[1-9]\d{1,14}$/.test(normalizedPhone)) {
    throw new ServiceError("Format număr de telefon invalid. Folosește formatul internațional (ex: +37312345678).", 400);
  }

  const result = await sendOTP(normalizedPhone);
  if (!result.ok) throw new ServiceError(result.error || "Eroare la trimiterea codului OTP.", 400);
  return { message: "Cod OTP trimis cu succes." };
}

export async function verifyOtpCode(input: VerifyOtpInput) {
  const phoneNumber = String(input.phoneNumber ?? "").trim();
  const code = String(input.code ?? "").trim();
  if (!phoneNumber) throw new ServiceError("Numărul de telefon este obligatoriu.", 400);
  if (!code) throw new ServiceError("Codul OTP este obligatoriu.", 400);

  const normalizedPhone = phoneNumber.replace(/\s+/g, "");
  if (!/^\+?[1-9]\d{1,14}$/.test(normalizedPhone)) {
    throw new ServiceError("Format număr de telefon invalid.", 400);
  }

  const result = await verifyOTP(normalizedPhone, code);
  if (!result.ok || !result.verified) {
    throw new ServiceError(result.error || "Cod OTP invalid sau expirat.", 400);
  }
  return { verified: true, message: "Număr de telefon verificat cu succes." };
}
