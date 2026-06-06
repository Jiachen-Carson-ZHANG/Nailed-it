import 'server-only';
import { getServiceClient } from '@/lib/db/client';
import type { StyleMediaStorage } from './types';

export const merchantStyleOriginalsBucket = 'merchant-style-originals';
export const merchantStylePublishedBucket = 'merchant-style-published';

export function createSupabaseStyleMediaStorage(): StyleMediaStorage {
  return {
    async uploadOriginal({ bucket, path, bytes, contentType }) {
      const { error } = await getServiceClient().storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error(`style_media_upload_failed: ${error.message}`);
    },

    async downloadOriginal(bucket, path) {
      const { data, error } = await getServiceClient().storage.from(bucket).download(path);
      if (error) throw new Error(`style_media_download_failed: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async publishCopy({
      originalBucket,
      originalPath,
      publishedBucket,
      publishedPath,
      contentType,
    }) {
      const { data, error: downloadError } = await getServiceClient().storage
        .from(originalBucket)
        .download(originalPath);
      if (downloadError) throw new Error(`style_media_download_failed: ${downloadError.message}`);

      const bytes = new Uint8Array(await data.arrayBuffer());
      const { error: uploadError } = await getServiceClient().storage
        .from(publishedBucket)
        .upload(publishedPath, bytes, { contentType, upsert: false });
      if (uploadError) throw new Error(`style_media_publish_failed: ${uploadError.message}`);
    },

    async remove(bucket, path) {
      if (bucket === 'external' || path.startsWith('http')) return;
      const { error } = await getServiceClient().storage.from(bucket).remove([path]);
      if (error) throw new Error(`style_media_remove_failed: ${error.message}`);
    },

    publicUrl(bucket, path) {
      if (bucket === 'external' || path.startsWith('http')) return path;
      return getServiceClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },

    async privatePreviewUrl(bucket, path) {
      if (bucket === 'external' || path.startsWith('http')) return path;
      const { data, error } = await getServiceClient().storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw new Error(`style_media_preview_failed: ${error.message}`);
      return data.signedUrl;
    },
  };
}
