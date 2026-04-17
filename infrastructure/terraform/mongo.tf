data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["137112412989"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "mongo" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = var.mongo_instance_type
  subnet_id                   = aws_subnet.db[0].id
  vpc_security_group_ids      = [aws_security_group.mongo.id]
  iam_instance_profile        = aws_iam_instance_profile.mongo.name
  associate_public_ip_address = false
  user_data = templatefile("${path.module}/user_data/mongo-init.sh.tftpl", {
    mongo_username      = var.mongo_username
    mongo_password      = random_password.mongo.result
    mongo_db_name       = var.mongo_db_name
    mongo_root_password = random_password.mongo_root.result
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
    kms_key_id  = aws_kms_key.app.arn
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-mongo" })
}
