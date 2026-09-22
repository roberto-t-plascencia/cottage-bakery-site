-- Adds payment tracking to orders, for ADR 0006 (online payment via
-- PayPal Checkout). Before this, every order was paid manually (cash,
-- Venmo, Zelle) outside the system entirely, so there was nothing to
-- track — an order's `status` said nothing about whether it had been
-- paid. Payment is a separate concern from fulfillment status: a
-- PayPal-paid order still moves through PENDING -> CONFIRMED -> READY ->
-- COMPLETED like any other order, and payment_status just answers "did
-- money already move for this order," independent of that.

create type payment_method as enum ('MANUAL', 'PAYPAL');
create type payment_status as enum ('UNPAID', 'PAID');

alter table orders
  add column if not exists payment_method payment_method not null default 'MANUAL',
  add column if not exists payment_status payment_status not null default 'UNPAID',
  -- PayPal's own order id for this order, once a PayPal Checkout has
  -- been started — set as soon as the PayPal order is created (see
  -- api/src/lib/paypal.ts), not only on a successful capture, so an
  -- abandoned or failed payment still leaves a trail back to PayPal's
  -- side for support/debugging, and so the capture-webhook (see
  -- api/src/routes/webhooks.ts) can look an order back up by it.
  add column if not exists paypal_order_id text;

create index if not exists idx_orders_paypal_order_id on orders(paypal_order_id);
