import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Spaces out task starts by at least `minIntervalMs`, in call order. Keeps the
 * request rate close to one student's browser (INTENT.md, "How the API will behave").
 */
export function createThrottle(minIntervalMs: number) {
  let queue: Promise<void> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const turn = queue.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
    });
    queue = turn;
    return turn.then(task);
  };
}
