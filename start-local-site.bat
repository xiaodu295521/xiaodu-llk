@echo off
setlocal

set "PROJECT_DIR=%~dp0"

echo [1/3] Entering project directory...
cd /d "%PROJECT_DIR%"

echo [2/3] Starting Node.js server in a new window...
start "LLK Codex Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npm start"

echo [3/3] Waiting for server, then opening browser...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'http://localhost:3000';" ^
  "$maxTry = 30;" ^
  "for ($i = 0; $i -lt $maxTry; $i++) {" ^
  "  try {" ^
  "    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2;" ^
  "    Start-Process $url;" ^
  "    exit 0;" ^
  "  } catch {" ^
  "    Start-Sleep -Seconds 1;" ^
  "  }" ^
  "}" ^
  "Start-Process $url;"

echo Done.
endlocal
