-- ============================================================
-- 007_cash_management.sql
-- Daily cash & accounting:
--   • daily_cash_records — one row per shop per day (open/close)
--   • expenses — categorised money-out log
--
-- Idempotent — safe to run on an existing database. The same
-- changes are also folded into 999_final_ready.sql for fresh setups.
-- ============================================================

-- ---- daily_cash_records ----
CREATE TABLE IF NOT EXISTS daily_cash_records (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  uuid        REFERENCES shops(id) ON DELETE CASCADE,
  record_date              date        NOT NULL,
  opening_balance          numeric     DEFAULT 0,
  closing_balance_expected numeric     DEFAULT 0,
  closing_balance_actual   numeric,
  difference               numeric,
  is_closed                boolean     DEFAULT false,
  notes                    text,
  created_at               timestamptz DEFAULT now(),
  UNIQUE (shop_id, record_date)
);

-- ---- expenses ----
CREATE TABLE IF NOT EXISTS expenses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid        REFERENCES shops(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL,
  category     text        NOT NULL,
  description  text        NOT NULL,
  payment_type text        DEFAULT 'cash',
  expense_date date        DEFAULT CURRENT_DATE,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_cash_shop_date ON daily_cash_records(shop_id, record_date);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date   ON expenses(shop_id, expense_date);

ALTER TABLE daily_cash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;

-- Owner full access only
DROP POLICY IF EXISTS "Owner full access to daily cash" ON daily_cash_records;
CREATE POLICY "Owner full access to daily cash"
  ON daily_cash_records FOR ALL USING (shop_id = auth_shop_id());

DROP POLICY IF EXISTS "Owner full access to expenses" ON expenses;
CREATE POLICY "Owner full access to expenses"
  ON expenses FOR ALL USING (shop_id = auth_shop_id());
