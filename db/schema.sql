-- Schema for the cottage bakery ordering system.
--
-- Why hand-rolled SQL + node:sqlite instead of an ORM like Prisma: Prisma's
-- `generate`/`migrate` steps download a native query/schema-engine binary
-- from Prisma's CDN on first run. In a network-restricted environment
-- (locked-down CI, an offline build, this project's own sandboxed dev
-- environment) that download is blocked and there's no local fallback —
-- the whole toolchain is unusable until network access changes. Node 22
-- ships `node:sqlite` built in, so this app has zero database dependencies
-- to install, download, or compile. The cost: no migration-diffing tool,
-- so schema changes are hand-written SQL migrations (see db/migrate.ts) and
-- there's no generated TypeScript types, so those are hand-written too (see
-- src/lib/repositories/*.ts). For a single-table-family app run by one
-- developer, that's a fair trade. Full reasoning: docs/adr/0001-tech-stack.md.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  allergens TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fulfillment_method TEXT NOT NULL CHECK (fulfillment_method IN ('PICKUP', 'LOCAL_DELIVERY', 'IN_STATE_SHIPPING')),
  fulfillment_address TEXT,
  requested_date TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED')),
  subtotal_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL -- snapshot at order time, not a live FK to products.price_cents
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
