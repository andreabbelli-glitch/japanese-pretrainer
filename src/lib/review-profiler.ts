type ReviewTimingMeta = Record<string, unknown>;

export class ReviewProfiler {
  addMeta(meta: ReviewTimingMeta) {
    void meta;
  }

  async measure<T>(
    _name: string,
    loader: () => Promise<T> | T,
    detail?:
      | ReviewTimingMeta
      | ((value: T) => ReviewTimingMeta | undefined | null)
  ): Promise<T> {
    void detail;
    return loader();
  }
}

export async function measureWith<T>(
  profiler: ReviewProfiler | null | undefined,
  name: string,
  fn: () => Promise<T> | T,
  detail?:
    | Record<string, unknown>
    | ((value: T) => Record<string, unknown> | undefined | null)
): Promise<T> {
  if (profiler) {
    return profiler.measure(name, fn, detail);
  }

  return fn();
}
