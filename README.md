# AegisCare Portal

AegisCare Portal is a HIPAA-focused healthcare records application built on a MERN stack and designed for a cloud security course project. The application demonstrates how privacy-first healthcare software can be implemented with role-separated access, encrypted storage, audit logging, and cloud security controls.

- **Doctors** can open patient charts, update clinical notes, review allergies and medications, and submit claims.
- **Insurance providers** can review billing claims and update claim status, but they cannot access clinical charts.
- **Admins** can seed the demo dataset and show that role separation and audit logging work in real time.

## What the application does

AegisCare Portal solves one core problem: **different people in healthcare need different slices of the same patient workflow**.

A doctor needs the chart.
An insurance provider needs the billing record.
An auditor needs proof of who touched what.

The portal keeps those needs in one system without exposing everything to everyone.

### Main product areas

#### 1. Overview
The overview page shows the current role, key workflow metrics, the most important records or claims to review next, and the latest audit activity.

#### 2. Patient Records
Doctors and admins can search patient charts, open a detailed record, review diagnoses, medications, allergies, and add chart notes.

Insurance providers are blocked from this view by design.

#### 3. Billing
The billing page contains the claims queue. Doctors can submit claims after care is documented. Insurance providers can review and update claim status without seeing the full chart.

#### 4. Audit Trail
Authentication events, chart access, chart edits, claim updates, and demo seeding actions are written to the audit log.

#### 5. Privacy Center
This page explains the actual privacy model used by the app:
- role-separated access
- audit logging
- KMS-backed encryption in AWS
- NIST SP 800-53 Access Control (AC) and Audit (AU) mapping

## Why this project fits the assignment well

This project is a direct cloud security implementation, not just a themed UI.

### Security focus
- **IAM-style access separation:** the application has distinct roles for doctors, insurers, and admins
- **Privacy-first authorization:** insurers are limited to billing workflows only
- **Auditability:** sensitive actions are written to the audit log
- **Encryption story:** the AWS deployment is designed around KMS customer-managed keys, encrypted storage, and secrets protection
- **Network security story:** the infrastructure baseline uses public/private segmentation so the database and app tier stay off the public internet

### Compliance alignment
The project is framed around **HIPAA-ready privacy controls** and maps especially well to:
- **NIST SP 800-53 AC family** — access control and least privilege
- **NIST SP 800-53 AU family** — audit logging and accountability

## Repository layout

- `frontend/` — React + Vite client
- `backend/` — Express + MongoDB API with auth, patients, billing, privacy, and audit routes
- `infrastructure/terraform/` — AWS provisioning baseline for VPC, ALB, ECS, ECR, EC2/MongoDB, KMS, IAM, logging, and monitoring
- `infrastructure/lambda/` — Lambda automation baseline
- `scripts/` — helper scripts for smoke tests, build/push, and local security checks
- `.github/workflows/` — CI workflow for build and security validation

## Local quick start

### 1. Copy environment files

From the repository root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Start MongoDB with Docker

```bash
docker compose -f docker-compose.dev.yml up mongo mongo-init -d
```

This project maps MongoDB to **localhost:27018** to avoid collisions with an existing local MongoDB service.

### 3. Start the backend

```bash
cd backend
npm install
npm run dev
```

### 4. Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

### 5. Seed demo accounts

In another terminal:

```bash
cd backend
npm run seed:admin
```

That creates:
- the admin account from `backend/.env`
- a demo doctor account: `doctor.demo@aegiscare.local / DoctorDemo1`
- a demo insurer account: `insurer.demo@aegiscare.local / InsurerDemo1`

### 6. Open the app

- Frontend: `http://localhost:5173`
- API health: `http://localhost:5000/health`

## Docker one-command option

If you want the full local stack in one command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## How to demo the portal

The easiest class demo is this:

1. Log in as **doctor**
2. Open **Patient Records** and show a chart
3. Add a care note to a patient
4. Open **Billing** and show the related claim workflow
5. Log out and sign in as **insurance provider**
6. Show that **Patient Records** are blocked
7. Show that **Billing** is still accessible
8. Open **Audit Trail** and show the recorded actions
9. Open **Privacy Center** and explain AC + AU in plain language

### Simple explanation

AegisCare Portal keeps patient care, billing, and privacy controls in one system.
Doctors can use the chart.
Insurance providers can use billing only.
Every sensitive action is logged.
That makes it a strong healthcare example of cloud security, least privilege, and auditability.

## Backend API overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/password-policy`

### Portal data
- `GET /api/portal/summary`
- `GET /api/privacy/overview`
- `GET /api/audit`
- `POST /api/demo/bootstrap`

### Patients
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `PATCH /api/patients/:id`

### Claims
- `GET /api/claims`
- `POST /api/claims`
- `PATCH /api/claims/:id`

## AWS deployment direction

The infrastructure folder is set up as the cloud-security baseline for the assignment. The intended deployment story is:

- public load balancer only at the edge
- private application tier
- private data tier
- KMS customer-managed keys for encrypted storage and secrets
- IAM separation between app execution, admin, and automation roles
- logs and alerts available for security review

For AWS provisioning:

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Then run the normal Terraform workflow:

```bash
terraform init
terraform plan
terraform apply
```

Then build and push application images:

```bash
export FRONTEND_REPO=<frontend_ecr_repository_url>
export BACKEND_REPO=<backend_ecr_repository_url>
export AWS_REGION=us-east-1
bash scripts/build-and-push.sh
```

## Security and testing helpers

Run the smoke test:

```bash
bash scripts/smoke-test.sh
```

Run the local security checks:

```bash
bash scripts/run-local-security-checks.sh
```

These helpers cover things like:
- backend syntax validation
- frontend production build
- Terraform validation
- `npm audit`
- Trivy scanning
- Checkov scanning

## Troubleshooting

### `vite: Permission denied`
Reinstall the frontend dependencies and restore execute bits:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
chmod +x node_modules/.bin/vite
chmod +x node_modules/vite/bin/vite.js
npm run dev
```

### MongoDB auth errors
Make sure the app is connecting to **localhost:27018** locally and that the `mongo-init` service created the `appuser` account for the `aegiscare` database.

### Docker permission denied on `/var/run/docker.sock`
Use `sudo docker ...` on systems where your user is not configured for Docker group access.

### Port 27017 already in use
This project uses **27018** on the host side specifically to avoid that conflict.
