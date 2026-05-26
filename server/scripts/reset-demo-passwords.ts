import bcrypt from "bcryptjs";
import { prisma } from "../src/prismaClient";

async function main() {
  const emails = ["angajator.demo@work2now.local", "angajat.demo@work2now.local"];
  const hash = await bcrypt.hash("demo1234", 10);

  for (const email of emails) {
    const result = await prisma.users.updateMany({
      where: { Email: email },
      data: { PasswordHash: hash, IsActive: true },
    });
    console.log(email, "updated:", result.count);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
