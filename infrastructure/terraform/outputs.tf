output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "frontend_ecr_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "mongo_private_ip" {
  value = aws_instance.mongo.private_ip
}

output "app_secret_arn" {
  value     = aws_secretsmanager_secret.app.arn
  sensitive = true
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "guardduty_detector_id" {
  value = length(aws_guardduty_detector.main) > 0 ? aws_guardduty_detector.main[0].id : null
}

output "automation_lambda_name" {
  value = var.enable_auto_response ? aws_lambda_function.responder[0].function_name : null
}

output "waf_web_acl_arn" {
  value = var.enable_waf ? aws_wafv2_web_acl.alb[0].arn : null
}
