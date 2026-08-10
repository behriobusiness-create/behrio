import { prisma } from "../lib/prisma";

async function main() {
  const application = await prisma.campaignApplication.create({
    data: {
      campaignId: "cmsfrgqxc0000271608qux0jk",
      creatorId: "cmsfrib290001g616cn6irq58",
      status: "APPROVED",
    },
  });

  console.log(JSON.stringify(application, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
