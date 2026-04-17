#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:5000}"

echo "[+] Checking API health at $API_BASE/health"
curl -fsS "$API_BASE/health" | tee /tmp/aegiscare-health.json

echo
echo "[+] Health check complete. Review /tmp/aegiscare-health.json for service status."
