/**
 * Verifică rapid tabelul experiences (rulează din server/: node scripts/check-experiences.mjs)
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

try {
  const rows = await prisma.experiences.findMany({
    take: 10,
    orderBy: { JobCategory: "asc" },
    select: {
      Id: true,
      JobCategory: true,
      Duration: true,
      Description: true,
      employee_profiles: { select: { UserId: true, Name: true, Surname: true } },
    },
  });
  const total = await prisma.experiences.count();
  console.log(`experiences count: ${total}`);
  for (const r of rows) {
    const u = r.employee_profiles;
    const name = u ? `${u.Name} ${u.Surname}`.trim() : "?";
    console.log(
      `- ${name} | JobCategory=${r.JobCategory} Duration=${r.Duration} descLen=${(r.Description || "").length} id=${r.Id.slice(0, 8)}…`
    );
  }
} catch (e) {
  console.error("DB error:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
