import { prisma } from "../lib/prisma";

async function main() {
  const userId = "cmsfrib1t0000g616wucx9od6";

  const earnings = await prisma.ledgerEntry.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
      type: "CREATOR_EARNING",
      status: {
        in: ["AVAILABLE", "COMPLETED"],
      },
    },
  });

  const withdrawals = await prisma.withdrawal.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId,
      status: {
        in: ["PROCESSING", "COMPLETED"],
      },
    },
  });

  console.log({
    totalEarned: Number(earnings._sum.amount ?? 0),
    withdrawn: Number(withdrawals._sum.amount ?? 0),
    available:
      Number(earnings._sum.amount ?? 0) -
      Number(withdrawals._sum.amount ?? 0),
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
