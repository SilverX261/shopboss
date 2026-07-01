-- ============================================================
-- 006_sales_fields.sql
-- Sales system additions:
--   • laptops: sale_price, sold_at, customer_name (filled when sold)
--   • sales:   notes, bank_reference (optional capture at sale time)
--
-- Idempotent — safe to run on an existing database. The same
-- changes are also folded into 999_final_ready.sql for fresh setups.
-- ============================================================

-- ---- laptops: snapshot of the sale on the laptop row ----
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sale_price    numeric;
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sold_at       timestamptz;
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS customer_name text;

-- ---- sales: optional fields captured during a sale ----
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;
