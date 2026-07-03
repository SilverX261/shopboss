-- 013_imei_nullable.sql
-- Make laptops.imei optional. Postgres unique constraints allow multiple NULLs,
-- so the existing UNIQUE constraint is kept as-is.
ALTER TABLE laptops ALTER COLUMN imei DROP NOT NULL;
