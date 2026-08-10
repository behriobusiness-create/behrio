import { prisma } from "../lib/prisma";

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      rewardPerClick: true,
    },
  });

  console.log(campaigns);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
