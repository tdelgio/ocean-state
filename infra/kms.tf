resource "aws_kms_key" "data" {
  description             = "Encrypts Ocean State logs, container images, and the WAF log group."
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "data" {
  name          = "alias/ocean-state"
  target_key_id = aws_kms_key.data.key_id
}

resource "aws_kms_key" "waf_logs" {
  provider                = aws.us_east_1
  description             = "Encrypts Ocean State WAF logs. CloudWatch log groups are regional, so this key lives in us-east-1 with the WAF."
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "waf_logs" {
  provider      = aws.us_east_1
  name          = "alias/ocean-state-waf-logs"
  target_key_id = aws_kms_key.waf_logs.key_id
}

resource "aws_kms_key_policy" "waf_logs" {
  provider = aws.us_east_1
  key_id   = aws_kms_key.waf_logs.id
  policy   = data.aws_iam_policy_document.waf_logs_kms.json
}

#tfsec:ignore:aws-iam-no-policy-wildcards
data "aws_iam_policy_document" "waf_logs_kms" {
  #checkov:skip=CKV_AWS_356:KMS key policies use Resource * because the key ARN cannot appear inside its own policy.
  #checkov:skip=CKV_AWS_111:Same key-policy constraint. CloudWatch Logs is limited with aws:SourceAccount.
  #checkov:skip=CKV_AWS_109:Same key-policy constraint. The root statement is the AWS-required admin path for the key.
  statement {
    sid    = "AccountRoot"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["logs.us-east-1.amazonaws.com"]
    }
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key_policy" "data" {
  key_id = aws_kms_key.data.id
  policy = data.aws_iam_policy_document.kms.json
}

data "aws_caller_identity" "current" {}

#tfsec:ignore:aws-iam-no-policy-wildcards
data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_356:KMS key policies use Resource * because the key ARN cannot appear inside its own policy. Account root kms:* is what keeps the key manageable.
  #checkov:skip=CKV_AWS_111:Same key-policy constraint. Service principals are limited with aws:SourceAccount or kms:ViaService.
  #checkov:skip=CKV_AWS_109:Same key-policy constraint. The root statement is the AWS-required admin path for the key.
  statement {
    sid    = "AccountRoot"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "LogDelivery"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["delivery.logs.amazonaws.com"]
    }
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid    = "Ecr"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ecr.amazonaws.com"]
    }
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey", "kms:CreateGrant"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ecr.${var.aws_region}.amazonaws.com"]
    }
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["logs.us-east-1.amazonaws.com"]
    }
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}
