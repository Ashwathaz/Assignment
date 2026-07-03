# Security Summary

## IAM
- No IAM users with long-lived access keys are used anywhere in this project. The EC2 instance authenticates to AWS via an attached IAM role (`EC2-App-Role`).
- The role's S3 permissions are scoped to a single bucket ARN (not `*`), and limited to `PutObject`, `GetObject`, `ListBucket`.
- The role additionally has only `CloudWatchAgentServerPolicy` — no EC2, IAM, or other service permissions attached.

## Network / Security Groups
- SSH (22) and the Jenkins UI (8080) are restricted to a single admin IP (`/32`), not open to the internet.
- Only HTTP (80) and HTTPS (443) are open publicly, since those are the only ports end users need.
- No database or backend ports are exposed (this deployment is a static site with no DB).

## Secrets Management
- No credentials are hardcoded in the Jenkinsfile, Dockerfile, or application code.
- Any future secrets (API keys, tokens) would be stored in Jenkins' built-in credentials store or migrated to AWS Secrets Manager — not committed to the repo.

## S3
- Bucket has default server-side encryption (AES256) enabled.
- Public access is fully blocked at the bucket level (ACLs, bucket policy, and account-level all blocked).

## Container / Host Hardening
- Base image is `nginx:alpine` — small attack surface, minimal packages.
- Docker container logs are size-capped (`max-size=10m`) to prevent disk exhaustion attacks/incidents.
- Host OS patched via `apt-get update && apt-get upgrade` at provisioning time.

## HTTPS
- TLS terminated via Let's Encrypt/Certbot where a domain is available.
- If no domain was available at submission time, a self-signed certificate was used instead, with the limitation documented here: production deployments should use an ACM-issued certificate behind an Application Load Balancer rather than a host-level self-signed cert.

## Known Limitations / Next Steps
- Single EC2 instance is a single point of failure — an Auto Scaling Group + ALB would remove this.
- No WAF in front of the app — AWS WAF would add protection against common web exploits (SQLi, XSS attempts, bot traffic) if this app grew beyond static content.
- Jenkins currently shares the same host as the application; in a larger setup these would be isolated onto separate instances so a CI compromise can't directly touch the running app.
