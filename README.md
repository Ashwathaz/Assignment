# CI/CD Pipeline for a Static Web App on AWS (Jenkins + Docker + Nginx)

## 30-Second Project Pitch

A static web application deployed on a single AWS EC2 (Ubuntu) instance, containerized with Docker and served by Nginx. Jenkins runs natively on the same instance and automates the full build-to-deploy flow: it builds a Docker image from the app source, deploys the container, runs a health check, and backs up build artifacts to S3. The instance is secured with least-privilege IAM roles and restrictive Security Groups, monitored with Amazon CloudWatch, and load tested with k6.

```text
Git push -> Jenkins pipeline triggers -> Docker image built -> container deployed -> health check -> S3 backup -> CloudWatch monitors -> k6 load tests
```

## Architecture

See [`docs/architecture.svg`](docs/architecture.svg) for the full diagram. Summary:

```text
Developer
    |
    v
GitHub repo  --(webhook)-->  Jenkins (Docker container/service on EC2)
                                   |
                                   v
                        Docker build -> Nginx container (app)
                                   |
                    -------------------------------
                    |              |               |
                    v              v               v
             Port 8081/80    S3 (backups)   CloudWatch Agent
             (Elastic IP)                    (metrics + logs)
                    |                               |
                    v                               v
              End users                     CloudWatch Dashboard
                                             + Alarms (SNS email)

Optional: API Gateway -> Lambda (health/status endpoint)
```

IAM role `EC2-App-Role` is attached to the instance (no static AWS keys anywhere) and scoped to only: S3 access on the one backup bucket, and the CloudWatch agent policy.

## Folder Structure

```text
aws-cicd-static-site/
|-- app/
|   |-- index.html
|   |-- style.css
|-- config/
|   |-- metadata.json
|-- docker/
|   |-- Dockerfile
|-- jenkins/
|   |-- Jenkinsfile
|-- docs/
|   |-- architecture.svg
|   |-- deployment-guide.md
|   |-- security-summary.md
|   |-- load-testing-report.md
|-- k6/
|   |-- loadtest.js
|-- .gitignore
|-- README.md
```

## Important Files

### `app/index.html`, `app/style.css`
Static frontend served by Nginx.

### `config/metadata.json`
```json
{
  "app_name": "AI CI/CD App",
  "port": 8081
}
```
Jenkins reads `port` at deploy time so the port is never hardcoded in the pipeline.

### `docker/Dockerfile`
Builds an `nginx:alpine` image containing the static site. Lightweight, fast to build, minimal attack surface.

### `jenkins/Jenkinsfile`
Declarative pipeline with stages: Checkout -> Read Metadata -> Build Image -> Deploy Container -> Health Check -> Backup to S3.

Note: an earlier version of this project included a Python "validator" stage that fails the pipeline early if required files are missing (a fail-fast gate). It was removed here to keep the pipeline focused on the AWS deployment flow, but it's a legitimate best practice worth mentioning if asked about it in review — file-existence and content checks before build are a cheap way to prevent broken deploys.

## How the Pipeline Works

1. **Checkout** — Jenkins pulls the latest commit via a GitHub webhook trigger.
2. **Read Metadata** — reads `config/metadata.json`, extracts the deployment port.
3. **Build Docker Image** — tags the image `app:<BUILD_NUMBER>` so every build is traceable.
4. **Deploy Container** — stops/removes the old container, runs the new one, with log rotation (`max-size=10m`) so container logs don't fill the disk.
5. **Health Check** — curls the app's own port after deploy; fails the build if the app doesn't respond, instead of silently deploying a broken container.
6. **Backup to S3** — syncs the app folder and metadata to S3 for versioned backup/audit.

## Infrastructure (AWS)

- **EC2**: Ubuntu 22.04/24.04 LTS, `t2.micro` (Free Tier), Elastic IP attached.
- **IAM**: instance role `EC2-App-Role` — S3 access limited to one bucket ARN, plus `CloudWatchAgentServerPolicy`. No access keys stored on the box or in Jenkins.
- **Security Group**: SSH (22) restricted to admin IP only; Jenkins UI (8080) restricted to admin IP only; HTTP (80)/HTTPS (443) open to the world for the app.
- **S3**: private bucket, default encryption (AES256), public access fully blocked. Used for app/config backups.
- **CloudWatch**: agent installed on the instance collecting CPU, memory, disk, and Nginx/Docker logs; dashboard + a CPU-utilization alarm notifying via SNS email.
- **API Gateway + Lambda** (optional add-on): a small Lambda-backed `/health` or `/status` endpoint, satisfying the "API Gateway where applicable" requirement without adding real complexity to a static site.
- **HTTPS**: Let's Encrypt via Certbot if a domain is available; otherwise a documented self-signed cert with ACM+ALB noted as the production-grade alternative.

Full setup commands are in [`docs/deployment-guide.md`](docs/deployment-guide.md).

## Load Testing

`k6/loadtest.js` runs against the live endpoint; results and analysis (latency, throughput, error rate, correlated with CloudWatch CPU/memory) are in [`docs/load-testing-report.md`](docs/load-testing-report.md).

## Security Summary

See [`docs/security-summary.md`](docs/security-summary.md) for IAM policy details, Security Group rules, and hardening notes.

## Possible Improvements (documented, not implemented)

- Move Jenkins off the app host onto its own instance or a managed CI service, so app and CI don't share failure domains.
- Auto Scaling Group + Application Load Balancer for actual horizontal scaling and zero-downtime deploys.
- ACM-issued certificate on an ALB instead of a host-level self-signed/Certbot cert.
- Migrate secrets (if any are added later) to AWS Secrets Manager instead of Jenkins credentials store.
- CloudFront + S3 static hosting as a lower-cost, higher-scale alternative to serving static content from EC2 directly.
