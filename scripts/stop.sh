#!/bin/bash
docker stop pm-app 2>/dev/null || true
docker rm pm-app 2>/dev/null || true
echo "App stopped"
