@echo off
setlocal
cd /d "%~dp0"
title keybr.com local server

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js 24 from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 24 (
  echo Warning: this project recommends Node.js 24; found:
  node --version
  echo.
)

if not exist ".env" (
  echo Creating local configuration...
  copy /y ".env.example" ".env" >nul
)

if not exist "node_modules\.bin\lage.cmd" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto :error
)

if /i "%~1"=="rebuild" goto :build
if not exist "root\lib\index.js" goto :build
if not exist "root\public\assets\manifest.json" goto :build
goto :database

:build
echo Compiling the application...
call "node_modules\.bin\lage.cmd" compile --no-cache
if errorlevel 1 goto :error

echo Building browser files...
set "NODE_ENV=development"
call "node_modules\.bin\webpack.cmd"
if errorlevel 1 goto :error

:database
for /f "tokens=1,* delims==" %%A in ('findstr /b "DATABASE_FILENAME=" .env') do set "DATABASE_FILENAME=%%B"
if "%DATABASE_FILENAME:~0,2%"=="~/" set "DATABASE_FILENAME=%USERPROFILE%\%DATABASE_FILENAME:~2%"
if not exist "%DATABASE_FILENAME%" (
  echo Preparing the local database...
  node --enable-source-maps --import @keybr/tsl "packages\devenv\lib\initdb.ts"
  if errorlevel 1 goto :error
)

echo.
echo keybr is starting at http://localhost:3000/
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
node --enable-source-maps ".\root\index.js"
exit /b %ERRORLEVEL%

:error
echo.
echo Setup failed. Review the error above, then run this file again.
pause
exit /b 1
