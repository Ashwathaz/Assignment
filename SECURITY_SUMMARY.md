# Security Summary & Hardening Report
> **Evaluation of System Controls, Network Boundaries, and Compliance Practices**

This report analyzes the security architecture implemented in the project. It describes the configuration of identity management, network traffic boundaries, data protection, and build runner constraints.

---

## 🔒 1. IAM Least Privilege & Identity Control
The primary defense mechanism is the elimination of static AWS credentials (such as Access Keys and Secret Access Keys) on host machines.

*   **Instance Profile Isolation**: The EC2 instance hosts a Docker-out-of-Docker container setup (Jenkins + Application Containers). Instead of saving an AWS credentials file inside the container, an IAM instance profile (`EC2-App-Role`) is attached to the EC2 host. AWS STS (Security Token Service) automatically rotates temporary security tokens every few hours.
*   **Scoped Permissions**: The attached IAM role is explicitly scoped to avoid administrative access.
    *   **Amazon S3 Permissions**: Access is confined to the specific bucket ARN `arn:aws:s3:::backupandstorage-ash`. The wildcard `*` action has been omitted. The allowed actions are restricted to objects needed for the synchronization stages (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject`).
    *   **CloudWatch Logging**: Standard AWS Managed policy `CloudWatchAgentServerPolicy` is assigned. It allows the CloudWatch agent on the host to create log streams and push system performance metrics. It provides no permissions for IAM, databases, or network changes.

---

## 🛡️ 2. Security Groups & Network Boundaries
We restrict the network attack surface by isolating administration endpoints while keeping web endpoints publicly open.

```text
                       [ Inbound Traffic ]
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
[ Admin IP /32 Only ]                           [ Public Internet ]
  |               |                               |               |
  v (Port 22)     v (Port 8080)                   v (Port 80)     v (Port 443)
[ SSH Daemon ]  [ Jenkins UI ]                  [ HTTP Proxy ]  [ HTTPS (SSL/TLS) ]
        |               |                               |               |
        +---------------+---------------+---------------+---------------+
                                        |
                                        v
                               [ EC2 Host / App ]
```

*   **Administration & Access Restrictions (Security Group: `EC2-sg`)**:
    *   **Port 22 (SSH)**: Scoped to a single administrator IP address (`106.222.223.138/32`). This blocks unauthorized SSH access.
    *   **Port 8080 (Jenkins UI)**: Scoped to the same administrator IP address (`106.222.223.138/32`), preventing public access to build history and scripts.
    *   **Port 443 (HTTPS)**: Set up with restriction to the administration IP (`106.222.223.138/32`) during development.
    *   **Port 80 (HTTP)**: Configured as open to all (`0.0.0.0/0`) to allow initial public access and redirect traffic as needed.

---

## 🔑 3. Secrets Management
Hardcoding database strings, API tokens, or cloud keys is blocked by using dynamic variables.

*   **Jenkins Credentials Store**: GitHub private keys and SSH deploy credentials are encrypted at rest by the Jenkins master key and injected only during runtime execution. They are masked in console output.
*   **Environment Injection**: Application configurations are managed using dynamic parameters. For example, the Jenkins pipeline reads the deployment port from [metadata.json](file:///a:/Assignment/config/metadata.json) at build time, ensuring the build file ([Jenkinsfile](file:///a:/Assignment/jenkins/Jenkinsfile)) does not contain hardcoded environmental values.
*   **Production Alternative**: For enterprise workloads, secrets should be stored in **AWS Secrets Manager** or **HashiCorp Vault**, with IAM permissions controlling dynamic secret retrieval at container boot.

---

## 🐳 4. Docker Container Hardening
The containerized deployment utilizes Nginx to serve the static frontend. We isolate this application environment using runtime limitations:

*   **Alpine Base Image**: The [Dockerfile](file:///a:/Assignment/docker/Dockerfile) uses `nginx:alpine`. This minimal Linux environment has a smaller attack surface, omitting unnecessary developer tooling (such as compilers, curl, or package managers) that could be exploited during a container escape.
*   **Memory Restrictions**:
    *   **Build Restriction**: The Docker build stage is capped (`--memory=512m`) to prevent container builds from exhausting the host's memory, which could cause Jenkins or the OS to crash.
    *   **Execution Capping**: The deployed container is limited to a maximum of 256MB of RAM (`--memory=256m`). This blocks memory-leak exploits from crashing the system.
*   **Log Rotation Policies**: Standard Docker containers can write logs indefinitely, potentially causing disk exhaustion. The container configuration enforces log limits:
    ```bash
    --log-driver json-file --log-opt max-size=10m
    ```
    This caps logs to 10 megabytes per container, rotating out old entries to protect host storage.

---

## Let's Encrypt HTTPS / TLS Termination
To protect data in transit:
*   We route request flows through **DuckDNS** (`assignment1ash.duckdns.org`).
*   TLS termination is handled on the host using Nginx and certificates from **Let's Encrypt** (via Certbot). This ensures all traffic between user browsers and the EC2 instance is encrypted via TLS 1.3, mitigating man-in-the-middle (MITM) attacks.
*   Port 80 is configured to automatically redirect to port 443.

---

## 💡 Recommendations for Enterprise Hardening

For production environments, we recommend the following enhancements:

1.  **AWS Web Application Firewall (WAF)**: Deploy AWS WAF in front of the entry point (API Gateway or Application Load Balancer) to filter out SQL injection, cross-site scripting (XSS), and DDoS attacks.
2.  **VPC Private Subnet Isolation**: Move the EC2 application host and Jenkins build server from a public subnet to a private subnet. In this setup, public traffic must pass through an Application Load Balancer (ALB) and a NAT Gateway, with management access routed via a secure AWS Bastion Host or AWS Systems Manager (SSM) Session Manager.
3.  **Static Application Security Testing (SAST)**: Add stages in the Jenkins pipeline to run security scans (such as **Trivy** for Docker vulnerability scanning, and **SonarQube** or **Snyk** for code scanning) before building images.
4.  **S3 Bucket Hardening**: Add a strict bucket policy enforcing HTTPS-only transfers (`aws:SecureTransport`) and block accidental policy modifications.
