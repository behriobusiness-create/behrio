import { prisma } from "../lib/prisma";

async function main() {
  const links = await prisma.trackingLink.findMany({
    select: {
      id: true,
      code: true,
      campaignId: true,
      creatorId: true,
      status: true,
    },
  });

  console.log(JSON.stringify(links, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
