-- Per-day starting quantities ("tomorrow we start with 10 sourdough"),
-- so capacity can be planned per date instead of only reacted to with
-- the all-or-nothing "sold out today" switch from
-- 0005_add_sold_out_on.sql. That switch stays: it's one tap for "this
-- batch is gone right now," while this table is for "here's what we
-- plan to have." Either one can sell an item out.
--
-- What this table does NOT store is the remaining count. Remaining is
-- derived at read time as start_quantity minus the quantities already
-- ordered for that date (api/src/lib/repositories/inventory.ts). Storing
-- a counter and decrementing it would mean two sources of truth for the
-- same fact, and they drift the first time an order is cancelled,
-- edited, or deleted — the orders are the truth, this is just the cap.
--
-- A (product, date) with no row here is UNLIMITED, not zero. That makes
-- this additive: every date the baker never touches keeps accepting
-- orders exactly as it does today, and forgetting to set numbers can
-- never silently close the shop.
--
-- Additive and safe to run before the code that reads it is deployed.
-- Run it on BOTH databases (production and preview).

create table if not exists daily_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  -- A calendar date, matching orders.requested_date — see
  -- specs/ENGINEERING_RULES.md "Date-only values". Never a timestamptz:
  -- "how many loaves on the 14th" is not an instant.
  inventory_date date not null,
  start_quantity integer not null check (start_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One cap per product per day. The upsert in
  -- repositories/inventory.ts's setStartQuantity relies on this
  -- constraint as its conflict target.
  unique (product_id, inventory_date)
);

-- Both access patterns: "the whole catalog's caps for one date" (the
-- admin's day view) and the unique constraint above covers lookups by
-- (product, date).
create index if not exists idx_daily_inventory_date on daily_inventory(inventory_date);

-- Remaining counts are computed by summing order_items for a given
-- requested_date, which has no index today — every order list and every
-- availability check filters on it.
create index if not exists idx_orders_requested_date on orders(requested_date);

create trigger daily_inventory_set_updated_at
  before update on daily_inventory
  for each row execute function set_updated_at();

-- Same fail-closed reasoning as the tables in 0001_init.sql: the app
-- reaches Supabase only with the service_role key, which bypasses RLS,
-- so enabling it with no policies costs nothing today and means this
-- table denies access rather than exposing the bakery's capacity plan
-- the moment anything ever queries it with the anon key.
alter table daily_inventory enable row level security;

notify pgrst, 'reload schema';
