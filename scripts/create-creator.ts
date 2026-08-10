import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Test Creator",
      email: "creator@test.com",
      role: "CREATOR",
      creatorProfile: {
        create: {
          displayName: "Test Creator",
          bio: "Creator for tracking test",
        },
      },
    },
    include: {
      creatorProfile: true,
    },
  });

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
