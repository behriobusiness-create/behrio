import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashPassword, normalizeEmail } from "../lib/auth/password";

async function main() {
  const email = normalizeEmail(
    process.env.ADMIN_EMAIL ||
      (() => {
        throw new Error("ADMIN_EMAIL is required");
      })(),
  );

  const password =
    process.env.ADMIN_PASSWORD ||
    (() => {
      throw new Error("ADMIN_PASSWORD is required");
    })();

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", status: "ACTIVE", emailVerified: existing.emailVerified ?? new Date() },
      })
    : await prisma.user.create({
        data: {
          email,
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: new Date(),
        },
      });

  const rows = await prisma.$executeRaw`UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE id = ${user.id}`;

  console.log(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      passwordSet: rows,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());