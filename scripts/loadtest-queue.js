import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';

const users = new SharedArray('users', () => JSON.parse(open('./tokens.json')));

const enqueueLatency = new Trend('latency_enqueue');

// exercise names that exist in catalogue, so jobs succeed
const EXERCISES = [
  'Squat',
  'Barbell Bench Press',
  'Barbell Curl',
  'Romanian Deadlift',
  'Seated Cable Row',
  'Leg Curl',
  'Preacher Curl',
  'Plank',
];

export const options = {
  scenarios: {
    enqueue: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 parse requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    // The API should stay fast even as the queue backs up.
    latency_enqueue: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = 'http://localhost:3000';

export default function () {
  const u = users[Math.floor(Math.random() * users.length)];
  const exercise = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  const sets = 3 + Math.floor(Math.random() * 3);
  const reps = 6 + Math.floor(Math.random() * 8);
  const weight = 20 + Math.floor(Math.random() * 100);

  const res = http.post(
    `${BASE}/workouts/parse`,
    JSON.stringify({
      rawText: `${sets} sets of ${reps} ${exercise} at ${weight} kg`,
    }),
    {
      headers: {
        Authorization: `Bearer ${u.token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  enqueueLatency.add(res.timings.duration);
  check(res, { 'accepted 202': (r) => r.status === 202 });
}
