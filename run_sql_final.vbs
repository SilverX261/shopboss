Option Explicit
Dim WshShell, fso, tmpFile, f
Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

' ONLY the GRANT statements - separate from ALTER TABLE to avoid transaction rollback issues
Dim SQL
SQL = "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(13) & Chr(10) & _
      "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;" & Chr(13) & Chr(10) & _
      "GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, authenticated, anon;"

tmpFile = fso.GetSpecialFolder(2) & "\shopboss_grant_only.txt"
Set f = fso.CreateTextFile(tmpFile, True, False)
f.Write SQL
f.Close
WshShell.Run "powershell -Command ""Get-Content -Path '" & tmpFile & "' -Raw | Set-Clipboard""", 0, True
WScript.Sleep 1000

' Activate the already-open Chrome Profile 3 window with Supabase
If WshShell.AppActivate("Disable Row Level") Then
    WScript.Sleep 800
ElseIf WshShell.AppActivate("SQL Editor") Then
    WScript.Sleep 800
ElseIf WshShell.AppActivate("Supabase") Then
    WScript.Sleep 800
End If

' The CodeMirror editor should be focused. Click INTO it by clicking the center of screen
' Use F6 to cycle focus, then click the editor area using Tab
' First try: just Ctrl+A, Ctrl+V, Ctrl+Enter
WshShell.SendKeys "^a"
WScript.Sleep 400
WshShell.SendKeys "^v"
WScript.Sleep 600
WshShell.SendKeys "^{ENTER}"
WScript.Sleep 5000

WScript.Echo "Grant SQL sent!"
