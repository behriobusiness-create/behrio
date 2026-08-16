import { randomBytes } from "node:crypto";
import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import { SupabaseStorageProvider } from "./supabase";
import { DbStorageProvider } from "./db";

export type { StorageProvider, UploadInput, UploadResult } from "./types";

let instance: StorageProvider | null = null;

export function buildProvider(): StorageProvider {
  const driver = (process.env.STORAGE_DRIVER || "db").toLowerCase();

  if (driver === "s3") {
    return new S3StorageProvider();
  }

  if (driver === "local") {
    return new LocalStorageProvider();
  }

  if (driver === "supabase") {
    return new SupabaseStorageProvider();
  }

  return new DbStorageProvider();
}

export function getStorage(): StorageProvider {
  if (!instance) {
    instance = buildProvider();
  }
  return instance;
}

export function resetStorageForTesting(): void {
  instance = null;
}

export function generateStorageKey(extension: string): string {
  return `${randomBytes(8).toString("hex")}${extension}`;
}