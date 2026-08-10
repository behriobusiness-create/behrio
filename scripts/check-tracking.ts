import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      applications: {
        select: {
          id: true,
          status: true,
          creatorId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
