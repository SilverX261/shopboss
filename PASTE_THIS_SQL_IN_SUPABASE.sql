-- Fix 403 errors: grant service_role access to all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;

-- Also add missing columns to avoid 400 errors
ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';
ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';
ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;