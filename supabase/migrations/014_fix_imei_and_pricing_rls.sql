-- 014_fix_imei_and_pricing_rls.sql
-- Fix 1: make laptops.imei nullable (migration 013 never applied)
ALTER TABLE laptops ALTER COLUMN imei DROP NOT NULL;

-- Fix 2: grant table-level privileges on model_pricing to all roles
-- (the GRANT block in migration 011 never ran)
GRANT ALL ON model_pricing TO anon, authenticated, service_role;

-- Fix 3: recreate RLS policies on model_pricing to match the working pattern
-- used by every other shop-scoped table (e.g. laptops, bank_transactions)
DROP POLICY IF EXISTS "Owner full access to model_pricing" ON model_pricing;
DROP POLICY IF EXISTS "Workers can view model_pricing"     ON model_pricing;

CREATE POLICY "Owner full access to model_pricing"
  ON model_pricing FOR ALL
  USING  (shop_id = auth_shop_id())
  WITH CHECK (shop_id = auth_shop_id());

CREATE POLICY "Workers can view model_pricing"
  ON model_pricing FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workers
      WHERE workers.auth_user_id = auth.uid()
        AND workers.shop_id      = model_pricing.shop_id
        AND workers.is_active    = true
    )
  );
