# Project Structure Reference

This document provides a detailed breakdown of the file-system structure of the repository. It describes the purpose of each directory and file, explaining how they fit into the overall CI/CD, containerization, and backend infrastructure.

## Directory Tree

```text
a:/Assignment/
├── .gitignore                   # Production-grade Git exclusion patterns
├── README.md                    # Core project portal & main overview
├── DEPLOYMENT_GUIDE.md          # Step-by-step infrastructure provisioning playbook
├── SECURITY_SUMMARY.md          # Analysis of security configurations & hardening
├── PERFORMANCE_REPORT.md        # k6 load testing results and bottleneck analysis
├── MONITORING.md                # Observability, CloudWatch dashboards & alarm configurations
├── ARCHITECTURE.md              # Detail description of all architecture components
├── REPORT.md                    # Academic/technical report for university submission
├── Assignment.docx              # Compiled Word Document report containing all text and screenshots
├── PROJECT_STRUCTURE.md         # Document index and file-system breakdown (this file)
├── DEMO_SCRIPT.md               # 5-10 minute presentation & product demo runbook
├── app/
│   ├── index.html               # Frontend dashboard HTML (simulating pipeline status)
│   └── style.css                # Custom styling for the frontend dashboard
├── config/
│   └── metadata.json            # Deployment environment parameters (e.g. port configuration)
├── docker/
│   └── Dockerfile               # Build configuration for containerizing the frontend
├── docs/
│   ├── Archietecture.png        # System architecture diagram (Visual Reference)
│   ├── deployment-guide.md      # [Legacy] Reference guide for base deployments
│   ├── load-testing-report.md   # [Legacy] Reference template for load testing
│   └── security-summary.md      # [Legacy] Reference template for security measures
├── jenkins/
│   └── Jenkinsfile              # Declarative CI/CD pipeline definition for automation
└── k6/
    ├── loadtest.js              # k6 script defining performance testing parameters
    ├── loadtest-summary.txt     # Summary of execution metrics from the test run
    └── results.json             # Raw test run results (data-intensive metrics output)
```

---

## Detailed Directory & File Explanations

### Root Directory Configuration & Documentation

#### 📄 [.gitignore](file:///a:/Assignment/.gitignore)
Defines file patterns that Git should ignore. Custom-configured for a production DevOps environment, excluding local Jenkins workspaces, temporary test runs, large raw k6 JSON results, Python virtual environments, and IDE settings while preserving critical configurations.

#### 📄 [README.md](file:///a:/Assignment/README.md)
The entry point of the repository. Provides a high-level pitch, architectural diagram reference, features, tech stack, deployment highlights, and execution overview.

#### 📄 [DEPLOYMENT_GUIDE.md](file:///a:/Assignment/DEPLOYMENT_GUIDE.md)
A comprehensive playbook describing the provisioning of AWS Free Tier resources, local server installations (Docker, Jenkins, AWS CLI), webhook setups, and service configurations.

#### 📄 [SECURITY_SUMMARY.md](file:///a:/Assignment/SECURITY_SUMMARY.md)
A detailed security assessment covering the network boundaries (Security Groups), authentication (IAM Least Privilege), host and container hardening, and data encryption.

#### 📄 [PERFORMANCE_REPORT.md](file:///a:/Assignment/PERFORMANCE_REPORT.md)
A performance report evaluating the stability, response times, and throughput of the target endpoint under steady and spike scenarios using k6.

#### 📄 [MONITORING.md](file:///a:/Assignment/MONITORING.md)
Observability playbook defining the configuration of the Amazon CloudWatch Dashboard, custom system and application metrics, log group aggregation, and alarm notification flows via SNS.

#### 📄 [ARCHITECTURE.md](file:///a:/Assignment/ARCHITECTURE.md)
A thorough technical document breaking down every block of the system design—from developer pushes to lambda executions and database lookups.

#### 📄 [REPORT.md](file:///a:/Assignment/REPORT.md)
A formal, academically structured report suitable for university grading. Summarizes the objectives, architectural decisions, results, challenges, and future optimizations.

#### 📄 [PROJECT_STRUCTURE.md](file:///a:/Assignment/PROJECT_STRUCTURE.md)
This file. Acts as a map for evaluators to easily navigate the repo.

#### 📄 [DEMO_SCRIPT.md](file:///a:/Assignment/DEMO_SCRIPT.md)
An step-by-step interview script for running a 5-10 minute project walk-through.

#### 📄 [Assignment.docx](file:///a:/Assignment/Assignment.docx)
The compiled Microsoft Word document containing the entire technical report integrated with all five infrastructure screenshots (SSH connection settings, storage gp3 20GB, IAM EC2 trusted entity role, IAM policies, and EC2 security group rules) and the architecture diagram.

---

### `app/` - Web Application Frontend
Contains the source code for the frontend dashboard application.

*   📄 [index.html](file:///a:/Assignment/app/index.html): The static web page representing the deployment dashboard (titled "AI CI/CD App"). Contains references to build validation metrics, live update log simulations, and component guides.
*   📄 [style.css](file:///a:/Assignment/app/style.css): Vanilla CSS defining a premium color palette, layouts, typography, and hover animations.

### `config/` - Pipeline Configurations
Contains metadata files utilized by build tools.

*   📄 [metadata.json](file:///a:/Assignment/config/metadata.json): JSON metadata declaring configuration keys like `app_name` and the deployment `port`. Jenkins dynamically processes this file to run the web application container on the host port specified, avoiding pipeline hardcoding.

### `docker/` - Container Configuration
Contains Dockerfiles and instructions for deployment sandboxing.

*   📄 [Dockerfile](file:///a:/Assignment/docker/Dockerfile): Employs a multi-stage-like concept using `nginx:alpine` as the base image. It flushes the default assets, embeds the `app/` folder, and exposes Nginx on port 80.

### `docs/` - Design & Historical Records
Houses system diagrams and early documentation drafts.

*   🖼️ [Archietecture.png](file:///a:/Assignment/docs/Archietecture.png): PNG version of the architecture diagram outlining both the Jenkins deployment flow and the serverless request path.
*   📄 [deployment-guide.md](file:///a:/Assignment/docs/deployment-guide.md): Legacy deployment template.
*   📄 [security-summary.md](file:///a:/Assignment/docs/security-summary.md): Legacy security notes.
*   📄 [load-testing-report.md](file:///a:/Assignment/docs/load-testing-report.md): Legacy load-testing parameters template.

### `jenkins/` - Continuous Integration Pipeline
Contains pipeline-as-code files.

*   📄 [Jenkinsfile](file:///a:/Assignment/jenkins/Jenkinsfile): A Jenkins declarative pipeline containing stages for code checking, metadata parsing, memory-limited Docker building (`--memory=512m`), resource-restricted Docker deployment, active HTTP curl health check, and S3 artifact synchronization.

### `k6/` - Load Testing Suite
Contains resources for executing stress and performance tests.

*   📄 [loadtest.js](file:///a:/Assignment/k6/loadtest.js): Javascript script declaring ramping Virtual Users (VUs) stages (10 to 50) and test constraints (durations and thresholds for p95 duration and error rates).
*   📄 [loadtest-summary.txt](file:///a:/Assignment/k6/loadtest-summary.txt): Captured console printout from a run, documenting success rates and average/p95 latency metrics.
*   📄 [results.json](file:///a:/Assignment/k6/results.json): Large raw JSON data containing performance telemetry.
