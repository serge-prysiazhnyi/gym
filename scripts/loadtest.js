import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';

const users = new SharedArray('users', () => JSON.parse(open('./tokens.json')));

// separate metrics per endpoint — this is the key change
const userLatency = new Trend('latency_user_by_id');
const workoutsLatency = new Trend('latency_workouts_list');
const userErrors = new Rate('errors_user_by_id');
const workoutErrors = new Rate('errors_workouts_list');

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 }, // hold — measure here
    { duration: '30s', target: 600 },
    { duration: '1m', target: 600 }, // hold
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    latency_user_by_id: ['p(95)<100'],
    latency_workouts_list: ['p(95)<1000'], // expect this to be slower
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = 'http://localhost:3000';

export default function () {
  const u = users[Math.floor(Math.random() * users.length)];
  const params = {
    headers: { Authorization: `Bearer ${u.token}` },
  };

  // 1. cheap cached lookup
  const userRes = http.get(`${BASE}/users/${u.userId}`, {
    ...params,
    tags: { endpoint: 'user_by_id' },
  });
  userLatency.add(userRes.timings.duration);
  userErrors.add(userRes.status !== 200);
  check(userRes, { 'user 200': (r) => r.status === 200 });

  // 2. the heavy one — 100 workouts per user, each with sets + exercises
  const workoutsRes = http.get(`${BASE}/workouts?page=1&limit=20`, {
    ...params,
    tags: { endpoint: 'workouts_list' },
  });
  workoutsLatency.add(workoutsRes.timings.duration);
  workoutErrors.add(workoutsRes.status !== 200);
  check(workoutsRes, {
    'workouts 200': (r) => r.status === 200,
    'workouts has data': (r) => {
      try {
        return JSON.parse(r.body).data.length > 0;
      } catch {
        return false;
      }
    },
  });
}
