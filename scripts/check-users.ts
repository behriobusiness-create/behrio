import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      creatorProfile: {
        select: {
          id: true,
          displayName: true,
        },
      },
      businessProfile: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
  });

  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
