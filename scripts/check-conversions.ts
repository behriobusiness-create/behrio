import { prisma } from "../lib/prisma";

async function main() {
  const data = await prisma.conversion.findMany({
    orderBy: {
      occurredAt: "desc",
    },
  });

  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
