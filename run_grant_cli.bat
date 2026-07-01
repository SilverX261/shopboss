@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo Checking for Supabase CLI and pg tools...
echo.

REM Check if supabase CLI is available
where supabase >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found Supabase CLI!
    supabase --version
    echo.
    echo Attempting to run GRANT SQL via CLI...
    supabase db execute --project-ref pcbwdbzfsnvpeiytpijr --file PASTE_THIS_SQL_IN_SUPABASE.sql
    if %ERRORLEVEL% EQU 0 (
        echo SUCCESS! SQL executed.
    ) else (
        echo CLI execute failed - trying login first...
        supabase login
    )
    goto :done
)

REM Check for psql
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found psql!
    psql --version
    goto :psql_found
)

REM Check common psql locations
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
    goto :psql_found
)
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
    goto :psql_found
)
if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\14\bin\psql.exe"
    goto :psql_found
)

echo Neither Supabase CLI nor psql found.
echo.
echo Running Node.js fallback to open browser with SQL pre-loaded...
node -e "const {execSync}=require('child_process');execSync('start \"\" \"https://supabase.com/dashboard/project/pcbwdbzfsnvpeiytpijr/sql/new\"',{shell:'cmd.exe'});console.log('Browser opened. SQL is in clipboard - press Ctrl+V in SQL editor then Run.');"
echo.
echo SQL file is at: %CD%\PASTE_THIS_SQL_IN_SUPABASE.sql
echo Contents:
echo.
type PASTE_THIS_SQL_IN_SUPABASE.sql
goto :done

:psql_found
echo Found psql at: %PSQL%
echo.
echo Note: Need DB password from Supabase dashboard (Settings > Database > Connection string)
echo Enter the Supabase DB password (or press Ctrl+C to skip):
set /p DB_PASS=Password:
if "%DB_PASS%"=="" goto :done
psql "postgresql://postgres.pcbwdbzfsnvpeiytpijr:%DB_PASS%@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" -f PASTE_THIS_SQL_IN_SUPABASE.sql
goto :done

:done
echo.
echo Done. Run node verify_fixes.js to check results.
pause
