// server/src/db.ts

import path from "path";
import fs from "fs";
import dotenv from "dotenv";

/**
 * ALWAYS load .env relative to project root (/server/.env)
 * Works in:
 *   - tsx dev (src/)
 *   - compiled dist (dist/)
 *   - pm2 production
 */
function loadEnv() {
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"),            // when running inside /server
    path.resolve(__dirname, "../.env"),             // when running from /server/src
    path.resolve(__dirname, "../../.env"),          // when running from /server/dist
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      console.log("[ENV] Loaded:", p);
      return;
    }
  }

  console.warn("[ENV] .env file not found. Using system environment variables.");
}

loadEnv();

import mysql, { RowDataPacket } from "mysql2/promise";
import { randomUUID } from "crypto";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PORT = process.env.DB_PORT;
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "time2go";
/**
 * IMPORTANT:
 * On Windows/XAMPP, table names are often case-insensitive (lower_case_table_names=1).
 * Use ONE canonical table name: `users` (lowercase) with the .NET columns.
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
  port: DB_PORT ? Number(DB_PORT) : 3306,
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

async function ensureColumn(
  conn: mysql.Connection,
  tableName: string,
  columnName: string,
  columnDefSql: string
): Promise<void> {
  const exists = await columnExists(conn, tableName, columnName);
  if (!exists) {
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefSql}`);
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

  // Mixed schema / legacy detection
  const legacyColumns = ["email", "password_hash", "created_at", "name", "role", "avatar"];
  for (const legacy of legacyColumns) {
    if (cols.has(legacy)) return false;
  }
  return true;
}

/**
 * Drops tables only (NO DROP DATABASE).
 * Used only when DB_FORCE_RESET=1.
 */
async function dropLegacySchema(conn: mysql.Connection): Promise<void> {
  // Drop children first to avoid FK errors.
  const dropOrder = [
    "ratings",
    "application_work_sessions",
    "applications",
    "jobs",
    "job_categories",
    "experiences",
    "branches",
    "business_profiles",
    "employee_profiles",
    "userlegacymap",
    "UserLegacyMap",
    "users",
    "Users",
  ];

  for (const t of dropOrder) {
    try {
      await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Job categories table seed (min salary per hour in MDL).
 * NOTE: `Code` is INT to match your existing JobCategory enum values.
 * You can later align enum numeric values with these codes.
 */
type JobCategorySeed = {
  code: number;
  title: string;
  hourlyMin: number; // MDL/hour
};

const JOB_CATEGORY_SEED: JobCategorySeed[] = [
  { code: 1, title: "Barback", hourlyMin: 30},
  { code: 2, title: "Barista", hourlyMin: 30 },
  { code: 3, title: "Bartender", hourlyMin: 45},
  { code: 4, title: "Cashier", hourlyMin: 40},
  { code: 5, title: "Chef", hourlyMin: 50},
  { code: 6, title: "Chef (Head)", hourlyMin: 90},
  { code: 7, title: "Chef (Pastry)", hourlyMin: 80},
  { code: 8, title: "Chef (Sous)", hourlyMin: 60},
  { code: 9, title: "Chef (Sushi)", hourlyMin: 45},
  { code: 10, title: "Cleaner", hourlyMin: 20},
  { code: 11, title: "Cocktail Bartender", hourlyMin: 70},
  { code: 12, title: "Dishwasher", hourlyMin: 40},
  { code: 13, title: "Event Crew", hourlyMin: 0 }, // TODO: set real min/max when known
  { code: 14, title: "Grocery Store Worker", hourlyMin: 60},
  { code: 15, title: "Head Waiter", hourlyMin: 50},
  { code: 16, title: "Housekeeper", hourlyMin: 45},
  { code: 17, title: "Maintenance", hourlyMin: 65},
  { code: 18, title: "Pizzaiolo", hourlyMin: 60},
  { code: 19, title: "Receptionist", hourlyMin: 30},
  { code: 20, title: "Sommelier", hourlyMin: 65},
  { code: 21, title: "T2S App Tester", hourlyMin: 70},
  { code: 22, title: "Waiter", hourlyMin: 65}, // ✅ must not be less than 65 MDL/hour
];

async function seedJobCategories(conn: mysql.Connection): Promise<void> {
  // Upsert by unique Code
  for (const c of JOB_CATEGORY_SEED) {
    await conn.query(
      `
      INSERT INTO \`job_categories\` (\`Id\`, \`Code\`, \`Title\`, \`HourlyMin\`)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`Title\` = VALUES(\`Title\`),
        \`HourlyMin\` = VALUES(\`HourlyMin\`)
      `,
      [randomUUID(), c.code, c.title, c.hourlyMin ?? null]
    );
  }
}

/**
 * Canonical .NET schema (MySQL):
 * users { Id Guid, Email, PasswordHash, Role(int), CreatedAt(datetime) }
 * employee_profiles 1:1 users via UNIQUE FK (UserId)
 * business_profiles 1:1 users via UNIQUE FK (UserId)
 */
export async function initDatabase(): Promise<void> {
  let conn: mysql.Connection | null = null;

  try {
    const port = DB_PORT ? Number(DB_PORT) : 3306;
    console.log(`[DB] Attempting connection to ${DB_HOST}:${port} as ${DB_USER} (database: ${DB_NAME})`);
    
    conn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      charset: "utf8mb4",
      multipleStatements: false,
      port: port,
    });

    // Ensure DB exists and use it
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await conn.changeUser({ database: DB_NAME });

    // Only drop TABLES when FORCE_RESET=1
    if (FORCE_RESET) {
      await dropLegacySchema(conn);
      console.log(`[DB] DB_FORCE_RESET=1 → dropped tables for clean rebuild (no DROP DATABASE).`);
    }

    // If users table exists but wrong schema and FORCE_RESET=0 → fail fast
    if (await tableExists(conn, "users")) {
      const cols = await getUserTableShape(conn);
      const ok = isCanonicalUsersTable(cols);
      if (!ok && !FORCE_RESET) {
        throw new Error(
          "[DB] Found legacy `users` table with wrong columns. Set DB_FORCE_RESET=1 to rebuild schema."
        );
      }
      if (!ok && FORCE_RESET) {
        await conn.query(`DROP TABLE IF EXISTS \`users\``);
        await conn.query(`DROP TABLE IF EXISTS \`Users\``);
        console.log(`[DB] Dropped users/Users to remove mixed schema columns`);
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
        INDEX \`idx_users_dis_idx\` (\`Role\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "users");
    await ensureColumn(conn, "users", "Avatar", "VARCHAR(500) NULL");
    await ensureColumn(conn, "users", "IsActive", "TINYINT(1) NOT NULL DEFAULT 1");
    await ensureColumn(conn, "users", "LastActiveAt", "DATETIME NULL");
    await ensureColumn(conn, "users", "PhoneNumber", "VARCHAR(50) NULL");
    await ensureColumn(conn, "users", "BoosterUntil", "DATETIME NULL");
    try {
      await conn.query("ALTER TABLE `users` MODIFY COLUMN `Avatar` MEDIUMTEXT NULL");
    } catch (_) {
      /* Ignore if already MEDIUMTEXT or DB doesn't support */
    }

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
    // Prisma schema requires IDNP as NOT NULL; add it for older schemas created before this column existed.
    await ensureColumn(conn, "employee_profiles", "IDNP", "VARCHAR(13) NOT NULL DEFAULT ''");

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

    // Align with Prisma schema: optional IDNO column for business_profiles
    await ensureColumn(conn, "business_profiles", "IDNO", "VARCHAR(13) NULL");

    // Branches (BusinessProfile has ICollection<Branch>)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`branches\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`BusinessProfileId\` ${GUID_COL} NOT NULL,
        \`Name\` VARCHAR(200) NOT NULL,
        \`Address\` VARCHAR(300) NOT NULL,
        \`City\` VARCHAR(120) NOT NULL,
        \`Country\` VARCHAR(120) NOT NULL,
        \`PhoneNumber\` VARCHAR(50) NOT NULL,
        \`ContactPersonName\` VARCHAR(100) NOT NULL DEFAULT '',
        \`ContactPersonSurname\` VARCHAR(100) NOT NULL DEFAULT '',
        \`IsActive\` TINYINT(1) NOT NULL DEFAULT 1,
        \`CreatedAt\` DATETIME NOT NULL,
        INDEX \`idx_branches_business_profile_id\` (\`BusinessProfileId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "branches");

    // If table existed before, ensure new columns exist (idempotent)
    await ensureColumn(conn, "branches", "ContactPersonName", "VARCHAR(100) NOT NULL DEFAULT ''");
    await ensureColumn(conn, "branches", "ContactPersonSurname", "VARCHAR(100) NOT NULL DEFAULT ''");

    // Experiences
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
    // 1.5) Job Categories table (NEW)
    // -------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`job_categories\` (
        \`Id\` ${GUID_COL} PRIMARY KEY,
        \`Code\` INT NOT NULL,
        \`Title\` VARCHAR(150) NOT NULL,
        \`HourlyMin\` INT NOT NULL,
        \`CreatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_job_categories_code\` (\`Code\`),
        INDEX \`idx_job_categories_title\` (\`Title\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "job_categories");

    // -------------------------
    // 2) Add foreign keys
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
    // 3) Optional app tables
    // -------------------------
    
    // Raioane table: 32 raioane + 13 municipii + 2 unități teritoriale autonome
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`raioane\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL UNIQUE,
        \`type\` ENUM('raion', 'municipiu', 'unitate_autonoma') NOT NULL DEFAULT 'raion',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_raioane_name\` (\`name\`),
        INDEX \`idx_raioane_type\` (\`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    await ensureInnoDB(conn, "raioane");
    
    // Populate raioane table with Moldova's administrative divisions
    // NOTE: `name` is UNIQUE in schema, so we cannot have the same "Cahul" as both raion and municipiu.
    // For municipii that share a name with a raion, we prefix with "mun. " to keep uniqueness.
    const raioaneList: Array<{ name: string; type: "raion" | "municipiu" | "unitate_autonoma" }> = [
      // 32 Raioane
      { name: "Anenii Noi", type: "raion" },
      { name: "Basarabeasca", type: "raion" },
      { name: "Briceni", type: "raion" },
      { name: "Cahul", type: "raion" },
      { name: "Cantemir", type: "raion" },
      { name: "Calarasi", type: "raion" },
      { name: "Causeni", type: "raion" },
      { name: "Cimislia", type: "raion" },
      { name: "Criuleni", type: "raion" },
      { name: "Donduseni", type: "raion" },
      { name: "Drochia", type: "raion" },
      { name: "Dubasari", type: "raion" },
      { name: "Edinet", type: "raion" },
      { name: "Falesti", type: "raion" },
      { name: "Floresti", type: "raion" },
      { name: "Glodeni", type: "raion" },
      { name: "Hincesti", type: "raion" },
      { name: "Ialoveni", type: "raion" },
      { name: "Leova", type: "raion" },
      { name: "Nisporeni", type: "raion" },
      { name: "Ocnita", type: "raion" },
      { name: "Orhei", type: "raion" },
      { name: "Rezina", type: "raion" },
      { name: "Riscani", type: "raion" },
      { name: "Singerei", type: "raion" },
      { name: "Soroca", type: "raion" },
      { name: "Straseni", type: "raion" },
      { name: "Soldanesti", type: "raion" },
      { name: "Stefan Voda", type: "raion" },
      { name: "Taraclia", type: "raion" },
      { name: "Telenesti", type: "raion" },
      { name: "Ungheni", type: "raion" },
      // 13 Municipii
      { name: "Chisinau", type: "municipiu" },
      { name: "Balti", type: "municipiu" },
      { name: "Tiraspol", type: "municipiu" },
      { name: "Bender", type: "municipiu" },
      { name: "Tighina", type: "municipiu" },
      { name: "Ribnita", type: "municipiu" },
      { name: "mun. Cahul", type: "municipiu" },
      { name: "mun. Ungheni", type: "municipiu" },
      { name: "mun. Soroca", type: "municipiu" },
      { name: "mun. Orhei", type: "municipiu" },
      { name: "Comrat", type: "municipiu" },
      { name: "Ceadir-Lunga", type: "municipiu" },
      { name: "Vulcanesti", type: "municipiu" },
      { name: "mun. Taraclia", type: "municipiu" },
      // 2 Unitati teritoriale autonome
      { name: "Gagauzia", type: "unitate_autonoma" },
      { name: "Stinga Nistrului", type: "unitate_autonoma" },
    ];
    
    // Upsert raioane on every start so new items added in code appear without requiring a DB reset.
    for (const raion of raioaneList) {
      await conn.query(
        "INSERT INTO `raioane` (`name`, `type`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `type` = VALUES(`type`)",
        [raion.name, raion.type]
      );
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`jobs\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` ${GUID_COL} NULL,
        \`Title\` VARCHAR(30) NOT NULL,
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

    // NEW columns for salary/category logic (idempotent)
    await ensureColumn(conn, "jobs", "job_category_code", "INT NULL");
    await ensureColumn(conn, "jobs", "hourly_rate_base", "DECIMAL(10,2) NULL");
    await ensureColumn(conn, "jobs", "is_promoted", "TINYINT(1) NOT NULL DEFAULT 0");
    
    // Migration: Add Title column (max 30 chars) and migrate data from job column
    await ensureColumn(conn, "jobs", "Title", "VARCHAR(30) NULL");
    
    // Check if old job column exists and migrate data
    const jobColumnExists = await columnExists(conn, "jobs", "job");
    if (jobColumnExists) {
      // Migrate existing data from job to Title if Title is empty
      await conn.query(`
        UPDATE \`jobs\` 
        SET \`Title\` = SUBSTRING(\`job\`, 1, 30) 
        WHERE \`Title\` IS NULL AND \`job\` IS NOT NULL
      `).catch(() => {
        // Ignore if no data to migrate
      });
      
      // Make Title NOT NULL after migration
      await conn.query(`
        ALTER TABLE \`jobs\` 
        MODIFY COLUMN \`Title\` VARCHAR(30) NOT NULL
      `).catch(() => {
        // Ignore if already NOT NULL
      });
      
      // Remove the old job column (after ensuring Title has data)
      try {
        await conn.query(`ALTER TABLE \`jobs\` DROP COLUMN \`job\``);
      } catch (e) {
        // Ignore if column doesn't exist or can't be dropped
        const err = e as Error;
        if (!err.message.includes("doesn't exist") && !err.message.includes("Unknown column")) {
          console.warn("[DB] Could not drop job column:", err.message);
        }
      }
    } else {
      // If job column doesn't exist, ensure Title is NOT NULL
      await conn.query(`
        ALTER TABLE \`jobs\` 
        MODIFY COLUMN \`Title\` VARCHAR(30) NOT NULL
      `).catch(() => {
        // Ignore if already NOT NULL
      });
    }

    // FK from jobs.job_category_code -> job_categories.Code (optional but recommended)
    if (!(await fkExists(conn, "jobs", "fk_jobs_job_category_code_job_categories_code"))) {
      try {
        await conn.query(`
          ALTER TABLE \`jobs\`
          ADD CONSTRAINT \`fk_jobs_job_category_code_job_categories_code\`
          FOREIGN KEY (\`job_category_code\`) REFERENCES \`job_categories\`(\`Code\`)
          ON DELETE SET NULL
        `);
      } catch (e) {
        // If the column/table exists but types/collation issues occur, don't crash init.
        // You can remove this catch once everything is stable.
        console.warn("[DB] Could not add FK fk_jobs_job_category_code_job_categories_code:", e);
      }
    }

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
    
    // Add raion_id and localitate columns for precise region tracking
    if (!(await columnExists(conn, "jobs", "raion_id"))) {
      await conn.query("ALTER TABLE `jobs` ADD COLUMN `raion_id` INT UNSIGNED NULL");
    }
    if (!(await columnExists(conn, "jobs", "localitate"))) {
      await conn.query("ALTER TABLE `jobs` ADD COLUMN `localitate` VARCHAR(200) NULL");
    }
    
    // Add foreign key constraint for raion_id
    if (!(await fkExists(conn, "jobs", "fk_jobs_raion_id_raioane_id"))) {
      try {
        await conn.query(`
          ALTER TABLE \`jobs\`
          ADD CONSTRAINT \`fk_jobs_raion_id_raioane_id\`
          FOREIGN KEY (\`raion_id\`) REFERENCES \`raioane\`(\`id\`)
          ON DELETE SET NULL
        `);
      } catch (e) {
        console.warn("[DB] Could not add FK fk_jobs_raion_id_raioane_id:", e);
      }
    }
    
    // Add index for raion_id for faster statistics queries
    try {
      await conn.query("CREATE INDEX IF NOT EXISTS `idx_jobs_raion_id` ON `jobs` (`raion_id`)");
    } catch (e) {
      // Index might already exist, ignore
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
    if (!(await columnExists(conn, "applications", "business_confirmed_at"))) {
      await conn.query("ALTER TABLE `applications` ADD COLUMN `business_confirmed_at` TIMESTAMP NULL");
    }
    if (await columnExists(conn, "applications", "completed_at")) {
      await conn.query("ALTER TABLE `applications` DROP COLUMN `completed_at`");
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
        \`application_id\` INT UNSIGNED NOT NULL,
        \`rater_id\` ${GUID_COL} NULL,
        \`rated_id\` ${GUID_COL} NULL,
        \`score\` DECIMAL(2,1) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`idx_ratings_application_rater\` (\`application_id\`, \`rater_id\`),
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
    if (!(await columnExists(conn, "ratings", "comment"))) {
      await conn.query("ALTER TABLE `ratings` ADD COLUMN `comment` TEXT NULL");
    }
    if (!(await columnExists(conn, "ratings", "photo_url"))) {
      await conn.query("ALTER TABLE `ratings` ADD COLUMN `photo_url` VARCHAR(2000) NULL");
    }
    if (!(await columnExists(conn, "ratings", "job_title"))) {
      await conn.query("ALTER TABLE `ratings` ADD COLUMN `job_title` VARCHAR(255) NULL");
    }
    try {
      await conn.query("ALTER TABLE `ratings` MODIFY COLUMN `score` DECIMAL(2,1) NOT NULL");
    } catch {
      // ignore if already DECIMAL or column missing
    }

    // -------------------------
    // 3.X) Activity logs (Support Technician audit)
    // -------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`activity_logs\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`actor_user_id\` ${GUID_COL} NULL,
        \`actor_role\` INT NULL,
        \`actor_email\` VARCHAR(191) NULL,
        \`action_type\` VARCHAR(80) NOT NULL,
        \`target_type\` VARCHAR(40) NULL,
        \`target_job_id\` INT UNSIGNED NULL,
        \`target_application_id\` INT UNSIGNED NULL,
        \`target_user_id\` ${GUID_COL} NULL,
        \`staff_name\` VARCHAR(120) NULL,
        \`job_title\` VARCHAR(255) NULL,
        \`business_name\` VARCHAR(200) NULL,
        \`work_date\` DATE NULL,
        \`work_session_checked_in_at\` TIMESTAMP NULL,
        \`work_session_checked_out_at\` TIMESTAMP NULL,
        \`summary\` VARCHAR(500) NULL,
        \`metadata\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_activity_logs_created_at\` (\`created_at\`),
        INDEX \`idx_activity_logs_actor_user_id\` (\`actor_user_id\`),
        INDEX \`idx_activity_logs_action_type\` (\`action_type\`),
        INDEX \`idx_activity_logs_target_job_id\` (\`target_job_id\`),
        INDEX \`idx_activity_logs_target_application_id\` (\`target_application_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    // Allow one rating per (application, rater): both customer and staff can rate the same application
    const [idxRows] = await conn.query<RowDataPacket[]>(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ratings' AND INDEX_NAME = 'idx_ratings_application_rater' LIMIT 1`,
      [DB_NAME]
    );
    if (Array.isArray(idxRows) && idxRows.length === 0) {
      try {
        await conn.query("ALTER TABLE `ratings` DROP INDEX `application_id`");
      } catch {
        // index may already be gone or have different name
      }
      try {
        await conn.query("ALTER TABLE `ratings` ADD UNIQUE INDEX `idx_ratings_application_rater` (`application_id`, `rater_id`)");
      } catch (e) {
        console.warn("[DB] ratings unique (application_id, rater_id) migration:", e);
      }
    }

    // -------------------------
    // 3.5) Seeders
    // -------------------------
    await seedJobCategories(conn);

    // -------------------------
    // 4) Sanity check
    // -------------------------
    const usersCols = await getUserTableShape(conn);
    for (const must of ["Id", "Email", "PasswordHash", "Role", "CreatedAt"]) {
      if (!usersCols.has(must)) throw new Error(`[DB] Schema invalid: users.${must} is missing`);
    }

    await conn.query("SELECT 1");
    console.log("[DB] MySQL conectat. Schema .NET (users + profiles) este OK. job_categories seeded.");
  } finally {
    if (conn) await conn.end();
  }
}

/**
 * Canonical user creation (matches .NET models).
 */
export async function createUserDotNetStyle(params: {
  email: string;
  passwordHash: string;
  role: number;
  employeeProfile?: {
    name: string;
    surname: string;
    dateOfBirth: string;
    aboutMe?: string;
    profilePictureFileId?: string | null;
  };
  businessProfile?: {
    companyName: string;
    contactPersonName: string;
    contactPersonSurname: string;
    companyCategory: number;
    infoForStaff?: string;
  };
  branch?: {
    name: string;
    address: string;
    city: string;
    country?: string;
    phoneNumber: string;
    contactPersonName?: string;
    contactPersonSurname?: string;
    raionId?: number;
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

      // Create branch if provided
      if (params.branch) {
        const branchId = randomUUID();
        await conn.query(
          `INSERT INTO \`branches\`
           (\`Id\`, \`BusinessProfileId\`, \`Name\`, \`Address\`, \`City\`, \`Country\`, \`PhoneNumber\`,
            \`ContactPersonName\`, \`ContactPersonSurname\`, \`IsActive\`, \`CreatedAt\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            branchId,
            busId,
            params.branch.name.trim(),
            params.branch.address.trim(),
            params.branch.city.trim(),
            params.branch.country?.trim() || "Moldova",
            params.branch.phoneNumber.trim(),
            (params.branch.contactPersonName ?? "").trim(),
            (params.branch.contactPersonSurname ?? "").trim(),
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
  const [rows] = await pool.query<RowDataPacket[]>("SELECT Id FROM users WHERE Id = ? LIMIT 1", [id]);
  const userId = Array.isArray(rows) && rows[0] ? String(rows[0].Id ?? "").trim() : "";
  return userId || null;
}

export default pool;
