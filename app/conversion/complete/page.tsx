import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { formatNumber } from "@/lib/stats";

export const dynamic = "force-dynamic";

function parseAmount(value: string | undefined): Prisma.Decimal | null {
  if (!value) return null;
  const str = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return null;
  const dec = new Prisma.Decimal(str);
  if (!dec.gt(0)) return null;
  return dec;
}

export default async function ConversionCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; amount?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const clickId = cookieStore.get("behrio_click_id")?.value ?? "";

  const orderId = params.orderId?.trim() ?? "";
  const amount = parseAmount(params.amount);

  const viewCampaignTypes = new Set(["CPM"]);

  if (!clickId) {
    return (
      <PageShell
        tone="error"
        title="شناسه کلیک پیدا نشد"
        message="کاربر از لینک رفرال Behrio وارد فروشگاه نشده است، یا مدت زیادی از کلیک گذشته. لطفاً مطمئن شوید خرید از طریق لینک رفرال انجام شده."
      />
    );
  }

  if (!orderId) {
    return (
      <PageShell
        tone="error"
        title="شماره سفارش الزامی است"
        message="پارامتر orderId در آدرس ارسال نشده است. آدرس تکمیل باید شامل orderId و amount باشد."
      />
    );
  }

  if (orderId.length > 190) {
    return (
      <PageShell
        tone="error"
        title="شماره سفارش نامعتبر است"
        message="شماره سفارش نمی‌تواند بیشتر از ۱۹۰ کاراکتر باشد."
      />
    );
  }

  if (!amount) {
    return (
      <PageShell
        tone="error"
        title="مبلغ سفارش نامعتبر است"
        message="پارامتر amount باید عددی بزرگ‌تر از صفر و به ریال باشد."
      />
    );
  }

  const click = await prisma.click.findUnique({
    where: { clickId },
    include: {
      trackingLink: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              destinationUrl: true,
              business: { select: { companyName: true } },
            },
          },
          creator: { select: { displayName: true } },
        },
      },
    },
  });

  if (!click) {
    return (
      <PageShell
        tone="error"
        title="کلیک یافت نشد"
        message="این شناسه کلیک در سیستم وجود ندارد. شاید با مرورگر دیگری خرید انجام شده است."
      />
    );
  }

  const campaign = click.trackingLink.campaign;
  const trackingLink = click.trackingLink;

  if (trackingLink.status !== "ACTIVE") {
    return (
      <PageShell
        tone="error"
        title="لینک رفرال فعال نیست"
        message="لینک رفرال این خرید فعال نیست و امکان ثبت تبدیل وجود ندارد."
      />
    );
  }

  if (campaign.status !== "ACTIVE") {
    return (
      <PageShell
        tone="error"
        title="کمپین فعال نیست"
        message="کمپین این خرید فعال نیست و امکان ثبت تبدیل وجود ندارد."
      />
    );
  }

  if (viewCampaignTypes.has(campaign.type)) {
    return (
      <PageShell
        tone="error"
        title="کمپین بر اساس نمایش است"
        message="این کمپین بر اساس نمایش (ویو) پرداخت می‌شود و نیازی به ثبت تبدیل فروش ندارد."
      />
    );
  }

  const existing = await prisma.conversion.findFirst({
    where: {
      OR: [
        { campaignId: campaign.id, externalOrderId: orderId },
        { clickId },
      ],
    },
  });

  if (existing) {
    return (
      <PageShell
        tone="neutral"
        title="این سفارش قبلاً ثبت شده است"
        message="سفارش یا کلیک موردنظر قبلاً در سیستم ثبت شده و پردازش آن در جریان است."
        storeName={campaign.business?.companyName ?? null}
        storeUrl={campaign.destinationUrl ?? null}
      />
    );
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
        source: "POSTBACK",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return (
        <PageShell
          tone="neutral"
          title="این سفارش قبلاً ثبت شده است"
          message="سفارش یا کلیک موردنظر قبلاً در سیستم ثبت شده است."
          storeName={campaign.business?.companyName ?? null}
          storeUrl={campaign.destinationUrl ?? null}
        />
      );
    }
    throw error;
  }

  return (
    <PageShell
      tone="success"
      title="پرداخت ثبت شد"
      message={`سفارش ${orderId} به مبلغ ${formatNumber(amount.toNumber())} ریال ثبت شد و در انتظار تأیید فروشگاه است. با تأیید، دستمزد به ${click.trackingLink.creator.displayName} پرداخت می‌شود.`}
      storeName={campaign.business?.companyName ?? null}
      storeUrl={campaign.destinationUrl ?? null}
      conversionId={conversion.id}
    />
  );
}

const tones = {
  success: {
    dot: "bg-primary",
    title: "text-primary-soft",
    card: "border-primary/25",
  },
  neutral: {
    dot: "bg-info",
    title: "text-info",
    card: "border-info/25",
  },
  error: {
    dot: "bg-danger",
    title: "text-danger",
    card: "border-danger/25",
  },
} as const;

function PageShell({
  tone,
  title,
  message,
  storeName,
  storeUrl,
  conversionId,
}: {
  tone: keyof typeof tones;
  title: string;
  message: string;
  storeName?: string | null;
  storeUrl?: string | null;
  conversionId?: string;
}) {
  const t = tones[tone];
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div
        className={`w-full max-w-md animate-rise rounded-2xl border ${t.card} bg-card p-8 text-center`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <span className={`h-4 w-4 rounded-full ${t.dot}`} />
        </div>
        <h1 className={`mt-4 text-xl font-bold ${t.title}`}>{title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted">{message}</p>
        {conversionId && (
          <p className="mt-2 text-[11px] text-subtle" dir="ltr">
            {conversionId}
          </p>
        )}
        {storeUrl && (
          <a
            href={storeUrl}
            className="mt-6 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            {storeName ? `بازگشت به ${storeName}` : "بازگشت به فروشگاه"}
          </a>
        )}
      </div>
    </main>
  );
}
