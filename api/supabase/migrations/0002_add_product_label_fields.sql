-- Adds the two remaining pieces of California cottage food label content
-- that products.allergens (added in 0001_init.sql) didn't cover:
-- ingredients and net weight. Both are legally required on every product
-- label (California Health & Safety Code cottage food labeling rules),
-- alongside the business name/address/registration number, which live
-- in application config (src/lib/config.ts) rather than the database —
-- that data doesn't vary per product, this does.
--
-- text, not null default '', matching the existing allergens column's
-- convention (see 0001_init.sql) rather than making them nullable: a
-- product with no ingredients text is a data-entry gap to flag in the
-- admin/seed step, not a valid "no ingredients" state.
alter table products
  add column if not exists ingredients text not null default '',
  add column if not exists net_weight text not null default '';
