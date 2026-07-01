-- ============================================================
-- 009_accessories_tracking.sql
-- Accessories stock & sales tracking (value-pool per category):
--   • accessory_categories: units_restocked, units_sold,
--     last_manual_count, last_manual_count_date
--   • accessory_transactions: payment_type (cash/bank/udhaar)
--
-- Idempotent — safe to run on an existing database. Also folded
-- into 999_final_ready.sql for fresh setups.
-- ============================================================

ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_restocked        integer DEFAULT 0;
ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_sold             integer DEFAULT 0;
ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS last_manual_count      integer;
ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS last_manual_count_date date;

ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';
