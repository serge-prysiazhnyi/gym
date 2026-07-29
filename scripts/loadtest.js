import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// loaded once, shared across all virtual users (memory-efficient)
const users = new SharedArray('users', () => JSON.parse(open('./tokens.json')));

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 600 },
    { duration: '1m', target: 300 },
    { duration: '30s', target: 3600 },
    { duration: '1m', target: 1600 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'], // less than 1% errors
  },
};

const BASE = 'http://localhost:3000';

export default function () {
  // each iteration picks a random user
  const u = users[Math.floor(Math.random() * users.length)];

  const res = http.get(`${BASE}/users/${u.userId}`, {
    headers: { Authorization: `Bearer ${u.token}` },
  });

  check(res, { 'status is 200': (r) => r.status === 200 });

  sleep(1); // "think time" — real users pause between requests
}
