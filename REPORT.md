# Technical Evaluation Report: Hybrid CI/CD & Serverless Application Deployment on AWS
> **Course / Assignment Project Submission**
> **Level**: Junior DevOps Engineering (1-2 Years Experience)

---

## 📝 Abstract
This project evaluates the deployment of a hybrid cloud infrastructure on AWS Free Tier, combining a containerized frontend application deployed via an automated CI/CD pipeline with a serverless API backend. The frontend application is containerized with Docker, deployed on an AWS EC2 instance, and automated natively by a Jenkins runner. The serverless backend uses AWS API Gateway, AWS Lambda (Python), and Amazon S3 to handle dynamic client lookups. Observability is managed via Amazon CloudWatch metrics, logs, and alarms, while performance is evaluated using k6 load tests.

---

## 🎯 1. Objectives
The core objectives of this deployment project are:
1.  **Automation**: Establish a declarative, version-controlled CI/CD pipeline triggered automatically on git push to build, test, and deploy a containerized web application.
2.  **Resource Efficiency**: Deploy on Free Tier resources (`t2.micro`) while utilizing Docker-level memory capping to prevent system out-of-memory errors and ensure host stability.
3.  **Observability**: Configure agent-based and service-native logs, metrics, dashboards, and alarms to notify operations of host and database failures.
4.  **Security Integration**: Enforce IAM least-privilege policies, security groups, dynamic DNS, and TLS termination to secure data-in-transit and management entry points.
5.  **Performance Verification**: Execute performance load tests to analyze system latency, throughput, error rates, and resource limits under steady and spike scenarios.

---

## 📐 2. System Architecture

The deployed hybrid architecture features two distinct request paths:

```text
                                +-------------------+
                                |     Developer     |
                                +---------+---------+
                                          | (Git Push)
                                          v
                                +---------+---------+
                                |      GitHub       |
                                +---------+---------+
                                          |
                                          | (Webhook Trigger over Port 8080)
                                          v
+-----------------------------------------+-----------------------------------------+
| AWS Cloud (VPC)                                                                   |
|                                                                                   |
|      +---------------------------------------------------------------------+      |
|      | EC2 Instance (t2.micro / Ubuntu Host)                               |      |
|      |                                                                     |      |
|      |   +-----------------------+              +-----------------------+  |      |
|      |   |   Jenkins Container   |              |  Frontend Container   |  |      |
|      |   |   (Port 8080 Admin)   |              |  (Nginx Alpine App)   |  |      |
|      |   +-----------+-----------+              +-----------+-----------+  |      |
|      |               |                                      ^              |      |
|      |               | (Docker Build & Run)                 | (Nginx Proxy)|      |
|      |               +--------------------------------------+              |      |
|      |                                                                     |      |
|      |   +--------------------------------------------------------------+  |      |
|      |   |                  Host Nginx Reverse Proxy                    |  |      |
|      |   |             (SSL/TLS Termination on Port 443)                |  |      |
|      |   +------------------------------^-------------------------------+  |      |
|      +----------------------------------|----------------------------------+      |
|                                         |                                         |
|                                         | (HTTPS Traffic)                         |
|                                         |                                         |
|                                +--------+--------+                                |
|                                | DNS (DuckDNS)   |                                |
|                                +--------+--------+                                |
|                                         ^                                         |
|                                         | (HTTPS Web Request)                     |
|                                         |                                         |
|                                +--------+--------+                                |
|                                |    End User     |                                |
|                                +--------+--------+                                |
|                                         |                                         |
|                                         | (HTTP API Request /health)              |
|                                         v                                         |
|                                +--------+--------+                                |
|                                |  API Gateway    |                                |
|                                +--------+--------+                                |
|                                         |                                         |
|                                         v                                         |
|                                +--------+--------+                                |
|                                |   AWS Lambda    | <------------+                 |
|                                | (Python Backend)|              |                 |
|                                +--------+--------+              | (Logs & Metrics)|
|                                         |                       |                 |
|                                         v (Read/Write Data)     v                 |
|                                +--------+--------+     +--------+--------+        |
|                                |    Amazon S3    |     |   CloudWatch    |        |
|                                | (Asset Storage) |     | (Observability) |        |
|                                +-----------------+     +-----------------+        |
+-----------------------------------------------------------------------------------+
```

*   **CI/CD Pipeline Flow**: Code is pushed to GitHub $\rightarrow$ Webhook triggers Jenkins on EC2 $\rightarrow$ Jenkins reads [metadata.json](file:///a:/Assignment/config/metadata.json) $\rightarrow$ Builds Docker image $\rightarrow$ Runs application container on host port `8081` $\rightarrow$ Executes curl health checks $\rightarrow$ Synchronizes build artifacts to Amazon S3.
*   **Serverless Application Flow**: User visits `https://assignment1ash.duckdns.org` $\rightarrow$ DuckDNS resolves to Nginx running on EC2 $\rightarrow$ Nginx terminates SSL and proxies traffic to the frontend container on port `8081`. 
*   Alternatively, backend queries are routed through **API Gateway** $\rightarrow$ **AWS Lambda (Python)** $\rightarrow$ reads backup configurations from **Amazon S3** and records executions in **Amazon CloudWatch**.

For details on security bounds and component-by-component analyses, refer to [ARCHITECTURE.md](file:///a:/Assignment/ARCHITECTURE.md).

---

## 🛠️ 3. Implementation Details

### AWS Infrastructure Provisioning
*   **Virtual Compute**: Provisioned an Ubuntu 22.04 LTS `t2.micro` instance within the default VPC. Associated an Elastic IP to maintain a static entry point.
*   **Security Bounds**: Configured a security group named **`EC2-sg`** restricting access to administrative and secure ports `22` (SSH), `8080` (Jenkins UI), and `443` (HTTPS) to the administrator's IP address (`106.222.223.138/32`), while keeping port `80` (HTTP) open to all traffic (`0.0.0.0/0`).
*   **Storage Setup**: Created a private, encrypted S3 bucket (`backupandstorage-ash`) using AWS-managed keys (SSE-S3). Configured public access blocks to protect backup objects.
*   **Serverless Backend**: Created an AWS Lambda function running Python 3.11 to fetch version logs from S3. Configured an API Gateway HTTP API to expose the `/health` resource.

### Host Services Configuration
*   **Runtime Engine**: Installed Docker Engine on the EC2 host. Added Jenkins as a container mounting the host's `/var/run/docker.sock` to enable Docker-out-of-Docker image builds.
*   **Reverse Proxy**: Installed Nginx on the host and used Certbot to acquire a Let's Encrypt SSL certificate for `assignment1ash.duckdns.org`. Configured Nginx to proxy HTTPS requests to the running application container.

---

## 📦 4. CI/CD Automations (Jenkinsfile Pipeline)
The CI/CD workflow is defined in [Jenkinsfile](file:///a:/Assignment/jenkins/Jenkinsfile) as a declarative pipeline:

1.  **Checkout**: Pulls the repository code using the GitHub webhook trigger.
2.  **Read Metadata**: Reads [metadata.json](file:///a:/Assignment/config/metadata.json) to dynamically extract the container port mapping, preventing hardcoded environmental values.
3.  **Build Docker Image**: Builds the lightweight `nginx:alpine` image, capping memory usage (`--memory=512m`) to prevent compilation tasks from exhausting host memory.
4.  **Deploy Container**: Stops running application containers, cleans up resources, and runs the new image with limits (`--memory=256m`) and log rotation (`max-size=10m`) enabled.
5.  **Health Check**: Curls `http://localhost:<METADATA_PORT>` after a 5-second sleep to verify the Nginx application container is active.
6.  **Backup**: Synchronizes build files and metadata configurations to S3 for disaster recovery.

---

## 📈 5. Monitoring & Observability
Observability is implemented using Amazon CloudWatch:

*   **Agent Deployment**: Configured the CloudWatch Agent on the EC2 host to monitor memory allocation (`mem_used_percent`) and disk space (`disk_used_percent`).
*   **Log Forwarding**: Forwarded host syslogs, Docker daemon event outputs, and Nginx logs (`access.log`, `error.log`) to CloudWatch Log Groups.
*   **CloudWatch Dashboard**: Configured line graphs to track EC2 CPU utilization, memory usage, and Lambda invocations.
*   **Alarms**: Configured a CloudWatch alarm to trigger when host CPU usage exceeds 70% for 5 consecutive minutes. This alert publishes a notification to an SNS topic, sending an email alert to the administrator.

---

## 🔒 6. Security Posture
*   **IAM Least Privilege**: Eliminated static Access Keys on the EC2 instance. The host uses an IAM Role (`EC2-App-Role`) with permissions restricted to the specific S3 bucket and CloudWatch API namespaces.
*   **Network Firewalls**: Exposed only HTTP and HTTPS ports to the public internet, restricting administration ports (SSH and Jenkins UI) to a single IP address.
*   **Container Security**: Used a lightweight Alpine base image to minimize package vulnerabilities. Set memory limits (`--memory=256m`) and capped container logs to prevent disk-exhaustion attacks.

---

## 🧪 7. Performance Testing Analysis (k6)
A load test was executed using k6 from an external test runner to evaluate the infrastructure under a ramping load profile (up to 50 concurrent users):

### Metrics Execution Summary
*   **Total Requests**: `5,249`
*   **Success Rate**: `100% (0 errors)`
*   **Average Latency**: `32.69 ms`
*   **P95 Latency**: `38.63 ms`
*   **Maximum Latency**: `163.60 ms`

### Performance Analysis
Serving static pages via Nginx requires minimal CPU, keeping host CPU usage between 8-12% during peak loads. The average response time of **32.69 ms** and p95 latency of **38.63 ms** prove the system remains highly responsive under load. No errors occurred, confirming that Nginx was able to handle 50 concurrent users without connection pooling issues.

---

## ⚠️ 8. Key Implementation Challenges & Solutions

### 1. Host Memory Exhaustion on Free Tier
*   **Problem**: Running Jenkins, Docker builds, Nginx, and application containers on a single `t2.micro` instance (1GB RAM) caused system memory exhaustion, leading the Linux OOM-killer to terminate the Jenkins daemon.
*   **Solution**: Configured swap space on the host OS. Capped Jenkins container compiler processes to 512MB RAM and set container runtimes to 256MB RAM in the pipeline config, ensuring stable operation.

### 2. Docker-in-Docker Socket Permission Errors
*   **Problem**: The Jenkins container could not access `/var/run/docker.sock` on the host, throwing "Permission Denied" errors when executing `docker build`.
*   **Solution**: Mounted `/var/run/docker.sock` into the Jenkins container and ran the container as root (`-u root`) to grant the container access to the host's Docker socket.

### 3. DNS and Certbot HTTPS Bindings for Dynamic IPs
*   **Problem**: Dynamic IP allocations on EC2 reboot break standard DNS configurations and Certbot TLS certificates.
*   **Solution**: Allocated and associated an AWS Elastic IP to ensure a static IP address, and set up dynamic DNS routing via DuckDNS before running Certbot.

---

## 🔭 9. Future Scope
1.  **Infrastructure as Code (IaC)**: Use Terraform to automate the provisioning of VPC subnets, EC2 instances, S3 buckets, and IAM roles.
2.  **Horizontal Scalability**: Replace the single EC2 host with an **Application Load Balancer (ALB)** and **Auto Scaling Group (ASG)** to scale instances dynamically.
3.  **Container Orchestration**: Migrate frontend workloads to **Amazon ECS (Fargate)** to eliminate EC2 host management and separate build tasks from runtime environments.

---

## 🏁 10. Conclusion
This project successfully demonstrates a hybrid DevOps deployment on AWS Free Tier. By combining containerized frontend pipelines with serverless backend architectures, the system achieves rapid deployments, secure access controls, real-time observability, and high performance. The testing results (p95 latency < 40ms, 100% success rate) confirm the setup is stable, secure, and ready for production-grade workloads.
