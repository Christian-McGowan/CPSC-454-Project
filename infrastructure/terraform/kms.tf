resource "aws_kms_key" "app" {
  description             = "KMS key for ${local.name_prefix} encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  tags                    = merge(local.common_tags, { Name = "${local.name_prefix}-kms" })
}

resource "aws_kms_alias" "app" {
  name          = "alias/${local.name_prefix}"
  target_key_id = aws_kms_key.app.key_id
}
