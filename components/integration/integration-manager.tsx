"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, inputClass, labelClass } from "@/components/ui";

type ApiKeyView = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
};

type IntegrationView = {
  id: string;
  status: string;
  verifiedAt: string | null;
  lastVerifiedAt: string | null;
  revokedAt: string | null;
  testClickId: string | null;
  apiKey: ApiKeyView | null;
};

type CampaignView = {
  id: string;
  name: string;
  status: string;
  integration: IntegrationView | null;
  _count: { trackingLinks: number; conversions: number };
};

const statusLabel: Record<string, string> = {
  NOT_CONFIGURED: "تنظیم نشده",
  CONFIGURED: "تنظیم شده",
  VERIFICATION_PENDING: "در انتظار تأیید",
  VERIFIED: "تأیید شده",
  FAILED: "ناموفق",
  DISABLED: "غیرفعال",
};

const statusTone: Record<string, "default" | "amber" | "green" | "red" | "blue"> = {
  NOT_CONFIGURED: "default",
  CONFIGURED: "blue",
  VERIFICATION_PENDING: "amber",
  VERIFIED: "green",
  FAILED: "red",
  DISABLED: "red",
};

export default function IntegrationManager({
  campaign,
}: {
  campaign: CampaignView;
}) {
  const router = useRouter();
  const [integration, setIntegration] = useState<IntegrationView | null>(
    campaign.integration,
  );
  const [apiKeyName, setApiKeyName] = useState("کلید اصلی");
  const [secret, setSecret] = useState<string | null>(null);
  const [testKey, setTestKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function call<T>(
    url: string,
    body?: Record<string, unknown>,
  ): Promise<T | null> {
    setError("");
    setNotice("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "خطا در اجرای عملیات.");
      return null;
    }
    return data as T;
  }

  async function createKey() {
    setLoading(true);
    const data = await call<{ apiKey: { key: string; id: string; name: string; prefix: string } }>(
      `/api/business/campaigns/${campaign.id}/integration/key`,
      { name: apiKeyName },
    );
    setLoading(false);
    if (!data) return;
    setSecret(data.apiKey.key);
    setIntegration((prev) => ({
      id: prev?.id ?? data.apiKey.id,
      status: "CONFIGURED",
      verifiedAt: null,
      lastVerifiedAt: null,
      revokedAt: null,
      testClickId: null,
      apiKey: {
        id: data.apiKey.id,
        name: data.apiKey.name,
        keyPrefix: data.apiKey.prefix,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: null,
      },
    }));
    router.refresh();
  }

  async function revoke() {
    setLoading(true);
    const data = await call(`/api/business/campaigns/${campaign.id}/integration/key/revoke`);
    setLoading(false);
    if (!data) return;
    setSecret(null);
    setTestKey("");
    setIntegration((prev) =>
      prev
        ? { ...prev, status: "CONFIGURED", revokedAt: new Date().toISOString(), apiKey: null }
        : prev,
    );
    router.refresh();
  }

  async function startVerify() {
    setLoading(true);
    const data = await call<{ testClickId: string; status: string }>(
      `/api/business/campaigns/${campaign.id}/integration/verify`,
    );
    setLoading(false);
    if (!data) return;
    setIntegration((prev) =>
      prev
        ? { ...prev, status: data.status, testClickId: data.testClickId, verifiedAt: null }
        : prev,
    );
    setNotice(`برای تکمیل تأیید، درخواست تست زیر را بفرستید (یا کلید API را در بخش «اجرای تست» وارد کنید):
clickId = ${data.testClickId}`);
    router.refresh();
  }

  async function runTest() {
    setLoading(true);
    const data = await call<{ status: string; testClickId: string }>(
      `/api/business/campaigns/${campaign.id}/integration/test`,
      { apiKey: testKey },
    );
    setLoading(false);
    if (!data) return;
    setIntegration((prev) =>
      prev ? { ...prev, status: data.status, testClickId: data.testClickId } : prev,
    );
    setNotice("تست موفق بود. یکپارچه‌سازی تأیید شد.");
    router.refresh();
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setNotice("کلید API کپی شد.");
  }

  const status = integration?.status ?? "NOT_CONFIGURED";
  const apiKey = integration?.apiKey ?? null;
  const endpoint = "/api/v1/integrations/conversions";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-fg">{campaign.name}</h2>
        <Badge tone={statusTone[status] ?? "default"}>
          {statusLabel[status] ?? status}
        </Badge>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-fg">جریان کامل رفرال (از کلیک تا پرداخت)</h3>
        <p className="mt-1 text-sm text-muted">
          دقیقاً بدانید که لینک رفرال کجا استفاده می‌شود و API شما در کدام مرحله وارد
          می‌شود:
        </p>
        <ol className="mt-4 space-y-3 text-sm leading-7 text-muted">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-soft">
              ۱
            </span>
            <span>
              هر خالق تأییدشده یک لینک اختصاصی رفرال می‌گیرد (مثلاً{" "}
              <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">
                behrio.com/t/abc123
              </code>
              ). او این لینک را در بیو/استوری/محتوا می‌گذارد. این لینک را{" "}
              <span className="font-semibold text-fg">خالق</span> استفاده می‌کند، نه سایت شما.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-soft">
              ۲
            </span>
            <span>
              مشتری روی لینک رفرال می‌زند. Behrio کلیک را ثبت و او را به سایت شما
              هدایت می‌کند و پارامتر{" "}
              <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">
                ?behrio_click_id=...
              </code>{" "}
              را به مقصد اضافه می‌کند.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-soft">
              ۳
            </span>
            <span>
              شما (کسب‌وکار) این <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">behrio_click_id</code> را در
              سیستم خود ذخیره می‌کنید — همان‌طور که یک کوکی/شناسه سشن ذخیره می‌کنید.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-soft">
              ۴
            </span>
            <span>
              مشتری از شما خرید می‌کند. حالا{" "}
              <span className="font-semibold text-fg">سایت شما</span> وارد عمل می‌شود: بعد از
              ثبت سفارش، یک درخواست به Conversion API می‌فرستد (مشابه درخواست تست
              پایین) و <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">clickId</code>،{" "}
              <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">orderId</code> و مبلغ را همراه کلید API
              می‌فرستد.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-soft">
              ۵
            </span>
            <span>
              Behrio تبدیل را به همان خالقِ آن کلیک نسبت می‌دهد و دستمزدش را ثبت می‌کند؛
              شما هم در داشبورد، هزینه و عملکرد هر خالق را می‌بینید.
            </span>
          </li>
        </ol>
        <div className="mt-4 rounded-xl border border-info/25 bg-info/10 p-4 text-xs leading-6 text-info/90">
          <p className="font-semibold text-info">خلاصه</p>
          <p className="mt-1">
            لینک رفرال (بخش ۱) کارِ خالق است و خودکار ساخته می‌شود؛ اتصال شما فقط همین
            صفحه است: ساخت کلید API و ارسال تبدیل‌ها به{" "}
            <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5">POST /api/v1/integrations/conversions</code>.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-fg">کلید API</h3>
        <p className="mt-1 text-sm text-muted">
          کلید برای احراز هویت درخواست‌های Conversion API استفاده می‌شود.
        </p>

        {apiKey ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-xs text-muted">نام</p>
                <p className="mt-1 font-medium text-fg">{apiKey.name}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-xs text-muted">شناسه</p>
                <p className="mt-1 font-mono text-fg">
                  {apiKey.keyPrefix}••••••••••••••••••••••••••••••
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-xs text-muted">وضعیت</p>
                <p className="mt-1 font-medium text-fg">
                  {apiKey.revokedAt ? "لغو شده" : "فعال"}
                </p>
              </div>
            </div>
            <Button variant="danger" onClick={revoke} disabled={loading || !!apiKey.revokedAt}>
              لغو کلید
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelClass}>نام کلید</label>
              <input
                className={inputClass}
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="مثلاً: سایت اصلی"
              />
            </div>
            <Button onClick={createKey} disabled={loading}>
              ساخت کلید API
            </Button>
          </div>
        )}
      </Card>

      {secret && (
        <Card className="border-warn/40 p-6">
          <h3 className="font-semibold text-warn">کلید شما (فقط یک بار نمایش داده می‌شود)</h3>
          <p className="mt-1 text-sm text-muted">
            این کلید را کپی و در سیستم خود ذخیره کنید. بعد از بستن این صفحه دیگر قابل مشاهده نیست.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 break-all rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg">
              {secret}
            </code>
            <Button variant="secondary" onClick={copySecret}>
              کپی
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-semibold text-fg">مراحل اتصال</h3>
        <ol className="mt-4 list-inside space-y-2 text-sm text-muted">
          <li>
            <span className="text-fg">۱.</span> ساخت کلید API
          </li>
          <li>
            <span className="text-fg">۲.</span> ارسال کلیک: یک پارامتر <code className="text-fg">behrio_click_id</code> به لینک مقصد اضافه می‌شود و شما آن را در سیستم خود ذخیره می‌کنید.
          </li>
          <li>
            <span className="text-fg">۳.</span> تأیید یکپارچه‌سازی: یک درخواست تست به آدرس زیر بفرستید.
          </li>
        </ol>

        {status !== "VERIFIED" && (
          <>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={startVerify} disabled={loading || !apiKey}>
                شروع تأیید
              </Button>
              <span className="text-xs text-subtle">یک clickId تست ساخته می‌شود</span>
            </div>

            {status === "VERIFICATION_PENDING" && integration?.testClickId && (
              <div className="mt-4 space-y-3">
                <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-xs leading-6 text-fg">{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"clickId":"${integration.testClickId}","orderId":"TEST-12345","amount":1000,"currency":"IRR","status":"TEST"}'`}</pre>

                <div className="border-t border-line pt-4">
                  <p className="text-sm text-muted">
                    یا اگر کلید API را در اختیار دارید، اینجا وارد کنید تا تست به‌صورت خودکار اجرا شود:
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      className={inputClass}
                      value={testKey}
                      onChange={(e) => setTestKey(e.target.value)}
                      placeholder="کلید API"
                      dir="ltr"
                    />
                    <Button onClick={runTest} disabled={loading || !testKey}>
                      اجرای تست
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {status === "VERIFIED" && (
          <p className="mt-4 text-sm font-medium text-primary-soft">
            یکپارچه‌سازی تأیید شده است. اکنون می‌توانید کمپین را برای بررسی ارسال کنید.
          </p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-fg">روش پیشرفته (Conversion API)</h3>
        <p className="mt-2 text-sm leading-7 text-muted">
          اگر ترجیح می‌دهید فروشگاه خودتان به‌جای ریدایرکت، تبدیل را مستقیم ارسال
          کند، از آدرس زیر استفاده کنید:
        </p>
        <code className="mt-1 block rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg" dir="ltr">
          POST {endpoint}
        </code>
        <p className="mt-3 text-sm leading-7 text-muted">
          کلید API در <span className="font-semibold text-fg">هدر Authorization</span> ارسال می‌شود
          (نه داخل بدنه JSON). نمونه کامل درخواست:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-4 text-xs leading-6 text-fg">{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ \\
    "clickId": "behrio_click_id_...", \\
    "orderId": "ORDER-1001", \\
    "amount": 250000, \\
    "currency": "IRR", \\
    "status": "PAID" \\
  }'`}</pre>
        <p className="mt-3 text-xs text-subtle">
          در صورت موفقیت، پاسخ ۲۰۰ و خطای ۴۰۱ در صورت کلید اشتباه یا ۴۰۴ در صورت
          clickId نامعتبر برمی‌گردد.
          پاسخ در هدر <code>X-Behrio-Request-Id</code> شناسه درخواست را برمی‌گرداند.
          وضعیت‌های معتبر: <code>PAID</code>، <code>PENDING</code>، <code>COMPLETED</code> و <code>TEST</code> (برای تست).
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-fg">روش بدون کد (پیشنهادی)</h3>
        <p className="mt-1 text-sm text-muted">
          هیچ کدی روی سایت خود نصب نکنید. فقط در صفحه «پرداخت موفق» فروشگاه، مشتری
          را به آدرس زیر ریدایرکت کنید:
        </p>
        <code
          dir="ltr"
          className="mt-3 block overflow-x-auto rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg"
        >
          https://behrio.com/conversion/complete?orderId=ORDER-1001&amp;amount=250000
        </code>
        <p className="mt-3 text-sm leading-7 text-muted">
          <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">orderId</code> = شماره سفارش و{" "}
          <code dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg">amount</code> = مبلغ سفارش (ریال).
          نیازی به ارسال clickId یا کلید API نیست؛ Behrio از کوکی خودش تشخیص می‌دهد که
          این خرید متعلق به کدام خالق است.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">نمونه در صفحهٔ پرداخت موفق:</p>
        <pre
          dir="ltr"
          className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-4 text-xs leading-6 text-fg"
        >{`<!-- صفحه پرداخت موفق فروشگاه شما -->
<script>
  var o = new URLSearchParams(window.location.search);
  window.location.replace(
    "https://behrio.com/conversion/complete" +
    "?orderId=" + o.get("order_id") +
    "&amount=" + o.get("amount")
  );
</script>`}</pre>
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 p-4 text-xs leading-6 text-primary-soft">
          <p className="font-semibold text-primary-soft">خلاصه</p>
          <p className="mt-1">
            بعد از پرداخت، مشتری به Behrio ریدایرکت می‌شود، تبدیل ثبت و به خالقِ همان
            کلیک پرداخت می‌شود — بدون نصب کد و بدون کلید API.
          </p>
        </div>
      </Card>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      {notice && <p className="whitespace-pre-line text-sm font-medium text-primary-soft">{notice}</p>}
    </div>
  );
}
