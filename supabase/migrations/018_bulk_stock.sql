-- Bulk stock support: quantity tracking on laptops, per-sale serial capture
-- (applied to remote via MCP as: bulk_stock_quantity, laptop_status_out_of_stock)

ALTER TABLE laptops
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_bulk boolean NOT NULL DEFAULT false;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_serial_number text;

-- Bulk items whose quantity reaches 0 stay visible as out of stock
ALTER TYPE laptop_status ADD VALUE IF NOT EXISTS 'out_of_stock';
