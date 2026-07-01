-- ============================================================
-- 008_udhaar_payments.sql
-- Udhaar (credit) recovery ledger:
--   • udhaar_payments — one row per payment received against a customer udhaar
--   • udhaar_records — ensure amount_paid / amount_remaining exist; add
--     description + notes for standalone udhaar.
--
-- Idempotent — safe to run on an existing database. The same changes are
-- also folded into 999_final_ready.sql for fresh setups.
-- ============================================================

-- ---- udhaar_records: ensure columns exist ----
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS amount_paid      numeric DEFAULT 0;
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS amount_remaining numeric DEFAULT 0;
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description      text;
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS notes            text;

-- ---- udhaar_payments ----
CREATE TABLE IF NOT EXISTS udhaar_payments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid        REFERENCES shops(id) ON DELETE CASCADE,
  udhaar_id      uuid        REFERENCES udhaar_records(id) ON DELETE CASCADE,
  amount_paid    numeric     NOT NULL,
  payment_date   date        DEFAULT CURRENT_DATE,
  payment_method text        DEFAULT 'cash',
  notes          text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_udhaar_payments_shop_date ON udhaar_payments(shop_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_udhaar_payments_udhaar    ON udhaar_payments(udhaar_id);

ALTER TABLE udhaar_payments ENABLE ROW LEVEL SECURITY;

-- Owner full access only
DROP POLICY IF EXISTS "Owner full access to udhaar payments" ON udhaar_payments;
CREATE POLICY "Owner full access to udhaar payments"
  ON udhaar_payments FOR ALL USING (shop_id = auth_shop_id());
