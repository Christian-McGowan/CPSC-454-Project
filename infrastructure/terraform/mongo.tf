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

  volume_tags = merge(local.common_tags, { Name = "${local.name_prefix}-mongo" })

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-mongo" })
}

resource "aws_iam_role" "dlm" {
  count = var.enable_mongo_snapshots ? 1 : 0
  name  = "${local.name_prefix}-dlm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          Service = "dlm.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "dlm" {
  count      = var.enable_mongo_snapshots ? 1 : 0
  role       = aws_iam_role.dlm[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "mongo_snapshots" {
  count              = var.enable_mongo_snapshots ? 1 : 0
  description        = "Daily snapshots for the MongoDB EC2 volume"
  execution_role_arn = aws_iam_role.dlm[0].arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    schedule {
      name = "daily-retain-seven"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["05:00"]
      }

      retain_rule {
        count = 7
      }

      copy_tags = true
    }

    target_tags = {
      Name = "${local.name_prefix}-mongo"
    }
  }

  tags = local.common_tags
}
