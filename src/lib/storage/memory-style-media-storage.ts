import type { StyleMediaStorage } from './types';

export function createMemoryStyleMediaStorage(): StyleMediaStorage {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const key = (bucket: string, path: string) => `${bucket}/${path}`;
  const dataUrl = (bucket: string, path: string) => {
    const object = objects.get(key(bucket, path));
    if (!object) throw new Error('style_media_not_found');
    return `data:${object.contentType};base64,${Buffer.from(object.bytes).toString('base64')}`;
  };

  return {
    async uploadOriginal({ bucket, path, bytes, contentType }) {
      objects.set(key(bucket, path), { bytes: new Uint8Array(bytes), contentType });
    },

    async downloadOriginal(bucket, path) {
      const original = objects.get(key(bucket, path));
      if (!original) throw new Error('style_media_download_failed');
      return new Uint8Array(original.bytes);
    },

    async publishCopy({ originalBucket, originalPath, publishedBucket, publishedPath, contentType }) {
      const original = objects.get(key(originalBucket, originalPath));
      if (!original) throw new Error('style_media_download_failed');
      objects.set(key(publishedBucket, publishedPath), {
        bytes: new Uint8Array(original.bytes),
        contentType,
      });
    },

    async remove(bucket, path) {
      objects.delete(key(bucket, path));
    },

    publicUrl(bucket, path) {
      if (bucket === 'external' || path.startsWith('http')) return path;
      return dataUrl(bucket, path);
    },

    async privatePreviewUrl(bucket, path) {
      if (bucket === 'external' || path.startsWith('http')) return path;
      return dataUrl(bucket, path);
    },
  };
}
