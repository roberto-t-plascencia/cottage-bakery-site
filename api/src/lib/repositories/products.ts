import { supabase } from "../supabase";
import type { NewProduct, Product } from "../types";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_url: string | null;
  allergens: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    imageUrl: row.image_url,
    allergens: row.allergens,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`listActiveProducts: ${error.message}`);
  return (data as ProductRow[]).map(rowToProduct);
}

export async function findProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);

  if (error) throw new Error(`findProductsByIds: ${error.message}`);
  return (data as ProductRow[]).map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getProductById: ${error.message}`);
  return data ? rowToProduct(data as ProductRow) : null;
}

/** Insert-or-update by slug — used by db/seed.ts, safe to re-run. */
export async function upsertProductBySlug(product: NewProduct): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .upsert(
      {
        slug: product.slug,
        name: product.name,
        description: product.description,
        price_cents: product.priceCents,
        category: product.category,
        image_url: product.imageUrl,
        allergens: product.allergens,
        is_active: product.isActive,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertProductBySlug: ${error.message}`);
  return rowToProduct(data as ProductRow);
}
