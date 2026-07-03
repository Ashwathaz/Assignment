# System Architecture Deep Dive
> **Detailed Review of Components, Workflows, Security Envelopes, and Telemetry Flows**

This document provides a detailed breakdown of each component shown in the [system architecture diagram](docs/Archietecture.png). It describes their functionality, interfaces, and operational roles within the hybrid cloud infrastructure.

---

## 📐 Overall Flow Diagram Overview

The architecture is divided into two operational segments:
1.  **Continuous Integration and Continuous Deployment (CI/CD)**: Governed by the Developer $\rightarrow$ GitHub $\rightarrow$ Webhook $\rightarrow$ Jenkins $\rightarrow$ Docker Build $\rightarrow$ Docker Container $\rightarrow$ S3 Backup lifecycle.
2.  **Serverless Core Application Flow**: Governed by the End User $\rightarrow$ DuckDNS $\rightarrow$ HTTPS $\rightarrow$ API Gateway $\rightarrow$ Lambda $\rightarrow$ S3 / DynamoDB database read/write.

Both paths are integrated through shared security bounds (IAM, Security Groups) and unified telemetry (CloudWatch, performance load testing).

---

## 🔍 Component Breakdown

### 👨‍💻 1. Developer
*   **Role**: The human agent driving code changes.
*   **Function**: Authors source code, styling sheets, configuration definitions, and pipeline workflows on a local machine.
*   **Interface**: Interacts with the repository using Git, verifying builds locally before pushing them to the remote repository.

### 🐙 2. GitHub (Repository)
*   **Role**: Distributed source control system hosting the codebase.
*   **Function**: Acts as the single source of truth for the application files. Tracks version history, branches, merge requests, and triggers pipeline automation.
*   **Interface**: Securely stores the code and provides an API and Webhooks engine to alert third-party systems of incoming commits.

### 🔌 3. Webhook Trigger
*   **Role**: Event-driven notification bridge.
*   **Function**: Sends HTTP POST requests containing commit metadata to Jenkins when code is pushed.
*   **Interface**: Runs over port `8080` (HTTP) from GitHub's public IP range to the Jenkins webhook endpoint (`http://13.201.11.78:8080/github-webhook/`).

### 🤵 4. Jenkins (Running on EC2)
*   **Role**: Orchestrator of the CI/CD pipeline.
*   **Function**: Runs inside a Docker container using a Docker-out-of-Docker socket mount (`/var/run/docker.sock`). Automates execution stages defined in the [Jenkinsfile](file:///a:/Assignment/jenkins/Jenkinsfile):
    1.  **Checkout**: Pulls code from GitHub.
    2.  **Read Metadata**: Reads [metadata.json](file:///a:/Assignment/config/metadata.json) to dynamically extract the container port mapping.
    3.  **Build Docker Image**: Compiles the Dockerfile into a stamped container image.
    4.  **Deploy Container**: Stops old containers and spins up the new application container.
    5.  **Health Check**: Curls the local container port to verify success.
    6.  **Backup**: Uploads static build folders and configurations to Amazon S3.
*   **Interface**: Exposes a web interface on port `8080` for configuration and log tracking.

### 🐳 5. Docker Engine
*   **Role**: Application container runtime engine.
*   **Function**: Manages the building, packaging, running, and destruction of isolated environment containers.
*   **Interface**: Interacts via the Docker socket on the host (`/var/run/docker.sock`), allowing Jenkins to build and control sibling containers.

### 🖥️ 6. EC2 Instance (`t2.micro`)
*   **Role**: Host virtualization server inside the VPC.
*   **Function**: Runs Ubuntu 22.04 LTS to host the Docker daemon, Jenkins container, application containers, Nginx reverse proxy, and CloudWatch system agent.
*   **Interface**: Exposes a single public Elastic IP, allowing inbound traffic on ports 22, 80, 443, and 8080.

### 🛡️ 7. Security Groups
*   **Role**: Host-level stateful firewall.
*   **Function**: Restricts inbound and outbound network access to the EC2 host.
*   **Interface**: Evaluates incoming connection rules:
    *   Port 22 (SSH) and Port 8080 (Jenkins) are restricted to the administrator's IP address.
    *   Port 80 (HTTP) and Port 443 (HTTPS) are open to all traffic (`0.0.0.0/0`).

### 🟢 8. IAM (Identity & Access Management)
*   **Role**: Access control policy evaluator.
*   **Function**: Grants temporary AWS security credentials to the EC2 instance using the `EC2-App-Role` role, eliminating the need for hardcoded keys on the host.
*   **Interface**: Attaches permission policies allowing the EC2 host to write to S3 and interact with CloudWatch Agent endpoints.

### 🔒 9. HTTPS / TLS Termination
*   **Role**: Data transport encryption gateway.
*   **Function**: Terminates incoming SSL/TLS tunnels on Nginx (via Certbot/Let's Encrypt) and redirects HTTP requests to HTTPS, protecting traffic from interception.
*   **Interface**: Listens on public port `443` and forwards requests to the application running on port `8081` on the local loopback interface.

### 🎛️ 10. Amazon API Gateway
*   **Role**: Serverless API entry point.
*   **Function**: Receives API traffic, manages TLS handshakes, handles client rate limits, and routes requests to the backend Lambda execution environment.
*   **Interface**: Listens on public HTTPS (port `443`) and routes `/health` endpoint traffic to AWS Lambda.

### ⚡ 11. AWS Lambda
*   **Role**: Serverless execution handler.
*   **Function**: Executes backend logic in Python 3.11 on-demand. When triggered, it queries S3 to verify backup logs and returns status reports to API Gateway.
*   **Interface**: Triggers automatically on API Gateway requests, returning JSON bodies and pushing runtime logs to CloudWatch.

### 🪣 12. Amazon S3 (Simple Storage Service)
*   **Role**: Encrypted object storage bucket.
*   **Function**: Stores build artifacts synced by the Jenkins pipeline and serves dynamic data read by the AWS Lambda backend.
*   **Interface**: Accessible via the AWS S3 API over HTTPS using IAM credentials.

### 🔍 13. Amazon CloudWatch
*   **Role**: Observability dashboard and monitoring service.
*   **Function**: Aggregates host performance metrics (CPU, RAM, Disk) sent by the CloudWatch Agent, collects application/Nginx log streams, and triggers SNS email notifications if thresholds are exceeded.
*   **Interface**: Visualizes logs, metrics, dashboards, and alarms in the AWS console.

### 🧪 14. k6 (Load Generator)
*   **Role**: Performance stress-testing harness.
*   **Function**: Simulates concurrent virtual users hitting the dynamic HTTPS endpoint. Measures latencies (average, p95), connection error rates, and throughput.
*   **Interface**: Runs from an external machine to prevent host resource interference, outputting telemetry summaries.
