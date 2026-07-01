-- ============================================================
-- 998_missing_tables.sql
-- Run this in the Supabase SQL Editor to create all missing
-- tables and add missing columns to existing tables.
-- All statements use IF NOT EXISTS / IF NOT EXISTS guards
-- so it is safe to run multiple times.
-- ============================================================

-- ─── auth_shop_id() helper (needed by all RLS policies) ─────

CREATE OR REPLACE FUNCTION auth_shop_id()
RETURNS uuid AS $$
  SELECT id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── EXPENSES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  payment_type text DEFAULT 'cash',
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages expenses" ON expenses;
CREATE POLICY "Owner manages expenses" ON expenses
FOR ALL USING (shop_id = auth_shop_id());

-- ─── DAILY CASH RECORDS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_cash_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  opening_balance numeric DEFAULT 0,
  closing_balance_expected numeric DEFAULT 0,
  closing_balance_actual numeric,
  difference numeric,
  is_closed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, record_date)
);
ALTER TABLE daily_cash_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages daily cash" ON daily_cash_records;
CREATE POLICY "Owner manages daily cash" ON daily_cash_records
FOR ALL USING (shop_id = auth_shop_id());

-- ─── BANK TRANSACTIONS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  transaction_type text CHECK (transaction_type IN (
    'sale_received','deposit','withdrawal',
    'expense_paid','udhaar_received','opening')),
  amount numeric NOT NULL,
  direction text CHECK (direction IN ('in','out')),
  reference_number text,
  description text,
  payment_method text DEFAULT 'bank',
  transaction_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages bank" ON bank_transactions;
CREATE POLICY "Owner manages bank" ON bank_transactions
FOR ALL USING (shop_id = auth_shop_id());

-- ─── UDHAAR PAYMENTS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS udhaar_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  udhaar_id uuid REFERENCES udhaar_records(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE udhaar_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages udhaar payments" ON udhaar_payments;
CREATE POLICY "Owner manages udhaar payments" ON udhaar_payments
FOR ALL USING (shop_id = auth_shop_id());

-- ─── SUPPLIER CREDITS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  laptop_id uuid REFERENCES laptops(id),
  supplier_name text NOT NULL,
  amount_owed numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  due_date date,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','partial','paid')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supplier_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages supplier credits" ON supplier_credits;
CREATE POLICY "Owner manages supplier credits" ON supplier_credits
FOR ALL USING (shop_id = auth_shop_id());

-- ─── EXPENSE BUDGETS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_budget numeric NOT NULL,
  budget_month integer NOT NULL,
  budget_year integer NOT NULL,
  UNIQUE(shop_id, category, budget_month, budget_year)
);
ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages budgets" ON expense_budgets;
CREATE POLICY "Owner manages budgets" ON expense_budgets
FOR ALL USING (shop_id = auth_shop_id());

-- ─── IMPORT HISTORY ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text,
  import_type text CHECK (import_type IN ('laptops','accessories')),
  total_rows integer NOT NULL DEFAULT 0,
  successful_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer DEFAULT 0,
  skipped_reasons jsonb DEFAULT '[]',
  imported_at timestamptz DEFAULT now()
);
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages imports" ON import_history;
CREATE POLICY "Owner manages imports" ON import_history
FOR ALL USING (shop_id = auth_shop_id());

-- ─── MISSING COLUMNS ON EXISTING TABLES ─────────────────────

ALTER TABLE laptops
  ADD COLUMN IF NOT EXISTS asking_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'used',
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_payment text DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS sale_price numeric,
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS imported_batch_id uuid;

ALTER TABLE udhaar_records
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_remaining numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE accessory_categories
  ADD COLUMN IF NOT EXISTS display_qty integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value_added numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value_sold numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_restocked integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_sold integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_manual_count integer,
  ADD COLUMN IF NOT EXISTS last_manual_count_date date,
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric DEFAULT 0;
