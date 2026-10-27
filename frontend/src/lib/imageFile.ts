export const IMAGE_MAX_BYTES = 250 * 1024;
export const IMAGE_TYPE_RE = /^image\/(png|jpe?g|webp)$/i;

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function imageFileToDataUrl(file: File, tooBig = 'Foto até 250 KB.') {
  if (!IMAGE_TYPE_RE.test(file.type)) throw new Error('Use PNG, JPEG ou WebP.');
  if (file.size > IMAGE_MAX_BYTES) throw new Error(tooBig);
  return readFileAsDataUrl(file);
}
