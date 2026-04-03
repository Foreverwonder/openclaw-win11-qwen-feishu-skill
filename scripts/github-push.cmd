@echo off
setlocal
set "PATH=C:\Program Files\GitHub CLI;C:\Program Files\Git\cmd;%PATH%"

echo ========================================
echo GitHub Push for openclaw-win11-qwen
echo ========================================
echo.

cd /d "D:\AI_Projects\openclaw"

rem Ensure we're in a git repo
if not exist ".git" (
    echo .git directory not found - this script assumes git has been initialized
    pause
    exit /b 1
)

rem Check auth status
echo Checking GitHub auth status...
gh auth status 2>&1 | findstr "You are logged into"
if errorlevel 1 (
    echo.
    echo GitHub is NOT logged in yet.
    echo Please run the following command yourself:
    echo   gh auth login --web
    echo.
    echo Then re-run this script to push.
    pause
    exit /b 1
)

echo Already logged in. Creating or updating remote repo...

rem Try to create or get the repo
set "REPO_NAME=openclaw-win11-qwen"

rem Check if remote already exists
set "REMOTE_EXISTS=0"
git remote get-url origin 2>nul && set "REMOTE_EXISTS=1"

if "%REMOTE_EXISTS%"=="1" (
    echo Remote already exists. Pushing changes...
    git add -A
    git commit -m "Update: OpenRouter Qwen 3.6 Plus switch + Feishu session delivery docs" --allow-empty-message
    git push -u origin master
    goto :done
)

echo Creating new private repository: %REPO_NAME%

rem Create the repo (user will need to confirm browser auth)
gh repo create "%REPO_NAME%" --private --source=. --push --remote=origin master

if errorlevel 1 (
    echo.
    echo Repo creation failed. You may need to create it manually at:
    echo https://github.com/new
    echo Then run:
    echo   git remote add origin https://github.com/YOUR_USERNAME/%REPO_NAME%.git
    echo   git branch -M master
    echo   git push -u origin master
    pause
    exit /b 1
)

:done
echo.
echo ========================================
echo Done! Repository pushed successfully.
echo ========================================
pause
