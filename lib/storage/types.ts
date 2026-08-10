export interface UploadInput {
  data: Buffer;
  mimeType: string;
  extension: string;
  key: string;
}

export type UploadResult = {
  url: string;
  key: string;
};

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getReadUrl(key: string): Promise<string>;
}