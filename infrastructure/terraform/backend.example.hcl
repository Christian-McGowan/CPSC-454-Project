# Copy this file to backend.hcl after creating the remote-state bucket and lock table.
# Then run: terraform init -backend-config=backend.hcl
bucket         = "aegiscare-terraform-state-ACCOUNTID"
key            = "aegiscare/dev/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "aegiscare-terraform-locks"
encrypt        = true
