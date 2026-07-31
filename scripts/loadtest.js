import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// loaded once, shared across all virtual users (memory-efficient)
const users = new SharedArray('users', () => JSON.parse(open('./tokens.json')));

export const options = {
  stages: [
    // { duration: '30s', target: 200 },
    // { duration: '1m', target: 400 }, // steady — watch here
    // { duration: '15s', target: 800 },
    // { duration: '30s', target: 200 },
    // { duration: '10s', target: 0 },

    { duration: '30s', target: 400 },
    { duration: '15s', target: 3000 },
    { duration: '10s', target: 0 },
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

  // sleep(1); // "think time" — real users pause between requests
}
