output "cloudfront_domain" {
  description = "Public HTTPS hostname. Use this until a custom domain is added."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution id."
  value       = aws_cloudfront_distribution.app.id
}

output "apprunner_service_url" {
  description = "Direct App Runner URL. Requests without the origin verify header are rejected by the app, except /health."
  value       = aws_apprunner_service.app.service_url
}

output "ecr_repository_url" {
  description = "Push the Next.js image here before setting image_identifier."
  value       = aws_ecr_repository.app.repository_url
}

output "github_plan_role_arn" {
  description = "Set this as the GitHub repository variable AWS_PLAN_ROLE_ARN after the first apply."
  value       = aws_iam_role.github_plan.arn
}

output "log_bucket" {
  description = "Private bucket that receives CloudFront access logs."
  value       = aws_s3_bucket.logs.bucket
}
