-- Adds a delivery fee to orders, for docs/adr/0008-delivery-fee.md: a
-- flat fee on LOCAL_DELIVERY orders below a free-delivery threshold.
-- The fee is computed by api/ (src/lib/fees.ts), never by the client,
-- and stored per order so a later change to the fee rule never rewrites
-- what an existing order was charged.
--
-- Written to be safe to run while the previous api/ deploy is still
-- live (Preview and Production share this database):
--   * the column defaults to 0, so rows inserted by the old code are
--     valid, zero-fee orders;
--   * the RPC's new parameter defaults to 0 as well, so the old code's
--     call (which doesn't pass it) still resolves to this function.
-- So: run this first, then deploy the code that passes the fee.

alter table orders
  add column if not exists delivery_fee_cents integer not null default 0
    check (delivery_fee_cents >= 0);

-- A new parameter means a new signature, which `create or replace`
-- can't do in place: drop the old one, then create the new one. Same
-- body as 0001_init.sql plus the fee column.
drop function if exists create_order_with_items(
  text, text, text, fulfillment_method, text, date, text, integer, jsonb
);

create function create_order_with_items(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_fulfillment_method fulfillment_method,
  p_fulfillment_address text,
  p_requested_date date,
  p_notes text,
  p_subtotal_cents integer,
  p_items jsonb, -- [{ "product_id": uuid, "quantity": int, "unit_price_cents": int }, ...]
  p_delivery_fee_cents integer default 0
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
    fulfillment_address, requested_date, notes, subtotal_cents,
    delivery_fee_cents
  )
  values (
    p_customer_name, p_customer_email, p_customer_phone, p_fulfillment_method,
    p_fulfillment_address, p_requested_date, p_notes, p_subtotal_cents,
    p_delivery_fee_cents
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

-- Tell PostgREST (Supabase's API layer) to pick up the new signature
-- right away instead of on its next schema-cache refresh.
notify pgrst, 'reload schema';
