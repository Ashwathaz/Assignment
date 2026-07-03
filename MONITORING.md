# Observability & Monitoring Playbook
> **Amazon CloudWatch Integration, Metrics Configuration, and SNS Alerting**

This document explains the observability and monitoring setup for the infrastructure, describing how logs, metrics, dashboards, and alarms are configured to maintain system health.

---

## 📊 1. CloudWatch Dashboard Setup
A centralized CloudWatch Dashboard is configured to display system telemetry, container status, and backend API performance.

### Key Visual Widgets & Configuration

1.  **Host Resource Panel (EC2)**:
    *   **Widget Type**: Line graph
    *   **Metrics**: `CPUUtilization` (percentage) and `DiskSpaceUtilization` (from the CloudWatch agent namespace).
    *   **Time Period**: 1-minute intervals.
2.  **Memory Allocations (CloudWatch Agent)**:
    *   **Widget Type**: Gauge or Number display
    *   **Metric**: `mem_used_percent` (custom metric sent by the host agent).
    *   **Goal**: Ensure memory consumption remains below 85% to prevent out-of-memory (OOM) killer events.
3.  **Network Bandwidth**:
    *   **Widget Type**: Line graph
    *   **Metrics**: `NetworkIn` and `NetworkOut` (bytes per minute).
    *   **Goal**: Monitor traffic patterns and identify potential data transfer anomalies or DDoS events.
4.  **Serverless Lambda Telemetry**:
    *   **Widget Type**: Line graph & Stacked area
    *   **Metrics**: `Invocations`, `Duration` (average and p95), and `Errors` for the `ServerlessBackendHandler` Lambda function.
    *   **Goal**: Monitor API Gateway request routing and identify backend failures.

---

## 📈 2. Metrics Reference Table

The following metrics are collected and tracked within CloudWatch:

| Metric Name | Namespace | Source | Dimension | Critical Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **`CPUUtilization`** | `AWS/EC2` | EC2 hypervisor | `InstanceId` | `> 70%` for 5 mins |
| **`mem_used_percent`** | `CWAgent` | CloudWatch Host Agent | `InstanceId`, `ImageId` | `> 85%` |
| **`disk_used_percent`**| `CWAgent` | CloudWatch Host Agent | `InstanceId`, `device`, `path` | `> 90%` |
| **`Invocations`** | `AWS/Lambda` | Lambda service | `FunctionName` | N/A |
| **`Errors`** | `AWS/Lambda` | Lambda service | `FunctionName` | `> 1` count |
| **`4XXError` / `5XXError`**| `AWS/ApiGateway`| API Gateway service | `ApiId`, `Stage` | `5XXError > 1%` |

---

## 📝 3. Log Aggregation & Analysis
Logs are collected from the host OS, containers, Nginx, and Jenkins using the CloudWatch Agent, and from the serverless backend using native integrations.

### Log Group Definitions

*   **Host System Logs (`/var/log/syslog`)**:
    *   **CloudWatch Log Group**: `EC2-OS-Syslog`
    *   **Purpose**: Track operating system events, SSH logins, and daemon status.
*   **Docker Container Standard Output (`/var/lib/docker/containers/*/*.log`)**:
    *   **CloudWatch Log Group**: `Docker-Containers-Logs`
    *   **Purpose**: Capture standard output (stdout) and standard error (stderr) from all containers running on the host.
*   **Nginx Server Logs (`/var/log/nginx/access.log` and `error.log`)**:
    *   **CloudWatch Log Group**: `EC2-Nginx-Logs`
    *   **Purpose**: Monitor incoming HTTP/HTTPS requests, identify 4xx client errors (such as routing issues) and 5xx server errors, and track response sizes.
*   **Jenkins Build Logs**:
    *   **CloudWatch Log Group**: `/aws/lambda/ServerlessBackendHandler` (for serverless execution) and host syslog entries for Jenkins container restarts.
    *   **Purpose**: Track automated deployment runs and identify build failures.

---

## 🚨 4. Alarms & Alert Notification Flows

To alert operators before service degradation occurs, CloudWatch alarms are integrated with **Amazon Simple Notification Service (SNS)**:

```text
  +--------------------------+
  | CloudWatch Metric Monitor |
  +-------------+------------+
                |
                | (Metric exceeds threshold)
                v
       +--------+-------+
       |   SNS Alarm    |
       +--------+-------+
                |
                | (Publish message to topic)
                v
       +--------+-------+
       |   SNS Topic    |
       +--------+-------+
                |
                +-----------------+-----------------+
                | (Email)                           | (Slack Webhook)
                v                                   v
       +--------+-------+                  +--------+-------+
       | Operator Email |                  | Chat Channel   |
       +----------------+                  +----------------+
```

### Alarm Configuration Matrix

#### Alarm 1: EC2 High CPU Utilization
*   **Description**: Alerts when host CPU usage remains high, which could indicate a run-away build or a performance bottleneck.
*   **Metric**: `AWS/EC2/CPUUtilization`
*   **Threshold**: `> 70%` for 5 consecutive evaluation periods of 1 minute (5 minutes total).
*   **Action**: Publish alert to `SNS-DevOps-Alerts-Topic`.

#### Alarm 2: API Gateway Server Errors (5xx)
*   **Description**: Alerts when backend server errors occur.
*   **Metric**: `AWS/ApiGateway/5XXError`
*   **Threshold**: `Average > 1%` over a 5-minute period.
*   **Action**: Publish alert to `SNS-DevOps-Alerts-Topic`.

#### Alarm 3: Host Memory Warning
*   **Description**: Alerts when RAM usage is high, which could lead to container crashes.
*   **Metric**: `CWAgent/mem_used_percent`
*   **Threshold**: `> 85%` for 5 minutes.
*   **Action**: Publish alert to `SNS-DevOps-Alerts-Topic`.

---

## 📸 5. Dashboard Screenshot Reference

When updating your documentation, capture and attach screenshots of the following widgets:

1.  **Main Panel Overview**: The CloudWatch Dashboard page, displaying the EC2 CPU line graph and Lambda execution metrics side-by-side.
2.  **Resource Usage Widget**: The memory gauge displaying the RAM consumption percentage on the `t2.micro` host.
3.  **Alarm State Indicator**: A screenshot showing the `EC2-High-CPU-Alarm` transition from `INSUFFICIENT_DATA` to `OK` status, proving the alarm configuration is active.
4.  **Notification Email**: An image of the SNS email alert notification received in your inbox.
