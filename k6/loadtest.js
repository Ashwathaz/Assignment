import http from 'k6/http';
import { sleep, check } from 'k6';

// Adjust TARGET to your Elastic IP or domain before running
const TARGET = __ENV.TARGET_URL || 'http://YOUR_ELASTIC_IP:8081/';

export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '2m30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(TARGET);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
