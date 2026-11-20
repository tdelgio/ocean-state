# Ocean State on AWS

This stack runs the existing Next.js server. It does not upload a static export to S3.

Ocean State renders on the server. Pages call `getOceanIntelligence()`, keep a short in-memory snapshot cache, and fetch NOAA, NWS, and NDBC from the Node process. Those upstreams are not reliable browser CORS APIs. A static site on S3 would mean rewriting data loading. App Runner keeps the current server, gives it HTTPS, and does not need a NAT gateway to reach the public ocean APIs.

`us-west-2` is the default because it is the closest common commercial region to Maui. CloudFront still answers viewers from the nearest US edge. There is no general-purpose Hawaii region to target instead.

## Architecture

```text
Viewer --HTTPS--> CloudFront (WAF, security headers, access logs)
                     |
                     | HTTPS only, X-Origin-Verify header
                     v
                 App Runner (Next.js standalone container)
                     |
                     +--> private ECR image
                     +--> public NOAA / NWS / NDBC / PacIOOS
```

The container listens on port 3000. App Runner terminates TLS on its own hostname. CloudFront terminates viewer TLS on `*.cloudfront.net` until a domain exists. HTML is not cached. `/_next/static/*` uses the AWS caching-optimized policy.

Direct requests to the App Runner URL are rejected by `src/proxy.ts` unless they carry the origin header or hit `/health`. The health check stays open so App Runner can see the container. The header value is a random password Terraform stores in state. Keep that state bucket private and encrypted.

## Resources

| Resource | Why it is here |
| --- | --- |
| `aws_ecr_repository.app` | Private registry. Immutable tags, scan on push, KMS encryption. |
| `aws_ecr_lifecycle_policy.app` | Keeps the newest 20 images. |
| `aws_kms_key.data` | Customer-managed key with rotation for images and the log buckets in `us-west-2`. |
| `aws_kms_key.waf_logs` | Separate `us-east-1` key because a CloudWatch log group can only use a key in its own region. |
| `aws_iam_role.apprunner_access` | Pulls only this ECR repository. `ecr:GetAuthorizationToken` is account-wide because AWS does not allow a resource ARN for that action. |
| `aws_iam_role.apprunner_instance` | Runtime role with no AWS permissions. The app does not call AWS APIs. |
| `aws_apprunner_service.app` | Runs the container. Egress is the default public path so NOAA is reachable without a NAT gateway. |
| `aws_apprunner_auto_scaling_configuration_version.app` | One instance minimum, two maximum. |
| `aws_cloudfront_distribution.app` | Viewer HTTPS redirect, TLS 1.2+, origin HTTPS only, WAF attached. |
| `aws_cloudfront_response_headers_policy.security` | HSTS, `nosniff`, frame deny, referrer policy, Content-Security-Policy, Permissions-Policy. |
| `aws_wafv2_web_acl.cloudfront` | AWS common rules and the known-bad-inputs rule group, which blocks the Log4j lookup pattern. WAF for CloudFront must live in `us-east-1`. |
| `aws_cloudwatch_log_group.waf` | WAF logs, 365-day retention, encrypted. |
| `aws_s3_bucket.logs` | CloudFront access logs. Public access blocked, KMS, versioning, TLS-only policy, 90-day expiry. |
| `aws_s3_bucket.access_logs` | S3 server access logs for the log buckets. Same private controls. |
| `aws_cloudwatch_log_delivery*` | CloudFront standard logging v2 into the private log bucket. This path does not require a public ACL. |
| `aws_iam_openid_connect_provider.github` | GitHub Actions identity. No long-lived access keys. |
| `aws_iam_role.github_plan` | Pull-request plans only (`repo:tdelgio/ocean-state:pull_request`). Read actions plus an explicit deny on create, update, and delete. |

App Runner writes its own application logs to CloudWatch under `/aws/apprunner/ocean-state/`. The service creates those groups on first boot, so their retention is not set in this stack. After the first deploy, set those groups to 30 days in the CloudWatch console or a follow-up change.

## What this does not create

- The remote state bucket. Steps are below. `backend.tf.example` is the configuration to copy after the bucket exists.
- A custom domain or ACM certificate. CloudFront's default certificate is enough to browse the app. Adding a domain means an `us-east-1` certificate, DNS validation, and an alias on the distribution.
- `terraform apply` from GitHub Actions.

## Rough monthly cost

Low traffic, one small instance always on, `us-west-2` public prices as of late 2026. This is a planning estimate, not a bill.

| Item | Estimate |
| --- | --- |
| App Runner 0.25 vCPU and 1 GB, always on | about $18 |
| CloudFront, Price Class 100, light traffic | about $1–3 |
| WAF Web ACL plus common and known-bad-input rule groups | about $8 |
| Two KMS keys (app region and us-east-1 WAF logs) | $2 |
| ECR, S3 logs, CloudWatch | under $2 |
| **Total** | **about $31–34** |

A NAT gateway was rejected because it adds about $32 before any data processing. A public Application Load Balancer was rejected because it adds about $16–22 and still needs a certificate Tomás does not have yet. Raising App Runner to 1 vCPU and 2 GB is roughly another $40 if the container runs out of memory.

## First-time state bucket

Run these once, with an admin or bootstrap identity. Replace `ACCOUNT_ID`.

```bash
aws s3api create-bucket \
  --bucket ACCOUNT_ID-ocean-state-tfstate \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2
```

`create-bucket` makes the state bucket. `--region us-west-2` is where the bucket lives. `--create-bucket-configuration LocationConstraint=us-west-2` is required for every region except `us-east-1`.

```bash
aws s3api put-public-access-block \
  --bucket ACCOUNT_ID-ocean-state-tfstate \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Turns on all four S3 Block Public Access switches so the state file cannot be made public.

```bash
aws s3api put-bucket-versioning \
  --bucket ACCOUNT_ID-ocean-state-tfstate \
  --versioning-configuration Status=Enabled
```

Keeps prior versions of the state file so a bad apply can be recovered.

```bash
aws s3api put-bucket-encryption \
  --bucket ACCOUNT_ID-ocean-state-tfstate \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
```

Encrypts the state object at rest with SSE-S3. The state contains the origin-verify secret.

`versions.tf` already contains an empty `backend "s3" {}` block. `backend.tf.example` lists the `-backend-config` arguments. Do not add a second backend block.

## Commands Tomás runs

From `infra/`:

```bash
terraform fmt -recursive
```

Rewrites `.tf` files to the canonical layout. `-recursive` includes nested directories. It does not talk to AWS.

```bash
terraform init -backend=false -input=false
```

Downloads the AWS and random providers into `.terraform` without contacting a state bucket. `-backend=false` skips the partial S3 backend. `-input=false` makes Terraform fail instead of asking questions. Use this for validate before the state bucket exists.

```bash
terraform init -input=false \
  -backend-config="bucket=ACCOUNT_ID-ocean-state-tfstate" \
  -backend-config="key=ocean-state/terraform.tfstate" \
  -backend-config="region=us-west-2" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

Same provider download, then stores state in the bucket. `bucket` is the bucket name. `key` is the object path. `region` must match the bucket. `encrypt=true` writes the state with SSE. `use_lockfile=true` locks with a file in that bucket on Terraform 1.10 or newer, so no DynamoDB table is required. Run this only after the bucket exists.

```bash
terraform validate
```

Checks that the configuration is internally consistent. It does not create resources and does not need permissions beyond what `init` already did.

```bash
terraform plan -input=false -out=tfplan \
  -var='image_identifier=ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/ocean-state:GIT_SHA'
```

Shows every resource that would be created or changed. `-out=tfplan` saves that exact plan. `-var` passes the image that App Runner will run. This command needs AWS read permissions. It does not create resources.

Build and push the image before apply, or App Runner will fail health checks:

```bash
aws ecr get-login-password --region us-west-2 \
  | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com
```

Fetches a short-lived ECR password and logs Docker in. Nothing is stored in the repo.

```bash
docker build -t ocean-state:GIT_SHA ..
docker tag ocean-state:GIT_SHA ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/ocean-state:GIT_SHA
docker push ACCOUNT_ID.dkr.ecr.us-west-2.amazonaws.com/ocean-state:GIT_SHA
```

`docker build` runs the root `Dockerfile`. The image tag must be new because the repository is immutable. The first apply has a chicken-and-egg problem: ECR is created by Terraform, so create the repository with one apply that you interrupt is not practical. Create the stack only after ECR exists, or apply once, let ECR succeed, push the image, then apply again with `image_identifier` set. If the first apply fails on App Runner because the image is missing, fix the image and run apply again. The other resources will already be in state.

```bash
terraform apply tfplan
```

Creates or updates only what is in the saved plan. Review the plan first. This is the command that spends money. Do not run it from GitHub Actions.

After apply, set the GitHub repository variable `AWS_PLAN_ROLE_ARN` to the `github_plan_role_arn` output. Optional variable `TF_STATE_BUCKET` makes pull-request plans read the remote state. `AWS_REGION` defaults to `us-west-2` inside the workflow.

## GitHub Actions

`.github/workflows/terraform.yml` runs on pull requests:

1. `terraform fmt -check`
2. `terraform init -backend=false`
3. `terraform validate`
4. `terraform plan` only when `AWS_PLAN_ROLE_ARN` is set, using GitHub OIDC. There is no `apply` job.

Until the role exists, the plan job is skipped and validate still runs.
