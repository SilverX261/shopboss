-- ============================================================
-- ShopBoss — Initial Schema Migration
-- ============================================================

-- ENUMS
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
CREATE TABLE shops (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  owner_name                text NOT NULL,
  owner_phone               varchar(11) NOT NULL,
  whatsapp_number           varchar(11) NOT NULL,
  wa_phone_number_id        text,
  wa_access_token           text,
  plan                      plan_type NOT NULL DEFAULT 'standard',
  subscription_status       subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at             timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  subscription_ends_at      timestamptz,
  next_reminder_date        date NOT NULL DEFAULT CURRENT_DATE + 3,
  easypaisa_payment_ref     text,
  shop_open_time            time DEFAULT '09:00',
  shop_close_time           time DEFAULT '20:00',
  max_udhaar_without_approval  numeric DEFAULT 20000,
  large_sale_alert_threshold   numeric DEFAULT 50000,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: workers
-- ============================================================
CREATE TABLE workers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid REFERENCES shops(id) ON DELETE CASCADE,
  name        text NOT NULL,
  pin_hash    text NOT NULL,
  is_active   boolean DEFAULT true,
  push_token  text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: laptops
-- ============================================================
CREATE TABLE laptops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid REFERENCES shops(id) ON DELETE CASCADE,
  imei            varchar(15) UNIQUE NOT NULL,
  brand           text NOT NULL,
  model           text NOT NULL,
  specs           jsonb DEFAULT '{}',
  purchase_price  numeric NOT NULL,
  status          laptop_status DEFAULT 'in_stock',
  added_by        uuid REFERENCES auth.users(id),
  added_at        timestamptz DEFAULT now(),
  days_in_stock   integer GENERATED ALWAYS AS (
    EXTRACT(day FROM now() - added_at)::integer
  ) STORED
);

-- ============================================================
-- TABLE: sales
-- ============================================================
CREATE TABLE sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid REFERENCES shops(id) ON DELETE CASCADE,
  laptop_id         uuid REFERENCES laptops(id),
  worker_id         uuid REFERENCES workers(id),
  sale_price        numeric NOT NULL,
  payment_type      payment_method NOT NULL,
  customer_phone    varchar(11),
  customer_name     text,
  profit            numeric GENERATED ALWAYS AS (
    sale_price - (SELECT purchase_price FROM laptops WHERE id = laptop_id)
  ) STORED,
  receipt_sent      boolean DEFAULT false,
  wa_alert_sent     boolean DEFAULT false,
  is_voided         boolean DEFAULT false,
  void_approved_by  uuid REFERENCES auth.users(id),
  sold_at           timestamptz DEFAULT now(),
  post_snapshot     boolean DEFAULT false
);

-- ============================================================
-- TABLE: accessories_categories
-- ============================================================
CREATE TABLE accessories_categories (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                     uuid REFERENCES shops(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  cost_per_unit               numeric NOT NULL,
  display_qty                 integer NOT NULL DEFAULT 0,
  total_value_added           numeric DEFAULT 0,
  total_value_sold            numeric DEFAULT 0,
  last_spot_check_at          timestamptz,
  last_spot_check_declared    integer,
  last_spot_check_expected    integer,
  created_at                  timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: accessories_transactions
-- ============================================================
CREATE TABLE accessories_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid REFERENCES shops(id) ON DELETE CASCADE,
  category_id       uuid REFERENCES accessories_categories(id),
  worker_id         uuid REFERENCES workers(id),
  transaction_type  text CHECK (transaction_type IN ('sale', 'udhaar', 'restock', 'adjustment')),
  units             integer,
  value             numeric NOT NULL,
  note              text,
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: count_requests
-- ============================================================
CREATE TABLE count_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid REFERENCES shops(id) ON DELETE CASCADE,
  category_id       uuid REFERENCES accessories_categories(id),
  status            count_status DEFAULT 'pending',
  fired_at          timestamptz DEFAULT now(),
  submitted_at      timestamptz,
  declared_count    integer,
  expected_count    integer,
  gap               integer GENERATED ALWAYS AS (
    COALESCE(expected_count, 0) - COALESCE(declared_count, 0)
  ) STORED,
  photo_url         text,
  response_seconds  integer GENERATED ALWAYS AS (
    EXTRACT(epoch FROM (submitted_at - fired_at))::integer
  ) STORED,
  submitted_by      uuid REFERENCES workers(id),
  flagged_reason    text
);

-- ============================================================
-- TABLE: udhaar_records
-- ============================================================
CREATE TABLE udhaar_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                   uuid REFERENCES shops(id) ON DELETE CASCADE,
  worker_id                 uuid REFERENCES workers(id),
  mode                      udhaar_mode NOT NULL,
  customer_name             text NOT NULL,
  customer_phone            varchar(11) NOT NULL,
  cnic_photo_url            text,
  total_amount              numeric NOT NULL,
  amount_paid               numeric DEFAULT 0,
  amount_remaining          numeric GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  items                     jsonb DEFAULT '[]',
  due_date                  date,
  status                    udhaar_status DEFAULT 'pending',
  approved_by_owner         boolean DEFAULT false,
  reminder_sent_at          timestamptz,
  deduct_from_accessories   boolean DEFAULT false,
  category_id               uuid REFERENCES accessories_categories(id),
  sale_id                   uuid REFERENCES sales(id),
  created_at                timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: cash_records
-- ============================================================
CREATE TABLE cash_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid REFERENCES shops(id) ON DELETE CASCADE,
  worker_id    uuid REFERENCES workers(id),
  record_type  text CHECK (record_type IN ('opening', 'closing', 'expense', 'deposit')),
  amount       numeric NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: activity_log
-- ============================================================
CREATE TABLE activity_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid REFERENCES shops(id) ON DELETE CASCADE,
  worker_id      uuid REFERENCES workers(id),
  event_type     activity_type NOT NULL,
  page           text,
  details        jsonb DEFAULT '{}',
  post_snapshot  boolean DEFAULT false,
  logged_at      timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: snapshots
-- ============================================================
CREATE TABLE snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                  uuid REFERENCES shops(id) ON DELETE CASCADE,
  snapshot_type            text CHECK (snapshot_type IN ('left', 'returned')),
  laptop_count             integer,
  laptops_in_stock_value   numeric,
  cash_declared            numeric,
  accessories_total_value  numeric,
  udhaar_total_pending     numeric,
  worker_id                uuid REFERENCES workers(id),
  worker_last_action       text,
  created_at               timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: payment_proofs
-- ============================================================
CREATE TABLE payment_proofs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid REFERENCES shops(id) ON DELETE CASCADE,
  screenshot_url  text NOT NULL,
  amount          numeric NOT NULL,
  plan            plan_type NOT NULL,
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at    timestamptz DEFAULT now(),
  verified_at     timestamptz,
  admin_note      text
);

-- ============================================================
-- TABLE: checklist_reminders
-- ============================================================
CREATE TABLE checklist_reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid REFERENCES shops(id) ON DELETE CASCADE,
  sent_at             timestamptz DEFAULT now(),
  next_reminder_date  date NOT NULL,
  channel             text DEFAULT 'whatsapp'
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_shops_owner_id ON shops(owner_id);
CREATE INDEX idx_workers_shop_id ON workers(shop_id);
CREATE INDEX idx_laptops_shop_id ON laptops(shop_id);
CREATE INDEX idx_laptops_status ON laptops(status);
CREATE INDEX idx_laptops_imei ON laptops(imei);
CREATE INDEX idx_sales_shop_id ON sales(shop_id);
CREATE INDEX idx_sales_sold_at ON sales(sold_at DESC);
CREATE INDEX idx_udhaar_shop_id ON udhaar_records(shop_id);
CREATE INDEX idx_udhaar_status ON udhaar_records(status);
CREATE INDEX idx_activity_shop_id ON activity_log(shop_id);
CREATE INDEX idx_activity_logged_at ON activity_log(logged_at DESC);
CREATE INDEX idx_count_requests_shop_id ON count_requests(shop_id);
CREATE INDEX idx_count_requests_status ON count_requests(status);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE laptops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE udhaar_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_reminders ENABLE ROW LEVEL SECURITY;

-- Helper: get shop_id for current authenticated user
CREATE OR REPLACE FUNCTION auth_shop_id()
RETURNS uuid AS $$
  SELECT id FROM shops WHERE owner_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- SHOPS ----
CREATE POLICY "Owner can view own shop"
  ON shops FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Owner can update own shop"
  ON shops FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owner can insert shop"
  ON shops FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ---- WORKERS ----
CREATE POLICY "Owner full access to workers"
  ON workers FOR ALL USING (shop_id = auth_shop_id());

-- ---- LAPTOPS ----
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

-- ---- ACCESSORIES CATEGORIES ----
CREATE POLICY "Owner full access to accessory categories"
  ON accessories_categories FOR ALL USING (shop_id = auth_shop_id());

CREATE POLICY "Workers can view accessory categories"
  ON accessories_categories FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- ACCESSORIES TRANSACTIONS ----
CREATE POLICY "Owner full access to accessory transactions"
  ON accessories_transactions FOR ALL USING (shop_id = auth_shop_id());

CREATE POLICY "Workers can insert accessory transactions"
  ON accessories_transactions FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

CREATE POLICY "Workers can view accessory transactions"
  ON accessories_transactions FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- COUNT REQUESTS ----
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
CREATE POLICY "Owner can view activity log"
  ON activity_log FOR SELECT USING (shop_id = auth_shop_id());

CREATE POLICY "Workers can insert activity log"
  ON activity_log FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- SNAPSHOTS ----
CREATE POLICY "Owner full access to snapshots"
  ON snapshots FOR ALL USING (shop_id = auth_shop_id());

CREATE POLICY "Workers can insert snapshots"
  ON snapshots FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM workers WHERE id::text = current_setting('app.worker_id', true))
  );

-- ---- PAYMENT PROOFS ----
CREATE POLICY "Owner can insert payment proofs"
  ON payment_proofs FOR INSERT WITH CHECK (shop_id = auth_shop_id());

CREATE POLICY "Owner can view payment proofs"
  ON payment_proofs FOR SELECT USING (shop_id = auth_shop_id());

-- ---- CHECKLIST REMINDERS ----
CREATE POLICY "Owner full access to checklist reminders"
  ON checklist_reminders FOR ALL USING (shop_id = auth_shop_id());
