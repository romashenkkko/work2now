/**
 * Șterge toate joburile și aplicațiile asociate din baza de date.
 * Din root: cd server && node scripts/delete-all-jobs.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "work2now";

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
  try {
    const [appResult] = await conn.query("DELETE FROM applications");
    const [jobResult] = await conn.query("DELETE FROM jobs");
    const appCount = appResult.affectedRows ?? 0;
    const jobCount = jobResult.affectedRows ?? 0;
    console.log("Șterse:", appCount, "aplicații,", jobCount, "joburi.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
