import { createHash, randomBytes } from "node:crypto";

type Backend = "memory" | "redis";

function backend(): Backend {
  const value = process.env.RATE_LIMITER_DRIVER;
  return value === "redis" ? "redis" : "memory";
}

const buckets = new Map<string, { timestamps: number[] }>();

function memoryCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { timestamps: [now] });
    return false;
  }

  const within = bucket.timestamps.filter((t) => now - t < windowMs);
  bucket.timestamps = within;
  buckets.set(key, bucket);

  if (within.length >= limit) {
    return true;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return false;
}

const REDIS_HASH_KEY = "behrio:rate-limits";

function redisKey(key: string): string {
  return `${REDIS_HASH_KEY}:${key}`;
}

async function redisCheck(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const { Redis } = await import("@upstash/redis");
  const client = Redis.fromEnv();
  const redisKeyName = redisKey(key);
  const windowSeconds = Math.ceil(windowMs / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const current = await client.zcard(redisKeyName);
  if (current >= limit) {
    return true;
  }

  const pipeline = client.pipeline();
  pipeline.zadd(redisKeyName, { score: nowSeconds, member: randomBytes(8).toString("hex") });
  pipeline.zremrangebyscore(redisKeyName, 0, nowSeconds - windowSeconds);
  pipeline.expire(redisKeyName, windowSeconds);
  await pipeline.exec();

  return false;
}

const pendingRedis = new Set<string>();

export async function isRateLimited(
  scope: string,
  id: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = createHash("sha256")
    .update(`${scope}:${id}`)
    .digest("hex");

  if (backend() === "redis") {
    const inFlight = pendingRedis.has(key);
    if (inFlight) return true;
    pendingRedis.add(key);
    try {
      return await redisCheck(key, limit, windowMs);
    } finally {
      pendingRedis.delete(key);
    }
  }

  return memoryCheck(key, limit, windowMs);
}
