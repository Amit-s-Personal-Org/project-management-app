#!/bin/bash
set -e
cd "$(dirname "$0")/.."

docker volume create pm-data 2>/dev/null || true
docker build -t pm-app .
docker rm -f pm-app 2>/dev/null || true
docker run -d --name pm-app -p 8000:8000 \
  -v pm-data:/data \
  --env-file .env \
  pm-app

echo "App running at http://localhost:8000"
