@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo Copying GRANT SQL to clipboard...

(
echo -- Fix 403 errors: grant service_role access to all tables
echo -- Run this in: https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new
echo.
echo GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;
echo GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
echo GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;
echo.
echo -- Also add bank_reference and notes columns to sales if missing
echo ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;
echo ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;
echo.
echo -- Add mode column to udhaar_records if missing
echo ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';
echo ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;
echo.
echo -- Ensure accessory_transactions has all needed columns
echo ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';
echo ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;
) | clip

echo SQL copied to clipboard!
echo.
echo Opening Supabase SQL Editor in Chrome...
start "" "https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new"
echo.
echo INSTRUCTIONS:
echo 1. The Supabase SQL Editor is opening in Chrome
echo 2. Click in the SQL editor area
echo 3. Press Ctrl+A to select all, then Ctrl+V to paste
echo 4. Click the "Run" button
echo 5. Come back here when done - verification will re-run automatically
echo.
timeout /t 8 /nobreak >nul
echo Waiting for you to run the SQL... then running verification...
echo (Close this window after pasting and running the SQL in Supabase)
pause
echo.
echo Re-running verification...
node verify_fixes.js
pause
