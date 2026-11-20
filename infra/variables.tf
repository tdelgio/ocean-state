variable "aws_region" {
  description = "Region for the app, registry, keys, and log buckets. CloudFront and its WAF stay global / us-east-1."
  type        = string
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must look like us-west-2."
  }
}

variable "environment" {
  description = "Tag value for the deployment stage."
  type        = string
  default     = "production"
}

variable "owner" {
  description = "Tag value for the person accountable for the stack."
  type        = string
  default     = "tomas"
}

variable "image_identifier" {
  description = "ECR image to run, including the tag. Example: 123456789012.dkr.ecr.us-west-2.amazonaws.com/ocean-state:GIT_SHA. Push the image before apply."
  type        = string
}

variable "apprunner_cpu" {
  description = "App Runner CPU units. 256 is 0.25 vCPU and must be paired with 512 or 1024 MB."
  type        = string
  default     = "256"
}

variable "apprunner_memory" {
  description = "App Runner memory in MB. 1024 pairs with 0.25 vCPU."
  type        = string
  default     = "1024"
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the read-only plan role, as owner/name."
  type        = string
  default     = "tdelgio/ocean-state"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set false when this AWS account already has one for token.actions.githubusercontent.com."
  type        = bool
  default     = true
}

variable "allowed_country_codes" {
  description = "CloudFront geo allow list. Default is the United States, which includes Hawaii. Add codes such as CA or MX if the audience travels."
  type        = list(string)
  default     = ["US"]
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub OIDC provider ARN. Used only when create_github_oidc_provider is false."
  type        = string
  default     = ""
}
