-- 012_widen_imei.sql
-- Widen laptops.imei from varchar(15) to varchar(30).
-- All other tables that store imei/serial already use text — no changes needed there.
ALTER TABLE laptops ALTER COLUMN imei TYPE varchar(30);
