import { prisma } from "../lib/prisma";

async function main() {
  const link = await prisma.trackingLink.create({
    data: {
      campaignId: "cmsfrgqxc0000271608qux0jk",
      creatorId: "cmsfrib290001g616cn6irq58",
      code: "testcreator001",
      status: "ACTIVE",
    },
  });

  console.log(JSON.stringify(link, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
