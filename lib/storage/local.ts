import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

export class LocalStorageProvider implements StorageProvider {
  private dir: string;

  constructor(dir: string = path.join(process.cwd(), "public", "uploads")) {
    this.dir = dir;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }

    const filePath = path.join(this.dir, input.key);
    await writeFile(filePath, input.data);

    return {
      url: `/uploads/${input.key}`,
      key: input.key,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.dir, key);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  async getReadUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }
}