Option Explicit
' run_sql_now.vbs
' Opens Supabase SQL Editor in existing Chrome (Modmaster profile) and runs SQL

Dim WshShell, fso, SQL, tmpFile, f, i, activated
Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

' The full SQL needed to fix all 403 errors + missing columns
SQL = "-- Fix 403 errors: grant service_role access to all tables" & Chr(10) & _
      "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "" & Chr(10) & _
      "-- Add missing columns to sales" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;" & Chr(10) & _
      "" & Chr(10) & _
      "-- Add missing columns to udhaar_records" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;" & Chr(10) & _
      "" & Chr(10) & _
      "-- Add missing columns to accessory_transactions" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;" & Chr(10) & _
      "" & Chr(10) & _
      "-- Add missing columns to accessory_categories" & Chr(10) & _
      "ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_restocked integer DEFAULT 0;" & Chr(10) & _
      "ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_sold integer DEFAULT 0;" & Chr(10) & _
      "" & Chr(10) & _
      "-- Add missing columns to laptops" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS asking_price numeric DEFAULT 0;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS condition text DEFAULT 'used';" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_name text;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_payment text DEFAULT 'cash';" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS notes text;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sale_price numeric;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sold_at timestamptz;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS customer_name text;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS imported_batch_id uuid;" & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_stock';" & Chr(10) & _
      "" & Chr(10) & _
      "-- Disable RLS on all tables (dev mode)" & Chr(10) & _
      "ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE daily_cash_records DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE udhaar_payments DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE supplier_credits DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE sales DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE laptops DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE udhaar_records DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE accessory_categories DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE accessory_transactions DISABLE ROW LEVEL SECURITY;" & Chr(10) & _
      "ALTER TABLE shops DISABLE ROW LEVEL SECURITY;"

' Write SQL to temp file then copy to clipboard using PowerShell
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_sql.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close

' Copy to clipboard
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True
WScript.Sleep 500

' Open URL in existing Chrome (opens as new tab in current Chrome window)
WshShell.Run "cmd /c start """" ""https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new""", 1, False

' Wait for page to load (15 seconds)
WScript.Sleep 15000

' Try to activate Chrome window with Supabase
Dim titles(5)
titles(0) = "SQL Editor"
titles(1) = "Supabase"
titles(2) = "New query"
titles(3) = "pcbwdbzfsnvpeiytpijr"
titles(4) = "Google Chrome"
titles(5) = "Chrome"

activated = False
For i = 0 To 5
    If WshShell.AppActivate(titles(i)) Then
        activated = True
        WScript.Sleep 1000
        Exit For
    End If
Next

If Not activated Then
    WScript.Echo "Could not find Chrome window. SQL is in clipboard - please paste it manually."
    WScript.Quit
End If

' Click in the editor area (Ctrl+A to select all, Ctrl+V to paste)
WshShell.SendKeys "^a"
WScript.Sleep 300
WshShell.SendKeys "^v"
WScript.Sleep 800

' Ctrl+Enter = Run in Supabase SQL Editor
WshShell.SendKeys "^{ENTER}"

WScript.Sleep 5000
WScript.Echo "SQL sent! Check Chrome to verify it ran successfully."
