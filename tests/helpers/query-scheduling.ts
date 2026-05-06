import { createDeferred, flushMicrotasks, waitForTruthy } from "./async";

type GateValue<T> = T | PromiseLike<T>;
type LoaderValue<T> = T | Promise<T> | (() => T | Promise<T>);

export type QuerySchedulingGate<T = void> = {
  readonly name: string;
  readonly promise: Promise<T>;
  readonly settled: boolean;
  readonly started: boolean;
  loader: {
    (): () => Promise<T>;
    <TLoader>(valueOrFactory: LoaderValue<TLoader>): () => Promise<TLoader>;
  };
  reject: (reason?: unknown) => void;
  resolve: (value?: GateValue<T>) => void;
};

export type QuerySchedulingHarness = {
  expectNotSettled: (name: string) => void;
  expectNotStarted: (name: string) => void;
  expectResolvesWhileBlocked: <T>(
    promise: Promise<T>,
    blockerName: string,
    message?: string
  ) => Promise<T>;
  expectStarted: (...names: string[]) => Promise<void>;
  gate: <T = void>(name: string) => QuerySchedulingGate<T>;
  releaseAll: () => Promise<void>;
};

type InternalGate<T> = QuerySchedulingGate<T>;

export function createQuerySchedulingHarness(): QuerySchedulingHarness {
  const gates = new Map<string, InternalGate<unknown>>();

  function requireGate(name: string) {
    const gate = gates.get(name);

    if (!gate) {
      throw new Error(`Unknown query scheduling gate: ${name}`);
    }

    return gate;
  }

  return {
    expectNotSettled(name) {
      const gate = requireGate(name);

      if (gate.settled) {
        throw new Error(`Expected query gate "${name}" not to be settled.`);
      }
    },
    expectNotStarted(name) {
      const gate = requireGate(name);

      if (gate.started) {
        throw new Error(`Expected query gate "${name}" not to have started.`);
      }
    },
    async expectResolvesWhileBlocked(promise, blockerName, message) {
      const blocker = requireGate(blockerName);

      if (blocker.settled) {
        throw new Error(
          `Expected query gate "${blockerName}" to be blocked before awaiting the result.`
        );
      }

      let settled = false;
      let rejected = false;
      let rejection: unknown;
      let resolvedValue: Awaited<typeof promise>;

      void Promise.resolve(promise).then(
        (value) => {
          settled = true;
          resolvedValue = value as Awaited<typeof promise>;
        },
        (error: unknown) => {
          settled = true;
          rejected = true;
          rejection = error;
        }
      );

      await waitForTruthy(
        () => settled,
        message ??
          `Expected promise to resolve while query gate "${blockerName}" remained blocked.`
      );

      if (rejected) {
        throw rejection;
      }

      if (blocker.settled) {
        throw new Error(
          `Expected query gate "${blockerName}" to remain blocked after the result resolved.`
        );
      }

      return resolvedValue!;
    },
    async expectStarted(...names) {
      for (const name of names) {
        await waitForTruthy(
          () => requireGate(name).started,
          `Expected query gate "${name}" to start.`
        );
      }
    },
    gate<T = void>(name: string) {
      if (gates.has(name)) {
        throw new Error(`Duplicate query scheduling gate: ${name}`);
      }

      const deferred = createDeferred<T>();
      let started = false;
      let settled = false;

      const loader = ((...args: [] | [LoaderValue<unknown>]) => {
        const [valueOrFactory] = args;

        return async () => {
          started = true;

          const resolvedGateValue = await deferred.promise;

          if (args.length === 0) {
            return resolvedGateValue;
          }

          return typeof valueOrFactory === "function"
            ? await (valueOrFactory as () => unknown | Promise<unknown>)()
            : await valueOrFactory;
        };
      }) as QuerySchedulingGate<T>["loader"];

      const gate: InternalGate<T> = {
        get name() {
          return name;
        },
        get promise() {
          return deferred.promise;
        },
        get settled() {
          return settled;
        },
        get started() {
          return started;
        },
        loader,
        reject(reason?: unknown) {
          if (!settled) {
            settled = true;
            deferred.reject(reason);
          }
        },
        resolve(value?: GateValue<T>) {
          if (!settled) {
            settled = true;
            deferred.resolve(value as T);
          }
        }
      };

      gates.set(name, gate as InternalGate<unknown>);

      return gate;
    },
    async releaseAll() {
      for (const gate of gates.values()) {
        gate.resolve(undefined);
      }

      await Promise.allSettled([...gates.values()].map((gate) => gate.promise));
      await flushMicrotasks();
    }
  };
}
