@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo Running ShopBoss fix verification...
node verify_fixes.js > verify_output.txt 2>&1
echo.
echo Done! Results saved to verify_output.txt and verify_results.json
pause
