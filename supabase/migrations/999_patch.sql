-- ============================================================
-- 999_patch.sql — Apply this if you already ran 999_final_ready.sql
-- and are seeing 403 errors or missing column errors.
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- 1. GRANTS (fixes 403 Forbidden on all REST API calls)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Workers table — missing columns
ALTER TABLE workers ADD COLUMN IF NOT EXISTS email        text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS role         text DEFAULT 'staff';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE workers ALTER COLUMN pin_hash SET DEFAULT '';

-- 3. Laptops table — missing columns
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_payment  text    DEFAULT 'cash';
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS stock_type        text    DEFAULT 'own';
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS source_shop_name  text;
ALTER TABLE laptops ADD COLUMN IF NOT EXISTS source_shop_price numeric;

-- 4. Sales table — missing exchange columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_exchange             boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_value          numeric DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_laptop_model   text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_laptop_condition text;

-- 5. bank_transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid        REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  transaction_type text        NOT NULL CHECK (transaction_type IN ('opening','deposit','withdrawal','expense_paid','udhaar_received','sale_received')),
  amount           numeric     NOT NULL CHECK (amount >= 0),
  direction        text        NOT NULL CHECK (direction IN ('in','out')),
  reference_number text,
  description      text,
  transaction_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner full access to bank transactions" ON bank_transactions;
CREATE POLICY "Owner full access to bank transactions"
  ON bank_transactions FOR ALL USING (shop_id = auth_shop_id());

-- 6. expense_budgets table
CREATE TABLE IF NOT EXISTS expense_budgets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid        REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  category       text        NOT NULL,
  monthly_budget numeric     NOT NULL CHECK (monthly_budget >= 0),
  budget_month   integer     NOT NULL CHECK (budget_month BETWEEN 1 AND 12),
  budget_year    integer     NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, category, budget_month, budget_year)
);
ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner full access to expense budgets" ON expense_budgets;
CREATE POLICY "Owner full access to expense budgets"
  ON expense_budgets FOR ALL USING (shop_id = auth_shop_id());

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_workers_auth_user_id        ON workers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_shop_date ON bank_transactions(shop_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_expense_budgets_shop        ON expense_budgets(shop_id);
