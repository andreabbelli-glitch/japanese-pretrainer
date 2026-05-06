const NO_BEST = Symbol("pickBestBy:no-best");

export function pickBestBy<T>(
  values: Iterable<T>,
  compare: (left: T, right: T) => number
) {
  let best: T | typeof NO_BEST = NO_BEST;

  for (const value of values) {
    if (best === NO_BEST || compare(value, best) < 0) {
      best = value;
    }
  }

  return best === NO_BEST ? null : best;
}
