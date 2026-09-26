import { supabase } from "../supabase";
import { bakeryToday } from "../cart";
import type { NewProduct, Product } from "../types";

// Also used by ./orders.ts for the product embedded in each order item.
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_url: string | null;
  allergens: string;
  ingredients: string;
  net_weight: string;
  is_active: boolean;
  sold_out_on: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    imageUrl: row.image_url,
    allergens: row.allergens,
    ingredients: row.ingredients,
    netWeight: row.net_weight,
    isActive: row.is_active,
    soldOutOn: row.sold_out_on,
    soldOutToday: row.sold_out_on !== null && row.sold_out_on === bakeryToday(),
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

/**
 * Marks a product sold out for the given bakery date, or clears it
 * (null). Returns null when no product has that id.
 */
export async function setProductSoldOutOn(id: string, date: string | null): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .update({ sold_out_on: date })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`setProductSoldOutOn: ${error.message}`);
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
        ingredients: product.ingredients,
        net_weight: product.netWeight,
        is_active: product.isActive,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertProductBySlug: ${error.message}`);
  return rowToProduct(data as ProductRow);
}
