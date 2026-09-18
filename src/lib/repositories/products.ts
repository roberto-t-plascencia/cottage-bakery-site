import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { NewProduct, Product } from "@/lib/types";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_url: string | null;
  allergens: string;
  is_active: number;
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
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listActiveProducts(): Product[] {
  const rows = db
    .prepare(
      `SELECT * FROM products WHERE is_active = 1 ORDER BY category ASC, name ASC`
    )
    .all() as ProductRow[];
  return rows.map(rowToProduct);
}

export function findProductsByIds(ids: string[]): Product[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`
    )
    .all(...ids) as ProductRow[];
  return rows.map(rowToProduct);
}

export function getProductById(id: string): Product | null {
  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as
    | ProductRow
    | undefined;
  return row ? rowToProduct(row) : null;
}

/** Insert-or-update by slug — used by db/seed.ts, safe to re-run. */
export function upsertProductBySlug(product: NewProduct): Product {
  const existing = db
    .prepare(`SELECT * FROM products WHERE slug = ?`)
    .get(product.slug) as ProductRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE products
       SET name = ?, description = ?, price_cents = ?, category = ?,
           image_url = ?, allergens = ?, is_active = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(
      product.name,
      product.description,
      product.priceCents,
      product.category,
      product.imageUrl,
      product.allergens,
      product.isActive ? 1 : 0,
      existing.id
    );
    return getProductById(existing.id)!;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO products (id, slug, name, description, price_cents, category, image_url, allergens, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    product.slug,
    product.name,
    product.description,
    product.priceCents,
    product.category,
    product.imageUrl,
    product.allergens,
    product.isActive ? 1 : 0
  );
  return getProductById(id)!;
}
