@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

REM --- 1. Start ngrok and save URL ---
echo Starting ngrok tunnel...
start "NGROK" cmd /k "npx ngrok http 3000 > ngrok.log"

REM Wait a few seconds for ngrok to start
timeout /t 5 >nul

REM --- 2. Grab public URL from ngrok API ---
for /f "tokens=*" %%i in ('curl -s http://127.0.0.1:4040/api/tunnels ^| findstr /i "public_url"') do (
    set "line=%%i"
    set "line=!line: =!"
    for /f "tokens=2 delims=:" %%a in ("!line!") do set "NGROK_URL=%%a"
)

REM Remove quotes and commas
set NGROK_URL=!NGROK_URL:"=!
set NGROK_URL=!NGROK_URL:,=!

echo Using ngrok URL: !NGROK_URL!

REM --- 3. Update .env.local ---
powershell -Command "(gc .env.local) -replace 'NEXTAUTH_URL=.*', 'NEXTAUTH_URL=""!NGROK_URL!""' | Set-Content .env.local"

echo Updated .env.local with new NEXTAUTH_URL

REM --- 4. Start Next.js dev server ---
start "NEXT" cmd /k "npx next dev --turbo"

REM --- 5. Start Uvicorn price service ---
start "PRICE" cmd /k "python -m uvicorn price_service.main:app --reload --port 8000"

echo All processes started!
pause