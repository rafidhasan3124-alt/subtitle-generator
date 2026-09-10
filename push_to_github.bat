@echo off
setlocal
echo ===================================================
echo   Pushing Subtitle Generator Updates to GitHub
echo ===================================================
echo.

set "GIT_CMD=%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe"
if not exist "%GIT_CMD%" (
    set "GIT_CMD=git"
)

cd /d "%~dp0"

echo Current commit:
"%GIT_CMD%" log -n 1 --oneline
echo.

echo Attempting push to origin main...
"%GIT_CMD%" push origin main

if %errorlevel% neq 0 (
    echo.
    echo ===================================================
    echo   GitHub Authentication Required
    echo ===================================================
    echo If prompted, enter your GitHub Username and
    echo Personal Access Token (PAT) as password.
    echo You can create a token at: https://github.com/settings/tokens
    echo.
    pause
) else (
    echo.
    echo [SUCCESS] Successfully updated GitHub repository!
    pause
)
