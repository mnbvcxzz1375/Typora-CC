@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo  Typora-GPT Plugin Uninstaller
echo  ==============================
echo.

set "TYPORA_DIR=E:\Typora"
set "TYPORA_HTML=%TYPORA_DIR%\resources\window.html"
set "TARGET_DIR=%TYPORA_DIR%\resources\typora-gpt"

:: Check if installed
findstr /C:"typora-gpt" "%TYPORA_HTML%" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Plugin is not currently installed.
    pause
    exit /b 0
)

:: Remove injection from window.html
echo  Removing loader from window.html...
findstr /V /C:"typora-gpt" "%TYPORA_HTML%" > "%TYPORA_HTML%.tmp"
move /Y "%TYPORA_HTML%.tmp" "%TYPORA_HTML%" >nul

:: Remove plugin files
echo  Removing plugin files...
if exist "%TARGET_DIR%" rmdir /S /Q "%TARGET_DIR%"

:: Offer to restore backup
if exist "%TYPORA_HTML%.backup" (
    set /p "RESTORE=  Restore original window.html from backup? (y/n): "
    if /i "!RESTORE!"=="y" (
        copy /Y "%TYPORA_HTML%.backup" "%TYPORA_HTML%" >nul
        echo  Original file restored.
    )
)

echo.
echo  Uninstallation complete. Please restart Typora.
echo.
pause
