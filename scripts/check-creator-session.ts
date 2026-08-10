import { prisma } from "../lib/prisma";

async function main() {
  const sessions = await prisma.authSession.findMany({
    where: {
      userId: "cmsfrib1t0000g616wucx9od6",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(JSON.stringify(sessions, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());