import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export const MAX_EMAIL_OTP_ATTEMPTS = 5;

function deriveKey(code: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export function generateEmailOtp(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export async function hashEmailOtp(code: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(code, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyEmailOtp(
  code: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash.startsWith("scrypt:")) {
    return false;
  }

  const [, salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const key = await deriveKey(code, salt);
  const storedKey = Buffer.from(hashHex, "hex");

  return (
    storedKey.length === key.length && timingSafeEqual(storedKey, key)
  );
}

export function getEmailOtpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_SECONDS * 1000);
}

export function isEmailOtpExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}