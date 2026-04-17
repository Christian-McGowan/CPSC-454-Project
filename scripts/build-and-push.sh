#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
FRONTEND_REPO="${FRONTEND_REPO:?Set FRONTEND_REPO}"
BACKEND_REPO="${BACKEND_REPO:?Set BACKEND_REPO}"

AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker build --build-arg VITE_API_BASE_URL=/api -t aegiscare-frontend ./frontend
docker build -t aegiscare-backend ./backend

docker tag aegiscare-frontend:latest "$FRONTEND_REPO:latest"
docker tag aegiscare-backend:latest "$BACKEND_REPO:latest"

docker push "$FRONTEND_REPO:latest"
docker push "$BACKEND_REPO:latest"
