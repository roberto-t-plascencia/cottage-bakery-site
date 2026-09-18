-- Initial schema for the cottage bakery ordering system, on Supabase
-- Postgres. Mirrors the shape of the earlier node:sqlite schema (see
-- docs/adr/0001-tech-stack.md for the full history of why this app's
-- database layer changed twice), translated to Postgres idioms: real
-- enum types instead of CHECK-constrained text, uuid primary keys with
-- server-side generation, timestamptz instead of hand-formatted ISO
-- strings, and a trigger for updated_at instead of doing it in app code.
--
-- Apply this via the Supabase SQL Editor (paste + run), or with the
-- Supabase CLI: `supabase db push`. See README.md "Supabase setup".

create extension if not exists pgcrypto;

create type order_status as enum ('PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED');
create type fulfillment_method as enum ('PICKUP', 'LOCAL_DELIVERY', 'IN_STATE_SHIPPING');

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  category text not null,
  -- Full public URL into the "product-images" Storage bucket (see
  -- src/lib/storage.ts), not a bare storage path — kept as a plain URL so
  -- the app never has to think about signing/resolving it at read time.
  image_url text,
  allergens text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  fulfillment_method fulfillment_method not null,
  fulfillment_address text,
  requested_date date not null,
  notes text,
  status order_status not null default 'PENDING',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
  -- Snapshot of price at order time, not a live FK to products.price_cents
  -- — a later price change must never retroactively change a past order's
  -- total. Same invariant as the earlier sqlite schema, same reason.
);

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_orders_status on orders(status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- The app talks to Supabase exclusively through the service_role key, from
-- server-side code only (see docs/adr/0001-tech-stack.md) — that key
-- bypasses RLS by design, so these policies aren't what's protecting data
-- today. They're here so the table fails closed rather than open the
-- moment anything ever queries these tables with the anon key (a future
-- client-side feature, a debugging session against the API URL directly,
-- a copy-pasted example from Supabase's own docs) — "no policies defined"
-- on an RLS-enabled table means "no access," which is the safe default to
-- have already been sitting there instead of retrofitted after an
-- incident.
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Inserting/updating an order and its line items has to be atomic — a
-- half-written order (order row present, items missing, or vice versa)
-- is a corrupt order, not a partial one. PostgREST (what supabase-js talks
-- to) doesn't expose ad-hoc multi-table transactions over its REST API,
-- so this is done as a single Postgres function instead: a function body
-- runs in one implicit transaction, so either both inserts land or
-- neither does. `security definer` lets it write to `orders`/`order_items`
-- under RLS regardless of which role calls it; `set search_path` pins
-- name resolution inside the function so it can't be hijacked by a
-- caller-controlled search_path.
create or replace function create_order_with_items(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_fulfillment_method fulfillment_method,
  p_fulfillment_address text,
  p_requested_date date,
  p_notes text,
  p_subtotal_cents integer,
  p_items jsonb -- [{ "product_id": uuid, "quantity": int, "unit_price_cents": int }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  insert into orders (
    customer_name, customer_email, customer_phone, fulfillment_method,
    fulfillment_address, requested_date, notes, subtotal_cents
  )
  values (
    p_customer_name, p_customer_email, p_customer_phone, p_fulfillment_method,
    p_fulfillment_address, p_requested_date, p_notes, p_subtotal_cents
  )
  returning id into v_order_id;

  insert into order_items (order_id, product_id, quantity, unit_price_cents)
  select
    v_order_id,
    (item ->> 'product_id')::uuid,
    (item ->> 'quantity')::integer,
    (item ->> 'unit_price_cents')::integer
  from jsonb_array_elements(p_items) as item;

  return v_order_id;
end;
$$;
