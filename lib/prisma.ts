import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const POOL_MAX = Number(process.env.DATABASE_POOL_MAX || "10");
const POOL_TIMEOUT_MS = Number(process.env.DATABASE_POOL_TIMEOUT_MS || "10000");

const adapter = new PrismaPg({
  connectionString,
  max: POOL_MAX,
  connectionTimeoutMillis: POOL_TIMEOUT_MS,
  idleTimeoutMillis: 0,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
