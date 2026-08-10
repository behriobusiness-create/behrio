import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  getEmailOtpExpiry,
  hashEmailOtp,
  isEmailOtpExpired,
  verifyEmailOtp,
} from "../lib/auth/email-otp";

const BASE = "http://localhost:3000";

async function post(
  path: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function createFreshOtp(email: string, code: string): Promise<void> {
  await prisma.emailOtp.create({
    data: {
      email,
      codeHash: await hashEmailOtp(code),
      expiresAt: getEmailOtpExpiry(),
    },
  });
}

function pass(name: string): boolean {
  console.log(`✅ ${name}`);
  return true;
}

function fail(name: string, detail?: unknown): boolean {
  console.log(`❌ ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  return false;
}

async function main() {
  let allOk = true;
  const suffix = `${Date.now()}${randomBytes(3).toString("hex")}`;
  const users: string[] = [];

  console.log("── Unit: email-otp helpers ──");
  {
    const code = "481516";
    const hash = await hashEmailOtp(code);

    const roundtrip = await verifyEmailOtp(code, hash);
    allOk = roundtrip ? pass("hash roundtrip") : (fail("hash roundtrip"), allOk);

    const wrong = await verifyEmailOtp("000000", hash);
    allOk = wrong ? (fail("wrong code rejected"), false) : (pass("wrong code rejected"), allOk);

    const expiry = getEmailOtpExpiry();
    const notExpired = !isEmailOtpExpired(expiry);
    const expired = isEmailOtpExpired(new Date(Date.now() - 1000));
    allOk = notExpired && expired
      ? pass("expiry semantics")
      : (fail("expiry semantics", { notExpired, expired }), allOk);
  }

  console.log("\n── request-otp ──");
  {
    const invalid = await post("/api/auth/email/request-otp", { email: "nope" });
    allOk = invalid.status === 400
      ? pass("invalid email -> 400")
      : (fail(`invalid email -> ${invalid.status}`), allOk);

    const email = `req-otp-${suffix}@test.local`;

    const sent = await post("/api/auth/email/request-otp", { email });
    const row = await prisma.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    allOk = sent.status === 200 && row !== null
      ? pass("send success creates row")
      : (fail("send success creates row", { status: sent.status, row }), allOk);

    const devLeak = "devCode" in sent.body;
    allOk = !devLeak
      ? pass("no devCode in response")
      : (fail("response leaks devCode"), allOk);

    const resent = await post("/api/auth/email/request-otp", { email });
    const alive = await prisma.emailOtp.count({ where: { email, usedAt: null } });
    allOk = resent.status === 200 && alive === 1
      ? pass("resend invalidates previous code")
      : (fail("resend invalidates previous code", { status: resent.status, alive }), allOk);

    const rateEmail = `ratelimit-${suffix}@example.com`;
    let atIdx = -1;
    for (let i = 0; i < 7; i++) {
      const r = await post("/api/auth/email/request-otp", { email: rateEmail });
      if (r.status === 429) {
        atIdx = i;
        break;
      }
    }
    allOk = atIdx === 6
      ? pass(`email rate limit -> 429 on 7th (idx ${atIdx})`)
      : (fail("email rate limit", { atIdx }), allOk);
  }

  console.log("\n── verify-otp ──");
  {
    const emailW = `verify-${suffix}@example.com`;
    await createFreshOtp(emailW, "654321");
    await post("/api/auth/email/verify-otp", { email: emailW, code: "000000", mode: "signup" });
    const rowW = await prisma.emailOtp.findFirst({ where: { email: emailW } });
    allOk = rowW?.attempts === 1
      ? pass("wrong code increments attempts")
      : (fail("wrong code increments attempts", { attempts: rowW?.attempts }), allOk);

    const emailOk = `ok-${suffix}@example.com`;
    await createFreshOtp(emailOk, "654321");
    const rOk = await post("/api/auth/email/verify-otp", {
      email: emailOk,
      code: "654321",
      mode: "signup",
    });
    const userOk = await prisma.user.findUnique({ where: { email: emailOk } });
    allOk = rOk.status === 200 && rOk.body.ok === true && userOk !== null
      ? pass("signup verify -> user + ok 200")
      : (fail("signup verify", { status: rOk.status, body: rOk.body }), allOk);
    if (userOk) {
      users.push(userOk.id);
    }

    const sessions = userOk
      ? await prisma.authSession.count({ where: { userId: userOk.id } })
      : 0;
    allOk = sessions === 1
      ? pass("session created")
      : (fail("session created", { sessions }), allOk);

    const again = await post("/api/auth/email/verify-otp", {
      email: emailOk,
      code: "654321",
      mode: "signup",
    });
    allOk = again.status === 400
      ? pass("code single use")
      : (fail("code single use", { status: again.status }), allOk);

    const emailExp = `exp-${suffix}@example.org`;
    await prisma.emailOtp.create({
      data: {
        email: emailExp,
        codeHash: await hashEmailOtp("111111"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const rExp = await post("/api/auth/email/verify-otp", {
      email: emailExp,
      code: "111111",
      mode: "signup",
    });
    allOk = rExp.status === 400
      ? pass("expired code rejected")
      : (fail("expired code rejected", { status: rExp.status }), allOk);

    const emailAtt = `att-${suffix}@example.net`;
    await createFreshOtp(emailAtt, "777777");
    let got429 = false;
    for (let i = 0; i < 6; i++) {
      const r = await post("/api/auth/email/verify-otp", {
        email: emailAtt,
        code: "000000",
        mode: "signup",
      });
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    allOk = got429
      ? pass("attempts exhaustion -> 429")
      : (fail("attempts exhaustion"), allOk);
  }

  console.log("\n── cleanup ──");
  const otpEmails = [
    `req-otp-${suffix}@example.local`,
    `ratelimit-${suffix}@example.com`,
    `verify-${suffix}@example.com`,
    `ok-${suffix}@example.com`,
    `exp-${suffix}@example.org`,
    `att-${suffix}@example.net`,
  ];
  await prisma.emailOtp.deleteMany({ where: { email: { in: otpEmails } } });
  const userSessions = await prisma.user.findMany({
    where: { email: { in: otpEmails } },
    select: { id: true },
  });
  await prisma.authSession.deleteMany({
    where: { userId: { in: userSessions.map((u) => u.id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  console.log("cleanup done");

  console.log(allOk ? "\nALL TESTS PASSED ✅" : "\nSOME TESTS FAILED ❌");
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());