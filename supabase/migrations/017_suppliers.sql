-- Suppliers, laptop warranty tracking, and supplier advance wallet
-- (applied to remote via MCP as: create_suppliers_table, laptops_supplier_and_warranty, supplier_transactions)

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  city text,
  advance_balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, name)
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO service_role;
CREATE POLICY "Owner full access to suppliers"
  ON suppliers FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
CREATE POLICY "Workers can view suppliers"
  ON suppliers FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM workers WHERE auth_user_id = auth.uid()));

ALTER TABLE laptops
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS warranty_status text
    NOT NULL DEFAULT 'none'
    CHECK (warranty_status IN ('none', 'sent', 'resolved')),
  ADD COLUMN IF NOT EXISTS warranty_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_resolution
    text CHECK (warranty_resolution IN ('replacement', 'refund', 'credit'));

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'advance_sent',
    'advance_used',
    'warranty_credit',
    'refund_received',
    'manual_adjustment'
  )),
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_transactions TO service_role;
CREATE POLICY "Owner full access to supplier_transactions"
  ON supplier_transactions FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
CREATE POLICY "Workers can view supplier_transactions"
  ON supplier_transactions FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM workers WHERE auth_user_id = auth.uid()));
