import { prisma } from "../lib/prisma";

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      businessId: true,
    },
  });

  console.log(JSON.stringify(campaigns, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
