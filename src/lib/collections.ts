export function pickBestBy<T>(
  values: Iterable<T>,
  compare: (left: T, right: T) => number
) {
  let best: T | null = null;

  for (const value of values) {
    if (!best || compare(value, best) < 0) {
      best = value;
    }
  }

  return best;
}
