# Load Testing Report (Template — fill in with your actual run results)

## Tooling
k6, run from a separate machine (not the EC2 host itself, to avoid skewing CPU results with the load generator's own overhead).

## Scenarios Run

| Scenario     | VUs | Duration | Purpose                          |
|--------------|-----|----------|-----------------------------------|
| Steady load  | 20  | 2 min    | Baseline sustained traffic        |
| Spike        | 0→100→0 | 2 min | Burst traffic / autoscaling need |

## Results

| Metric              | Steady Load | Spike |
|---------------------|-------------|-------|
| p50 latency          | _fill in_   | _fill in_ |
| p95 latency          | _fill in_   | _fill in_ |
| Throughput (req/s)   | _fill in_   | _fill in_ |
| Error rate           | _fill in_   | _fill in_ |
| Peak CPU (CloudWatch)| _fill in_   | _fill in_ |
| Peak memory          | _fill in_   | _fill in_ |

Grab CPU/memory numbers from the CloudWatch dashboard for the same time window as the k6 run, and paste screenshots here.

## Analysis

- A static Nginx site on `t2.micro` is expected to handle steady 20 VUs comfortably with sub-100ms p95 latency and near-zero error rate, since Nginx serving static files is not CPU-intensive.
- Under the spike scenario, `t2.micro` burstable CPU credits are the likely bottleneck if sustained above baseline for too long — watch for CPU credit balance depleting in CloudWatch (`CPUCreditBalance` metric) rather than just raw CPUUtilization.
- If error rate rises under spike, it's most likely connection-limit related (Nginx worker connections) rather than application logic, since there is none for a static site.

## Suggested Optimizations

1. **Horizontal scaling**: Auto Scaling Group behind an Application Load Balancer instead of a single instance, so spikes are absorbed by adding instances rather than one box saturating.
2. **CloudFront + S3**: for a purely static site, offloading to CloudFront with S3 origin removes EC2 from the request path entirely for static assets, cutting both cost and latency at scale.
3. **Instance type**: if sustained (not just bursty) high load is expected, move off `t2.micro`'s burstable CPU model to a fixed-performance type (e.g., `t3.small` with unlimited credit mode, or `m` family) to avoid CPU credit exhaustion.
4. **Nginx tuning**: increase `worker_connections` and enable gzip/caching headers for static assets if not already set, to reduce per-request overhead under high concurrency.
