-- ============================================================
-- 000_clean_reset.sql
-- ShopBoss — Clean combined migration (safe to re-run)
-- Combines 001_initial + 002_reminder_function_and_cron + 004_udhaar_approvals
--
-- Changes vs originals:
--  • Table names use SINGULAR form (accessory_categories, accessory_transactions)
--    to match all application code (migrations 001 used plural by mistake)
--  • days_in_stock: regular integer (now() is STABLE not IMMUTABLE — cannot be
--    used in STORED generated column in PostgreSQL 15)
--  • profit: regular numeric (subqueries not allowed in generated columns)
--  • amount_remaining: regular numeric (API code inserts it explicitly)
--  • All cron.schedule() calls omitted (add after enabling pg_cron extension)
--  • DROP POLICY IF EXISTS before every CREATE POLICY (idempotent)
-- ============================================================

-- ============================================================
-- DROP EXISTING ENUMS (CASCADE drops any columns using them)
-- ============================================================
DROP TYPE IF EXISTS plan_type          CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS payment_method     CASCADE;
DROP TYPE IF EXISTS laptop_status      CASCADE;
DROP TYPE IF EXISTS udhaar_status      CASCADE;
DROP TYPE IF EXISTS udhaar_mode        CASCADE;
DROP TYPE IF EXISTS count_status       CASCADE;
DROP TYPE IF EXISTS activity_type      CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE plan_type AS ENUM ('standard', 'pro', 'boss');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'payment_pending', 'expired', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'udhaar', 'bank_transfer');
CREATE TYPE laptop_status AS ENUM ('in_stock', 'sold', 'traded_in');
CREATE TYPE udhaar_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE udhaar_mode AS ENUM ('item_based', 'value_based');
CREATE TYPE count_status AS ENUM ('pending', 'submitted', 'verified', 'flagged');
CREATE TYPE activity_type AS ENUM (
  'login', 'logout', 'sale', 'udhaar', 'stock_add',
  'search', 'page_view', 'price_edit', 'count_submit', 'void_attempt'
);

-- ============================================================
-- TABLE: shops
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  name                         text        NOT NULL,
  owner_name                   text        NOT NULL,
  owner_phone                  varchar(11) NOT NULL,
  whatsapp_number              varchar(11) NOT NULL,
  wa_phone_number_id           text,
  wa_access_token              text,
  plan                         plan_type   NOT NULL DEFAULT 'standard',
  subscription_status          subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at                timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  subscription_ends_at         timestamptz,
  next_reminder_date           date        NOT NULL DEFAULT CURRENT_DATE + 3,
  easypaisa_payment_ref        text,
  shop_open_time               time        DEFAULT '09:00',
  shop_close_time              time        DEFAULT '20:00',
  max_udhaar_without_approval  numeric     DEFAULT 20000,
  large_sale_alert_threshold   numeric     DEFAULT 50000,
  min_sale_prices              jsonb       DEFAULT '{}',
  created_at                   timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: workers
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        REFERENCES shops(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  pin_hash    text        NOT NULL,
  is_active   boolean     DEFAULT true,
  push_token  text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: laptops
-- NOTE: days_in_stock is a plain integer (set via trigger on INSERT).
--       PostgreSQL STORED generated columns require IMMUTABLE expressions;
--       now() is STABLE, not IMMUTABLE, so it cannot be used here.
--       Call refresh_days_in_stock() periodically (or via pg_cron) to update.
-- ============================================================
CREATE TABLE IF NOT EXISTS laptops (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid          REFERENCES shops(id) ON DELETE CASCADE,
  imei            varchar(15)   UNIQUE NOT NULL,
  brand           text          NOT NULL,
  model           text          NOT NULL,
  specs           jsonb         DEFAULT '{}',
  purchase_price  numeric       NOT NULL,
  status          laptop_status DEFAULT 'in_stock',
  added_by        uuid          REFERENCES auth.users(id),
  added_at        timestamptz   DEFAULT now(),
  days_in_stock   integer       DEFAULT 0
);

-- ============================================================
-- TABLE: sales
-- NOTE: profit is a plain numeric (original used a subquery in GENERATED,
--       which PostgreSQL does not allow). Application code inserts profit.
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid          REFERENCES shops(id) ON DELETE CASCADE,
  laptop_id         uuid          REFERENCES laptops(id),
  worker_id         uuid          REFERENCES workers(id),
  sale_price        numeric       NOT NULL,
  payment_type      payment_method NOT NULL,
  customer_phone    varchar(11),
  customer_name     text,
  profit            numeric,
  receipt_sent      boolean       DEFAULT false,
  wa_alert_sent     boolean       DEFAULT false,
  is_voided         boolean       DEFAULT false,
  void_approved_by  uuid          REFERENCES auth.users(id),
  sold_at           timestamptz   DEFAULT now(),
  post_snapshot     boolean       DEFAULT false
);

-- ============================================================
-- TABLE: accessory_categories   (singular — matches all app code)
-- ============================================================
CREATE TABLE IF NOT EXISTS accessory_categories (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                     uuid        REFERENCES shops(id) ON DELETE CASCADE,
  name                        text        NOT NULL,
  cost_per_unit               numeric     NOT NULL,
  display_qty                 integer     NOT NULL DEFAULT 0,
  total_value_added           numeric     DEFAULT 0,
  total_value_sold            numeric     DEFAULT 0,
  last_spot_check_at          timestamptz,
  last_spot_check_declared    integer,
  last_spot_check_expected    integer,
  created_at                  timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: accessory_transactions   (singular — matches all app code)
-- ============================================================
CREATE TABLE IF NOT EXISTS accessory_transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid        REFERENCES shops(id) ON DELETE CASCADE,
  category_id       uuid        REFERENCES accessory_categories(id),
  worker_id         uuid        REFERENCES workers(id),
  transaction_type  text        CHECK (transaction_type IN ('sale', 'udhaar', 'restock', 'adjustment')),
  units             integer,
  value             numeric     NOT NULL,
  note              text,
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: count_requests
-- NOTE: gap and response_seconds are computed but app code also writes them
--       explicitly in count/submit/route.ts. Keeping them as plain columns
--       to avoid "cannot update generated column" errors. The application
--       computes both values itself before inserting.
-- ============================================================
CREATE TABLE IF NOT EXISTS count_requests (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid         REFERENCES shops(id) ON DELETE CASCADE,
  category_id      uuid         REFERENCES accessory_categories(id),
  status           count_status DEFAULT 'pending',
  fired_at         timestamptz  DEFAULT now(),
  submitted_at     timestamptz,
  declared_count   integer,
  expected_count   integer,
  gap              integer,
  photo_url        text,
  response_seconds integer,
  submitted_by     uuid         REFERENCES workers(id),
  flagged_reason   text
);

-- ============================================================
-- TABLE: udhaar_records
-- NOTE: amount_remaining is a plain numeric because API code inserts it
--       directly (amount_remaining: total_amount). A GENERATED column would
--       reject that explicit value.
-- ============================================================
CREATE TABLE IF NOT EXISTS udhaar_records (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                   uuid          REFERENCES shops(id) ON DELETE CASCADE,
  worker_id                 uuid          REFERENCES workers(id),
  mode                      udhaar_mode   NOT NULL,
  customer_name             text          NOT NULL,
  customer_phone            varchar(11)   NOT NULL,
  cnic_photo_url            text,
  total_amount              numeric       NOT NULL,
  amount_paid               numeric       DEFAULT 0,
  amount_remaining          numeric       DEFAULT 0,
  items                     jsonb         DEFAULT '[]',
  due_date                  date,
  status                    udhaar_status DEFAULT 'pending',
  approved_by_owner         boolean       DEFAULT false,
  reminder_sent_at          timestamptz,
  deduct_from_accessories   boolean       DEFAULT false,
  category_id               uuid          REFERENCES accessory_categories(id),
  sale_id                   uuid          REFERENCES sales(id),
  created_at                timestamptz   DEFAULT now()
);

-- ============================================================
-- TABLE: cash_records
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_records (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid        REFERENCES shops(id) ON DELETE CASCADE,
  worker_id    uuid        REFERENCES workers(id),
  record_type  text        CHECK (record_type IN ('opening', 'closing', 'expense', 'deposit')),
  amount       numeric     NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: activity_log
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid          REFERENCES shops(id) ON DELETE CASCADE,
  worker_id      uuid          REFERENCES workers(id),
  event_type     activity_type NOT NULL,
  page           text,
  details        jsonb         DEFAULT '{}',
  post_snapshot  boolean       DEFAULT false,
  logged_at      timestamptz   DEFAULT now()
);

-- ============================================================
-- TABLE: snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS snapshots (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  uuid        REFERENCES shops(id) ON DELETE CASCADE,
  snapshot_type            text        CHECK (snapshot_type IN ('left', 'returned')),
  laptop_count             integer,
  laptops_in_stock_value   numeric,
  cash_declared            numeric,
  accessories_total_value  numeric,
  udhaar_total_pending     numeric,
  worker_id                uuid        REFERENCES workers(id),
  worker_last_action       text,
  created_at               timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: payment_proofs
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_proofs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid        REFERENCES shops(id) ON DELETE CASCADE,
  screenshot_url  text        NOT NULL,
  amount          numeric     NOT NULL,
  plan            plan_type   NOT NULL,
  status          text        DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at    timestamptz DEFAULT now(),
  verified_at     timestamptz,
  admin_note      text
);

-- ============================================================
-- TABLE: checklist_reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_reminders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid        REFERENCES shops(id) ON DELETE CASCADE,
  sent_at             timestamptz DEFAULT now(),
  next_reminder_date  date        NOT NULL,
  channel             text        DEFAULT 'whatsapp'
);

-- ============================================================
-- TABLE: udhaar_approvals   (from migration 004)
-- ============================================================
CREATE TABLE IF NOT EXISTS udhaar_approvals (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid          REFERENCES shops(id) ON DELETE CASCADE,
  worker_id        uuid          REFERENCES workers(id) ON DELETE SET NULL,
  status           text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amount           numeric(12,2) NOT NULL,
  customer_name    text          NOT NULL,
  customer_phone   text          NOT NULL,
  mode             text          NOT NULL CHECK (mode IN ('item_based', 'value_based')),
  items            jsonb,
  note             text,
  category_id      uuid          REFERENCES accessory_categories(id) ON DELETE SET NULL,
  deduct_units     integer,
  due_date         date,
  cnic_photo_url   text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);

-- ============================================================
-- TABLE: trade_in_records   (from migration 004)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_in_records (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid          REFERENCES shops(id) ON DELETE CASCADE,
  sale_id      uuid          REFERENCES sales(id) ON DELETE CASCADE,
  imei         text,
  model_desc   text,
  condition    text          CHECK (condition IN ('good', 'fair', 'poor')),
  credit_value numeric(12,2) DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shops_owner_id              ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_next_reminder_date    ON shops(next_reminder_date) WHERE subscription_status IN ('trial', 'active');
CREATE INDEX IF NOT EXISTS idx_workers_shop_id             ON workers(shop_id);
CREATE INDEX IF NOT EXISTS idx_laptops_shop_id             ON laptops(shop_id);
CREATE INDEX IF NOT EXISTS idx_laptops_status              ON laptops(status);
CREATE INDEX IF NOT EXISTS idx_laptops_imei                ON laptops(imei);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id               ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at               ON sales(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_udhaar_shop_id              ON udhaar_records(shop_id);
CREATE INDEX IF NOT EXISTS idx_udhaar_status               ON udhaar_records(status);
CREATE INDEX IF NOT EXISTS idx_activity_shop_id            ON activity_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_activity_logged_at          ON activity_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_count_requests_shop_id      ON count_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_count_requests_status       ON count_requests(status);
CREATE INDEX IF NOT EXISTS idx_udhaar_approvals_shop_status ON udhaar_approvals(shop_id, status) WHERE status = 'pending';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Trigger helper: update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Security helper: return the shop_id owned by the current authenticated user
CREATE OR REPLACE FUNCTION auth_shop_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- Utility: set days_in_stock on laptop INSERT
CREATE OR REPLACE FUNCTION set_days_in_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.days_in_stock := EXTRACT(day FROM now() - NEW.added_at)::integer;
  RETURN NEW;
END;
$$;

-- Utility: batch-refresh days_in_stock for all laptops (call via pg_cron daily)
CREATE OR REPLACE FUNCTION refresh_days_in_stock()
RETURNS void LANGUAGE sql AS $$
  UPDATE laptops
  SET days_in_stock = EXTRACT(day FROM now() - added_at)::integer
  WHERE status = 'in_stock';
$$;

-- Migration 002: skip-Fridays reminder-date helper
CREATE OR REPLACE FUNCTION get_next_reminder_date(from_date date)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  next_date    date    := from_date;
  days_counted integer := 0;
BEGIN
  WHILE days_counted < 3 LOOP
    next_date    := next_date + 1;
    IF EXTRACT(DOW FROM next_date) != 5 THEN   -- skip Fridays (DOW=5)
      days_counted := days_counted + 1;
    END IF;
  END LOOP;
  RETURN next_date;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS shops_updated_at ON shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS laptops_set_days_in_stock ON laptops;
CREATE TRIGGER laptops_set_days_in_stock
  BEFORE INSERT ON laptops
  FOR EACH ROW EXECUTE FUNCTION set_days_in_stock();

-- ============================================================
-- ROW LEVEL SECURITY — enable on all tables
-- ============================================================
ALTER TABLE shops                ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE laptops              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE udhaar_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_reminders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE udhaar_approvals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_records     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- DROP IF EXISTS before CREATE makes this script idempotent
-- ============================================================

-- ---- SHOPS ----
DROP POLICY IF EXISTS "Owner can view own shop"   ON shops;
DROP POLICY IF EXISTS "Owner can update own shop" ON shops;
DROP POLICY IF EXISTS "Owner can insert shop"     ON shops;

CREATE POLICY "Owner can view own shop"
  ON shops FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owner can update own shop"
  ON shops FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owner can insert shop"
  ON shops FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ---- WORKERS ----
DROP POLICY IF EXISTS "Owner full access to workers" ON workers;
CREATE POLICY "Owner full access to workers"
  ON workers FOR ALL USING (shop_id = auth_shop_id());

-- ---- LAPTOPS ----
DROP POLICY IF EXISTS "Owner full access to laptops" ON laptops;
DROP POLICY IF EXISTS "Workers can view laptops"     ON laptops;
DROP POLICY IF EXISTS "Workers can insert laptops"   ON laptops;

CREATE POLICY "Owner full access to laptops"
  ON laptops FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can view laptops"
  ON laptops FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can insert laptops"
  ON laptops FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- SALES ----
DROP POLICY IF EXISTS "Owner full access to sales" ON sales;
DROP POLICY IF EXISTS "Workers can insert sales"   ON sales;
DROP POLICY IF EXISTS "Workers can view sales"     ON sales;

CREATE POLICY "Owner full access to sales"
  ON sales FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert sales"
  ON sales FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can view sales"
  ON sales FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- ACCESSORY CATEGORIES ----
DROP POLICY IF EXISTS "Owner full access to accessory categories" ON accessory_categories;
DROP POLICY IF EXISTS "Workers can view accessory categories"     ON accessory_categories;

CREATE POLICY "Owner full access to accessory categories"
  ON accessory_categories FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can view accessory categories"
  ON accessory_categories FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- ACCESSORY TRANSACTIONS ----
DROP POLICY IF EXISTS "Owner full access to accessory transactions"  ON accessory_transactions;
DROP POLICY IF EXISTS "Workers can insert accessory transactions"    ON accessory_transactions;
DROP POLICY IF EXISTS "Workers can view accessory transactions"      ON accessory_transactions;

CREATE POLICY "Owner full access to accessory transactions"
  ON accessory_transactions FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert accessory transactions"
  ON accessory_transactions FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can view accessory transactions"
  ON accessory_transactions FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- COUNT REQUESTS ----
DROP POLICY IF EXISTS "Owner full access to count requests"  ON count_requests;
DROP POLICY IF EXISTS "Workers can insert count requests"    ON count_requests;
DROP POLICY IF EXISTS "Workers can update count requests"    ON count_requests;
DROP POLICY IF EXISTS "Workers can view count requests"      ON count_requests;

CREATE POLICY "Owner full access to count requests"
  ON count_requests FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert count requests"
  ON count_requests FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can update count requests"
  ON count_requests FOR UPDATE USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can view count requests"
  ON count_requests FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- UDHAAR RECORDS ----
DROP POLICY IF EXISTS "Owner full access to udhaar" ON udhaar_records;
DROP POLICY IF EXISTS "Workers can insert udhaar"   ON udhaar_records;
DROP POLICY IF EXISTS "Workers can view udhaar"     ON udhaar_records;

CREATE POLICY "Owner full access to udhaar"
  ON udhaar_records FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert udhaar"
  ON udhaar_records FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can view udhaar"
  ON udhaar_records FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- CASH RECORDS ----
DROP POLICY IF EXISTS "Owner full access to cash records" ON cash_records;
DROP POLICY IF EXISTS "Workers can insert cash records"   ON cash_records;
DROP POLICY IF EXISTS "Workers can view cash records"     ON cash_records;

CREATE POLICY "Owner full access to cash records"
  ON cash_records FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert cash records"
  ON cash_records FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );
CREATE POLICY "Workers can view cash records"
  ON cash_records FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- ACTIVITY LOG ----
DROP POLICY IF EXISTS "Owner can view activity log"    ON activity_log;
DROP POLICY IF EXISTS "Workers can insert activity log" ON activity_log;

CREATE POLICY "Owner can view activity log"
  ON activity_log FOR SELECT USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert activity log"
  ON activity_log FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- SNAPSHOTS ----
DROP POLICY IF EXISTS "Owner full access to snapshots" ON snapshots;
DROP POLICY IF EXISTS "Workers can insert snapshots"   ON snapshots;

CREATE POLICY "Owner full access to snapshots"
  ON snapshots FOR ALL USING (shop_id = auth_shop_id());
CREATE POLICY "Workers can insert snapshots"
  ON snapshots FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- PAYMENT PROOFS ----
DROP POLICY IF EXISTS "Owner can insert payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Owner can view payment proofs"   ON payment_proofs;

CREATE POLICY "Owner can insert payment proofs"
  ON payment_proofs FOR INSERT WITH CHECK (shop_id = auth_shop_id());
CREATE POLICY "Owner can view payment proofs"
  ON payment_proofs FOR SELECT USING (shop_id = auth_shop_id());

-- ---- CHECKLIST REMINDERS ----
DROP POLICY IF EXISTS "Owner full access to checklist reminders" ON checklist_reminders;
CREATE POLICY "Owner full access to checklist reminders"
  ON checklist_reminders FOR ALL USING (shop_id = auth_shop_id());

-- ---- UDHAAR APPROVALS ----
DROP POLICY IF EXISTS "shop owner access udhaar_approvals" ON udhaar_approvals;
CREATE POLICY "shop owner access udhaar_approvals"
  ON udhaar_approvals FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- ---- TRADE IN RECORDS ----
DROP POLICY IF EXISTS "shop owner access trade_in_records" ON trade_in_records;
CREATE POLICY "shop owner access trade_in_records"
  ON trade_in_records FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

-- ============================================================
-- NOTE: pg_cron jobs omitted.
-- After enabling pg_cron extension in Supabase Dashboard
-- (Extensions → pg_cron), add the following manually:
--
--   SELECT cron.schedule(
--     'send-checklist-reminders',
--     '0 4 * * *',   -- 4 AM UTC = 9 AM PKT
--     $$ SELECT net.http_post(...) $$
--   );
--
--   SELECT cron.schedule(
--     'refresh-days-in-stock',
--     '0 0 * * *',   -- midnight UTC
--     $$ SELECT refresh_days_in_stock() $$
--   );
-- ============================================================
