# Infrastructure & Deployment Playbook
> **Step-by-Step Provisioning Guide for the AWS DevOps Lab**

This deployment guide walks you through setting up the complete infrastructure required to run the containerized frontend pipeline and the serverless backend flow. The instructions are tailored to fit AWS Free Tier resources.

---

## 📋 Table of Contents
1. [AWS Account Setup](#1-aws-account-setup)
2. [IAM Configuration](#2-iam-configuration)
3. [Security Groups Setup](#3-security-groups-setup)
4. [EC2 Instance Provisioning](#4-ec2-instance-provisioning)
5. [Docker & Jenkins Installation](#5-docker--jenkins-installation)
6. [Jenkins CI/CD Pipeline & GitHub Integration](#6-jenkins-cicd-pipeline--github-integration)
7. [Amazon S3 Storage Config](#7-amazon-s3-storage-config)
8. [API Gateway & Lambda Serverless Flow](#8-api-gateway--lambda-serverless-flow)
9. [HTTPS Configuration (DuckDNS & Let's Encrypt)](#9-https-configuration-duckdns--lets-encrypt)
10. [CloudWatch Observability & Dashboard Setup](#10-cloudwatch-observability--dashboard-setup)
11. [Performance Load Testing (k6)](#11-performance-load-testing-k6)
12. [Validation & Verification Runbook](#12-validation--verification-runbook)

---

## 1. AWS Account Setup
1. Visit [AWS Free Tier](https://aws.amazon.com/free/) and create a new account if you don't have one.
2. Log in as the **Root User** and immediately configure Multi-Factor Authentication (MFA) on the security page.
3. Access **IAM Identity Center** or create a dedicated IAM user with administrative credentials for daily operations. Avoid using the Root User for routine tasks.
4. Select your target region. For this project, we assume AWS Region **ap-south-1** (Mumbai) or **us-east-1** (N. Virginia). Ensure this is consistent across all service deployments.

---

## 2. IAM Configuration
To enable the EC2 instance to interact securely with S3 and CloudWatch, we assign it an IAM Role at runtime, avoiding stored access keys on the box.

1. Navigate to **IAM console** $\rightarrow$ **Roles** $\rightarrow$ **Create Role**.
2. Select **AWS Service** as the trusted entity and select **EC2** as the use case.
3. Attach the following AWS Managed Policy:
   *   `CloudWatchAgentServerPolicy` (Allows the CloudWatch agent to write telemetry logs and metrics).
4. Create a custom inline policy named `S3-Backup-Access-Policy` to permit the instance to read/write only to your backup bucket. Replace `backupandstorage-ash` with your globally unique bucket name:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:ListBucket",
           "s3:DeleteObject"
         ],
         "Resource": [
           "arn:aws:s3:::backupandstorage-ash",
           "arn:aws:s3:::backupandstorage-ash/*"
         ]
       }
     ]
   }
   ```
5. Name the role **`EC2-App-Role`** and click **Create Role**.

---

## 3. Security Groups Setup
We establish firewall rules to shield Jenkins and SSH from public scanning, keeping the web server and HTTPS access mapped appropriately.

1. Go to **EC2 Console** $\rightarrow$ **Security Groups** $\rightarrow$ **Create Security Group**.
2. Name the group **`EC2-sg`** with the description `Sg-for the Assignment` and select the default VPC.
3. Configure the following **Inbound Rules** (as verified in the deployment configuration):

| Protocol | Port | Source | Description |
| :--- | :--- | :--- | :--- |
| **TCP** | `22` | `106.222.223.138/32` (My IP) | SSH admin terminal access |
| **TCP** | `8080` | `106.222.223.138/32` (My IP) | Jenkins UI administration access |
| **TCP** | `80` | `0.0.0.0/0` (Anywhere) | Public HTTP web traffic |
| **TCP** | `443` | `106.222.223.138/32` (My IP) | Secure HTTPS traffic (restricted) |

4. Keep the **Outbound Rules** open to `0.0.0.0/0` (All traffic) to allow the host to pull Docker images and send logs to CloudWatch.

---

## 4. EC2 Instance Provisioning
1. Navigate to **EC2 console** $\rightarrow$ **Instances** $\rightarrow$ **Launch Instances**.
2. **Name**: `devops-lab-host`.
3. **AMI**: Select **Ubuntu Server 22.04 LTS** (or 24.04 LTS), 64-bit (x86).
4. **Instance Type**: Select **`t2.micro`** (Free Tier eligible).
5. **Key Pair**: Select or generate a new RSA `.pem` key pair for SSH access.
6. **Configure Storage**:
   *   Size: **`20 GiB`** gp3 Root volume, 3000 IOPS, Not encrypted.
7. **Network Settings**:
   *   Assign the **`EC2-sg`** security group created in Step 3.
8. **Advanced Details**:
   *   Under **IAM instance profile**, select **`EC2-App-Role`**.
9. Launch the instance.
10. **Elastic IP**: Allocate and associate an Elastic IP (Public IP: **`13.201.11.78`**) and link it to your running instance.

---

## 5. Docker & Jenkins Installation
Establish the execution container engine and host-managed Jenkins.

1. Connect to your instance via SSH (using MobaXterm or terminal):
   ```bash
   ssh -i "your-key.pem" ubuntu@13.201.11.78
   ```
2. Update the repository lists and install Docker:
   ```bash
   sudo apt-get update -y
   sudo apt-get install -y docker.io git curl unzip
   sudo systemctl enable --now docker
   sudo usermod -aG docker ubuntu
   # Exit and log back in to apply group privileges
   exit
   ```
3. Re-establish SSH access and install the **AWS CLI v2** globally on the host:
   ```bash
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   rm -rf awscliv2.zip aws/
   ```
4. Run Jenkins inside a Docker container, mounting the host's Docker socket. This is a common DevOps pattern ("Docker-out-of-Docker") allowing the containerized Jenkins to spawn Docker sibling containers on the host:
   ```bash
   sudo docker run -d --name jenkins \
     --restart unless-stopped \
     -p 8080:8080 -p 50000:50000 \
     -v jenkins_home:/var/jenkins_home \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -u root \
     jenkins/jenkins:lts
   ```
5. Install the Docker CLI and AWS CLI *inside* the Jenkins container so that the pipeline shell calls (`docker build`, `aws s3 sync`) succeed:
   ```bash
   sudo docker exec -u root jenkins bash -c "\
     apt-get update && \
     apt-get install -y docker.io awscli && \
     apt-get clean"
   ```
6. Retrieve the initial setup password to unlock Jenkins:
   ```bash
   sudo docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```

---

## 6. Jenkins CI/CD Pipeline & GitHub Integration
1. Open a browser and visit `http://13.201.11.78:8080`. Paste the initialization password.
2. Select **Install Suggested Plugins**.
3. Once completed, navigate to **Manage Jenkins** $\rightarrow$ **Plugins** $\rightarrow$ **Available Plugins**, and install:
   *   **Docker Pipeline** (for Docker DSL inside Jenkinsfiles)
   *   **Pipeline Utility Steps** (required for `readJSON` parameters parsing)
4. Go to **New Item** $\rightarrow$ enter name `ec2-front-pipeline` $\rightarrow$ Select **Pipeline** $\rightarrow$ **OK**.
5. Under the **Pipeline** configuration block:
   *   **Definition**: `Pipeline script from SCM`
   *   **SCM**: `Git`
   *   **Repository URL**: Link your GitHub repository (e.g., `https://github.com/your-username/your-repo.git`)
   *   **Branch Specifier**: `*/main` or `*/master`
   *   **Script Path**: `jenkins/Jenkinsfile`
6. Click **Save**.
7. **Webhook Integration**:
   *   In your GitHub repository, navigate to **Settings** $\rightarrow$ **Webhooks** $\rightarrow$ **Add Webhook**.
   *   **Payload URL**: `http://13.201.11.78:8080/github-webhook/`
   *   **Content Type**: `application/json`
   *   **Events**: Select **Just the push event**.
   *   Add webhook. Now, pushes to the main branch will automatically trigger builds.

---

## 7. Amazon S3 Storage Config
The Jenkins pipeline backs up static frontend builds to a private S3 bucket.

1. Create a secure, encrypted S3 bucket via the AWS CLI (run from the EC2 host):
   ```bash
   aws s3 mb s3://backupandstorage-ash --region ap-south-1
   ```
2. Enable default AES-256 server-side encryption:
   ```bash
   aws s3api put-bucket-encryption --bucket backupandstorage-ash \
     --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```
3. Block all public bucket access (ensuring backups remain private):
   ```bash
   aws s3api put-public-access-block --bucket backupandstorage-ash \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```

---

## 8. API Gateway & Lambda Serverless Flow
This handles the serverless application flow: `User -> DuckDNS -> HTTPS -> API Gateway -> Lambda -> S3 -> CloudWatch`.

### AWS Lambda Setup
1. Navigate to **AWS Lambda** $\rightarrow$ **Create Function** $\rightarrow$ **Author from scratch**.
2. **Function name**: `ServerlessBackendHandler`.
3. **Runtime**: **Python 3.11** (or Python 3.12).
4. **Permissions**: Create a execution role with standard Lambda permission, granting it permissions to read from the S3 bucket (`backupandstorage-ash`).
5. Write the backend handler in `lambda_function.py`:
   ```python
   import json
   import boto3
   import logging

   logger = logging.getLogger()
   logger.setLevel(logging.INFO)

   s3_client = boto3.client('s3')
   BUCKET_NAME = 'backupandstorage-ash'

   def lambda_handler(event, context):
       logger.info(f"Incoming event parsed: {json.dumps(event)}")
       
       try:
           # Attempt to fetch metadata version backup details
           response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix='config-backup/')
           files = [content['Key'] for content in response.get('Contents', [])]
           
           return {
               'statusCode': 200,
               'headers': {
                   'Content-Type': 'application/json',
                   'Access-Control-Allow-Origin': '*'
               },
               'body': json.dumps({
                   'status': 'HEALTHY',
                   'message': 'API backend processing requests.',
                   'version_backups_found': len(files),
                   'backup_files': files[:5]  # return top 5 for validation
               })
           }
       except Exception as e:
           logger.error(f"Error fetching data from S3: {str(e)}")
           return {
               'statusCode': 500,
               'body': json.dumps({'error': 'Internal server error reading database/backups'})
           }
   ```
6. Click **Deploy**.

### Amazon API Gateway Setup
1. Navigate to **API Gateway Console** $\rightarrow$ **Create API** $\rightarrow$ Select **HTTP API** (fastest and cheapest for Free Tier).
2. Click **Add Integration** $\rightarrow$ Select **Lambda** $\rightarrow$ Choose your `ServerlessBackendHandler` function.
3. **API Name**: `Serverless-Gateway`.
4. **Configure Routes**:
   *   **Method**: `GET`
   *   **Resource Path**: `/health`
5. Keep the stage as `$default` (auto-deploy enabled) and click **Create**.
6. Record the generated **Invoke URL** (e.g., `https://abcdefgh12.execute-api.ap-south-1.amazonaws.com/health`).

---

## 9. HTTPS Configuration (DuckDNS & Let's Encrypt)
To expose a user-facing domain with dynamic resolution:

1. Register at [DuckDNS](https://www.duckdns.org/).
2. Create a domain matching your assignment target: `assignment1ash.duckdns.org`.
3. Set the domain's IP address to your EC2 instance's Elastic IP.
4. **Certbot HTTPS configuration**:
   To secure our app (running on EC2 port `8081`) with HTTPS, install Certbot and Nginx on the host to act as a TLS-terminating reverse proxy pointing to the Docker container:
   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```
5. Edit `/etc/nginx/sites-available/default` to forward requests to the Docker container:
   ```nginx
   server {
       listen 80;
       server_name assignment1ash.duckdns.org;

       location / {
           proxy_pass http://localhost:8081;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
6. Reload Nginx and execute Certbot:
   ```bash
   sudo systemctl restart nginx
   sudo certbot --nginx -d assignment1ash.duckdns.org --non-interactive --agree-tos --email your-email@example.com
   ```
   Certbot will obtain the Let's Encrypt certificate, modify the Nginx configuration, and automatically redirect port `80` to port `443` (HTTPS) securely.

---

## 10. CloudWatch Observability & Dashboard Setup
Collect system-level statistics and push log groups for visualization.

1. Install the CloudWatch Agent on the EC2 host:
   ```bash
   wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
   sudo dpkg -i amazon-cloudwatch-agent.deb
   ```
2. Create the config file `amazon-cloudwatch-agent.json` under `/opt/aws/amazon-cloudwatch-agent/bin/` to gather RAM, CPU, Nginx logs, and Docker container logs:
   ```json
   {
     "agent": {
       "metrics_collection_interval": 60,
       "run_as_user": "cwagent"
     },
     "metrics": {
       "metrics_collected": {
         "mem": {
           "measurement": ["mem_used_percent"]
         },
         "disk": {
           "resources": ["/"],
           "measurement": ["disk_used_percent"]
         }
       }
     },
     "logs": {
       "logs_collected": {
         "files": {
           "collect_list": [
             {
               "file_path": "/var/log/nginx/access.log",
               "log_group_name": "EC2-Nginx-Access-Logs",
               "log_stream_name": "{hostname}"
             },
             {
               "file_path": "/var/lib/docker/containers/*/*.log",
               "log_group_name": "Docker-Containers-Logs",
               "log_stream_name": "docker-applications"
             }
           ]
         }
       }
     }
   }
   ```
3. Start the agent:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent.json
   ```
4. **CloudWatch Dashboard**:
   *   In AWS Console $\rightarrow$ **CloudWatch** $\rightarrow$ **Dashboards** $\rightarrow$ **Create Dashboard**.
   *   Add line widgets for CPUUtilization (EC2), mem_used_percent, and invocation count (Lambda).
5. **Alarms**:
   *   Create a CloudWatch Metric Alarm for EC2 `CPUUtilization` > 70% for 5 consecutive minutes.
   *   Assign an action to send alerts to an **Amazon SNS Topic** (configured with your email address). Confirm the email subscription link sent to you.

---

## 11. Performance Load Testing (k6)
Verify response limits under stress testing patterns.

1. Install k6 on a separate test runner (or local development machine) to avoid CPU interference with the target EC2 host:
   ```bash
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update && sudo apt-get install k6
   ```
2. Navigate to the repository folder containing [loadtest.js](file:///a:/Assignment/k6/loadtest.js).
3. Run the performance test:
   ```bash
   k6 run --env TARGET_URL=https://assignment1ash.duckdns.org k6/loadtest.js
   ```

---

## 12. Validation & Verification Runbook
To verify all components function correctly, complete this checklist:

*   **GitHub Integration**: Push a trivial comment edit to `app/index.html`. Go to Jenkins and confirm a pipeline execution (e.g. Build #2) is triggered.
*   **Docker Container Status**: Access your EC2 terminal and list the running containers:
    ```bash
    docker ps
    ```
    Confirm container `ec2-front` is running on port `8081` with status `Up`.
*   **S3 Backup Verification**: Verify files have synced using the CLI:
    ```bash
    aws s3 ls s3://backupandstorage-ash/site-backup/
    aws s3 ls s3://backupandstorage-ash/config-backup/
    ```
*   **Serverless Handshake**: Navigate in your browser to your API Gateway Invoke URL `/health`. Verify it returns `200 OK` with JSON displaying the status (`"status": "HEALTHY"`) and backup files stored in S3.
*   **HTTPS Check**: Visit `https://assignment1ash.duckdns.org` in a browser. Inspect the certificate lock icon to confirm it is signed by Let's Encrypt.
*   **Observability Dashboard**: Access the AWS CloudWatch page and review the custom dashboard widgets to verify data points are plotted for CPU and Memory.
