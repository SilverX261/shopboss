-- ============================================================
-- 005_inventory_supplier_credits.sql
-- Inventory system additions:
--   • laptops: asking_price, purchase_date, supplier_name
--   • supplier_credits table (owner-only RLS)
--
-- Idempotent — safe to run on an existing database. The same
-- changes are also folded into 999_final_ready.sql for fresh setups.
-- ============================================================

-- ---- laptops: new inventory columns ----
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS asking_price  numeric DEFAULT 0;
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS purchase_date date    DEFAULT CURRENT_DATE;
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_name text;
-- condition / notes are written by the Add Laptop form but were missing from the
-- base schema — add them here so inserts succeed on a fresh database.
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS condition     text DEFAULT 'used';
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS notes         text;

-- ---- supplier_credits ----
CREATE TABLE IF NOT EXISTS supplier_credits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid        REFERENCES shops(id)   ON DELETE CASCADE,
  laptop_id     uuid        REFERENCES laptops(id) ON DELETE CASCADE,
  supplier_name text        NOT NULL,
  amount_owed   numeric     NOT NULL,
  amount_paid   numeric     DEFAULT 0,
  due_date      date,
  status        text        DEFAULT 'pending' CHECK (status IN ('pending','partial','paid')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_credits_shop_id ON supplier_credits(shop_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credits_status  ON supplier_credits(status);

ALTER TABLE supplier_credits ENABLE ROW LEVEL SECURITY;

-- Owner full access only
DROP POLICY IF EXISTS "Owner full access to supplier credits" ON supplier_credits;
CREATE POLICY "Owner full access to supplier credits"
  ON supplier_credits FOR ALL USING (shop_id = auth_shop_id());
