@echo off
title Minervini Journal - Starting...
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     Minervini Journal Starting...    ║
echo  ╚══════════════════════════════════════╝
echo.

:: Start Backend
echo  [1/2] Starting Backend (FastAPI)...
start "Backend - FastAPI" cmd /k "cd /d C:\Users\DELL\jornl\minervini-api && python -m uvicorn main:app --reload --port 8000"

:: Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend
echo  [2/2] Starting Frontend (React)...
start "Frontend - React" cmd /k "cd /d C:\Users\DELL\jornl\minervini-journal && npm run dev"

:: Wait for frontend
timeout /t 4 /nobreak > nul

:: Open browser
echo  [3/3] Opening Browser...
start http://localhost:5173

echo.
echo  ✅ All services started!
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo.
