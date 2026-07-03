# Deployment Guide

## 1. IAM Setup

1. Create an IAM role `EC2-App-Role` with:
   - `CloudWatchAgentServerPolicy` (AWS managed)
   - A custom inline policy scoped to one S3 bucket only:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
           "Resource": [
             "arn:aws:s3:::yourname-devops-assignment-2026",
             "arn:aws:s3:::yourname-devops-assignment-2026/*"
           ]
         }
       ]
     }
     ```
2. Attach this role to the EC2 instance at launch (Instance Settings -> Attach/Replace IAM Role). No access keys are stored anywhere on the box or in Jenkins.

## 2. Security Group

| Port | Protocol | Source          | Purpose          |
|------|----------|-----------------|------------------|
| 22   | TCP      | Your IP /32     | SSH admin access |
| 8080 | TCP      | Your IP /32     | Jenkins UI       |
| 80   | TCP      | 0.0.0.0/0       | HTTP app traffic |
| 443  | TCP      | 0.0.0.0/0       | HTTPS app traffic|

```bash
aws ec2 create-security-group --group-name app-sg --description "App SG"
aws ec2 authorize-security-group-ingress --group-name app-sg --protocol tcp --port 22 --cidr <YOUR_IP>/32
aws ec2 authorize-security-group-ingress --group-name app-sg --protocol tcp --port 8080 --cidr <YOUR_IP>/32
aws ec2 authorize-security-group-ingress --group-name app-sg --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name app-sg --protocol tcp --port 443 --cidr 0.0.0.0/0
```

## 3. Launch EC2 (Ubuntu)

- AMI: Ubuntu 22.04 or 24.04 LTS
- Type: `t2.micro` (Free Tier)
- Attach the SG above and the `EC2-App-Role`
- Allocate and associate an Elastic IP

## 4. Install Docker, Jenkins, AWS CLI on Ubuntu

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io git curl unzip

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# Jenkins (as a container, mounting docker.sock so it can build/run images on the host)
sudo docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -u root \
  jenkins/jenkins:lts

# Install docker CLI + AWS CLI inside the Jenkins container so pipeline stages can call them
docker exec -u root jenkins bash -c "apt-get update && apt-get install -y docker.io awscli"
```

Get the initial admin password:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

## 5. Configure Jenkins Pipeline

1. Open `http://<Elastic-IP>:8080`, install suggested plugins plus **Docker Pipeline** and **Pipeline Utility Steps** (for `readJSON`).
2. New Item -> Pipeline -> Pipeline script from SCM -> point to this repo, script path `jenkins/Jenkinsfile`.
3. Add a GitHub webhook: repo Settings -> Webhooks -> Payload URL `http://<Elastic-IP>:8080/github-webhook/`, content type `application/json`, event: just the push event.
4. Push a commit and confirm the pipeline runs end to end.

## 6. S3 Bucket

```bash
aws s3 mb s3://yourname-devops-assignment-2026
aws s3api put-bucket-encryption --bucket yourname-devops-assignment-2026 \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket yourname-devops-assignment-2026 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 7. HTTPS

If you have a domain pointed at the Elastic IP:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
Since Nginx runs inside the app container (not on the host), terminate TLS with a host-level Nginx reverse proxy in front of the container, or document a self-signed certificate as the fallback and note ACM + ALB as the production path.

## 8. CloudWatch Agent

```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
sudo systemctl start amazon-cloudwatch-agent
```
Configure it to collect CPU, memory, disk, and container logs (mount `/var/lib/docker/containers` or bind-mount app logs to a host path first). Then build a CloudWatch dashboard and a CPU > 70% alarm with an SNS email subscription.

## 9. API Gateway + Lambda (optional add-on)

Create a tiny Lambda (Python or Node) returning `{"status": "ok"}`, expose it via API Gateway as `GET /health`. This satisfies the "API Gateway where applicable" requirement without adding real complexity to what is otherwise a static site.

## 10. Load Testing

```bash
sudo apt-get install -y gnupg2
curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6

k6 run --env TARGET_URL=http://<Elastic-IP>:8081/ k6/loadtest.js
```
