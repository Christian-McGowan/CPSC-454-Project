resource "random_password" "jwt" {
  length  = var.jwt_secret_length
  special = true
}

resource "random_password" "mongo" {
  length  = 24
  special = false
}

resource "random_password" "mongo_root" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name       = "${local.name_prefix}/app"
  kms_key_id = aws_kms_key.app.arn
  tags       = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    mongo_uri  = "mongodb://${var.mongo_username}:${random_password.mongo.result}@${aws_instance.mongo.private_ip}:27017/${var.mongo_db_name}?authSource=admin"
    jwt_secret = random_password.jwt.result
  })
}
