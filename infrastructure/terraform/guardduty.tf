resource "aws_guardduty_detector" "main" {
  enable                       = var.enable_guardduty
  finding_publishing_frequency = "FIFTEEN_MINUTES"
  tags                         = merge(local.common_tags, { Name = "${local.name_prefix}-guardduty" })
}
