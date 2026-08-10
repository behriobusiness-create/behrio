import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey, generateRequestId } from "@/lib/integrations/keys";
import { processConversionApi } from "@/lib/integrations/conversion";
import { writeApiRequestLog, clientIp } from "@/lib/integrations/log";
import { isRateLimited } from "@/lib/rate-limit";
import { createHash } from "node:crypto";

const ENDPOINT = "/api/v1/integrations/conversions";

function ipHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function extractBearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const ip = clientIp(request);

  const respond = async (result: {
    statusCode: number;
    body: Record<string, unknown>;
    errorCode?: string;
    campaignId?: string | null;
    userId?: string | null;
    apiKeyId?: string | null;
  }) => {
    await writeApiRequestLog({
      requestId,
      userId: result.userId,
      campaignId: result.campaignId,
      apiKeyId: result.apiKeyId,
      endpoint: ENDPOINT,
      method: "POST",
      statusCode: result.statusCode,
      errorCode: result.errorCode,
      ipHash: ipHash(ip),
    });

    return NextResponse.json(result.body, {
      status: result.statusCode,
      headers: { "X-Behrio-Request-Id": requestId },
    });
  };

  try {
    const key = extractBearer(request);

    if (!key) {
      return respond({
        statusCode: 401,
        body: { success: false, error: "UNAUTHORIZED" },
        errorCode: "UNAUTHORIZED",
      });
    }

    const keyHash = hashApiKey(key);
    const apiKey = await prisma.businessApiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, status: true } } },
    });

    if (!apiKey) {
      return respond({
        statusCode: 401,
        body: { success: false, error: "UNAUTHORIZED" },
        errorCode: "UNAUTHORIZED",
      });
    }

    if (apiKey.revokedAt) {
      return respond({
        statusCode: 401,
        body: { success: false, error: "KEY_REVOKED" },
        errorCode: "KEY_REVOKED",
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });
    }

    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      return respond({
        statusCode: 401,
        body: { success: false, error: "KEY_EXPIRED" },
        errorCode: "KEY_EXPIRED",
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });
    }

    if (apiKey.user.status !== "ACTIVE") {
      return respond({
        statusCode: 403,
        body: { success: false, error: "UNAUTHORIZED" },
        errorCode: "UNAUTHORIZED",
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });
    }

    if (await isRateLimited("conversion:api", apiKey.id, 120, 60_000)) {
      return respond({
        statusCode: 429,
        body: { success: false, error: "RATE_LIMITED" },
        errorCode: "RATE_LIMITED",
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });
    }

    await prisma.businessApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond({
        statusCode: 400,
        body: { success: false, error: "INVALID_JSON" },
        errorCode: "INVALID_JSON",
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });
    }

    const result = await processConversionApi({
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      body,
    });

    return respond(result);
  } catch (error) {
    console.error("Conversion API error:", error);
    return respond({
      statusCode: 500,
      body: { success: false, error: "INTERNAL_ERROR" },
      errorCode: "INTERNAL_ERROR",
    });
  }
}