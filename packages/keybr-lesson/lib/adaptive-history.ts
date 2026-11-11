// The stored format of the adaptive practice history.
// This module has no imports, so the server can use it for validation
// without loading the rest of the lesson package.

/** A letter combination with its typing statistics and review schedule. */
export type AdaptivePattern = {
  /** Two or three letters. */
  readonly text: string;
  /** How many times the combination was typed. */
  readonly samples: number;
  /** Smoothed time per transition, in milliseconds. */
  readonly time: number;
  /** How many of the samples contained a typo. */
  readonly errors: number;
  /** Smoothed share of samples with a typo in recent lessons, in range [0, 1]. */
  readonly errorRate: number;
  /** The number of consecutive lessons in which the combination was typed well. */
  readonly streak: number;
  /** The lesson number at which the next review is due. */
  readonly due: number;
  /** The time stamp at which the next review is due. */
  readonly dueAt: number;
};

export type AdaptiveHistory = {
  readonly version: 2;
  /** The number of completed lessons. */
  readonly lesson: number;
  /** Patterns ordered from the least to the most recently typed. */
  readonly patterns: readonly AdaptivePattern[];
};

export const maxAdaptivePatterns = 1000;

/** Lowercase and caseless letters, and the marks which combine with them. */
const letter = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}]$/u;
const patternText = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}]{2,3}$/u;

/**
 * Returns whether the given character can be a part of a pattern.
 * Capitals, digits, punctuation and spaces cannot.
 */
export function isAdaptiveLetter(codePoint: number): boolean {
  return letter.test(String.fromCodePoint(codePoint));
}

/** Returns whether the given pattern should be reviewed in the next lesson. */
export function isAdaptivePatternDue(
  { due, dueAt }: AdaptivePattern,
  lesson: number,
  now: number = Date.now(),
): boolean {
  return due <= lesson + 1 || dueAt <= now;
}

/**
 * Validates a history which was read from storage or received over
 * the network, and converts it to the current version.
 *
 * Invalid patterns are dropped. If the history itself is invalid,
 * then `null` is returned.
 */
export function parseAdaptiveHistory(data: unknown): AdaptiveHistory | null {
  if (!isRecord(data)) {
    return null;
  }
  const { version, lesson, patterns } = data;
  if (
    (version !== 1 && version !== 2) ||
    !Number.isSafeInteger(lesson) ||
    (lesson as number) < 0 ||
    !Array.isArray(patterns)
  ) {
    return null;
  }
  const result: AdaptivePattern[] = [];
  for (const item of patterns) {
    const pattern = parsePattern(version, item);
    if (pattern != null) {
      result.push(pattern);
    }
  }
  return {
    version: 2,
    lesson: lesson as number,
    patterns: result.slice(-maxAdaptivePatterns),
  };
}

function parsePattern(version: 1 | 2, data: unknown): AdaptivePattern | null {
  if (!isRecord(data)) {
    return null;
  }
  const { text, samples, time, errors, streak, due, dueAt } = data;
  if (
    typeof text !== "string" ||
    !patternText.test(text) ||
    !isCount(samples) ||
    !isCount(time) ||
    !isCount(errors) ||
    !isCount(streak) ||
    !isCount(due) ||
    !isCount(dueAt)
  ) {
    return null;
  }
  let errorRate: number;
  if (version === 1) {
    // Version one kept the number of errors in the last lesson only,
    // so all we know is whether the last lesson had an error.
    errorRate = errors > 0 ? 1 : 0;
  } else {
    if (!isCount(data.errorRate)) {
      return null;
    }
    errorRate = Math.min(data.errorRate, 1);
  }
  return {
    text,
    samples,
    time,
    errors: Math.min(errors, samples),
    errorRate,
    streak,
    due,
    dueAt,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** The browser storage key of a guest history. */
export function adaptiveStorageKey(layoutId: string): string {
  return `keybr.adaptive.v1.${layoutId}`;
}

/** The browser storage key of a cached account history. */
export function adaptiveAccountStorageKey(
  userId: string,
  layoutId: string,
): string {
  return `keybr.adaptive.account.v1.${userId}.${layoutId}`;
}

/** The server path of an account history. */
export function adaptiveSyncPath(layoutId: string): string {
  return `/_/sync/adaptive/${encodeURIComponent(layoutId)}`;
}
