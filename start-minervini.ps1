# start-minervini.ps1

# مسار الباكند
cd "C:\Users\DELL\jornl\minervini-api"
.\venv\Scripts\Activate.ps1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PWD`"; uvicorn main:app --reload --port 8000"

# مسار الفرونت
cd "C:\Users\DELL\jornl\minervini-journal"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PWD`"; npm run dev"