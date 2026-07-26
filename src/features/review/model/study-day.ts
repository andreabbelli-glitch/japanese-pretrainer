export type ReviewStudyDayPolicy = {
  rolloverMinutes: number;
  timeZone: string;
};

export type ReviewStudyDayBounds = {
  dayEnd: Date;
  dayEndIso: string;
  dayStart: Date;
  dayStartIso: string;
  studyDay: string;
};

export type ReviewStudyDayContext = ReviewStudyDayBounds & {
  policyKey: string;
};

export const DEFAULT_REVIEW_STUDY_DAY_POLICY: ReviewStudyDayPolicy = {
  rolloverMinutes: 4 * 60,
  timeZone: "Europe/Rome"
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const formatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

/** Returns the logical FSRS day containing the supplied instant. */
export function getReviewStudyDay(
  value: Date | string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
) {
  const date = parseReviewTimestamp(value);
  const normalizedPolicy = normalizeReviewStudyDayPolicy(policy);
  const parts = getZonedDateTimeParts(date, normalizedPolicy.timeZone);
  const localMinutes = parts.hour * 60 + parts.minute;

  if (localMinutes >= normalizedPolicy.rolloverMinutes) {
    return formatDateKey(parts.year, parts.month, parts.day);
  }

  return addReviewStudyDays(
    formatDateKey(parts.year, parts.month, parts.day),
    -1
  );
}

/**
 * Returns exact instants for the logical day boundaries. The duration may be
 * 23 or 25 hours across DST; callers must not derive the end with +24h.
 */
export function getReviewStudyDayBounds(
  value: Date | string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
): ReviewStudyDayBounds {
  return getReviewStudyDayBoundsForKey(
    getReviewStudyDay(value, policy),
    policy
  );
}

export function getReviewStudyDayBoundsForKey(
  studyDay: string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
): ReviewStudyDayBounds {
  const normalizedPolicy = normalizeReviewStudyDayPolicy(policy);
  const dayStart = getReviewStudyDayStart(studyDay, normalizedPolicy);
  const dayEnd = getReviewStudyDayStart(
    addReviewStudyDays(studyDay, 1),
    normalizedPolicy
  );

  return {
    dayEnd,
    dayEndIso: dayEnd.toISOString(),
    dayStart,
    dayStartIso: dayStart.toISOString(),
    studyDay
  };
}

export function getReviewStudyDayContext(
  value: Date | string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
): ReviewStudyDayContext {
  return {
    ...getReviewStudyDayBounds(value, policy),
    policyKey: getReviewStudyDayPolicyKey(policy)
  };
}

export function getReviewStudyDayStart(
  studyDay: string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
) {
  const normalizedPolicy = normalizeReviewStudyDayPolicy(policy);
  const { day, month, year } = parseDateKey(studyDay);
  const hour = Math.floor(normalizedPolicy.rolloverMinutes / 60);
  const minute = normalizedPolicy.rolloverMinutes % 60;

  return zonedDateTimeToDate(
    { day, hour, minute, month, year },
    normalizedPolicy.timeZone
  );
}

/** Adds calendar days to a logical day key, independently from DST length. */
export function addReviewStudyDays(studyDay: string, amount: number) {
  const { day, month, year } = parseDateKey(studyDay);

  if (!Number.isFinite(amount)) {
    throw new Error("Invalid review study-day offset.");
  }

  const shifted = new Date(Date.UTC(year, month - 1, day + Math.trunc(amount)));

  return formatDateKey(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

/** Returns an integer calendar-day distance, never an elapsed-ms fraction. */
export function differenceInReviewStudyDayKeys(
  startStudyDay: string,
  endStudyDay: string
) {
  return (
    (dateKeyToOrdinal(endStudyDay) - dateKeyToOrdinal(startStudyDay)) / DAY
  );
}

export function differenceInReviewStudyDays(
  start: Date | string,
  end: Date | string,
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
) {
  return differenceInReviewStudyDayKeys(
    getReviewStudyDay(start, policy),
    getReviewStudyDay(end, policy)
  );
}

/**
 * Normalizes day-based FSRS due dates to the rollover boundary. Sub-day
 * learning/relearning steps retain the exact timestamp returned by FSRS.
 */
export function normalizeReviewDueAt(input: {
  dueAt: Date | string;
  reviewedAt: Date | string;
  scheduledDays: number;
  policy?: ReviewStudyDayPolicy;
}) {
  const dueAt = parseReviewTimestamp(input.dueAt);
  const scheduledDays = Math.max(0, Math.round(input.scheduledDays));

  if (scheduledDays < 1) {
    return dueAt;
  }

  const policy = input.policy ?? DEFAULT_REVIEW_STUDY_DAY_POLICY;
  const reviewedStudyDay = getReviewStudyDay(input.reviewedAt, policy);

  return getReviewStudyDayStart(
    addReviewStudyDays(reviewedStudyDay, scheduledDays),
    policy
  );
}

export function getReviewStudyDayPolicyKey(
  policy: ReviewStudyDayPolicy = DEFAULT_REVIEW_STUDY_DAY_POLICY
) {
  const normalizedPolicy = normalizeReviewStudyDayPolicy(policy);

  return `study-day:v1:${normalizedPolicy.timeZone}:rollover-${normalizedPolicy.rolloverMinutes}`;
}

function normalizeReviewStudyDayPolicy(policy: ReviewStudyDayPolicy) {
  if (
    !Number.isInteger(policy.rolloverMinutes) ||
    policy.rolloverMinutes < 0 ||
    policy.rolloverMinutes >= 24 * 60
  ) {
    throw new Error(
      "Review study-day rollover must be a whole minute in [0, 1440)."
    );
  }

  // Constructing the formatter validates the IANA identifier once and lets us
  // fail close to configuration instead of silently falling back to the host TZ.
  getZonedDateTimeFormatter(policy.timeZone);

  return policy;
}

function parseReviewTimestamp(value: Date | string) {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid review study-day timestamp.");
  }

  return date;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

  if (!match) {
    throw new Error(`Invalid review study-day key: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid review study-day key: ${value}`);
  }

  return { day, month, year };
}

function dateKeyToOrdinal(value: string) {
  const { day, month, year } = parseDateKey(value);

  return Date.UTC(year, month - 1, day);
}

function getZonedDateTimeParts(date: Date, timeZone: string) {
  const formatter = getZonedDateTimeFormatter(timeZone);
  const values = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    day: values.get("day") ?? 1,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    month: values.get("month") ?? 1,
    year: values.get("year") ?? 1970
  };
}

function getZonedDateTimeFormatter(timeZone: string) {
  const cached = formatterByTimeZone.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });

  // Force eager validation: some runtimes defer checking until first format.
  formatter.format(new Date(0));
  formatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

function zonedDateTimeToDate(
  target: {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  },
  timeZone: string
) {
  const targetWallTime = wallTimeToUtcMillis(target);
  const possibleOffsets = new Set<number>();

  for (const sampleOffset of [-2 * DAY, -DAY, 0, DAY, 2 * DAY]) {
    const sample = new Date(targetWallTime + sampleOffset);
    const sampleWallTime = wallTimeToUtcMillis(
      getZonedDateTimeParts(sample, timeZone)
    );
    possibleOffsets.add(sampleWallTime - sample.getTime());
  }

  const exactCandidates = [...possibleOffsets]
    .map((offset) => new Date(targetWallTime - offset))
    .filter((candidate) =>
      wallTimeEquals(getZonedDateTimeParts(candidate, timeZone), target)
    )
    .sort((left, right) => left.getTime() - right.getTime());

  if (exactCandidates[0]) {
    return exactCandidates[0];
  }

  // A configured rollover may land inside a DST gap. In that uncommon case,
  // use the first representable local minute after the requested wall time.
  const approximateOffset = possibleOffsets.values().next().value ?? 0;
  const approximateInstant = targetWallTime - approximateOffset;

  for (
    let offsetMinutes = -6 * 60;
    offsetMinutes <= 6 * 60;
    offsetMinutes += 1
  ) {
    const candidate = new Date(approximateInstant + offsetMinutes * MINUTE);
    const candidateWallTime = wallTimeToUtcMillis(
      getZonedDateTimeParts(candidate, timeZone)
    );

    if (candidateWallTime >= targetWallTime) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve review study-day boundary in ${timeZone}.`
  );
}

function wallTimeToUtcMillis(value: {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}) {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute
  );
}

function wallTimeEquals(
  left: {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  },
  right: {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  }
) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function formatDateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
