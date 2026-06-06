export type UploadOriginalInput = {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
};

export type PublishCopyInput = {
  originalBucket: string;
  originalPath: string;
  publishedBucket: string;
  publishedPath: string;
  contentType: string;
};

export interface StyleMediaStorage {
  uploadOriginal(input: UploadOriginalInput): Promise<void>;
  downloadOriginal(bucket: string, path: string): Promise<Uint8Array>;
  publishCopy(input: PublishCopyInput): Promise<void>;
  remove(bucket: string, path: string): Promise<void>;
  publicUrl(bucket: string, path: string): string;
  privatePreviewUrl(bucket: string, path: string): Promise<string>;
}
