variable "project_name" {
  type    = string
  default = "aegiscare"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "app_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "db_subnet_cidrs" {
  type    = list(string)
  default = ["10.20.20.0/24", "10.20.21.0/24"]
}

variable "allowed_ingress_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "frontend_image" {
  type        = string
  description = "ECR image URI for the frontend container"
  default     = "nginx:1.27-alpine"
}

variable "backend_image" {
  type        = string
  description = "ECR image URI for the backend container"
  default     = "public.ecr.aws/docker/library/node:22-alpine"
}

variable "acm_certificate_arn" {
  type        = string
  description = "Existing ACM certificate ARN for HTTPS listener"
}

variable "frontend_desired_count" {
  type    = number
  default = 1
}

variable "backend_desired_count" {
  type    = number
  default = 1
}

variable "backend_container_port" {
  type    = number
  default = 5000
}

variable "frontend_container_port" {
  type    = number
  default = 80
}

variable "ecs_task_cpu" {
  type    = number
  default = 512
}

variable "ecs_task_memory" {
  type    = number
  default = 1024
}

variable "mongo_instance_type" {
  type    = string
  default = "t3.small"
}

variable "mongo_db_name" {
  type    = string
  default = "aegiscare"
}

variable "mongo_username" {
  type    = string
  default = "appuser"
}

variable "jwt_secret_length" {
  type    = number
  default = 32
}


variable "enable_vpc_endpoints" {
  type        = bool
  description = "Create private VPC endpoints for AWS service traffic from private subnets"
  default     = true
}

variable "enable_mongo_snapshots" {
  type        = bool
  description = "Create a daily DLM snapshot policy for the MongoDB EC2 root volume"
  default     = true
}

variable "alert_email" {
  type        = string
  description = "Optional email address subscribed to SNS security alerts"
  default     = ""
}

variable "enable_guardduty" {
  type        = bool
  description = "Enable GuardDuty detector"
  default     = true
}

variable "enable_waf" {
  type        = bool
  description = "Attach AWS WAF managed rule groups to the ALB"
  default     = true
}

variable "enable_auto_response" {
  type        = bool
  description = "Deploy the EventBridge to Lambda containment workflow"
  default     = true
}

variable "auto_response_mode" {
  type        = string
  description = "Responder mode. Use simulate for demo safety and enforce only after testing."
  default     = "simulate"
}
