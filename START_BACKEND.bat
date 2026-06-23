@echo off
title PLAY Music App - Backend Server
color 0D

:: Try to find Node.js
set "NODE_EXE=node"
set "NPM_EXE=npm"
set "NODE_DIR=C:\AI\nodejs\node-v22.16.0-win-x64"

if exist "%NODE_DIR%\node.exe" (
    set "NODE_EXE=%NODE_DIR%\node.exe"
    set "NPM_EXE=%NODE_DIR%\npm.cmd"
    set "PATH=%NODE_DIR%;%PATH%"
) else (
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Node.js is not installed!
        echo  Please install Node.js:
        echo    1. Go to https://nodejs.org
        echo    2. Download the LTS installer
        echo    3. Install it, then run this script again
        echo.
        pause
        exit /b 1
    )
)

echo.
echo  ============================================
echo   PLAY Music Backend Server
echo  ============================================
echo.
echo [OK] Node.js found: 
"%NODE_EXE%" --version

:: Check if yt-dlp.exe exists
if not exist "%~dp0yt-dlp.exe" (
    echo [*] Downloading yt-dlp (one-time, ~11MB)...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%~dp0yt-dlp.exe' -UseBasicParsing"
    if exist "%~dp0yt-dlp.exe" (
        echo [OK] yt-dlp downloaded!
    ) else (
        echo [ERROR] Could not download yt-dlp. Check your internet connection.
        pause
        exit /b 1
    )
) else (
    echo [OK] yt-dlp found
)

:: Install npm dependencies if needed
if not exist "%~dp0node_modules" (
    echo [*] Installing server dependencies (first time only)...
    cd /d "%~dp0"
    "%NPM_EXE%" config set strict-ssl false
    "%NPM_EXE%" install
    echo [OK] Dependencies installed!
) else (
    echo [OK] Dependencies already installed
)

:: Detect and show local IP for real device connection
echo.
echo  ============================================
echo   For REAL Android device (same WiFi):
echo  ============================================
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    setlocal EnableDelayedExpansion
    set IP=!IP: =!
    echo   http://!IP!:3000/
    endlocal
)
echo.
echo   Edit ApiClient.kt and set BASE_URL to one of the above
echo   (Your phone and PC must be on the same WiFi network)
echo.
echo  ============================================
echo   For Android EMULATOR: already configured
echo   (uses 10.0.2.2 automatically)
echo  ============================================
echo.

cd /d "%~dp0"
echo  [STARTING] PLAY Music Backend on port 3000...
echo.
"%NODE_EXE%" server.js
pause
