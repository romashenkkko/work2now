import "../src/env";
import { prisma } from "../src/prismaClient";

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  try {
    const tables = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      "SHOW TABLES LIKE 'job_payment_reservations'"
    );
    console.log("table exists:", tables.length > 0, tables);
    const count = await prisma.job_payment_reservations.count();
    console.log("row count:", count);
    const rows = await prisma.job_payment_reservations.findMany({ take: 5, orderBy: { id: "desc" } });
    console.log("sample rows:", JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error("query failed:", e);
  }
  await prisma.$disconnect();
}

main();
