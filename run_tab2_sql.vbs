Option Explicit
Dim WshShell, fso, SQL, tmpFile, f

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

' Write SQL to temp file and copy to clipboard
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_tab2_sql.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True
WScript.Sleep 800

' Step 1: Activate the Modmaster Chrome window (currently shows "Supabase" as active tab)
Dim activated
activated = False

' Try activating by tab title substrings
If WshShell.AppActivate("Disable Row Level") Then
    activated = True
    WScript.Sleep 1000
ElseIf WshShell.AppActivate("Supabase - Google Chrome") Then
    activated = True
    WScript.Sleep 800
    ' Switch to previous tab (Tab 2 = Disable Row Level Security)
    WshShell.SendKeys "^+{TAB}"
    WScript.Sleep 1500
ElseIf WshShell.AppActivate("Confirm your email") Then
    activated = True
    WScript.Sleep 800
    ' Need to go forward 1 tab
    WshShell.SendKeys "^{TAB}"
    WScript.Sleep 1500
End If

If Not activated Then
    ' Last resort: find any Chrome window
    If WshShell.AppActivate("Google Chrome") Then
        WScript.Sleep 800
        WshShell.SendKeys "^+{TAB}"
        WScript.Sleep 1500
    End If
End If

' Now we should be on the "Disable Row Level Security Acr..." tab
' The Supabase SQL editor should be loaded there
' Wait for tab content to be visible
WScript.Sleep 2000

' Click somewhere safe first (middle of window) then use keyboard
' Use Ctrl+` to focus the SQL editor (Supabase shortcut)
' Or just try Ctrl+A to select all and paste
WshShell.SendKeys "^a"
WScript.Sleep 500
WshShell.SendKeys "^v"
WScript.Sleep 1000

' Run the SQL
WshShell.SendKeys "^{ENTER}"
WScript.Sleep 8000

WScript.Echo "Done! SQL should have run in the Supabase SQL Editor (Tab 2)."
