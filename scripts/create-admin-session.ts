import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";

async function main() {
  const userId = "cmsfseiad0000ve167ov4v0lh";

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const session = await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("AuthSession created:", session.id);
  console.log("RAW TOKEN (set as the sessionToken cookie):", token);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());