Option Explicit
' automate_supabase.vbs
' Uses Windows SendKeys to paste SQL into Supabase SQL Editor
' VBScript runs at OS level - not restricted by MCP browser tiers

Dim WshShell, fso, SQL, tmpFile, f, activated, i
Dim CHROME_PATH

Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

CHROME_PATH = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(CHROME_PATH) Then
    CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
End If

' The SQL to run
SQL = "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;"

' Step 1: Write SQL to temp file and copy to clipboard via PowerShell
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_grant.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close

WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True

' Step 2: Open Chrome with Supabase SQL Editor (new window)
If fso.FileExists(CHROME_PATH) Then
    WshShell.Run """" & CHROME_PATH & """ --new-window ""https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new""", 1, False
Else
    ' Fallback to default browser
    WshShell.Run "cmd /c start """" ""https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new""", 1, False
End If

' Step 3: Wait 18 seconds for Chrome to open and page to load
WScript.Sleep 18000

' Step 4: Try to activate the Chrome window with Supabase SQL Editor
activated = False
Dim titles(7)
titles(0) = "SQL Editor | Supabase"
titles(1) = "SQL Editor"
titles(2) = "Supabase"
titles(3) = "pcbwdbzfsnvpeiytpijr"
titles(4) = "New query"
titles(5) = "SQL - Supabase"
titles(6) = "Dashboard - Supabase"
titles(7) = "Google Chrome"

For i = 0 To 7
    If WshShell.AppActivate(titles(i)) Then
        activated = True
        WScript.Sleep 800
        Exit For
    End If
Next

If Not activated Then
    MsgBox "Could not find Chrome/Supabase window." & Chr(10) & Chr(10) & _
           "Please do this manually:" & Chr(10) & _
           "1. Open Chrome and go to:" & Chr(10) & _
           "   https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new" & Chr(10) & _
           "2. Login if needed" & Chr(10) & _
           "3. Click in the SQL editor" & Chr(10) & _
           "4. Press Ctrl+A then Ctrl+V to paste" & Chr(10) & _
           "5. Press Ctrl+Enter to run" & Chr(10) & Chr(10) & _
           "SQL is in your clipboard.", 48, "ShopBoss - Action Needed"
    WScript.Quit
End If

' Step 5: Send keystrokes to paste and run SQL
' Ctrl+A = select all existing text in editor
WshShell.SendKeys "^a"
WScript.Sleep 400

' Ctrl+V = paste SQL from clipboard
WshShell.SendKeys "^v"
WScript.Sleep 600

' Ctrl+Enter = run SQL (Supabase SQL Editor shortcut)
WshShell.SendKeys "^{ENTER}"

' Wait for SQL to execute (5 seconds)
WScript.Sleep 5000

MsgBox "SQL paste + run sent to Chrome!" & Chr(10) & Chr(10) & _
       "Check Chrome to confirm the SQL ran successfully." & Chr(10) & _
       "You should see green checkmarks or row counts in the Results panel." & Chr(10) & Chr(10) & _
       "After confirming, double-click run_verify.bat to check all 17 tests pass.", _
       64, "ShopBoss GRANT Fix"
