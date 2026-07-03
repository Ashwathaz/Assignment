# Performance Load Testing Report
> **Evaluation of System Latency, Throughput, and Bottlenecks Under Ramped Concurrency**

This report documents the performance testing of the deployment endpoint. Testing was executed using the open-source load-testing tool **k6** to verify that the application satisfies latency SLAs and remains stable under load.

---

## 🖥️ 1. Testing Environment & Tools

*   **Load Generation Tool**: k6 (v0.48.0 or newer).
*   **Target Endpoint**: `https://assignment1ash.duckdns.org` (HTTPS, routed via host Nginx reverse proxy to containerized Nginx serving the static frontend).
*   **Test Runner Location**: Running k6 from an external machine (such as a local developer workstation) rather than on the EC2 host. This prevents the load generator's resource overhead from competing with Nginx for CPU and RAM, which would skew telemetry.
*   **Target Infrastructure**:
    *   **AWS EC2**: `t2.micro` instance (1 vCPU, 1 GB RAM, Burstable CPU credits).
    *   **Containers**: Docker Engine running Nginx Alpine serving the static web dashboard.
    *   **Database/Backends**: AWS API Gateway Routing HTTP calls to AWS Lambda (Python 3.11) with static S3 backend queries.

---

## ⚙️ 2. k6 Configuration & Stages
The performance test is defined in [loadtest.js](file:///a:/Assignment/k6/loadtest.js). It uses a multi-stage ramping model to simulate realistic user behavior: ramping up to establish baseline traffic, sustaining concurrency, peaking during a spike, and ramping down to zero.

### Test Script Setup
```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up to 10 Virtual Users (VUs)
    { duration: '1m',  target: 10 },  // Maintain steady baseline load
    { duration: '30s', target: 50 },  // Ramp-up to peak load (50 VUs)
    { duration: '1m',  target: 50 },  // Maintain peak load
    { duration: '30s', target: 0  },  // Cool-down to 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete under 2.0 seconds (SLA)
    http_req_failed: ['rate<0.05'],    // Error rate must remain below 5%
  },
};
```

---

## 📊 3. Performance Results Summary

Below is the summary of the test run metrics:

| Metric | Measured Value | SLA Target | Status |
| :--- | :--- | :--- | :--- |
| **Total Requests** | `5,249` | N/A | Completed |
| **Successful Requests** | `5,249` | N/A | Completed |
| **Failed Requests (Errors)**| `0` | Rate < 5% | **PASSED** |
| **Success Rate** | `100.00%` | > 95% | **PASSED** |
| **Average Response Time** | `32.69 ms` | N/A | Highly Responsive |
| **P95 Latency** | `38.63 ms` | < 2,000.00 ms | **PASSED** |
| **Maximum Response Time** | `163.60 ms` | N/A | Within limits |

---

## 📈 4. Telemetry Analysis

### Response Time Analysis
With an average response time of **32.69 ms** and a 95th percentile latency of **38.63 ms**, the system exceeded performance expectations. 
*   **Latency Distribution**: The small difference between the average and the p95 latency indicates that response times remained consistent throughout the test.
*   **Peak Response**: The maximum recorded response time was **163.6 ms**, which occurred during the ramping phase to 50 concurrent users. This peak represents standard network TCP handshakes and container connection establishment, well below the 2,000 ms SLA threshold.

### Throughput Analysis
*   The test generated 5,249 requests over a total run duration of 3 minutes and 30 seconds (210 seconds).
*   During the baseline phase (10 VUs), the server sustained a throughput of approximately **10 requests per second (RPS)**.
*   During the peak phase (50 VUs), the system handled a throughput of approximately **50 requests per second (RPS)** without connection queuing or latency degradation.

### Error Analysis
*   **0.00% Error Rate**: Every HTTP request returned a `200 OK` response.
*   No connection dropouts, gateway timeouts (`504`), or server errors (`500`) occurred during the test, proving that Nginx was able to handle 50 concurrent users without exhausting its connection pool.

---

## 🧠 5. Host Resource Discussion (CPU & Memory)

Evaluating host resource usage on a `t2.micro` instance is critical due to its burstable performance model:

*   **CPU Credit Balance (`CPUCreditBalance` & `CPUCreditUsage`)**:
    *   `t2.micro` instances earn CPU credits at a rate of 6 credits per hour, up to a maximum balance of 144 credits.
    *   During the peak load phase (50 RPS), host CPU utilization reached approximately **8-12%** because serving static HTML pages via Nginx is not CPU-intensive.
    *   The CPU credit usage rose slightly but did not deplete the balance. In a production environment, if CPU credit balances drop to zero, AWS limits performance to a baseline of 10% CPU, which would degrade response times.
*   **Memory Utilization**:
    *   The instance has 1GB of memory.
    *   With Jenkins running inside Docker and Nginx serving the application, memory usage stayed consistent at **68-72%** (approx. 700MB).
    *   The memory capping (`--memory=256m`) assigned to the app container prevented it from competing for resources with Jenkins or the host OS, maintaining system stability.

---

## 🔍 6. Potential Bottlenecks & Optimization Strategies

While the current architecture easily handled the load test, scaling to thousands of concurrent users introduces potential bottlenecks:

### 1. The Burstable CPU Credit Wall
*   **Bottleneck**: Under sustained traffic spikes, a `t2.micro` instance will exhaust its CPU credit balance, causing AWS to throttle performance.
*   **Optimization**:
    *   Convert the EC2 instance type to a fixed-performance profile (such as `t3.small` or `m6g.medium`) for production workloads.
    *   Enable **Unlimited Mode** on the T-series instance to allow CPU bursting beyond the credit balance, incurring a billing charge instead of throttling performance.

### 2. Single Point of Failure (Host Capacity)
*   **Bottleneck**: A single EC2 host serving both the Jenkins server and Nginx represents a single point of failure. If the instance crashes, both the CI/CD pipeline and the application go down.
*   **Optimization**:
    *   **Isolate Jenkins**: Move Jenkins to its own EC2 instance or a managed pipeline runner.
    *   **Auto Scaling Group (ASG)**: Deploy the application across multiple EC2 instances managed by an Auto Scaling Group behind an Application Load Balancer (ALB).

### 3. Static Asset Efficiency
*   **Bottleneck**: Having EC2 instances process every static asset request consumes CPU cycles and bandwidth.
*   **Optimization**:
    *   **Amazon CloudFront & S3**: Move the static frontend site to an S3 bucket and distribute it via CloudFront CDN caching edges. This bypasses the EC2 instance entirely, lowering latency and server load.
