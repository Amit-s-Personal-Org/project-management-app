@echo off
cd /d "%~dp0\.."

docker volume create pm-data 2>nul
docker build -t pm-app .
docker rm -f pm-app 2>nul
docker run -d --name pm-app -p 8000:8000 ^
  -v pm-data:/data ^
  --env-file .env ^
  pm-app

echo App running at http://localhost:8000
