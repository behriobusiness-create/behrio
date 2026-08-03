
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.$queryRaw<
    { current_database: string; current_user: string }[]
  >`SELECT current_database(), current_user`;

  console.log("Database connection successful:");
  console.log(result);
}

main()
  .catch((error) => {
    console.error("Database connection failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

