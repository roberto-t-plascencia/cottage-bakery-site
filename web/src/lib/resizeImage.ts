/**
 * Shrinks a photo in the browser before it's uploaded, so a 5–10 MB phone
 * picture becomes a ~200–400 KB JPEG: fast on a phone connection and well
 * under the server's 4 MB limit. Menu cards show photos at most ~400 px
 * wide, so 1600 px on the long side leaves room for sharp high-DPI screens.
 */
export const MAX_PHOTO_SIDE = 1600;

/** The size to draw at: the long side capped at `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function resizeForUpload(file: Blob): Promise<Blob> {
  // "from-image" applies the photo's EXIF rotation, so phone pictures
  // don't come out sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't convert the photo.");
  return blob;
}
