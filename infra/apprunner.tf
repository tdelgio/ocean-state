resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

resource "aws_apprunner_auto_scaling_configuration_version" "app" {
  auto_scaling_configuration_name = "ocean-state"
  max_concurrency                 = 80
  min_size                        = 1
  max_size                        = 2
}

resource "aws_apprunner_service" "app" {
  service_name = "ocean-state"

  source_configuration {
    auto_deployments_enabled = false

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_identifier      = var.image_identifier
      image_repository_type = "ECR"

      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NODE_ENV             = "production"
          HOSTNAME             = "0.0.0.0"
          PORT                 = "3000"
          ORIGIN_VERIFY_SECRET = random_password.origin_verify.result
        }
      }
    }
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    ingress_configuration {
      is_publicly_accessible = true
    }
    egress_configuration {
      egress_type = "DEFAULT"
    }
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.app.arn

  depends_on = [aws_iam_role_policy.apprunner_access]
}
