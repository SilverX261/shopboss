-- ============================================================
-- Migration 004 — Udhaar approvals + schema additions
-- ============================================================

-- Udhaar approvals table (for amounts above max_udhaar_without_approval)
CREATE TABLE IF NOT EXISTS udhaar_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid REFERENCES shops(id) ON DELETE CASCADE,
  worker_id        uuid REFERENCES workers(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  amount           numeric(12,2) NOT NULL,
  customer_name    text NOT NULL,
  customer_phone   text NOT NULL,
  mode             text NOT NULL CHECK (mode IN ('item_based','value_based')),
  items            jsonb,
  note             text,
  category_id      uuid REFERENCES accessory_categories(id) ON DELETE SET NULL,
  deduct_units     integer,
  due_date         date,
  cnic_photo_url   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_udhaar_approvals_shop_status
  ON udhaar_approvals(shop_id, status)
  WHERE status = 'pending';

-- Add min_sale_prices column to shops (JSONB map of model→floor price)
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS min_sale_prices jsonb DEFAULT '{}';

-- Add last_spot_check_declared and expected columns to accessory_categories
ALTER TABLE accessory_categories
  ADD COLUMN IF NOT EXISTS last_spot_check_declared integer,
  ADD COLUMN IF NOT EXISTS last_spot_check_expected  integer;

-- Trade-in records table (Boss plan)
CREATE TABLE IF NOT EXISTS trade_in_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid REFERENCES shops(id) ON DELETE CASCADE,
  sale_id      uuid REFERENCES sales(id) ON DELETE CASCADE,
  imei         text,
  model_desc   text,
  condition    text CHECK (condition IN ('good','fair','poor')),
  credit_value numeric(12,2) DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Supabase Storage buckets (run these in Supabase dashboard if not done):
-- create bucket 'cnic-photos' (private)
-- create bucket 'count-photos' (private)

-- Enable RLS on new tables
ALTER TABLE udhaar_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_records ENABLE ROW LEVEL SECURITY;

-- RLS policies: owner sees all records for their shop
CREATE POLICY "shop owner access udhaar_approvals"
  ON udhaar_approvals FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "shop owner access trade_in_records"
  ON trade_in_records FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
