-- "Sold out today" switch for the admin dashboard. Stores the bakery
-- date the product sold out on, not a boolean: a product is sold out
-- only while sold_out_on equals today's date in America/Los_Angeles, so
-- it comes back on its own at midnight with no scheduled job to reset it.
-- Orders for later dates are unaffected. See docs/adr/0009-sold-out-today.md.
--
-- Additive and nullable, so it's safe to run before or after the code
-- that reads it is deployed. Run it on BOTH databases (production and
-- preview).

alter table products add column if not exists sold_out_on date;

notify pgrst, 'reload schema';
