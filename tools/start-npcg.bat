@echo off
rem NPCG: start the local server and open it in the PC browser.
rem The desktop shortcut runs this file. Close this window to stop the server.
rem Phones on the same Wi-Fi can open http://<this PC LAN IP>:8787 while it runs.
cd /d "%~dp0.."
title NPCG server - close this window to stop
netstat -ano | findstr /r /c:":8787 .*LISTENING" >nul
if not errorlevel 1 goto open
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){try{(New-Object Net.Sockets.TcpClient('127.0.0.1',8787)).Close();break}catch{Start-Sleep 1}};Start-Process 'http://localhost:8787'"
call npx.cmd wrangler dev --port 8787 --ip 0.0.0.0
echo.
echo Server stopped. Press any key to close this window.
pause >nul
exit /b
:open
start "" http://localhost:8787
