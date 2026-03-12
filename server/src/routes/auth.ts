import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { createUserDotNetStyle } from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";
import { stringToUserRole, UserRole } from "../enums";
import { sendOTP, verifyOTP } from "../twilio";
import { sendTermsAcceptanceEmail } from "../email";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

function calculateAgeFromIsoOrYmd(value: string | undefined | null): number | null {
  if (!value) return null;
  const [datePart] = String(value).split("T");
  if (!datePart) return null;
  const [yStr, mStr, dStr] = datePart.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return null;
  const dob = new Date(y, m - 1, d);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/** Fallback în memorie când MySQL nu e disponibil (doar development) */
type MemoryUser = { id: number; name: string; email: string; password_hash: string; role: string; avatar?: string | null };
const memoryUsers: MemoryUser[] = [];
let memoryNextId = 1000000;

/** Cont admin implicit: email admin@admin.com, parolă admin1 */
const DEFAULT_ADMIN = { email: "admin@admin.com", password: "admin1", name: "Admin", role: "admin" as const };

/** Asigură că admin este în memoryUsers (pentru login când DB e oprit). */
async function ensureAdminInMemory(): Promise<void> {
  if (memoryUsers.some((u) => u.email.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase())) return;
  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  memoryUsers.push({
    id: memoryNextId++,
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    password_hash: hash,
    role: DEFAULT_ADMIN.role,
  });
  console.log("[Auth] Cont admin implicit disponibil (memorie): " + DEFAULT_ADMIN.email);
}

export async function ensureDefaultAdmin(): Promise<void> {
  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  try {
    const [rows] = await db.query("SELECT Id FROM users WHERE Email = ?", [DEFAULT_ADMIN.email]) as [{ Id: string }[], unknown];
    if (Array.isArray(rows) && rows.length === 0) {
      // Use new schema function - Admin users don't need profiles
      await createUserDotNetStyle({
        email: DEFAULT_ADMIN.email,
        passwordHash: hash,
        role: UserRole.Admin,
      });
      console.log("[Auth] Cont admin implicit creat în DB (nouă schemă): " + DEFAULT_ADMIN.email);
    }
  } catch (_) {
    /* DB indisponibil – adăugăm în memorie */
  }
  if (!memoryUsers.some((u) => u.email.toLowerCase() === DEFAULT_ADMIN.email.toLowerCase())) {
    memoryUsers.push({
      id: memoryNextId++,
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      password_hash: hash,
      role: DEFAULT_ADMIN.role,
    });
    console.log("[Auth] Cont admin implicit disponibil (memorie): " + DEFAULT_ADMIN.email);
  }
}

function isDbConnectionError(e: unknown): boolean {
  const err = e as NodeJS.ErrnoException & { code?: string };
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  if (typeof code === "string" && (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "ECONNRESET" || code.startsWith("ER_"))) return true;
  return (
    /ECONNREFUSED|ER_ACCESS_DENIED|ER_BAD_DB_ERROR|ER_NO_SUCH_TABLE|connect|ETIMEDOUT|ENOTFOUND|ECONNRESET/i.test(msg) ||
    /Unknown database|Table .* doesn't exist/i.test(msg)
  );
}

/** În development, folosim fallback în memorie la orice eroare DB (nu doar la conexiune). */
function useMemoryFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** POST /api/auth/validate-registration - Validate registration data before showing terms & conditions */
router.post("/validate-registration", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const {
    name = "",
    email = "",
    password = "",
    role = "user",
    employeeProfile,
    businessProfile,
    branch,
    contactDateOfBirth,
  } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    employeeProfile?: { firstName?: string; lastName?: string; dateOfBirth?: string; aboutMe?: string };
    businessProfile?: { companyName?: string; contactFirstName?: string; contactLastName?: string; companyCategory?: number; infoForStaff?: string };
    branch?: { name?: string; address?: string; city?: string; country?: string; phoneNumber?: string; raionId?: number };
    contactDateOfBirth?: string;
  };

  // Validate basic fields
  const nameTrim = String(name).trim();
  if (!nameTrim || nameTrim.length < 2) {
    res.status(400).json({ error: "Numele este prea scurt." });
    return;
  }

  const emailStr = String(email).trim();
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    res.status(400).json({ error: "Email invalid." });
    return;
  }

  if (!String(password).length || String(password).length < 6) {
    res.status(400).json({ error: "Parola trebuie sa aiba minim 6 caractere." });
    return;
  }

  const allowedRole = ["user", "staff", "customer", "admin"].includes(String(role)) ? String(role) : "user";
  const emailTrim = emailStr;

  if (allowedRole === "user") {
    res.status(400).json({ error: "Selectează un rol valid: staff sau customer." });
    return;
  }

  // Check if email already exists
  try {
    const [rows] = await db.query("SELECT Id FROM users WHERE Email = ?", [emailTrim]) as [unknown[], unknown];
    if (Array.isArray(rows) && rows.length > 0) {
      res.status(400).json({ error: "Email deja folosit." });
      return;
    }
  } catch (e) {
    const err = e as Error;
    console.error("Validate registration error:", err);
    res.status(500).json({ error: "Eroare la validare. Verifica ca backend-ul ruleaza." });
    return;
  }

  // Validate role-specific required fields
  if (allowedRole === "staff") {
    if (!employeeProfile) {
      res.status(400).json({ error: "Profilul staff este obligatoriu." });
      return;
    }
    if (!employeeProfile.firstName?.trim() || !employeeProfile.lastName?.trim()) {
      res.status(400).json({ error: "Prenumele și numele sunt obligatorii pentru staff." });
      return;
    }
    if (!employeeProfile.dateOfBirth) {
      res.status(400).json({ error: "Data nașterii este obligatorie pentru staff." });
      return;
    }
    const age = calculateAgeFromIsoOrYmd(employeeProfile.dateOfBirth);
    if (age === null || age < 18) {
      res.status(400).json({ error: "Trebuie să ai cel puțin 18 ani pentru a crea un cont de staff (18+)." });
      return;
    }
  }

  if (allowedRole === "customer") {
    if (!businessProfile) {
      res.status(400).json({ error: "Profilul business este obligatoriu pentru customer." });
      return;
    }
    if (!businessProfile.companyName?.trim()) {
      res.status(400).json({ error: "Numele companiei este obligatoriu." });
      return;
    }
    if (!businessProfile.contactFirstName?.trim() || !businessProfile.contactLastName?.trim()) {
      res.status(400).json({ error: "Numele și prenumele persoanei de contact sunt obligatorii." });
      return;
    }
    if (!branch || !branch.name?.trim() || !branch.address?.trim() || !branch.city?.trim() || !branch.phoneNumber?.trim()) {
      res.status(400).json({ error: "Toate câmpurile filialei sunt obligatorii." });
      return;
    }
    if (!branch.raionId || branch.raionId <= 0) {
      res.status(400).json({ error: "Raionul este obligatoriu." });
      return;
    }
    const age = calculateAgeFromIsoOrYmd(contactDateOfBirth);
    if (age === null) {
      res.status(400).json({ error: "Data nașterii este obligatorie pentru customer." });
      return;
    }
    if (age < 18) {
      res.status(400).json({ error: "Trebuie să ai cel puțin 18 ani pentru a crea un cont de customer (18+)." });
      return;
    }
  }

  // All validations passed
  res.status(200).json({ valid: true });
});

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const {
    name = "",
    email = "",
    password = "",
    role = "user",
    employeeProfile,
    businessProfile,
    branch,
    contactDateOfBirth,
  } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    employeeProfile?: { firstName?: string; lastName?: string; dateOfBirth?: string; aboutMe?: string; profilePictureFileId?: string | null };
    businessProfile?: { companyName?: string; contactFirstName?: string; contactLastName?: string; companyCategory?: number; infoForStaff?: string };
    branch?: { name?: string; address?: string; city?: string; country?: string; phoneNumber?: string; raionId?: number };
    contactDateOfBirth?: string;
  };
  
  // For backward compatibility, use name if firstName/lastName not provided
  const nameTrim = String(name).trim();
  if (!nameTrim || nameTrim.length < 2) {
    res.status(400).json({ error: "Numele este prea scurt." });
    return;
  }
  
  const emailStr = String(email).trim();
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    res.status(400).json({ error: "Email invalid." });
    return;
  }
  if (!String(password).length || String(password).length < 6) {
    res.status(400).json({ error: "Parola trebuie sa aiba minim 6 caractere." });
    return;
  }
  const allowedRole = ["user", "staff", "customer", "admin"].includes(String(role)) ? String(role) : "user";
  const emailTrim = emailStr;
  const passwordStr = String(password ?? "");

  if (allowedRole === "user") {
    res.status(400).json({ error: "Selectează un rol valid: staff sau customer." });
    return;
  }

  // Validate role-specific required fields.
  if (allowedRole === "staff") {
    if (!employeeProfile) {
      res.status(400).json({ error: "Profilul staff este obligatoriu." });
      return;
    }
    if (!employeeProfile.firstName?.trim() || !employeeProfile.lastName?.trim()) {
      res.status(400).json({ error: "Prenumele și numele sunt obligatorii pentru staff." });
      return;
    }
    if (!employeeProfile.dateOfBirth) {
      res.status(400).json({ error: "Data nașterii este obligatorie pentru staff." });
      return;
    }
    const age = calculateAgeFromIsoOrYmd(employeeProfile.dateOfBirth);
    if (age === null || age < 18) {
      res.status(400).json({ error: "Trebuie să ai cel puțin 18 ani pentru a crea un cont de staff (18+)." });
      return;
    }
  }
  
  if (allowedRole === "customer") {
    if (!businessProfile) {
      res.status(400).json({ error: "Profilul business este obligatoriu pentru customer." });
      return;
    }
    if (!businessProfile.companyName?.trim()) {
      res.status(400).json({ error: "Numele companiei este obligatoriu." });
      return;
    }
    if (!businessProfile.contactFirstName?.trim() || !businessProfile.contactLastName?.trim()) {
      res.status(400).json({ error: "Numele și prenumele persoanei de contact sunt obligatorii." });
      return;
    }
    if (!branch || !branch.name?.trim() || !branch.address?.trim() || !branch.city?.trim() || !branch.phoneNumber?.trim()) {
      res.status(400).json({ error: "Toate câmpurile filialei sunt obligatorii." });
      return;
    }
    const age = calculateAgeFromIsoOrYmd(contactDateOfBirth);
    if (age === null) {
      res.status(400).json({ error: "Data nașterii este obligatorie pentru customer." });
      return;
    }
    if (age < 18) {
      res.status(400).json({ error: "Trebuie să ai cel puțin 18 ani pentru a crea un cont de customer (18+)." });
      return;
    }
  }
  
  try {
    const [rows] = await db.query("SELECT Id FROM users WHERE Email = ?", [emailTrim]) as [{ Id: string }[], unknown];
    if (Array.isArray(rows) && rows.length > 0) {
      res.status(400).json({ error: "Email deja folosit." });
      return;
    }
    const password_hash = await bcrypt.hash(passwordStr, 10);
    // Use new schema function
    const roleEnum = stringToUserRole(allowedRole);
    
    // Prepare profile data based on role
    if (roleEnum === UserRole.Employee && employeeProfile) {
      await createUserDotNetStyle({
        email: emailTrim,
        passwordHash: password_hash,
        role: roleEnum,
        employeeProfile: {
          name: employeeProfile.firstName || nameTrim.split(" ")[0] || "User",
          surname: employeeProfile.lastName || nameTrim.split(" ").slice(1).join(" ") || "User",
          dateOfBirth: employeeProfile.dateOfBirth || new Date("1990-01-01").toISOString(),
          aboutMe: employeeProfile.aboutMe || "",
          profilePictureFileId: employeeProfile.profilePictureFileId || null,
        },
      });
    } else if (roleEnum === UserRole.Business && businessProfile) {
      await createUserDotNetStyle({
        email: emailTrim,
        passwordHash: password_hash,
        role: roleEnum,
        businessProfile: {
          companyName: businessProfile.companyName || nameTrim,
          contactPersonName: businessProfile.contactFirstName || nameTrim.split(" ")[0] || "Contact",
          contactPersonSurname: businessProfile.contactLastName || nameTrim.split(" ").slice(1).join(" ") || "Person",
          companyCategory: businessProfile.companyCategory || 1,
          infoForStaff: businessProfile.infoForStaff || "",
        },
        branch: branch ? {
          name: branch.name.trim(),
          address: branch.address.trim(),
          city: branch.city.trim(),
          country: branch.country?.trim() || "Moldova",
          phoneNumber: branch.phoneNumber.trim(),
        } : undefined,
      });
    } else {
      // Admin or no profile data - create user without profile
      await createUserDotNetStyle({
        email: emailTrim,
        passwordHash: password_hash,
        role: roleEnum,
      });
    }
    // Send T&C acceptance confirmation email to user
    const displayName =
      allowedRole === "staff" && employeeProfile
        ? `${employeeProfile.firstName || ""} ${employeeProfile.lastName || ""}`.trim()
        : allowedRole === "customer" && businessProfile
          ? `${businessProfile.contactFirstName || ""} ${businessProfile.contactLastName || ""}`.trim()
          : nameTrim;
    await sendTermsAcceptanceEmail(emailTrim, displayName || nameTrim);

    res.status(201).json({ message: "Cont creat cu succes. Acum te poti autentifica." });
  } catch (e) {
    /* Fallback în memorie DOAR la erori reale de conexiune DB. */
    if (useMemoryFallback() && isDbConnectionError(e)) {
      try {
        const existing = memoryUsers.find((u) => u.email.toLowerCase() === emailTrim.toLowerCase());
        if (existing) {
          res.status(400).json({ error: "Email deja folosit." });
          return;
        }
        const password_hash = await bcrypt.hash(passwordStr, 10);
        const id = memoryNextId++;
        memoryUsers.push({ id, name: nameTrim, email: emailTrim, password_hash, role: allowedRole });
        console.warn("[Auth] DB indisponibil – utilizator salvat în memorie.", (e as Error)?.message);
        await sendTermsAcceptanceEmail(emailTrim, nameTrim);
        res.status(201).json({ message: "Cont creat cu succes. Acum te poti autentifica." });
        return;
      } catch (memErr) {
        console.error("Memory fallback failed:", memErr);
      }
    }
    const err = e as Error;
    console.error("Register error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message
          ? `Eroare la inregistrare: ${err.message}`
          : "Eroare la inregistrare. Verifica ca backend-ul ruleaza (npm run dev).",
      });
    }
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const { email = "", password = "" } = body;
  if (!String(email).trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    res.status(400).json({ error: "Email invalid." });
    return;
  }
  const passStr = body.password;
  if (!passStr || String(passStr).length === 0) {
    res.status(400).json({ error: "Parola este obligatorie." });
    return;
  }
  const emailTrim = String(email).trim();

  try {
    // Query new schema: join with profile tables to get name/avatar
    const [rows] = await db.query(
      `SELECT u.Id, u.Email, u.PasswordHash, u.Role, COALESCE(u.IsActive, 1) AS IsActive,
              CASE
                WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                ELSE 'User'
              END as name,
              COALESCE(ep.Surname, '') as surname,
              COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) as avatar,
              CASE
                WHEN u.Role = 3 THEN 'admin'
                WHEN bp.UserId IS NOT NULL THEN 'customer'
                WHEN ep.UserId IS NOT NULL THEN 'staff'
                WHEN u.Role = 2 THEN 'customer'
                ELSE 'staff'
              END as resolved_role
       FROM users u
       LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
       LEFT JOIN business_profiles bp ON u.Id = bp.UserId
       WHERE u.Email = ?`,
      [emailTrim]
    ) as [{ Id: string; Email: string; PasswordHash: string; Role: number; IsActive: number; name: string; surname: string; avatar?: string | null; resolved_role: string }[], unknown];
    const user = Array.isArray(rows) ? rows[0] : undefined;
    if (!user || !(await bcrypt.compare(String(passStr), user.PasswordHash))) {
      res.status(401).json({ error: "Email sau parola incorecta." });
      return;
    }
    const isActive = Number(user.IsActive) !== 0;
    const roleStr = String(user.resolved_role || "").trim() || "staff";
    const fullName = user.name;
    const token = jwt.sign(
      { userId: user.Id, email: emailTrim } as JwtPayload,
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ 
      token, 
      user: { 
        id: user.Id, 
        name: fullName, 
        email: emailTrim, 
        role: roleStr, 
        avatar: user.avatar ?? undefined,
        isActive 
      } 
    });
  } catch (e) {
    /* Fallback în memorie DOAR când DB e indisponibil. */
    if (useMemoryFallback() && isDbConnectionError(e)) {
      await ensureAdminInMemory();
      const mem = memoryUsers.find((u) => u.email.toLowerCase() === emailTrim.toLowerCase());
      if (mem && (await bcrypt.compare(String(passStr), mem.password_hash))) {
        const token = jwt.sign(
          { userId: String(mem.id), email: emailTrim } as JwtPayload,
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : "user";
        res.json({ token, user: { id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar } });
        return;
      }
    }
    if (!res.headersSent) {
      if (isDbConnectionError(e)) {
        res.status(503).json({
          error: "Baza de date este indisponibila. Porneste MySQL (XAMPP). Pentru test: admin@admin.com / admin1",
        });
      } else {
        res.status(401).json({ error: "Email sau parola incorecta." });
      }
    }
  }
});

router.post("/change-password", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  const body = req.body ?? {};
  const currentPassword = String(body.currentPassword ?? "").trim();
  const newPassword = String(body.newPassword ?? "").trim();
  if (!currentPassword) {
    res.status(400).json({ error: "Parola curentă este obligatorie." });
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Parola nouă trebuie să aibă minim 6 caractere." });
    return;
  }

  try {
    const [rows] = await db.query(
      "SELECT PasswordHash FROM users WHERE Id = ?",
      [user.userId]
    ) as [{ PasswordHash: string }[], unknown];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (row) {
      const valid = await bcrypt.compare(currentPassword, row.PasswordHash);
      if (!valid) {
        res.status(400).json({ error: "Parola curentă este incorectă." });
        return;
      }
      
      // Update password in new schema
      const password_hash = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET PasswordHash = ? WHERE Id = ?", [password_hash, user.userId]);
      res.json({ message: "Parola a fost schimbată cu succes." });
      return;
    }
  } catch (e) {
    // If DB update fails, fallback to memory
    if (e && typeof e === "object" && "code" in e) {
      /* fallback la memorie */
    } else {
      throw e;
    }
  }

  const mem = memoryUsers.find((m) => String(m.id) === user.userId);
  if (mem) {
    const valid = await bcrypt.compare(currentPassword, mem.password_hash);
    if (!valid) {
      res.status(400).json({ error: "Parola curentă este incorectă." });
      return;
    }
    mem.password_hash = await bcrypt.hash(newPassword, 10);
    res.json({ message: "Parola a fost schimbată cu succes." });
    return;
  }

  if (!res.headersSent) {
    res.status(404).json({ error: "Utilizator negăsit." });
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  try {
    // Query new schema: join with profile tables to get name/avatar
    const [rows] = await db.query(
      `SELECT u.Id, u.Email, u.Role, COALESCE(u.IsActive, 1) AS IsActive, u.BoosterUntil AS boosterUntil,
              CASE
                WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                ELSE 'User'
              END as name,
              COALESCE(ep.Surname, '') as surname,
              COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) as avatar,
              CASE
                WHEN u.Role = 3 THEN 'admin'
                WHEN bp.UserId IS NOT NULL THEN 'customer'
                WHEN ep.UserId IS NOT NULL THEN 'staff'
                WHEN u.Role = 2 THEN 'customer'
                ELSE 'staff'
              END as resolved_role
       FROM users u
       LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
       LEFT JOIN business_profiles bp ON u.Id = bp.UserId
       WHERE u.Id = ?`,
      [user.userId]
    ) as [{ Id: string; Email: string; Role: number; IsActive: number; boosterUntil?: string | Date | null; name: string; surname: string; avatar?: string | null; resolved_role: string }[], unknown];
    const u = Array.isArray(rows) ? rows[0] : undefined;
    if (u) {
      const roleStr = String(u.resolved_role || "").trim() || "staff";
      const fullName = u.name;
      const isActive = Number(u.IsActive) !== 0;
      const boosterUntil = u.boosterUntil != null ? (typeof u.boosterUntil === "string" ? u.boosterUntil : (u.boosterUntil as Date).toISOString?.() ?? String(u.boosterUntil)) : undefined;
      res.json({ id: u.Id, name: fullName, email: u.Email, role: roleStr, avatar: u.avatar ?? undefined, isActive, boosterUntil: boosterUntil ?? undefined });
      return;
    }
    const mem = memoryUsers.find((m) => String(m.id) === user.userId);
    if (mem) {
      const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : (mem.role ?? "user");
      res.json({ id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar, isActive: true });
      return;
    }
    res.status(404).json({ error: "Utilizator negasit." });
  } catch (e) {
    if (useMemoryFallback() && isDbConnectionError(e)) {
      const mem = memoryUsers.find((m) => String(m.id) === user.userId);
      if (mem) {
        const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : (mem.role ?? "user");
        res.json({ id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar, isActive: true });
        return;
      }
    }
    console.error("/me error:", e);
    if (!res.headersSent) res.status(500).json({ error: "Eroare server." });
  }
});

/** PATCH /api/auth/me - actualizează nume și avatar (nu email) */
router.patch("/me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  let avatarVal: string | null | undefined = typeof body.avatar === "string" ? body.avatar.trim() || null : undefined;
  if (avatarVal && avatarVal.length > 1024 * 1024) {
    res.status(400).json({ error: "Imaginea este prea mare. Alege o imagine mai mică (max. ~1MB)." });
    return;
  }
  if (name !== undefined && name.length < 2) {
    res.status(400).json({ error: "Numele trebuie să aibă minim 2 caractere." });
    return;
  }
  if (name === undefined && avatarVal === undefined) {
    res.status(400).json({ error: "Trimite name sau avatar." });
    return;
  }
  const avatar = avatarVal;
  try {
    // Update profile tables based on user role
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      
      // Get user role to determine which profile to update
      const [userRows] = await conn.query(
        "SELECT Role FROM users WHERE Id = ?",
        [user.userId]
      ) as [{ Role: number }[], unknown];
      const userRole = Array.isArray(userRows) && userRows[0] ? userRows[0].Role : null;
      
      if (userRole !== null) {
        if (name !== undefined) {
          const nameParts = name.split(" ");
          const firstName = nameParts[0] || name;
          const lastName = nameParts.slice(1).join(" ") || name;
          
          if (userRole === UserRole.Employee) {
            // Update EmployeeProfiles
            await conn.query(
              "UPDATE employee_profiles SET Name = ?, Surname = ? WHERE UserId = ?",
              [firstName, lastName, user.userId]
            );
          } else if (userRole === UserRole.Business) {
            // Update BusinessProfiles
            await conn.query(
              "UPDATE business_profiles SET ContactPersonName = ?, ContactPersonSurname = ? WHERE UserId = ?",
              [firstName, lastName, user.userId]
            );
          }
        }
        
        if (avatar !== undefined) {
          if (userRole === UserRole.Employee) {
            await conn.query("UPDATE users SET Avatar = ? WHERE Id = ?", [avatar, user.userId]);
            const shortAvatar = typeof avatar === "string" && avatar.length <= 36 ? avatar : null;
            await conn.query(
              "UPDATE employee_profiles SET ProfilePictureFileId = ? WHERE UserId = ?",
              [shortAvatar, user.userId]
            );
          } else if (userRole === UserRole.Business) {
            await conn.query("UPDATE users SET Avatar = ? WHERE Id = ?", [avatar, user.userId]);
          }
        }
      }
      
      await conn.commit();
      
      // Fetch updated user for response
      const [rows] = await conn.query(
        `SELECT u.Id, u.Email, u.Role,
                CASE
                  WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                  WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                  ELSE 'User'
                END as name,
                COALESCE(ep.Surname, '') as surname,
                COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) as avatar,
                CASE
                  WHEN u.Role = 3 THEN 'admin'
                  WHEN bp.UserId IS NOT NULL THEN 'customer'
                  WHEN ep.UserId IS NOT NULL THEN 'staff'
                  WHEN u.Role = 2 THEN 'customer'
                  ELSE 'staff'
                END as resolved_role
         FROM users u
         LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
         LEFT JOIN business_profiles bp ON u.Id = bp.UserId
         WHERE u.Id = ?`,
        [user.userId]
      ) as [{ Id: string; Email: string; Role: number; name: string; surname: string; avatar?: string | null; resolved_role: string }[], unknown];
      const u = Array.isArray(rows) ? rows[0] : undefined;
      if (u) {
        const roleStr = String(u.resolved_role || "").trim() || "staff";
        const fullName = u.name; // Already contains full name (company name for business, full name for employees)
        res.json({ id: u.Id, name: fullName, email: u.Email, role: roleStr, avatar: u.avatar ?? undefined });
        return;
      }
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("PATCH /me error:", e);
    if (!res.headersSent) res.status(500).json({ error: "Eroare server." });
    return;
  }
  const mem = memoryUsers.find((m) => String(m.id) === user.userId);
  if (mem) {
    if (name !== undefined) mem.name = name;
    if (avatar !== undefined) mem.avatar = avatar;
    const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : (mem.role ?? "user");
    res.json({ id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar });
    return;
  }
  if (!res.headersSent) res.status(404).json({ error: "Utilizator negasit." });
});

/** Lista utilizatori – doar pentru admin (id, name, email, role, fără parolă) */
router.get("/users", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  let isAdmin = false;
  try {
    const [rows] = await db.query(
      "SELECT Role FROM users WHERE Id = ?",
      [user.userId]
    ) as [{ Role: number }[], unknown];
    const current = Array.isArray(rows) ? rows[0] : undefined;
    if (current?.Role === UserRole.Admin) isAdmin = true;
  } catch (_) {
    /* DB indisponibil, verific în memorie */
  }
  if (!isAdmin) {
    const mem = memoryUsers.find((m) => String(m.id) === user.userId);
    if (mem?.role === "admin") isAdmin = true;
  }
  if (!isAdmin) {
    res.status(403).json({ error: "Doar administratorii pot vedea lista de conturi." });
    return;
  }
  try {
    // Query all users with profile data
    const [allRows] = await db.query(
      `SELECT u.Id as id, u.Email as email, u.Role, COALESCE(u.IsActive, 1) AS IsActive, u.BoosterUntil AS boosterUntil,
              COALESCE(
                (SELECT b.PhoneNumber FROM branches b INNER JOIN business_profiles bp ON bp.Id = b.BusinessProfileId AND bp.UserId = u.Id LIMIT 1),
                ''
              ) AS phone,
              CASE
                WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                ELSE 'User'
              END as name,
              COALESCE(ep.Surname, '') as surname,
              CASE
                WHEN u.Role = 3 THEN 'admin'
                WHEN bp.UserId IS NOT NULL THEN 'customer'
                WHEN ep.UserId IS NOT NULL THEN 'staff'
                WHEN u.Role = 2 THEN 'customer'
                ELSE 'staff'
              END as resolved_role
       FROM users u
       LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
       LEFT JOIN business_profiles bp ON u.Id = bp.UserId
       ORDER BY u.CreatedAt`
    ) as [{ id?: string; Id?: string; email: string; Role: number; IsActive: number; boosterUntil?: string | Date | null; phone?: string; name: string; surname: string; resolved_role: string }[], unknown];
    if (Array.isArray(allRows)) {
      const users = allRows.map((u) => {
        const roleStr = String(u.resolved_role || "").trim() || "staff";
        const fullName = u.name;
        const userId = (u as { id?: string; Id?: string }).id ?? (u as { id?: string; Id?: string }).Id;
        const boosterUntil = u.boosterUntil != null ? (typeof u.boosterUntil === "string" ? u.boosterUntil : (u.boosterUntil as Date).toISOString?.() ?? String(u.boosterUntil)) : undefined;
        return { id: userId, name: fullName, email: u.email, role: roleStr, isActive: Number(u.IsActive) !== 0, phone: String(u.phone ?? "").trim() || undefined, boosterUntil: boosterUntil ?? undefined };
      });
      res.json({ users });
      return;
    }
  } catch (_) {
    /* DB indisponibil */
  }
  res.json({
    users: memoryUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: true, phone: undefined })),
  });
});

/** POST /api/auth/users/set-status - admin: blochează/deblochează cont (IsActive). userId în body, evită 404 pe PATCH cu :id în path. */
router.post("/users/set-status", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  const targetId = String(req.body?.userId ?? req.body?.id ?? "").trim();
  const active = req.body?.active === true;
  if (!targetId) {
    res.status(400).json({ error: "ID utilizator lipsă. Trimite userId în body." });
    return;
  }
  let isAdmin = false;
  try {
    const [rows] = await db.query("SELECT Role FROM users WHERE Id = ?", [user.userId]) as [{ Role: number }[], unknown];
    const current = Array.isArray(rows) ? rows[0] : undefined;
    if (current?.Role === UserRole.Admin) isAdmin = true;
  } catch (_) {}
  if (!isAdmin) {
    const mem = memoryUsers.find((m) => String(m.id) === user.userId);
    if (mem?.role === "admin") isAdmin = true;
  }
  if (!isAdmin) {
    res.status(403).json({ error: "Doar administratorii pot bloca/debloca conturi." });
    return;
  }
  if (targetId === user.userId) {
    res.status(400).json({ error: "Nu vă puteți bloca contul propriu." });
    return;
  }
  try {
    const [existing] = await db.query("SELECT Id FROM users WHERE Id = ?", [targetId]) as [{ Id: string }[], unknown];
    if (!Array.isArray(existing) || !existing[0]) {
      res.status(404).json({ error: "Utilizator negăsit." });
      return;
    }
    await db.query("UPDATE users SET IsActive = ? WHERE Id = ?", [active ? 1 : 0, targetId]);
    res.json({ ok: true, active });
  } catch (e) {
    console.error("POST /auth/users/set-status error:", e);
    if (!res.headersSent) res.status(500).json({ error: "Eroare la actualizarea statusului." });
  }
});

/** POST /api/auth/users/set-booster - admin: setează subscription booster pentru un user (customer). Joburile lui vor apărea primele. */
router.post("/users/set-booster", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { user } = req as Request & { user: JwtPayload };
  const targetId = String(req.body?.userId ?? req.body?.id ?? "").trim();
  const rawUntil = req.body?.boosterUntil; // ISO string or null to clear
  if (!targetId) {
    res.status(400).json({ error: "ID utilizator lipsă. Trimite userId în body." });
    return;
  }
  let isAdmin = false;
  try {
    const [rows] = await db.query("SELECT Role FROM users WHERE Id = ?", [user.userId]) as [{ Role: number }[], unknown];
    const current = Array.isArray(rows) ? rows[0] : undefined;
    if (current?.Role === UserRole.Admin) isAdmin = true;
  } catch (_) {}
  if (!isAdmin) {
    const mem = memoryUsers.find((m) => String(m.id) === user.userId);
    if (mem?.role === "admin") isAdmin = true;
  }
  if (!isAdmin) {
    res.status(403).json({ error: "Doar administratorii pot seta booster." });
    return;
  }
  try {
    const [existing] = await db.query("SELECT Id FROM users WHERE Id = ?", [targetId]) as [{ Id: string }[], unknown];
    if (!Array.isArray(existing) || !existing[0]) {
      res.status(404).json({ error: "Utilizator negăsit." });
      return;
    }
    let boosterUntil: string | null = null;
    if (rawUntil !== undefined && rawUntil !== null) {
      if (typeof rawUntil === "string" && rawUntil.trim()) {
        const d = new Date(rawUntil.trim());
        if (Number.isNaN(d.getTime())) {
          res.status(400).json({ error: "boosterUntil trebuie să fie o dată ISO validă." });
          return;
        }
        boosterUntil = d.toISOString().slice(0, 19).replace("T", " ");
      }
    }
    await db.query("UPDATE users SET BoosterUntil = ? WHERE Id = ?", [boosterUntil, targetId]);
    res.json({ ok: true, boosterUntil: boosterUntil ?? undefined });
  } catch (e) {
    console.error("POST /auth/users/set-booster error:", e);
    if (!res.headersSent) res.status(500).json({ error: "Eroare la setarea booster." });
  }
});

/** POST /api/auth/send-otp - Send OTP to phone number */
router.post("/send-otp", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const phoneNumber = String(body.phoneNumber ?? "").trim();

  if (!phoneNumber) {
    res.status(400).json({ error: "Numărul de telefon este obligatoriu." });
    return;
  }

  // Basic phone number validation (should start with + and contain digits)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const normalizedPhone = phoneNumber.replace(/\s+/g, "");
  if (!phoneRegex.test(normalizedPhone)) {
    res.status(400).json({ error: "Format număr de telefon invalid. Folosește formatul internațional (ex: +37312345678)." });
    return;
  }

  try {
    const result = await sendOTP(normalizedPhone);
    if (result.ok) {
      res.json({ message: "Cod OTP trimis cu succes." });
    } else {
      res.status(400).json({ error: result.error || "Eroare la trimiterea codului OTP." });
    }
  } catch (e) {
    const err = e as Error;
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Eroare la trimiterea codului OTP." });
  }
});

/** POST /api/auth/verify-otp - Verify OTP code */
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const phoneNumber = String(body.phoneNumber ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!phoneNumber) {
    res.status(400).json({ error: "Numărul de telefon este obligatoriu." });
    return;
  }

  if (!code) {
    res.status(400).json({ error: "Codul OTP este obligatoriu." });
    return;
  }

  // Basic phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const normalizedPhone = phoneNumber.replace(/\s+/g, "");
  if (!phoneRegex.test(normalizedPhone)) {
    res.status(400).json({ error: "Format număr de telefon invalid." });
    return;
  }

  try {
    const result = await verifyOTP(normalizedPhone, code);
    if (result.ok && result.verified) {
      res.json({ verified: true, message: "Număr de telefon verificat cu succes." });
    } else {
      res.status(400).json({ verified: false, error: result.error || "Cod OTP invalid sau expirat." });
    }
  } catch (e) {
    const err = e as Error;
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Eroare la verificarea codului OTP." });
  }
});

export default router;
