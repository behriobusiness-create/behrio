import { prisma } from "../lib/prisma";

async function main() {
  const campaign = await prisma.campaign.update({
    where: {
      id: "cmsfrgqxc0000271608qux0jk",
    },
    data: {
      rewardPerClick: 5000,
    },
  });

  console.log(campaign);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

