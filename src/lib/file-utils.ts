export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.split(',')[1] ?? '';
      if (!base64) reject(new Error('Failed to read file'));
      else resolve(base64);
    });
    reader.addEventListener('error', () => reject(new Error('Failed to read file')));
    reader.readAsDataURL(file);
  });
}
