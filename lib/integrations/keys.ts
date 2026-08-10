import { createHash, randomBytes, randomInt } from "node:crypto";

const PREFIX = "br_live_";
const KEY_BYTES = 24;
const CLICK_PREFIX = "clk_";
const TEST_CLICK_PREFIX = "test_clk_";
const REQUEST_PREFIX = "req_";

export function generateApiKey(): string {
  return PREFIX + randomBytes(KEY_BYTES).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyPrefixOf(key: string): string {
  return key.slice(0, PREFIX.length + 8);
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return "****";
  return `${key.slice(0, 9)}${"*".repeat(Math.max(4, key.length - 13))}${key.slice(-4)}`;
}

export function generateClickId(test = false): string {
  return (test ? TEST_CLICK_PREFIX : CLICK_PREFIX) + randomBytes(12).toString("hex");
}

export function isTestClickId(id: string): boolean {
  return id.startsWith(TEST_CLICK_PREFIX);
}

export function generateRequestId(): string {
  return REQUEST_PREFIX + randomBytes(10).toString("base64url");
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
