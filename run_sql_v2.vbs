Option Explicit
Dim WshShell, fso, SQL, tmpFile, f, i, activated
Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

SQL = "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(13) & Chr(10) & _
      "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(13) & Chr(10) & _
      "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(13) & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';" & Chr(13) & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_restocked integer DEFAULT 0;" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_categories ADD COLUMN IF NOT EXISTS units_sold integer DEFAULT 0;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS asking_price numeric DEFAULT 0;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS condition text DEFAULT 'used';" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_name text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS supplier_payment text DEFAULT 'cash';" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS notes text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sale_price numeric;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS sold_at timestamptz;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS customer_name text;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS imported_batch_id uuid;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_stock';" & Chr(13) & Chr(10) & _
      "ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE daily_cash_records DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE udhaar_payments DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE supplier_credits DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE sales DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE laptops DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE udhaar_records DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_categories DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE accessory_transactions DISABLE ROW LEVEL SECURITY;" & Chr(13) & Chr(10) & _
      "ALTER TABLE shops DISABLE ROW LEVEL SECURITY;"

' Step 1: Copy SQL to clipboard
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_grant2.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True
WScript.Sleep 800

' Step 2: Activate an existing Supabase tab in Chrome (Modmaster - already logged in)
activated = False
Dim supabaseTitles(3)
supabaseTitles(0) = "Supabase"
supabaseTitles(1) = "ShopBoss"
supabaseTitles(2) = "SQL Editor"
supabaseTitles(3) = "Google Chrome"

For i = 0 To 3
    If WshShell.AppActivate(supabaseTitles(i)) Then
        activated = True
        WScript.Sleep 600
        Exit For
    End If
Next

If Not activated Then
    WScript.Echo "Could not activate Chrome. SQL is in clipboard."
    WScript.Quit
End If

' Step 3: Open new tab, navigate to SQL editor URL
' Use Ctrl+T for new tab, then type URL
WshShell.SendKeys "^t"
WScript.Sleep 600

' Type the Supabase SQL editor URL in the address bar
WshShell.SendKeys "https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new"
WScript.Sleep 300
WshShell.SendKeys "{ENTER}"

' Step 4: Wait for page to load (20 seconds)
WScript.Sleep 20000

' Step 5: Focus the SQL editor - click via Tab navigation or just paste
' The Supabase SQL editor auto-focuses the CodeMirror on page load
' First Ctrl+A to select all text in editor, then paste our SQL
WshShell.SendKeys "^a"
WScript.Sleep 400
WshShell.SendKeys "^v"
WScript.Sleep 800

' Step 6: Run with Ctrl+Enter
WshShell.SendKeys "^{ENTER}"
WScript.Sleep 6000

WScript.Echo "Done! SQL submitted to Supabase SQL Editor."
