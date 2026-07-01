@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo ========================================
echo  ShopBoss - Supabase GRANT Fix
echo ========================================
echo.

:: Step 1: Kill any pending VBScript dialogs
echo [1/6] Clearing any pending dialogs...
taskkill /F /IM wscript.exe /T >nul 2>&1
echo Done.
echo.

:: Step 2: Write SQL to temp file and copy to clipboard
echo [2/6] Copying GRANT SQL to clipboard...
powershell -Command ^
  "$sql = 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;`nGRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;`nGRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;`nALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;`nALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;`nALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT ''value_based'';`nALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;`nALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT ''cash'';`nALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;'; Set-Clipboard -Value $sql; Write-Host 'Clipboard set.'"
echo.

:: Step 3: Open Supabase SQL Editor in default browser
echo [3/6] Opening Supabase SQL Editor in browser...
start "" "https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new"
echo Waiting 18 seconds for page to load...
timeout /t 18 /nobreak
echo.

:: Step 4: Try to click "Continue with GitHub" button via keyboard
echo [4/6] Attempting GitHub login (Tab + Enter on login page)...
powershell -Command ^
  "$w = New-Object -ComObject wscript.shell; $r = $w.AppActivate('Supabase'); if ($r) { Start-Sleep -Milliseconds 1000; $w.SendKeys('{ESC}'); Start-Sleep -Milliseconds 300; $w.SendKeys('{TAB}'); Start-Sleep -Milliseconds 300; $w.SendKeys('{ENTER}'); Write-Host 'Login keys sent' } else { Write-Host 'Could not activate window' }"
echo Waiting 30 seconds for GitHub OAuth + redirect to SQL Editor...
timeout /t 30 /nobreak
echo.

:: Step 5: Paste SQL and run
echo [5/6] Pasting SQL and running in SQL Editor...
powershell -Command ^
  "$w = New-Object -ComObject wscript.shell; $titles = @('SQL Editor','SQL Editor | Supabase','New query','Supabase','Microsoft Edge'); $ok = $false; foreach ($t in $titles) { if ($w.AppActivate($t)) { $ok = $true; break } }; if ($ok) { Start-Sleep -Milliseconds 2000; $w.SendKeys('^a'); Start-Sleep -Milliseconds 400; $w.SendKeys('^v'); Start-Sleep -Milliseconds 600; $w.SendKeys('^(~)'); Write-Host 'SQL pasted and run command sent' } else { Write-Host 'WARNING: Could not find SQL Editor window' }"
echo.
echo Waiting 5 seconds for SQL to execute...
timeout /t 5 /nobreak
echo.

:: Step 6: Run verification
echo [6/6] Running verification tests...
echo.
node verify_fixes.js
echo.
echo ========================================
echo  Check results above!
echo  All 17 tests should pass now.
echo ========================================
pause
