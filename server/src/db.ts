// server/src/db.ts
import mysql, { RowDataPacket } from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "work2now";

/**
 * IMPORTANT (your current bug):
 * On Windows/XAMPP, MySQL/MariaDB is usually case-insensitive for table names
 * (lower_case_table_names=1). That means `Users` and `users` are THE SAME TABLE.
 * This is why you "created Users", but you still see the old `users` schema.
 *
 * Solution: use ONE canonical table name: `users` (lowercase) with the .NET columns.
 */

/**
 * Keep GUID/UUID columns as:
 *   CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci
 * to prevent FK mismatch errors (errno: 150).
 */
const GUID_COL = "CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci";

/**
 * If you want to hard-reset schema automatically:
 * set DB_FORCE_RESET=1 in .env
 * Otherwise, the database will be preserved on server restarts.
 */
const FORCE_RESET = String(process.env.DB_FORCE_RESET || "").trim() === "1";

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

async function tableExists(conn: mysql.Connection, tableName: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     LIMIT 1`,
    [DB_NAME, tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(conn: mysql.Connection, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [DB_NAME, tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function fkExists(conn: mysql.Connection, tableName: string, constraintName: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
     LIMIT 1`,
    [DB_NAME, tableName, constraintName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureInnoDB(conn: mysql.Connection, tableName: string): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ENGINE
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     LIMIT 1`,
    [DB_NAME, tableName]
  );
  const engine = Array.isArray(rows) && rows[0] ? String(rows[0].ENGINE || "") : "";
  if (engine && engine.toUpperCase() !== "INNODB") {
    await conn.query(`ALTER TABLE \`${tableName}\` ENGINE=InnoDB`);
  }
}

async function getUserTableShape(conn: mysql.Connection): Promise<Set<string>> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
    [DB_NAME]
  );
  return new Set((rows || []).map((r) => String(r.COLUMN_NAME)));
}

function isCanonicalUsersTable(cols: Set<string>): boolean {
  const required = ["Id", "Email", "PasswordHash", "Role", "CreatedAt"];
  for (const c of required) if (!cols.has(c)) return false;
  
  // Also check that legacy columns don't exist (mixed schema detection)
  const legacyColumns = ["email", "password_hash", "created_at", "name", "role", "avatar"];
  for (const legacy of legacyColumns) {
    if (cols.has(legacy)) {
      return false; // Has legacy columns, not canonical
    }
  }
  return true;
}

async function dropLegacySchema(conn: mysql.Connection): Promise<void> {
  // Drop children first to avoid FK errors.
  const dropOrder = [
    "ratings",
    "application_work_sessions",
    "applications",
    "jobs",
    "experiences",
    "branches",
    "business_profiles",
    "employee_profiles",
    // legacy mapping table from your old attempt
    "userlegacymap",
    "UserLegacyMap",
    // canonical
    "users",
    // old phpmyadmin sample DB might also have capitalized variants on other OS
    "Users",
  ];

  for (const t of dropOrder) {
    // ignore errors if table doesn't exist
    try {
      await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    } catch {
      /* ignore */
    }
  }
}

async function dropDatabase(conn: mysql.Connection): Promise<void> {
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    console.log(`[DB] Dropped database ${DB_NAME}`);
  } catch (e) {
    const err = e as Error;
    console.warn(`[DB] Failed to drop database: ${err.message}`);
    throw e;
  }
}

/**
 * Canonical .NET schema (MySQL):
 * users { Id Guid, Email, PasswordHash, Role(int), CreatedAt(datetime) }
 * employee_profiles 1:1 users via UNIQUE FK (UserId)
 * business_profiles 1:1 users via UNIQUE FK (UserId)
 *
 * Notes:
 * - Your .NET models have MaxLength constraints; we apply VARCHAR where applicable.
 * - We keep names snake_case for MySQL, but columns match .NET property names where it matters.
 */
export async function initDatabase(): Promise<void> {
  let conn: mysql.Connection | null = null;

  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      charset: "utf8mb4",
      multipleStatements: false,
    });

    // If FORCE_RESET is enabled, drop and recreate the entire database
    if (FORCE_RESET) {
      const [dbExists] = await conn.query<RowDataPacket[]>(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [DB_NAME]
      ) as [{ SCHEMA_NAME: string }[], unknown];
      if (Array.isArray(dbExists) && dbExists.length > 0) {
        await conn.query(`USE \`${DB_NAME}\``);
        await dropLegacySchema(conn);
        await dropDatabase(conn);
        console.log(`[DB] Dropped database ${DB_NAME} for clean rebuild`);
      }
    }

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await conn.changeUser({ database: DB_NAME });

    // Check if users table exists and has correct schema
    if (await tableExists(conn, "users")) {
      const cols = await getUserTableShape(conn);
      // Check for required columns AND ensure no legacy columns exist
      const hasRequired = isCanonicalUsersTable(cols);
      const hasLegacy = cols.has("email") || cols.has("password_hash") || cols.has("created_at") || cols.has("name");
      
      if (!hasRequired || hasLegacy) {
        if (!FORCE_RESET) {
          throw new Error(
            "[DB] Found legacy `users` table with wrong columns. Set DB_FORCE_RESET=1 to rebuild schema."
          );
        }
        // Drop users table specifically to remove mixed columns
        await conn.query(`DROP TABLE IF EXISTS \`users\``);
        await conn.query(`DROP TABLE IF EXISTS \`Users\``);
        console.log(`[DB] Dropped users table to remove mixed schema columns`);
      }
    }

    // -------------------------
    // 1) Create canonical tables
    // -------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`Email\` VARCHAR(191) NOT NULL UNIQUE,
        \`PasswordHash\` VARCHAR(255) NOT NULL,
        \`Role\` INT NOT NULL,
        \`CreatedAt\` DATETIME NOT NULL,
        INDEX \`idx_users_email\` (\`Email\`),
        INDEX \`idx_users_role\` (\`Role\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "users");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`employee_profiles\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`UserId\` ${GUID_COL} NOT NULL UNIQUE,
        \`Name\` VARCHAR(100) NOT NULL,
        \`Surname\` VARCHAR(100) NOT NULL,
        \`DateOfBirth\` DATETIME NOT NULL,
        \`AboutMe\` VARCHAR(1000) NOT NULL DEFAULT '',
        \`ProfilePictureFileId\` ${GUID_COL} NULL,
        INDEX \`idx_employee_profiles_user_id\` (\`UserId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "employee_profiles");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`business_profiles\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`UserId\` ${GUID_COL} NOT NULL UNIQUE,
        \`CompanyName\` VARCHAR(200) NOT NULL,
        \`ContactPersonName\` VARCHAR(100) NOT NULL,
        \`ContactPersonSurname\` VARCHAR(100) NOT NULL,
        \`CompanyCategory\` INT NOT NULL,
        \`InfoForStaff\` VARCHAR(2000) NOT NULL DEFAULT '',
        INDEX \`idx_business_profiles_user_id\` (\`UserId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "business_profiles");

    // Branches (because BusinessProfile has ICollection<Branch>)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`branches\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`BusinessProfileId\` ${GUID_COL} NOT NULL,
        \`Name\` VARCHAR(200) NOT NULL,
        \`Address\` VARCHAR(300) NOT NULL,
        \`City\` VARCHAR(120) NOT NULL,
        \`Country\` VARCHAR(120) NOT NULL,
        \`PhoneNumber\` VARCHAR(50) NOT NULL,
        \`IsActive\` TINYINT(1) NOT NULL DEFAULT 1,
        \`CreatedAt\` DATETIME NOT NULL,
        INDEX \`idx_branches_business_profile_id\` (\`BusinessProfileId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "branches");

    // Experiences (because EmployeeProfile has ICollection<Experience>)
    // NOTE: your real Experience model may have more fields; add them later.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`experiences\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`EmployeeProfileId\` ${GUID_COL} NOT NULL,
        \`JobCategory\` INT NOT NULL,
        \`Duration\` INT NOT NULL,
        \`Description\` TEXT NOT NULL,
        INDEX \`idx_experiences_employee_profile_id\` (\`EmployeeProfileId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "experiences");

    // -------------------------
    // 2) Add foreign keys (idempotent)
    // -------------------------
    if (!(await fkExists(conn, "employee_profiles", "fk_employee_profiles_userid_users_id"))) {
      await conn.query(`
        ALTER TABLE \`employee_profiles\`
        ADD CONSTRAINT \`fk_employee_profiles_userid_users_id\`
        FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE CASCADE
      `);
    }

    if (!(await fkExists(conn, "business_profiles", "fk_business_profiles_userid_users_id"))) {
      await conn.query(`
        ALTER TABLE \`business_profiles\`
        ADD CONSTRAINT \`fk_business_profiles_userid_users_id\`
        FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE CASCADE
      `);
    }

    if (!(await fkExists(conn, "branches", "fk_branches_businessprofileid_business_profiles_id"))) {
      await conn.query(`
        ALTER TABLE \`branches\`
        ADD CONSTRAINT \`fk_branches_businessprofileid_business_profiles_id\`
        FOREIGN KEY (\`BusinessProfileId\`) REFERENCES \`business_profiles\`(\`Id\`)
        ON DELETE CASCADE
      `);
    }

    if (!(await fkExists(conn, "experiences", "fk_experiences_employeeprofileid_employee_profiles_id"))) {
      await conn.query(`
        ALTER TABLE \`experiences\`
        ADD CONSTRAINT \`fk_experiences_employeeprofileid_employee_profiles_id\`
        FOREIGN KEY (\`EmployeeProfileId\`) REFERENCES \`employee_profiles\`(\`Id\`)
        ON DELETE CASCADE
      `);
    }

    // -------------------------
    // 3) Optional: keep your existing app tables, but make them GUID-based
    // -------------------------
    // If you don't need these yet, you can delete this whole block.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`jobs\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` ${GUID_COL} NULL,
        \`job\` VARCHAR(255) NOT NULL,
        \`location\` TEXT,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'Draft',
        \`status_class\` VARCHAR(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700',
        \`date\` VARCHAR(50) NOT NULL,
        \`end_date\` VARCHAR(50),
        \`job_type\` VARCHAR(30),
        \`applications_count\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`start_time\` VARCHAR(20),
        \`end_time\` VARCHAR(20),
        \`people_needed\` VARCHAR(50),
        \`duration\` VARCHAR(100),
        \`estimated_salary\` VARCHAR(100),
        \`image_url\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_jobs_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "jobs");

    if (!(await fkExists(conn, "jobs", "fk_jobs_user_id_users_id"))) {
      await conn.query(`
        ALTER TABLE \`jobs\`
        ADD CONSTRAINT \`fk_jobs_user_id_users_id\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE SET NULL
      `);
    }
    if (!(await columnExists(conn, "jobs", "check_in_lat"))) {
      await conn.query("ALTER TABLE `jobs` ADD COLUMN `check_in_lat` DOUBLE NULL");
    }
    if (!(await columnExists(conn, "jobs", "check_in_lng"))) {
      await conn.query("ALTER TABLE `jobs` ADD COLUMN `check_in_lng` DOUBLE NULL");
    }
    if (!(await columnExists(conn, "jobs", "check_in_radius_m"))) {
      await conn.query("ALTER TABLE `jobs` ADD COLUMN `check_in_radius_m` INT NULL");
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`applications\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`job_id\` INT UNSIGNED NOT NULL,
        \`staff_id\` ${GUID_COL} NULL,
        \`staff_name\` VARCHAR(100) NOT NULL,
        \`staff_email\` VARCHAR(191),
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'pending',
        \`status_code\` INT NULL,
        \`completed_at\` TIMESTAMP NULL,
        \`checked_in_at\` TIMESTAMP NULL,
        \`checked_out_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_app_job_id\` (\`job_id\`),
        INDEX \`idx_app_staff_id\` (\`staff_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "applications");

    if (!(await fkExists(conn, "applications", "fk_applications_job_id_jobs_id"))) {
      await conn.query(`
        ALTER TABLE \`applications\`
        ADD CONSTRAINT \`fk_applications_job_id_jobs_id\`
        FOREIGN KEY (\`job_id\`) REFERENCES \`jobs\`(\`id\`)
        ON DELETE CASCADE
      `);
    }

    if (!(await fkExists(conn, "applications", "fk_applications_staff_id_users_id"))) {
      await conn.query(`
        ALTER TABLE \`applications\`
        ADD CONSTRAINT \`fk_applications_staff_id_users_id\`
        FOREIGN KEY (\`staff_id\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE SET NULL
      `);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`application_work_sessions\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`application_id\` INT UNSIGNED NOT NULL,
        \`work_date\` DATE NOT NULL,
        \`checked_in_at\` TIMESTAMP NULL,
        \`checked_out_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_app_date\` (\`application_id\`, \`work_date\`),
        INDEX \`idx_application_id\` (\`application_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "application_work_sessions");

    if (!(await fkExists(conn, "application_work_sessions", "fk_app_work_sessions_application_id"))) {
      await conn.query(`
        ALTER TABLE \`application_work_sessions\`
        ADD CONSTRAINT \`fk_app_work_sessions_application_id\`
        FOREIGN KEY (\`application_id\`) REFERENCES \`applications\`(\`id\`)
        ON DELETE CASCADE
      `);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`ratings\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`application_id\` INT UNSIGNED NOT NULL UNIQUE,
        \`rater_id\` ${GUID_COL} NULL,
        \`rated_id\` ${GUID_COL} NULL,
        \`score\` TINYINT UNSIGNED NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_rated_id\` (\`rated_id\`),
        INDEX \`idx_rater_id\` (\`rater_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "ratings");

    if (!(await fkExists(conn, "ratings", "fk_ratings_application_id_applications_id"))) {
      await conn.query(`
        ALTER TABLE \`ratings\`
        ADD CONSTRAINT \`fk_ratings_application_id_applications_id\`
        FOREIGN KEY (\`application_id\`) REFERENCES \`applications\`(\`id\`)
        ON DELETE CASCADE
      `);
    }

    if (!(await fkExists(conn, "ratings", "fk_ratings_rater_id_users_id"))) {
      await conn.query(`
        ALTER TABLE \`ratings\`
        ADD CONSTRAINT \`fk_ratings_rater_id_users_id\`
        FOREIGN KEY (\`rater_id\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE SET NULL
      `);
    }

    if (!(await fkExists(conn, "ratings", "fk_ratings_rated_id_users_id"))) {
      await conn.query(`
        ALTER TABLE \`ratings\`
        ADD CONSTRAINT \`fk_ratings_rated_id_users_id\`
        FOREIGN KEY (\`rated_id\`) REFERENCES \`users\`(\`Id\`)
        ON DELETE SET NULL
      `);
    }

    // -------------------------
    // 4) Sanity check (fail fast)
    // -------------------------
    const usersCols = await getUserTableShape(conn);
    for (const must of ["Id", "Email", "PasswordHash", "Role", "CreatedAt"]) {
      if (!usersCols.has(must)) {
        throw new Error(`[DB] Schema invalid: users.${must} is missing`);
      }
    }

    await conn.query("SELECT 1");
    console.log("[DB] MySQL conectat. Schema .NET (users + profiles) este OK.");
  } finally {
    if (conn) await conn.end();
  }
}

/**
 * Canonical user creation (matches .NET models).
 * Use this from your register/auth flow.
 *
 * NOTE:
 * - role is the .NET enum int (Employee | Employer | Admin).
 * - Provide exactly ONE of employeeProfile or businessProfile.
 */
export async function createUserDotNetStyle(params: {
  email: string;
  passwordHash: string;
  role: number; // .NET enum int
  employeeProfile?: {
    name: string;
    surname: string;
    dateOfBirth: string; // ISO date/datetime
    aboutMe?: string;
    profilePictureFileId?: string | null;
  };
  businessProfile?: {
    companyName: string;
    contactPersonName: string;
    contactPersonSurname: string;
    companyCategory: number; // enum int
    infoForStaff?: string;
  };
  branch?: {
    name: string;
    address: string;
    city: string;
    country?: string;
    phoneNumber: string;
  };
}): Promise<{ userId: string }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const userId = randomUUID();
    const createdAt = new Date();

    await conn.query(
      `INSERT INTO \`users\` (\`Id\`, \`Email\`, \`PasswordHash\`, \`Role\`, \`CreatedAt\`)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, params.email, params.passwordHash, params.role, createdAt]
    );

    if (params.employeeProfile && params.businessProfile) {
      throw new Error("Provide either employeeProfile OR businessProfile, not both.");
    }

    if (params.employeeProfile) {
      const empId = randomUUID();
      await conn.query(
        `INSERT INTO \`employee_profiles\`
         (\`Id\`, \`UserId\`, \`Name\`, \`Surname\`, \`DateOfBirth\`, \`AboutMe\`, \`ProfilePictureFileId\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          empId,
          userId,
          params.employeeProfile.name,
          params.employeeProfile.surname,
          new Date(params.employeeProfile.dateOfBirth),
          params.employeeProfile.aboutMe ?? "",
          params.employeeProfile.profilePictureFileId ?? null,
        ]
      );
    }

    if (params.businessProfile) {
      const busId = randomUUID();
      await conn.query(
        `INSERT INTO \`business_profiles\`
         (\`Id\`, \`UserId\`, \`CompanyName\`, \`ContactPersonName\`, \`ContactPersonSurname\`, \`CompanyCategory\`, \`InfoForStaff\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          busId,
          userId,
          params.businessProfile.companyName,
          params.businessProfile.contactPersonName,
          params.businessProfile.contactPersonSurname,
          params.businessProfile.companyCategory,
          params.businessProfile.infoForStaff ?? "",
        ]
      );

      // Automatically create the branch if branch data is provided
      if (params.branch) {
        const branchId = randomUUID();
        await conn.query(
          `INSERT INTO \`branches\`
           (\`Id\`, \`BusinessProfileId\`, \`Name\`, \`Address\`, \`City\`, \`Country\`, \`PhoneNumber\`, \`IsActive\`, \`CreatedAt\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            branchId,
            busId,
            params.branch.name.trim(),
            params.branch.address.trim(),
            params.branch.city.trim(),
            params.branch.country?.trim() || "Moldova",
            params.branch.phoneNumber.trim(),
          ]
        );
      }
    }

    await conn.commit();
    return { userId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Backward-compatible helper used by routes.
 * In canonical schema user IDs are already UUID strings.
 */
export async function getUserUuidFromLegacyId(legacyId: string | number): Promise<string | null> {
  const id = String(legacyId ?? "").trim();
  if (!id) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT Id FROM users WHERE Id = ? LIMIT 1",
    [id]
  );
  const userId = Array.isArray(rows) && rows[0] ? String(rows[0].Id ?? "").trim() : "";
  return userId || null;
}

export default pool;
