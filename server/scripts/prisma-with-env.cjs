/**
 * Prisma CLI citește doar env("DATABASE_URL") din schema; aplicația derivă URL-ul
 * din DB_HOST / DB_USER / DB_PASSWORD / DB_NAME în src/env.ts.
 * Acest script aplică aceeași logică înainte de a apela `prisma`.
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const serverDir = path.resolve(__dirname, "..");

const possiblePaths = [
  path.join(serverDir, ".env"),
  path.join(serverDir, "..", ".env"),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "3306";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const dbName = process.env.DB_NAME || "time2go";
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  process.env.DATABASE_URL = `mysql://${auth}@${host}:${port}/${dbName}`;
}

if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
  console.error(
    "Lipsește conexiunea la baza de date. Pune în server/.env fie DATABASE_URL, fie DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (ca la rularea API-ului)."
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error("Utilizare: node scripts/prisma-with-env.cjs <comenzi prisma...>");
  console.error('Exemplu: node scripts/prisma-with-env.cjs migrate deploy');
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  stdio: "inherit",
  cwd: serverDir,
  env: process.env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
