export type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

type WaitForTruthyOptions = {
  attempts?: number;
  intervalMs?: number;
};

export function createDeferred<T = void>(): Deferred<T> {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;

  return {
    promise: new Promise<T>((innerResolve, innerReject) => {
      reject = innerReject;
      resolve = innerResolve;
    }),
    reject,
    resolve
  };
}

export async function flushMicrotasks(cycles = 2) {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await Promise.resolve();
  }
}

export async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  options: WaitForTruthyOptions | number = {}
) {
  const normalizedOptions =
    typeof options === "number" ? { attempts: options } : options;
  const attempts = normalizedOptions.attempts ?? 50;
  const intervalMs = normalizedOptions.intervalMs ?? 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(message);
}
