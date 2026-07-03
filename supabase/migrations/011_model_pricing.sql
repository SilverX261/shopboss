-- ============================================================
-- 011_model_pricing.sql — Two-tier price list per model + condition
-- ============================================================

-- 1. New table: model_pricing
CREATE TABLE IF NOT EXISTS model_pricing (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  model       text        NOT NULL,
  condition   text        NOT NULL CHECK (condition IN ('new', 'used', 'refurbished', 'open_box')),
  list_price  numeric     NOT NULL DEFAULT 0,
  floor_price numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, model, condition)
);

ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

-- Owner has full access
DROP POLICY IF EXISTS "Owner full access to model_pricing" ON model_pricing;
CREATE POLICY "Owner full access to model_pricing"
  ON model_pricing FOR ALL
  USING  (shop_id = auth_shop_id())
  WITH CHECK (shop_id = auth_shop_id());

-- Workers can SELECT (read-only)
DROP POLICY IF EXISTS "Workers can view model_pricing" ON model_pricing;
CREATE POLICY "Workers can view model_pricing"
  ON model_pricing FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.auth_user_id = auth.uid()
        AND workers.shop_id = model_pricing.shop_id
        AND workers.is_active = true
    )
  );

-- 2. Extend sales table with floor-price tracking columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS below_floor         boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS floor_price_at_sale numeric;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_model_pricing_shop    ON model_pricing(shop_id);
CREATE INDEX IF NOT EXISTS idx_model_pricing_model   ON model_pricing(shop_id, model);

-- 4. Grants
GRANT ALL ON model_pricing TO anon, authenticated, service_role;
