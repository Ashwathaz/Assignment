# Project Demonstration Script
> **Runbook & Talking Points for a 5–10 Minute Technical Review**

This demo script walks you through showcasing the architecture, CI/CD pipeline, and observability features of the project during a technical review or assignment evaluation.

---

## ⏱️ Timeline Overview

| Section | Duration | Screen View | Core Talking Point |
| :--- | :---: | :--- | :--- |
| **1. Intro & Architecture** | `1.5 Min` | Architecture Diagram | Hybrid deployment topology and design choices |
| **2. CI/CD Pipeline & Deploy**| `2.5 Min` | VS Code $\rightarrow$ GitHub $\rightarrow$ Jenkins | Automated webhook execution and Docker builds |
| **3. Security & Validation** | `1.5 Min` | AWS IAM & S3 Console | IAM Least Privilege, bucket blocks, encryption |
| **4. Serverless Backend Flow** | `1.5 Min` | Browser URL / AWS Console | API Gateway routing to Python Lambda |
| **5. Observability & Testing** | `2.0 Min` | CloudWatch Dashboard & k6 console | Real-time monitoring metrics and load tests |
| **6. Q&A / Wrap Up** | `1.0 Min` | Project repository | Summary of architecture improvements |

---

## 🎬 Detailed Demo Steps

### 1. Introduction & Architectural Overview (1.5 Minutes)
*   **What to Show on Screen**: Display the [System Architecture Diagram](docs/Archietecture.png) in your browser or image viewer.
*   **Talking Track**:
    > "Welcome. I am demonstrating a hybrid DevOps architecture deployed on AWS Free Tier. The system runs on a containerized EC2 host and a serverless backend.
    >
    > Our frontend is containerized using Docker and deployed on a virtual EC2 host, with deployments automated natively via Jenkins.
    >
    > For our serverless backend, user requests are routed through dynamic DNS on DuckDNS over HTTPS to AWS API Gateway, which triggers an AWS Lambda handler that pulls data from S3. Let's look at the CI/CD pipeline."

---

### 2. CI/CD Pipeline & Automated Deployment (2.5 Minutes)
*   **What to Show on Screen**: 
    1.  Open [Jenkinsfile](file:///a:/Assignment/jenkins/Jenkinsfile) in VS Code.
    2.  Open your Jenkins Pipeline Web UI.
*   **Action**:
    *   In VS Code, add a comment line at the bottom of `app/index.html` (e.g., `<!-- Demo update validation -->`) and commit the change:
        ```bash
        git add app/index.html
        git commit -m "chore: trigger webhook for deployment demo"
        git push origin main
        ```
    *   Immediately switch to the Jenkins UI browser tab.
*   **Talking Track**:
    > "Here is our declarative Jenkins pipeline. When I push a commit to our GitHub repository, a webhook triggers a build in Jenkins.
    >
    > Switch to the Jenkins dashboard. A new pipeline execution is running. 
    >
    > The pipeline reads port details from metadata.json to avoid hardcoded values. During the build stage, we apply memory limits (`--memory=512m`) to prevent compilation tasks from exhausting the t2.micro host memory.
    >
    > During the deploy stage, Jenkins cleans up old application containers and runs Nginx with memory limits (`--memory=256m`) and log rotation (`max-size=10m`) enabled. The build succeeds after passing local curl health checks."

---

### 3. Security, Access Controls & Backups (1.5 Minutes)
*   **What to Show on Screen**:
    1.  AWS IAM console showing the `EC2-App-Role` policy permissions.
    2.  AWS S3 console showing the `backupandstorage-ash` bucket structure.
*   **Talking Track**:
    > "Security is configured at the infrastructure level. The EC2 instance does not use hardcoded AWS Access Keys. Instead, it assumes an attached IAM role (`EC2-App-Role`).
    >
    > This role restricts permissions to our specific S3 bucket (`backupandstorage-ash`) and CloudWatch logging APIs.
    >
    > The S3 bucket blocks public access and encrypts backups at rest using AES-256 keys. Here, we can see the backups updated by our Jenkins build."

---

### 4. Serverless Backend Verification (1.5 Minutes)
*   **What to Show on Screen**:
    1.  Open the API Gateway URL in a browser tab (e.g., `https://abcdefgh12.execute-api.ap-south-1.amazonaws.com/health`).
    2.  Open the AWS Lambda console showing the Python handler code.
*   **Talking Track**:
    > "Our serverless backend handles dynamic client requests. The GET endpoint `/health` routes traffic to our Lambda function, which fetches configuration details from S3 and returns a status report.
    >
    > Here is the JSON response, confirming the serverless API is integrated with our S3 storage backend."

---

### 5. Observability & Performance Load Testing (2.0 Minutes)
*   **What to Show on Screen**:
    1.  AWS CloudWatch Dashboard containing CPU, Memory, and Disk usage widgets.
    2.  An open terminal window ready to execute the k6 test.
*   **Action**:
    *   Run the k6 load test:
        ```bash
        k6 run --env TARGET_URL=https://assignment1ash.duckdns.org k6/loadtest.js
        ```
*   **Talking Track**:
    > "To verify performance, we use k6 to run load tests against the HTTPS endpoint. We run the tests from an external machine to prevent the load generator's CPU usage from skewing our host metrics.
    >
    > The test simulates concurrent users ramping up to 50 VUs. In our testing, the system handled 5,249 requests with a 100% success rate, an average latency of 32.69 ms, and p95 latency of 38.63 ms.
    >
    > In our CloudWatch Dashboard, we can monitor EC2 CPU usage, memory utilization, and log groups. We have also set up a CloudWatch alarm that sends email alerts via Amazon SNS if CPU usage exceeds 70%."

---

### 6. Wrap Up (1.0 Minute)
*   **What to Show on Screen**: Show your repository files.
*   **Talking Track**:
    > "To summarize, this project demonstrates a secure, high-performance deployment. By combining containerized frontend pipelines with serverless backend architectures, we achieve rapid deployments, secure access controls, and real-time observability.
    >
    > For future scope, we recommend automating provisioning using Terraform, and deploying the app behind an Application Load Balancer (ALB) and Auto Scaling Group (ASG) to handle high-traffic spikes. Thank you."
