import { createClient } from "@supabase/supabase-js";
import type { StorageProvider, UploadInput, UploadResult } from "./types";

const DEFAULT_BUCKET = "reports";

function requireString(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

export class SupabaseStorageProvider implements StorageProvider {
  private url: string;
  private serviceKey: string;
  private bucket: string;
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.url = requireString("SUPABASE_URL").replace(/\/$/, "");
    this.serviceKey = requireString("SUPABASE_SERVICE_ROLE_KEY");
    this.bucket = process.env.STORAGE_BUCKET || DEFAULT_BUCKET;

    this.client = createClient(this.url, this.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  private publicUrl(key: string): string {
    return `${this.url}/storage/v1/object/public/${this.bucket}/${key}`;
  }

  private async ensureBucket(): Promise<void> {
    const { data: buckets } = await this.client.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === this.bucket);
    if (exists) return;

    await this.client.storage.createBucket(this.bucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    await this.ensureBucket();

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.key, input.data, {
        contentType: input.mimeType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (error) {
      throw error;
    }

    return {
      url: this.publicUrl(input.key),
      key: input.key,
    };
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) {
      throw error;
    }
  }

  async getReadUrl(key: string): Promise<string> {
    return this.publicUrl(key);
  }
}