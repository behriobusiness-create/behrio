import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ConversionApiResult = {
  statusCode: number;
  body: Record<string, unknown>;
  errorCode?: string;
  campaignId?: string | null;
  userId?: string | null;
  apiKeyId?: string | null;
};

export type ConversionApiContext = {
  apiKeyId: string;
  userId: string;
  body: unknown;
};

const VALID_CURRENCY = "IRR";
const VALID_REAL_STATUSES = new Set(["PAID", "PENDING", "COMPLETED"]);
const TEST_STATUS = "TEST";

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const dec = new Prisma.Decimal(str);
  if (!dec.gt(0)) return null;
  return dec;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

export async function processConversionApi(
  ctx: ConversionApiContext
): Promise<ConversionApiResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;

  const clickId = isString(body.clickId) ? body.clickId.trim() : "";
  const orderId = isString(body.orderId) ? body.orderId.trim() : "";
  const currency = isString(body.currency) ? body.currency.trim().toUpperCase() : "";
  const statusRaw = isString(body.status) ? body.status.trim().toUpperCase() : "";

  if (!clickId) {
    return { statusCode: 400, body: { success: false, error: "MISSING_CLICK_ID" }, errorCode: "MISSING_CLICK_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }
  if (!orderId) {
    return { statusCode: 400, body: { success: false, error: "MISSING_ORDER_ID" }, errorCode: "MISSING_ORDER_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }
  if (orderId.length > 190) {
    return { statusCode: 400, body: { success: false, error: "INVALID_ORDER_ID" }, errorCode: "INVALID_ORDER_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }
  if (currency !== VALID_CURRENCY) {
    return { statusCode: 400, body: { success: false, error: "INVALID_CURRENCY" }, errorCode: "INVALID_CURRENCY", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }

  const amount = parseAmount(body.amount);
  if (!amount) {
    return { statusCode: 400, body: { success: false, error: "INVALID_AMOUNT" }, errorCode: "INVALID_AMOUNT", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }

  const isTest = statusRaw === TEST_STATUS || clickId.startsWith("test_clk_");

  if (isTest) {
    return handleTestConversion(ctx, { clickId, orderId, currency, amount });
  }

  if (!VALID_REAL_STATUSES.has(statusRaw)) {
    return { statusCode: 400, body: { success: false, error: "INVALID_STATUS" }, errorCode: "INVALID_STATUS", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }

  const click = await prisma.click.findUnique({
    where: { clickId },
    include: {
      trackingLink: {
        include: {
          campaign: { include: { business: { select: { userId: true } } } },
          creator: { select: { userId: true } },
        },
      },
    },
  });

  if (!click) {
    return { statusCode: 404, body: { success: false, error: "INVALID_CLICK_ID" }, errorCode: "INVALID_CLICK_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }

  const campaign = click.trackingLink.campaign;
  const trackingLink = click.trackingLink;

  if (campaign.business.userId !== ctx.userId) {
    return { statusCode: 403, body: { success: false, error: "UNAUTHORIZED" }, errorCode: "UNAUTHORIZED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  const integration = await prisma.campaignIntegration.findUnique({
    where: { campaignId: campaign.id },
  });

  if (integration?.status === "DISABLED") {
    return { statusCode: 403, body: { success: false, error: "INTEGRATION_DISABLED" }, errorCode: "INTEGRATION_DISABLED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  if (!integration || integration.status !== "VERIFIED") {
    return { statusCode: 403, body: { success: false, error: "INTEGRATION_NOT_VERIFIED" }, errorCode: "INTEGRATION_NOT_VERIFIED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  if (integration.userId !== ctx.userId) {
    return { statusCode: 403, body: { success: false, error: "UNAUTHORIZED" }, errorCode: "UNAUTHORIZED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  if (campaign.status !== "ACTIVE") {
    return { statusCode: 409, body: { success: false, error: "CAMPAIGN_NOT_ACTIVE" }, errorCode: "CAMPAIGN_NOT_ACTIVE", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  if (trackingLink.status !== "ACTIVE") {
    return { statusCode: 409, body: { success: false, error: "TRACKING_LINK_NOT_ACTIVE" }, errorCode: "TRACKING_LINK_NOT_ACTIVE", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  if (trackingLink.expiresAt && trackingLink.expiresAt.getTime() <= Date.now()) {
    return { statusCode: 409, body: { success: false, error: "TRACKING_LINK_EXPIRED" }, errorCode: "TRACKING_LINK_EXPIRED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: campaign.id };
  }

  const existing = await prisma.conversion.findUnique({
    where: {
      campaignId_externalOrderId: {
        campaignId: campaign.id,
        externalOrderId: orderId,
      },
    },
  });

  if (existing) {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "DUPLICATE_ORDER",
        conversion: { id: existing.id, status: existing.status },
      },
      errorCode: "DUPLICATE_ORDER",
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      campaignId: campaign.id,
    };
  }

  const existingForClick = await prisma.conversion.findUnique({
    where: { clickId },
  });

  if (existingForClick) {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: "CLICK_ALREADY_CONVERTED",
        conversion: { id: existingForClick.id, status: existingForClick.status },
      },
      errorCode: "CLICK_ALREADY_CONVERTED",
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      campaignId: campaign.id,
    };
  }

  let conversion;
  try {
    conversion = await prisma.conversion.create({
      data: {
        trackingLinkId: trackingLink.id,
        campaignId: campaign.id,
        clickId,
        externalOrderId: orderId,
        amount,
        status: "PENDING",
        source: "INTEGRATION",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const dup = await prisma.conversion.findFirst({
        where: { OR: [{ campaignId: campaign.id, externalOrderId: orderId }, { clickId }] },
      });
      if (dup) {
        return {
          statusCode: 409,
          body: {
            success: false,
            error: dup.externalOrderId === orderId ? "DUPLICATE_ORDER" : "CLICK_ALREADY_CONVERTED",
            conversion: { id: dup.id, status: dup.status },
          },
          errorCode: dup.externalOrderId === orderId ? "DUPLICATE_ORDER" : "CLICK_ALREADY_CONVERTED",
          userId: ctx.userId,
          apiKeyId: ctx.apiKeyId,
          campaignId: campaign.id,
        };
      }
    }
    throw error;
  }

  return {
    statusCode: 201,
    body: {
      success: true,
      conversion: {
        id: conversion.id,
        status: conversion.status,
        clickId: conversion.clickId,
        orderId: conversion.externalOrderId,
        amount: amount.toNumber(),
      },
    },
    userId: ctx.userId,
    apiKeyId: ctx.apiKeyId,
    campaignId: campaign.id,
  };
}

async function handleTestConversion(
  ctx: ConversionApiContext,
  input: { clickId: string; orderId: string; currency: string; amount: Prisma.Decimal }
): Promise<ConversionApiResult> {
  const integration = await prisma.campaignIntegration.findUnique({
    where: { testClickId: input.clickId },
    include: { campaign: { include: { business: { select: { userId: true } } } } },
  });

  if (!integration) {
    return { statusCode: 404, body: { success: false, error: "INVALID_CLICK_ID" }, errorCode: "INVALID_CLICK_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId };
  }

  if (integration.userId !== ctx.userId || integration.campaign.business.userId !== ctx.userId) {
    return { statusCode: 403, body: { success: false, error: "UNAUTHORIZED" }, errorCode: "UNAUTHORIZED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: integration.campaignId };
  }

  if (integration.status === "DISABLED") {
    return { statusCode: 403, body: { success: false, error: "INTEGRATION_DISABLED" }, errorCode: "INTEGRATION_DISABLED", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: integration.campaignId };
  }

  if (!input.orderId.startsWith("TEST-")) {
    return { statusCode: 400, body: { success: false, error: "INVALID_ORDER_ID" }, errorCode: "INVALID_ORDER_ID", userId: ctx.userId, apiKeyId: ctx.apiKeyId, campaignId: integration.campaignId };
  }

  const now = new Date();

  await prisma.campaignIntegration.update({
    where: { id: integration.id },
    data: {
      status: "VERIFIED",
      verifiedAt: now,
      lastVerifiedAt: now,
      verifiedBy: ctx.apiKeyId,
      verificationMeta: {
        method: "test-conversion",
        orderId: input.orderId,
        amount: input.amount.toNumber(),
      },
    },
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      test: true,
      conversion: {
        id: `test_${input.clickId}`,
        status: "TEST",
        orderId: input.orderId,
      },
    },
    userId: ctx.userId,
    apiKeyId: ctx.apiKeyId,
    campaignId: integration.campaignId,
  };
}
