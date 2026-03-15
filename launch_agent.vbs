Set WshShell = CreateObject("WScript.Shell")
' Launch the agent with NoWindow (0) and don't wait for exit (False)
WshShell.Run "python agent.py", 0, False
