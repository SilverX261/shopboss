@echo off
cd /d "E:\Claude Code\ShopBoss\shopboss"
echo Running npm run build...
npm run build > build_output.txt 2>&1
echo.
echo Build complete. Output saved to build_output.txt
