# Terraform Notes

This Terraform directory provisions the AWS environment for AegisCare Portal.

The baseline architecture is designed for a HIPAA-focused healthcare portal:
- public load balancer at the edge only
- private application tier
- private data tier for the database
- IAM role separation for application tasks and automation
- KMS-backed encryption for storage, logs, and secrets
- logging, alerts, and audit-friendly cloud telemetry

## Main resources
- VPC and subnet tiers
- ALB and listeners
- ECS cluster, task definitions, and services
- ECR repositories
- EC2 MongoDB host
- IAM roles and policies
- KMS customer-managed key
- Secrets Manager secret
- S3 log bucket
- CloudWatch log groups and alarms
- GuardDuty detector
- WAF web ACL
- SNS topic for security alerts
- EventBridge rules and Lambda responder

## Safe demo default
The Lambda responder defaults to:

```hcl
auto_response_mode = "simulate"
```

That means the automation path is deployed and demonstrable, but does not perform destructive or risky response actions until the team explicitly decides to test that mode.
