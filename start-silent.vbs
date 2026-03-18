' Silent launcher - no console window flashing
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c C:\Users\DELL\jornl\start.bat", 0, False
Set shell = Nothing
