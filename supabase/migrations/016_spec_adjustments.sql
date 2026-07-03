-- Add spec columns to model_pricing
ALTER TABLE model_pricing
  ADD COLUMN IF NOT EXISTS processor text,
  ADD COLUMN IF NOT EXISTS ram       text,
  ADD COLUMN IF NOT EXISTS storage   text,
  ADD COLUMN IF NOT EXISTS screen    text;

-- spec_adjustments: per-shop RAM/Storage price deltas
CREATE TABLE IF NOT EXISTS spec_adjustments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  spec_type   text NOT NULL CHECK (spec_type IN ('ram', 'storage')),
  label       text NOT NULL,
  price_delta numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spec_adjustments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON spec_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON spec_adjustments TO service_role;

DROP POLICY IF EXISTS "Owner full access to spec_adjustments" ON spec_adjustments;
DROP POLICY IF EXISTS "Workers can view spec_adjustments"     ON spec_adjustments;

CREATE POLICY "Owner full access to spec_adjustments"
  ON spec_adjustments FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Workers can view spec_adjustments"
  ON spec_adjustments FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM workers WHERE auth_user_id = auth.uid()));
