Option Explicit
Dim WshShell
Set WshShell = WScript.CreateObject("WScript.Shell")

' Activate the SQL editor tab (it's now the active tab showing "Disable Row Level Security")
If WshShell.AppActivate("Disable Row Level Security Across Tables") Then
    WScript.Sleep 800
ElseIf WshShell.AppActivate("Disable Row Level Security") Then
    WScript.Sleep 800
ElseIf WshShell.AppActivate("Supabase") Then
    WScript.Sleep 800
End If

' The SQL is already in the editor - just run it with Ctrl+Enter
WshShell.SendKeys "^{ENTER}"
WScript.Sleep 10000

WScript.Echo "SQL execution triggered!"
