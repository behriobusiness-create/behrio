import { prisma } from "../lib/prisma";

async function main() {
  const campaign = await prisma.campaign.update({
    where: {
      id: "cmsfrgqxc0000271608qux0jk",
    },
    data: {
      status: "ACTIVE",
    },
  });

  console.log(JSON.stringify(campaign, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
