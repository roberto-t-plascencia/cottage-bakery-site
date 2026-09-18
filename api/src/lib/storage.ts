import { supabase } from "./supabase";

/**
 * Product photos live in a public Supabase Storage bucket named
 * "product-images" — public because a bakery's menu photos are marketing
 * material, not sensitive data, so a signed-URL scheme would be
 * complexity with no security benefit here. Create the bucket once in the
 * Supabase dashboard (Storage → New bucket → "product-images" → Public)
 * or via the CLI; see README.md "Supabase setup".
 */
const PRODUCT_IMAGES_BUCKET = "product-images";

/**
 * Uploads a product photo and returns its public URL — the same string
 * that gets stored directly in products.image_url (see
 * supabase/migrations/0001_init.sql). Storing the resolved public URL
 * rather than a bare object path means every read site (ProductCard, the
 * admin dashboard, order confirmation) just renders `product.imageUrl`
 * with no extra resolution step.
 */
export async function uploadProductImage(
  file: File | Blob,
  filename: string
): Promise<string> {
  const path = `${Date.now()}-${filename}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(`Failed to upload product image: ${error.message}`);
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductImage(publicUrl: string): Promise<void> {
  const marker = `/${PRODUCT_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // not a URL from our bucket — nothing to do

  const path = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Failed to delete product image: ${error.message}`);
  }
}
