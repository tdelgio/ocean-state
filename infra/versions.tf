terraform {
  required_version = ">= 1.10.0"

  # Partial backend. Pass -backend-config when the state bucket exists.
  # `terraform init -backend=false` skips it for fmt/validate and for a plan
  # before remote state is created. The bucket itself is not created here.
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = {
    Project     = "ocean-state"
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
  }

  github_oidc_provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.github_oidc_provider_arn
}
