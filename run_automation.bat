@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo =========================================
echo  ShopBoss - Automated Supabase SQL Fix
echo =========================================
echo.
echo This will:
echo  1. Copy the GRANT SQL to your clipboard
echo  2. Open Chrome at Supabase SQL Editor
echo  3. Automatically paste and run the SQL
echo.
echo IMPORTANT: Make sure you are logged into
echo supabase.com in Chrome before continuing!
echo.
echo Press any key when ready (Chrome will open)...
pause >nul
echo.
echo Starting automation...
cscript //nologo automate_supabase.vbs
echo.
echo Done. Run node verify_fixes.js to check results.
pause
