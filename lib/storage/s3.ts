import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

function requireString(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private baseUrl: string | null;

  constructor() {
    this.bucket = requireString("STORAGE_BUCKET");
    this.region = process.env.STORAGE_REGION || "auto";
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
    const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;

    if (!accessKey || !secretKey) {
      throw new Error(
        "STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required for S3 storage."
      );
    }

    this.client = new S3Client({
      region: this.region,
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    this.baseUrl = process.env.STORAGE_PUBLIC_BASE_URL || null;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.data,
        ContentType: input.mimeType,
      })
    );

    return {
      url: await this.getReadUrl(input.key),
      key: input.key,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getReadUrl(key: string): Promise<string> {
    if (this.baseUrl) {
      return `${this.baseUrl.replace(/\/$/, "")}/${key}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 }
    );
  }
}