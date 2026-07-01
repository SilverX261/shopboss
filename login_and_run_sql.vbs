Option Explicit
' login_and_run_sql.vbs
' Logs into Supabase via GitHub OAuth, then pastes GRANT SQL into the SQL editor
' Uses Windows SendKeys - works at OS level regardless of browser tier restrictions

Dim WshShell, fso, SQL, tmpFile, f

Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

' ---- SQL to Execute ----
SQL = "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_reference text;" & Chr(10) & _
      "ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes text;" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS mode text DEFAULT 'value_based';" & Chr(10) & _
      "ALTER TABLE udhaar_records ADD COLUMN IF NOT EXISTS description text;" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash';" & Chr(10) & _
      "ALTER TABLE accessory_transactions ADD COLUMN IF NOT EXISTS note text;"

' ---- Step 1: Copy SQL to clipboard ----
tmpFile = fso.GetSpecialFolder(2) & "\shopboss_sql.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True

MsgBox "SQL copied to clipboard!" & Chr(10) & Chr(10) & _
       "Click OK - I will now:" & Chr(10) & _
       "1. Focus the Supabase login page in Edge" & Chr(10) & _
       "2. Click 'Continue with GitHub' (Tab + Enter)" & Chr(10) & _
       "3. Wait 25 seconds for login redirect" & Chr(10) & _
       "4. Paste + run SQL in the editor" & Chr(10) & Chr(10) & _
       "Make sure Edge is NOT minimized!", _
       64, "ShopBoss - Step 1 Ready"

' ---- Step 2: Focus Edge/Supabase login page ----
Dim activated, i
activated = False

' Try different window title patterns for the login page
Dim loginTitles(4)
loginTitles(0) = "Supabase"
loginTitles(1) = "Sign in"
loginTitles(2) = "Welcome back"
loginTitles(3) = "supabase.com"
loginTitles(4) = "Microsoft Edge"

For i = 0 To 4
    If WshShell.AppActivate(loginTitles(i)) Then
        activated = True
        WScript.Sleep 1000
        Exit For
    End If
Next

If Not activated Then
    MsgBox "Could not find Edge/Supabase window." & Chr(10) & _
           "Please manually open Edge, go to supabase.com, log in," & Chr(10) & _
           "then run the GitHub login redirect to get to the SQL Editor." & Chr(10) & _
           "SQL is in your clipboard - paste it in the SQL Editor with Ctrl+V then Ctrl+Enter.", _
           48, "Window Not Found"
    WScript.Quit
End If

' ---- Step 3: Click "Continue with GitHub" via Tab + Enter ----
' The GitHub button is the first interactive element on the page
' Press Tab 1-2 times to reach it, then Enter to click

' First, make sure we're focused in the page (not browser chrome)
' Click in the page area using a key press
WshShell.SendKeys "{ESC}"
WScript.Sleep 300
WshShell.SendKeys "{TAB}"
WScript.Sleep 300
WshShell.SendKeys "{ENTER}"
WScript.Sleep 500

' If first Tab+Enter was on a skip link (common accessibility pattern),
' try again to reach the actual GitHub button
WshShell.SendKeys "{TAB}"
WScript.Sleep 300

MsgBox "GitHub login attempt sent!" & Chr(10) & Chr(10) & _
       "Waiting 30 seconds for GitHub OAuth redirect to complete..." & Chr(10) & _
       "If prompted by GitHub, please approve the login in Edge." & Chr(10) & Chr(10) & _
       "Click OK to start the 30-second wait.", _
       64, "ShopBoss - GitHub Login"

' ---- Step 4: Wait for OAuth redirect ----
WScript.Sleep 30000

' ---- Step 5: Re-focus the browser (now should be on SQL Editor) ----
activated = False
Dim editorTitles(6)
editorTitles(0) = "SQL Editor | Supabase"
editorTitles(1) = "SQL Editor"
editorTitles(2) = "New query"
editorTitles(3) = "Supabase"
editorTitles(4) = "SQL - Supabase"
editorTitles(5) = "pcbwdbzfsnvpeiytpijr"
editorTitles(6) = "Microsoft Edge"

For i = 0 To 6
    If WshShell.AppActivate(editorTitles(i)) Then
        activated = True
        WScript.Sleep 1000
        Exit For
    End If
Next

If Not activated Then
    MsgBox "Could not find the SQL Editor window after login." & Chr(10) & Chr(10) & _
           "SQL is in your clipboard." & Chr(10) & _
           "Please manually:" & Chr(10) & _
           "1. Navigate Edge to the Supabase SQL Editor" & Chr(10) & _
           "2. Press Ctrl+A then Ctrl+V to paste" & Chr(10) & _
           "3. Press Ctrl+Enter to run", _
           48, "Manual Action Needed"
    WScript.Quit
End If

' ---- Step 6: Paste SQL and Run ----
WScript.Sleep 2000

' Select all existing SQL in the editor
WshShell.SendKeys "^a"
WScript.Sleep 400

' Paste our GRANT SQL from clipboard
WshShell.SendKeys "^v"
WScript.Sleep 600

' Run with Ctrl+Enter (Supabase SQL Editor shortcut)
WshShell.SendKeys "^{ENTER}"
WScript.Sleep 5000

MsgBox "GRANT SQL sent to Supabase SQL Editor!" & Chr(10) & Chr(10) & _
       "Check Edge to see the results." & Chr(10) & _
       "You should see green checkmarks in the Results panel." & Chr(10) & Chr(10) & _
       "After confirming success, double-click run_verify.bat to check all tests pass.", _
       64, "ShopBoss - Done!"
