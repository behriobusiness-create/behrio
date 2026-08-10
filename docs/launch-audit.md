# گزارش ممیزی آمادگی دپلوی Behrio (MVP)

> ممیزی فقط-خواندنی. تاریخ: 2026-08-10

---

## 1. خلاصه مدیریتی — Executive Summary

| شاخص | وضعیت |
|---|---|
| بیلد (`next build`) | ✅ موفق |
| تایپ (`tsc --noEmit`) | ✅ پاک |
| لینت (`eslint`) | ⚠️ ۵ warning `<img>` (بدون error) |
| آمادگی لانچ | **~۶۰٪** |
| تصمیم | **NO-GO برای لانچ بلافاصله** — بعد از رفع ۵ بلاکر، GO به شرط تست محدود |

**بلاکرهای بحرانی (Critical Blockers):**
- C1. درگاه sandbox بدون گیت محیط → پول رایگان در پرود
- C2. کلاینت Prisma کامیت نشده + بدون `prisma generate` در build
- C3. نبود cron/automat برای تسویه خودکار کمپین (sweep فقط دستی)
- C4. توان ضعیف ضد بروتفورس در OTP تلفنی (۱۰۰۰ تلاش مجاز)
- C5. حافظهی `public/uploads` روی سرورلس (با هر دپلوی حذف میشود)

---

## 2. معماری و استک

- Next.js **16.2.x** (App Router، Turbopack) + React 19 + TypeScript 5
- Prisma **7.x** + `@prisma/adapter-pg` با اتصال مستقیم `DATABASE_URL` — `prisma.config.ts` + dotenv
- کلاینت تولیدشده در `app/generated/prisma` (در `.gitignore` — **باید در build تولید شود**)
- بدون Dockerfile/Procfile/vercel.json/CI
- `package.json` فقط اسکریپتهای dev/build/start/lint

---

## 3. احراز هویت — Auth

- **مکانیزم فعال:** `AuthSession` با توکن خام در کوکی `sessionToken` (httpOnly, sameSite=lax, secure=prod) + نگهداری SHA-256 هش در دیتابیس
- `getCurrentUser` چهار منبع را میخواند: کوکی `sessionToken`، کوکی `auth-session`، هدر `x-session-token`، هدر `Authorization: Bearer`
- **ریشهی 401 (تأییدشدهی زنده):** توکنهایی که در جدول legacy `Session` (فلوی Auth.js) نوشته شدهاند در `AuthSession` نیستند → کد 401 میدهد. با یک `AuthSession` معتبر، پاسخ `200` است. (`Session` فقط ۳ ردیف قدیمی دارد.)
- ورود: OTP موبایل/ایمیل، رمز عبور (scrypt N=16384, r=8, p=1)، Google OAuth (state چک میشود)
- کوکیهای سشن ۳۰ روز، `secure` فقط در پرود
- ⚠️ `AUTH_SECRET` ادعا شده ولی استفاده نمیشود (ادامه از فلو legacy)

---

## 4. مجوزدهی و کنترل دسترسی (Authorization)

- چکها route-level و عمدتاً سالم: برندهی کمپین (`businessId`)، `role`، وضعیت کاربر `ACTIVE`
- تأیید تبدیل/گزارش: فقط ADMIN یا صاحب کمپین (اصلی درست)
- بریدگی مالکیت در `fund`، `status`، `integration/*` تأیید شد
- ⚠️ جزئی: در `creator/campaigns` فقط `status: ACTIVE` فیلتر شده ولی `accessType` همهی مقادیر را برمیگرداند (OR هر سه) — یعنی همهی کمپینها برای همهی کریتورها قابل دیدناند.

---

## 5. دیتابیس — Schema

- مدلها: User, AuthSession (فعال) + Session (لگاسی)، Account, CreatorProfile, BusinessProfile, Campaign, CampaignApplication, CampaignReport, TrackingLink, Click, Conversion, LedgerEntry, Withdrawal, OtpCode, EmailOtp, BusinessApiKey, CampaignIntegration, ApiRequestLog
- **خوب:** constrainهای یکتایی مالی: `@@unique([campaignId, externalOrderId])`، `clickId @unique`، `code @unique`، `tokenHash @unique`
- ۹ مایگریشن موجود؛ `migration_lock.toml` سالم
- ⚠️ مدل `Session` بلااستفاده — بدون چک `prisma validate` روی تولید

---

## 6. یکپارچگی مالی — Wallet

**مفهوم:** موجودی کسبوکار = `funded (CAMPAIGN_FUNDING AVAILABLE/PROCESSING) − reserved (reservedAmount کمپینهای فعال/paused/draft)`. موجودی کریتور = `CREATOR_EARNING AVAILABLE − مجموع withdrawalهای REQUESTED/PROCESSING/COMPLETED`.

- تراکنشها با `SELECT ... FOR UPDATE` روی ردیف `User`/`Campaign`/`Withdrawal` انجام میشوند → ضد double-spend ✅
- `requestWithdrawal` قفل ردیفی + محاسبه مجدد موجودی داخل تراکنش ✅
- **C1 (بحرانی):** `POST /api/payments/sandbox` بدون هیچ گیت `NODE_ENV` اعتبار دلخواه اعطا میکند — هر کاربر لاگینشده در پرود میتواند نامحدود شارژ کند.

---

## 7. کمیسیون (مشخصات: ۵٪ کسبوکار / ۱۵٪ کریتور)

- ۵٪ کسبوکار: در `settleCampaign` هنگام COMPLETED — `PLATFORM_FEE AVAILABLE` با `referenceId` یکتا و `settledAt` ✅
- ۱۵٪ کریتور: در برداشت — `setWithdrawalFeeLedger` (PENDING → AVAILABLE/REVERSED) ✅
- **ناسازگاری:** مسیر خودکار تمامشدن بودجه از *گزارش نمایش* (CPM) کمپین را `CANCELLED` میکند و `settleCampaign` صدا نمیزند → **کارمزد ۵٪ شارژ نمیشود** (برخلاف مسیر conversion approve که COMPLETED میکند و تسویه را اجرا میکند).

---

## 8. چرخهی زندگی کمپین

- انتقال وضعیت: کسبوکار فقط DRAFT→PENDING_REVIEW | ACTIVE→PAUSED/COMPLETED | PAUSED→ACTIVE/COMPLETED؛ ادمین فقط PENDING_REVIEW→ACTIVE/CANCELLED
- شرط یکپارچهسازی VERIFIED برای فعالسازی اعمال میشود (البته همانند درخواستیِ خارج از تراکنش در یکی از مسیرها)
- `maybeAutoCloseCampaign`: COMPLETED خودکار با BUDGET/END/GOAL + تسویه
- **C3:** این فقط با فراخوانی دستی `POST /api/admin/commissions/settle` اجرا میشود — هیچ تایمر/cron/Vercel Cron وجود ندارد.

---

## 9. مارکتپلیس کریتور

- فیلتر: ACTIVE + بازهی زمانی + `budget > spentAmount` (فیلتر در JS)
- درخواست OPEN → خودکار APPROVED + ساخت tracking link
- **اخطار:** ظرفیت محدود نشده — یک کمپین با بودجهی باقیماندهی اندک میتواند کریتورهای بیشمار بپذیرد؛ پس از پر شدن بودجه، کریتورهای بعدی هم در همکاریاند ولی ممکن است پرداختی نگیرند.

---

## 10. رفرال / CPA / CPC (تجربی — حذف نشود، ممیزی شد)

- **کلیک `/t/[code]`:** dedup ۱۰ ثانیهای بر اساس IP، گروهبندی CPC/CPA با قفل ردیفی روی Campaign، ساخت batch پرداخت محدود به بودجه ✅
- **بدون redirect/پساز پرداخت** و فلو POSTBACK با کوکی `behrio_click_id` (ایمن، بدون تقلب کوکی چون به Click واقعی متصل است) ✅
- **`POST /api/conversions` بدون احراز هویت** — هرکسی با دانستن یک کد tracking link میتواند conversion ساخت؛ خطر مالی ندارد (PENDING نیاز به تأیید دارد) ولی پتانسیل اسپم/گیجی وجود دارد.
- تکراریزدایی تبدیل در سه لایه (unique constraint، چک دوگانه، catch P2002) ✅

---

## 11. برداشت پول

- درخواست: قفل ردیفی + موجودی کامل، ثبت `REQUESTED` و fee PENDING
- پردازش ادمین: APPROVE→COMPLETED + fee AVAILABLE | REJECT→FAILED + fee REVERSED — هر دو در تراکنش با قفل ردیفی ✅
- **بدون درگاه بانکی واقعی** — فرایند پرداخت خارج از پلتفرم انجام میشود (فرض MVP مستند).

---

## 12. امنیت Conversion API

- **مثبت:** SHA-256 هش کلید، بررسی revoked/expired/user status، تطبیق مالکیت کمپین، الزام VERIFIED، ثبت لاگ درخواست + IP-hash، پاسخ ثابت UNAUTHORIZED
- نبود rate limit مخصوص API (تکinstance و کلید) — با توجه به لاگ کامل و نیاز به کلید، ریسک متوسط
- نبود nonce/امضای request-time برای anti-replay فراتر از یکتایی orderId

---

## 13. OTP ایمیل

- **قوی:** scrypt، ۵ تلاش، ارسال مجدد کد قبلی را میسوزاند، limit: ۶/ایمیل/۱۰دقیقه، ۳۰/IP، verify 12/ایمیل ۶۰/IP
- بدون SMTP پیکربندیشده، کد فقط console میشود؛ در پرود هیچ ایمیلی نمیرود (ناسازگاری) — باید SMTP ست شود.

---

## 14. OTP تلفن + رمز عبور

- hash: `sha256(phone:code)` بدون salt
- ⚠️ **C4:** `SEND_OTP_LIMIT = 10000`، `VERIFY_LIMIT = 10000`، `MAX_ATTEMPTS = 1000` — عملاً بدون محافظت بروتفورس برای کد ۶ رقمی (فضای ۱M). حداقل باید MAX_ATTEMPTS ~5–10 شود و محدودیت IP واقعی.
- رمز عبور: حداقل ۸ کاراکتر، scrypt سالم، limit ۲۰/آیپی+ایمیل/۱۰دقیقه ✅

---

## 15. فرانتاند / UX

- صفحات: login, signup, onboarding, creator (dashboard/marketplace/wallet), business (dashboard/reports/conversions/applications/integration), admin (dashboard/campaigns/users/withdrawals/commissions/integrations/reports/conversions), settings, conversion/complete
- تمام UI فارسی/RTL. بدون ارور در build. ۵ warning `img` (غیربحرانی)

---

## 16. آمادگی تولید — Production Readiness

- ❌ بدون CI/CD، بدون Dockerfile/Procfile، بدون vercel.json
- ❌ بدون backup/restore، بدون monitoring (فقط `/api/health` سطحی)
- ❌ آپلود روی دیسک local (Vercel = ephemeral)
- ❌ بدون اتصال دامنه/HTTPS config (فقط assumption)
- ⚠️ rate limiter درونحافظهای Map — با چند instance ناهماهنگ

---

## 17. تستها

- فقط اسکریپتهای دستی `scripts/*.ts` (tsx) مانند test-email-otp، test-commissions، test-reports، test-cpc — بدون framework (jest/vitest)، بدون CI
- کیفیت اسکریپتها خوب و خود-تأییدهندهاند اما پوشش گپ دارد (Google OAuth، sandbox gate، rate-limit multi-instance)

---

## 18. ماتریس MVP

| ویژگی | وضعیت |
|---|---|
| CPM (گزارش نمایش) | ✅ کامل + تأیید/دریافت |
| CLIPPING | ✅ همان فلوی CPM |
| CPC (کلیک) | ✅ خودکار با dedup |
| CPA (تبدیل) | ✅ POSTBACK + API |
| AFFILIATE (درصد) | ✅ |
| کیف پول / برداشت کریتور | ✅ |
| شارژ کسبوکار | ⚠️ فقط sandbox |
| کمیسیون ۵/۱۵٪ | ⚠️ ناسازگاری CPM |

---

## 19. نقشه راه (Roadmap)

1. **قبل از لانچ:** گیت محیطی sandbox، `prisma generate`+`migrate deploy` در build، cron تسویه، سفتکردن OTP تلفن، استوریج پایدار آپلود، SMTP
2. **هفتهی اول پس از لانچ:** درگاه پرداخت واقعی، فلو برداشت بانکی، CI + تست framework
3. **میانمدت:** 2FA، اسکوپ CSP، rate limit توزیعشده، لاگ/گزارش تقلب

---

## 20. فهرست ۱۰ اصلاح برتر

1. گیت `NODE_ENV !== "production"` برای `/api/payments/sandbox` (یا حذف)
2. افزودن `"postinstall": "prisma generate"` و `"build": "prisma generate && next build"` + اجرای `prisma migrate deploy` در دپلوی
3. cron (Vercel Cron/cron.yaml) برای `runAutoCloseSweep`
4. کاهش `MAX_ATTEMPTS` به ۵–۱۰ و `SEND/VERIFY_LIMIT` برای تلفن + هش کد با salt
5. جابهجایی آپلود به استوریج آبنما (S3/Blob) با URL یکتا و صدور دسترسی
6. همسوسازی وضعیت CPM در تمامشدن بودجه (COMPLETED + settleCampaign) یا شارژ کارمزد CPM
7. rate limit توزیعشده (Redis/Upstash) یا پذیرش تکinstance با مستندسازی
8. محدودکردن `POST /api/conversions` به احراز هویت یا cap-rate قوی
9. پیکربندی SMTP واقعی و fail-explorشفاف وقتی ایمیل نمیرود
10. CI (GitHub Actions: lint+tsc+build+prisma validate) و Dockerfile برای دپلوی غیر-Vercel

---

## 21. تصمیم نهایی — GO / NO-GO

**NO-GO برای لانچ عمومی بلافاصله.**

- بلاکر C1 (پول رایگان) و C2 (بیلد روی کلون تازه) حتماً باید قبل از هر دپلوی رفع شوند.
- C4 به لحاظ امنیتی مبلغساز است و باید قبل از ثبتنام باز سفت شود.
- برای **لانچ محدود/بتا** با رفع C1، C2 و سفتکردن OTP قابل پذیرش است.

---

## 22. گزارش رفع بلاکرها — پس از اصلاح (2026-08-10)

| مورد | وضعیت | اقدام |
|---|---|---|
| C1. گیت محیطی sandbox | ✅ **FIXED** | `lib/env.ts` + `isProduction()` در ابتدای `POST /api/payments/sandbox` → 403 در پرود پیش از auth/هزینه |
| C2. `prisma generate` در build | ✅ **FIXED** | `build: "prisma generate && next build"`، `postinstall: "prisma generate"`، `db:*` اسکریپتها |
| C3. cron تسویه خودکار | ✅ **FIXED** | `app/api/cron/settlement/route.ts` با Bearer `CRON_SECRET` + `vercel.json` `*/15 * * * *` |
| C4. بروتفورس OTP تلفن | ✅ **FIXED** | `lib/auth/otp.ts` با scrypt نمکی، `MAX_OTP_ATTEMPTS=5`، محدودیت IP/شناسه، سوزاندن کد قبلی |
| C5. استوریج پایدار | ✅ **FIXED** | `lib/storage/{types,local,s3,index}.ts` + route آپلود از `getStorage()`؛ S3 با presigned URL |
| C6. ناسازگاری کمیسیون CPM | ✅ **FIXED** | گزارش نمایش تمامبودجه → `COMPLETED` + `reservedAmount` + `settleCampaign` (کارمزد ۵٪) |
| C7. ظرفیت مارکتپلیس | ✅ **FIXED** | `lib/campaign/capacity.ts` + قفل ردیفی در apply و هر دو مسیر APPROVE کسبوکار |
| C8. `/api/conversions` بدون auth | ✅ **FIXED** | auth اجباری + مالکیت tracking link + rate limit؛ API-key route rate limit هم اضافه شد |
| C9. SMTP | ✅ **FIXED** | `lib/mail.ts` قبلاً degradable بود؛ تأیید شد + سند env |
| C10. rate limit توزیعشده | ✅ **FIXED** | `lib/rate-limit.ts` اکنون async با backend memory/redis (`RATE_LIMITER_DRIVER`، Upstash اختیاری) |
| C11. CI | ✅ **FIXED** | `.github/workflows/ci.yml` (npm ci, prisma validate, generate, typecheck, lint, build) |
| C12. محیط | ✅ **FIXED** | `.env.example` کامل (CRON_SECRET, STORAGE_*, RATE_LIMITER_DRIVER) و `.gitignore` الگوی env را باز میکند |

### تأییدات نهایی
- `prisma validate` ✅ · `prisma generate` ✅ · `tsc --noEmit` ✅ · `eslint` 0 error ✅ · `next build` ✅
- `scripts/test-launch-regression.ts` (۱۵ تست: sandbox gate, OTP, capacity, API key, نرخ کمیسیون) — **همه ✅**

### نکات باقیمانده (غیربلاکر)
- پول اتصال همزمان محلی: پروکسی Prisma Postgres dev با `connection_limit=10`؛ پیکربندی pool در `lib/prisma.ts` (max=10, timeout) افزوده شد. در تولید با Prisma Postgres ابری/Postgres واقعی باید `DATABASE_POOL_MAX` متناسب ست شود.
- `Session` لگاسی در دیتابیس باقی است ولی هیچ کدی به آن نمینویسد؛ حذف مدل/مایگریشن در پاکسازی آینده.
- CRON_SECRET را در Vercel ست کنید؛ بدون آن cron برگشت 401 میدهد.

### تصمیم بهروزشده
برای **لانچ محدود/بتا**: ✅ **GO** — به شرط ستشدن `CRON_SECRET`، SMTP و بررسی نهایی در پرود (gate سندباکس در NODE_ENV=production، کد OTP فقط از طریق ایمیل، آپلود به S3).