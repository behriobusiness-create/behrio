import { prisma } from "@/lib/prisma";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const ab = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  return new Uint8Array(ab);
}

export class DbStorageProvider implements StorageProvider {
  async upload(input: UploadInput): Promise<UploadResult> {
    const bytes = toBytes(input.data);

    await prisma.storedFile.upsert({
      where: { key: input.key },
      update: {
        data: bytes,
        mimeType: input.mimeType,
        size: input.data.length,
      },
      create: {
        key: input.key,
        data: bytes,
        mimeType: input.mimeType,
        size: input.data.length,
      },
    });

    return {
      url: `/api/files/${input.key}`,
      key: input.key,
    };
  }

  async delete(key: string): Promise<void> {
    await prisma.storedFile.deleteMany({ where: { key } });
  }

  async getReadUrl(key: string): Promise<string> {
    return `/api/files/${key}`;
  }
}