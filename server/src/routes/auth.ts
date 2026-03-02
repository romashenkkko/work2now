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

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const body = req.body ?? {};
  const { name = "", email = "", password = "", role = "user", employeeProfile, businessProfile, branch } = body;
  
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
      `SELECT u.Id, u.Email, u.PasswordHash, u.Role,
              CASE
                WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                ELSE 'User'
              END as name,
              COALESCE(ep.Surname, '') as surname,
              COALESCE(ep.ProfilePictureFileId, NULL) as avatar,
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
    ) as [{ Id: string; Email: string; PasswordHash: string; Role: number; name: string; surname: string; avatar?: string | null; resolved_role: string }[], unknown];
    const user = Array.isArray(rows) ? rows[0] : undefined;
    if (!user || !(await bcrypt.compare(String(passStr), user.PasswordHash))) {
      res.status(401).json({ error: "Email sau parola incorecta." });
      return;
    }
    // Map Role INT to string for backward compatibility
    const roleStr = String(user.resolved_role || "").trim() || "staff";
    const fullName = user.name; // Already contains full name (company name for business, full name for employees)
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
        avatar: user.avatar ?? undefined 
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
      `SELECT u.Id, u.Email, u.Role,
              CASE
                WHEN bp.UserId IS NOT NULL THEN COALESCE(bp.CompanyName, 'User')
                WHEN ep.UserId IS NOT NULL THEN TRIM(CONCAT(COALESCE(ep.Name, ''), ' ', COALESCE(ep.Surname, '')))
                ELSE 'User'
              END as name,
              COALESCE(ep.Surname, '') as surname,
              COALESCE(ep.ProfilePictureFileId, NULL) as avatar,
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
    const mem = memoryUsers.find((m) => String(m.id) === user.userId);
    if (mem) {
      const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : (mem.role ?? "user");
      res.json({ id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar });
      return;
    }
    res.status(404).json({ error: "Utilizator negasit." });
  } catch (e) {
    if (useMemoryFallback() && isDbConnectionError(e)) {
      const mem = memoryUsers.find((m) => String(m.id) === user.userId);
      if (mem) {
        const role = typeof mem.role === "string" ? mem.role.toLowerCase().trim() : (mem.role ?? "user");
        res.json({ id: String(mem.id), name: mem.name, email: mem.email, role, avatar: mem.avatar });
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
        
        if (avatar !== undefined && userRole === UserRole.Employee) {
          // Only EmployeeProfiles has ProfilePictureFileId
          await conn.query(
            "UPDATE employee_profiles SET ProfilePictureFileId = ? WHERE UserId = ?",
            [avatar, user.userId]
          );
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
                COALESCE(ep.ProfilePictureFileId, NULL) as avatar,
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
      `SELECT u.Id as id, u.Email as email, u.Role,
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
    ) as [{ id: string; email: string; Role: number; name: string; surname: string; resolved_role: string }[], unknown];
    if (Array.isArray(allRows)) {
      const users = allRows.map((u) => {
        const roleStr = String(u.resolved_role || "").trim() || "staff";
        const fullName = u.name; // Already contains full name (company name for business, full name for employees)
        return { id: u.id, name: fullName, email: u.email, role: roleStr };
      });
      res.json({ users });
      return;
    }
  } catch (_) {
    /* DB indisponibil */
  }
  res.json({
    users: memoryUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
  });
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
