@echo off
docker stop pm-app 2>nul
docker rm pm-app 2>nul
echo App stopped
