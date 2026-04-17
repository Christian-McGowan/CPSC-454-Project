#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="$ROOT_DIR/security/evidence"
mkdir -p "$EVIDENCE_DIR"

run_or_warn() {
  local name="$1"
  shift
  echo "[+] Running: $name"
  if "$@"; then
    echo "[+] Completed: $name"
  else
    echo "[!] Warning: $name failed or is unavailable"
  fi
}

capture_cmd() {
  local outfile="$1"
  shift
  "$@" >"$outfile" 2>&1 || true
}

if command -v node >/dev/null 2>&1; then
  capture_cmd "$EVIDENCE_DIR/backend-syntax.txt" bash -lc "cd '$ROOT_DIR/backend' && npm run lint"
else
  echo "node not found; skipping backend syntax checks" | tee "$EVIDENCE_DIR/backend-syntax.txt"
fi

if command -v npm >/dev/null 2>&1; then
  if [ -f "$ROOT_DIR/backend/package.json" ]; then
    capture_cmd "$EVIDENCE_DIR/npm-audit-backend.txt" bash -lc "cd '$ROOT_DIR/backend' && npm audit --audit-level=moderate"
  fi
  if [ -f "$ROOT_DIR/frontend/package.json" ]; then
    capture_cmd "$EVIDENCE_DIR/npm-audit-frontend.txt" bash -lc "cd '$ROOT_DIR/frontend' && npm audit --audit-level=moderate"
  fi
else
  echo "npm not found; skipping npm audit" | tee "$EVIDENCE_DIR/npm-audit-backend.txt"
fi

if command -v trivy >/dev/null 2>&1; then
  capture_cmd "$EVIDENCE_DIR/trivy-fs.txt" trivy fs --scanners vuln,secret,misconfig "$ROOT_DIR"
  capture_cmd "$EVIDENCE_DIR/trivy-config.txt" trivy config "$ROOT_DIR/infrastructure/terraform"
else
  echo "trivy not found; skipping Trivy scans" | tee "$EVIDENCE_DIR/trivy-fs.txt"
fi

if command -v checkov >/dev/null 2>&1; then
  capture_cmd "$EVIDENCE_DIR/checkov.txt" checkov -d "$ROOT_DIR/infrastructure/terraform"
else
  echo "checkov not found; skipping Checkov" | tee "$EVIDENCE_DIR/checkov.txt"
fi

if command -v terraform >/dev/null 2>&1; then
  capture_cmd "$EVIDENCE_DIR/terraform-fmt.txt" terraform -chdir="$ROOT_DIR/infrastructure/terraform" fmt -check
  capture_cmd "$EVIDENCE_DIR/terraform-init-validate.txt" bash -lc "cd '$ROOT_DIR/infrastructure/terraform' && terraform init -backend=false && terraform validate"
else
  echo "terraform not found; skipping Terraform validate" | tee "$EVIDENCE_DIR/terraform-init-validate.txt"
fi

if command -v grep >/dev/null 2>&1; then
  grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude='*.zip' -E "(AKIA[0-9A-Z]{16}|SECRET_KEY|PRIVATE KEY|BEGIN RSA|password\s*=\s*['\"])" "$ROOT_DIR" >"$EVIDENCE_DIR/secret-grep.txt" || true
fi

echo "Security checks complete. Review outputs in $EVIDENCE_DIR"
