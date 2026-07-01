Option Explicit
Dim WshShell, fso, SQL, tmpFile, f, i
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
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_sql3.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True
WScript.Sleep 1000

' Step 2: Launch Chrome with Modmaster profile (Profile 3) pointing to SQL editor
Dim chromePath, profileDir, sqlUrl
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chromePath) Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If

profileDir = "Profile 3"
sqlUrl = "https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new"

WshShell.Run """" & chromePath & """ --profile-directory=""" & profileDir & """ """ & sqlUrl & """", 1, False

' Step 3: Wait for Chrome to open and Supabase SQL editor to load (25 seconds)
WScript.Sleep 25000

' Step 4: Find and activate the SQL Editor tab
Dim found, titles(4)
titles(0) = "SQL Editor"
titles(1) = "New query"
titles(2) = "pcbwdbzfsnvpeiytpijr"
titles(3) = "Supabase"
titles(4) = "Google Chrome"

found = False
For i = 0 To 4
    If WshShell.AppActivate(titles(i)) Then
        found = True
        WScript.Sleep 1000
        Exit For
    End If
Next

If Not found Then
    WScript.Echo "Could not activate Chrome SQL editor. SQL is in clipboard."
    WScript.Quit
End If

' Step 5: Click somewhere on the page first to ensure focus
' Then Ctrl+A to select all editor text, Ctrl+V to paste, Ctrl+Enter to run
WshShell.SendKeys "^a"
WScript.Sleep 500
WshShell.SendKeys "^v"
WScript.Sleep 1000
WshShell.SendKeys "^{ENTER}"

WScript.Sleep 8000
WScript.Echo "SQL sent to Supabase SQL Editor via Chrome Modmaster profile (Profile 3)!"
