import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type ApiLogInput = {
  requestId: string;
  userId?: string | null;
  campaignId?: string | null;
  apiKeyId?: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  errorCode?: string | null;
  ipHash?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function writeApiRequestLog(input: ApiLogInput): Promise<void> {
  try {
    await prisma.apiRequestLog.create({
      data: {
        requestId: input.requestId,
        userId: input.userId ?? null,
        campaignId: input.campaignId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        errorCode: input.errorCode ?? null,
        ipHash: input.ipHash ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write api request log:", error);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}
