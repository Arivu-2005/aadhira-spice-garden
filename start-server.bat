@echo off
title Aadhira Spice Garden Server
echo ====================================================
echo Starting Aadhira Spice Garden Restaurant Web Server
echo ====================================================
echo.
echo Customer Website: http://localhost:3000
echo Admin Dashboard:  http://localhost:3000/admin.html
echo Default Login:    admin / admin123
echo.
echo Press Ctrl+C to stop the server at any time.
echo.
node server/index.js
pause
