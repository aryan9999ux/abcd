/** Per-key async mutex so two requests on one account never interleave their read-modify-write. In-process only. */
const g = globalThis as unknown as { __propLocks?: Map<string, Promise<unknown>> };
const tails = (g.__propLocks ??= new Map());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
