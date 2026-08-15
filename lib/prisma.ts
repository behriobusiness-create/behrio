import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const POOL_MAX = Number(process.env.DATABASE_POOL_MAX || "10");
const POOL_TIMEOUT_MS = Number(process.env.DATABASE_POOL_TIMEOUT_MS || "10000");

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: POOL_MAX,
    connectionTimeoutMillis: POOL_TIMEOUT_MS,
    idleTimeoutMillis: 0,
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!client) {
      client = globalForPrisma.prisma ?? createClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = client;
      }
    }
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? (value as () => unknown).bind(client) : value;
  },
});
