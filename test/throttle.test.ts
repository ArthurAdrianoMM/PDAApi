import { expect, it } from 'vitest';
import { createThrottle } from '../src/core/throttle.js';

it('spaces task starts by the minimum interval, in call order', async () => {
  const schedule = createThrottle(40);
  const starts: number[] = [];
  const order: number[] = [];

  await Promise.all(
    [0, 1, 2].map((i) =>
      schedule(async () => {
        starts.push(performance.now());
        order.push(i);
      }),
    ),
  );

  expect(order).toEqual([0, 1, 2]);
  expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(35);
  expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(35);
});

it('keeps going after a task fails', async () => {
  const schedule = createThrottle(0);
  await expect(schedule(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  await expect(schedule(async () => 'ok')).resolves.toBe('ok');
});
