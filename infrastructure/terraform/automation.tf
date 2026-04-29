resource "aws_sns_topic" "alerts" {
  name              = "${local.name_prefix}-security-alerts"
  kms_master_key_id = aws_kms_key.app.arn
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-alerts" })
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.alert_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

data "archive_file" "lambda_responder" {
  type        = "zip"
  source_file = "${path.module}/../lambda/containment_handler.py"
  output_path = "${path.module}/build/containment_handler.zip"
}

resource "aws_cloudwatch_log_group" "lambda_responder" {
  count = var.enable_auto_response ? 1 : 0

  name              = "/aws/lambda/${local.name_prefix}-auto-containment"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.app.arn
  tags              = local.common_tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_responder" {
  count = var.enable_auto_response ? 1 : 0

  name               = "${local.name_prefix}-lambda-responder-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "lambda_responder" {
  count = var.enable_auto_response ? 1 : 0

  name = "${local.name_prefix}-lambda-responder-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeNetworkInterfaces",
          "ec2:ModifyNetworkInterfaceAttribute",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupEgress"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:GetUser",
          "iam:ListAccessKeys",
          "iam:UpdateAccessKey",
          "iam:UpdateLoginProfile"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_responder" {
  count = var.enable_auto_response ? 1 : 0

  role       = aws_iam_role.lambda_responder[0].name
  policy_arn = aws_iam_policy.lambda_responder[0].arn
}

resource "aws_lambda_function" "responder" {
  count = var.enable_auto_response ? 1 : 0

  function_name    = "${local.name_prefix}-auto-containment"
  role             = aws_iam_role.lambda_responder[0].arn
  filename         = data.archive_file.lambda_responder.output_path
  source_code_hash = data.archive_file.lambda_responder.output_base64sha256
  handler          = "containment_handler.handler"
  runtime          = "python3.12"
  timeout          = 30

  environment {
    variables = {
      ALERT_TOPIC_ARN    = aws_sns_topic.alerts.arn
      AUTO_RESPONSE_MODE = var.auto_response_mode
      RESPONSE_TAG       = local.name_prefix
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_responder]

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-lambda-responder" })
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count = var.enable_auto_response ? 1 : 0

  name        = "${local.name_prefix}-guardduty-findings"
  description = "Send GuardDuty findings to the containment Lambda"
  event_pattern = jsonencode({
    source        = ["aws.guardduty"],
    "detail-type" = ["GuardDuty Finding"],
    detail = {
      severity = [{ numeric = [">=", 4] }]
    }
  })
  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "guardduty_to_lambda" {
  count = var.enable_auto_response ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "containment-lambda"
  arn       = aws_lambda_function.responder[0].arn
}

resource "aws_lambda_permission" "guardduty_events" {
  count = var.enable_auto_response ? 1 : 0

  statement_id  = "AllowGuardDutyEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.responder[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.guardduty_findings[0].arn
}

resource "aws_cloudwatch_event_rule" "inspector_findings" {
  count = var.enable_auto_response ? 1 : 0

  name        = "${local.name_prefix}-inspector-findings"
  description = "Send high-severity Inspector findings to the containment Lambda"
  event_pattern = jsonencode({
    source        = ["aws.inspector2"],
    "detail-type" = ["Inspector2 Finding"],
    detail = {
      severity = ["HIGH", "CRITICAL"]
    }
  })
  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "inspector_to_lambda" {
  count = var.enable_auto_response ? 1 : 0

  rule      = aws_cloudwatch_event_rule.inspector_findings[0].name
  target_id = "containment-lambda"
  arn       = aws_lambda_function.responder[0].arn
}

resource "aws_lambda_permission" "inspector_events" {
  count = var.enable_auto_response ? 1 : 0

  statement_id  = "AllowInspectorEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.responder[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.inspector_findings[0].arn
}
