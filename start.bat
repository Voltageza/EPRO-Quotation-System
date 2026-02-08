@echo off
title EPRO Quotation System
echo ============================================
echo   Electrical Pro - Quotation System v1.0
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Navigate to project directory
cd /d "%~dp0"

:: Install dependencies if node_modules missing
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install
)
if not exist "server\node_modules" (
    echo Installing server dependencies...
    cd server && call npm install && cd ..
)
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client && call npm install && cd ..
)

:: Create data directory if missing
if not exist "server\data" mkdir server\data

:: Build client if dist missing
if not exist "client\dist" (
    echo Building client...
    cd client && call npm run build && cd ..
)

:: Run database migrations
echo Running database migrations...
cd server && call npx ts-node src/database/migrate.ts && cd ..

:: Start the server
echo.
echo Starting server...
echo Press Ctrl+C to stop.
echo.
cd server && call npm start
