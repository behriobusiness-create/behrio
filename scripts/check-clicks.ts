import { prisma } from "../lib/prisma";

async function main() {
  const clicks = await prisma.click.findMany({
    orderBy: {
      clickedAt: "desc",
    },
    take: 10,
  });

  console.log(JSON.stringify(clicks, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
