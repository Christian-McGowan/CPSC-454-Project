#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

aws inspector2 enable \
  --resource-types EC2 ECR \
  --region "$AWS_REGION" \
  --account-ids "$ACCOUNT_ID"

echo "Amazon Inspector requested for EC2 and ECR in $AWS_REGION"
echo "GuardDuty is provisioned through Terraform in infrastructure/terraform/guardduty.tf"
