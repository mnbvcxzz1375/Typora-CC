@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo  ================================================
echo     Typora-GPT Plugin Installer v1.0
echo  ================================================
echo.

:: ---- Configuration ----
set "TYPORA_DIR=E:\Typora"
set "TYPORA_HTML=%TYPORA_DIR%\resources\window.html"
set "PLUGIN_SRC=%~dp0plugin"
set "TARGET_DIR=%TYPORA_DIR%\resources\typora-gpt"
set "LOADER_SRC=%~dp0loader-embedded.js"
set "PS_SCRIPT=%TEMP%\typora-gpt-inject.ps1"

:: ---- Verify ----
if not exist "%TYPORA_HTML%" (
    echo  [ERROR] Typora not found at: %TYPORA_DIR%
    echo  Please edit TYPORA_DIR in this script.
    goto :done
)

:: ---- Step 1: Copy files ----
echo  [1/3] Copying plugin files...
if exist "%TARGET_DIR%" rmdir /S /Q "%TARGET_DIR%" 2>nul
mkdir "%TARGET_DIR%\plugin\css" 2>nul
for %%f in ("%PLUGIN_SRC%\*.js") do copy /Y "%%f" "%TARGET_DIR%\plugin\" >nul 2>&1
copy /Y "%PLUGIN_SRC%\css\style.css" "%TARGET_DIR%\plugin\css\" >nul 2>&1
copy /Y "%LOADER_SRC%" "%TARGET_DIR%\loader.js" >nul 2>&1

if not exist "%TARGET_DIR%\loader.js" (
    echo  [ERROR] Failed to copy loader.js
    goto :done
)
if not exist "%TARGET_DIR%\plugin\ui.js" (
    echo  [ERROR] Failed to copy plugin files
    goto :done
)
echo        Done.

:: ---- Step 2: Backup ----
echo  [2/3] Backing up window.html...
if not exist "%TYPORA_HTML%.backup" (
    copy /Y "%TYPORA_HTML%" "%TYPORA_HTML%.backup" >nul
    echo        Backup created.
) else (
    echo        Backup exists, skipping.
)

:: ---- Step 3: Inject script tag via PowerShell script file ----
echo  [3/3] Injecting loader into window.html...

:: Write PowerShell script to temp file (avoids all quoting issues)
(
echo $f = '%TYPORA_HTML%'
echo $c = [IO.File]::ReadAllText($f^)
echo $tag = '<!-- Typora-GPT Plugin -->' + [Environment]::NewLine + '<script src="./typora-gpt/loader.js"></script>' + [Environment]::NewLine
echo if ($c -match 'typora-gpt/loader' + [char]0x002E + 'js'^) {
echo     Write-Host 'Already injected, skipping.'
echo     exit 0
echo }
echo $c = $c -replace '</body></html>', ($tag + '</body></html>'^)
echo [IO.File]::WriteAllText($f, $c, [Text.Encoding]::UTF8^)
echo Write-Host 'Injection complete.'
) > "%PS_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
del "%PS_SCRIPT%" 2>nul

:: ---- Verify ----
findstr /C:"typora-gpt/loader.js" "%TYPORA_HTML%" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo  ================================================
    echo   Installation Successful!
    echo  ================================================
    echo.
    echo   1. Restart Typora
    echo   2. Press Ctrl+Shift+G or click the G button
    echo   3. Click gear icon to configure API
    echo.
) else (
    echo.
    echo  [ERROR] Auto-injection failed.
    echo  Please manually add this line before ^</body^> in:
    echo  %TYPORA_HTML%
    echo.
    echo    ^<script src="./typora-gpt/loader.js"^>^</script^>
)

:done
echo.
pause
