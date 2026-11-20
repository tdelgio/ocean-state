resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_plan_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:pull_request"]
    }
  }
}

resource "aws_iam_role" "github_plan" {
  name               = "ocean-state-github-plan"
  assume_role_policy = data.aws_iam_policy_document.github_plan_trust.json
  description        = "Read-only role for GitHub Actions pull request terraform plan. It cannot apply."
}

#tfsec:ignore:aws-iam-no-policy-wildcards
data "aws_iam_policy_document" "github_plan" {
  #checkov:skip=CKV_AWS_356:Terraform plan refreshes every resource in the stack. The read actions AWS requires for that are not limited to ARNs that exist before the first apply. A following statement denies writes.
  #checkov:skip=CKV_AWS_108:The role is assumed only from pull requests and cannot create, change, or delete infrastructure.
  statement {
    sid    = "ReadForPlan"
    effect = "Allow"
    actions = [
      "apprunner:Describe*",
      "apprunner:List*",
      "cloudfront:Describe*",
      "cloudfront:Get*",
      "cloudfront:List*",
      "ecr:Describe*",
      "ecr:Get*",
      "ecr:List*",
      "iam:Get*",
      "iam:List*",
      "kms:Describe*",
      "kms:Get*",
      "kms:List*",
      "logs:Describe*",
      "logs:Get*",
      "logs:List*",
      "s3:Get*",
      "s3:List*",
      "sts:GetCallerIdentity",
      "wafv2:Get*",
      "wafv2:List*",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyChanges"
    effect = "Deny"
    actions = [
      "apprunner:Create*",
      "apprunner:Delete*",
      "apprunner:Update*",
      "apprunner:Start*",
      "cloudfront:Create*",
      "cloudfront:Delete*",
      "cloudfront:Update*",
      "ecr:Put*",
      "ecr:Delete*",
      "ecr:Upload*",
      "iam:Create*",
      "iam:Delete*",
      "iam:Put*",
      "iam:Attach*",
      "iam:Detach*",
      "iam:Update*",
      "kms:Create*",
      "kms:Schedule*",
      "kms:Disable*",
      "kms:Enable*",
      "s3:Put*",
      "s3:Delete*",
      "wafv2:Create*",
      "wafv2:Delete*",
      "wafv2:Update*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_plan" {
  name   = "ocean-state-plan-read"
  role   = aws_iam_role.github_plan.id
  policy = data.aws_iam_policy_document.github_plan.json
}

data "aws_iam_policy_document" "apprunner_access_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_access" {
  name               = "ocean-state-apprunner-ecr"
  assume_role_policy = data.aws_iam_policy_document.apprunner_access_trust.json
  description        = "Lets App Runner pull the Ocean State image from this account's private ECR repository."
}

#tfsec:ignore:aws-iam-no-policy-wildcards
data "aws_iam_policy_document" "apprunner_access" {
  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  statement {
    sid       = "DecryptImage"
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "apprunner_access" {
  name   = "ocean-state-ecr-pull"
  role   = aws_iam_role.apprunner_access.id
  policy = data.aws_iam_policy_document.apprunner_access.json
}

data "aws_iam_policy_document" "apprunner_instance_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "ocean-state-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.apprunner_instance_trust.json
  description        = "Runtime identity for the Next.js task. It has no AWS permissions because the app only calls public ocean APIs."
}
