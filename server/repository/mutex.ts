// Minimal single-process async mutex. SQLite has no per-row locking, and this backend runs as
// one Node process (V1's real deployment shape — DATABASE.md §24) — so the thing that actually
// prevents two concurrent order mutations from both passing the stock check before either
// commits is this in-process queue, not database transaction isolation. The Prisma `$transaction`
// wrapping each order write is for crash-safety/write-atomicity, not for race prevention.
// Scoped honestly: this does not extend to multiple backend instances behind a load balancer.

export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

export const orderMutex = new Mutex();
