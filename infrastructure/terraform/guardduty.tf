resource "aws_guardduty_detector" "main" {
  count  = var.enable_guardduty ? 1 : 0
  enable = false

  finding_publishing_frequency = "FIFTEEN_MINUTES"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-guardduty"
  })
}
