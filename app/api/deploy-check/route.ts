import { NextResponse } from "next/server";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

export async function GET() {
  const scope = {
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
      : null,
    VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };

  const conf = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
    AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    STORAGE_DRIVER: process.env.STORAGE_DRIVER ?? "db (default, DisSQL-Free)",
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  let db;
  if (process.env.DATABASE_URL) {
    try {
      const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      const prisma = new PrismaClient({ adapter });
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      db = { connected: true, error: null };
    } catch (e: any) {
      db = { connected: false, error: String(e?.message || e) };
    }
  } else {
    db = {
      connected: false,
      error: "DATABASE_URL is not defined in this deployment scope",
    };
  }

  return NextResponse.json(
    {
      ok: true,
      scope,
      envConfigured: conf,
      db,
    },
    { status: 200 }
  );
}
