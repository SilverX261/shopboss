GRANT ALL ON model_pricing TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Owner full access to model_pricing" ON model_pricing;
DROP POLICY IF EXISTS "Workers can view model_pricing"     ON model_pricing;

CREATE POLICY "Owner full access to model_pricing"
  ON model_pricing FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Workers can view model_pricing"
  ON model_pricing FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM workers WHERE auth_user_id = auth.uid()));
