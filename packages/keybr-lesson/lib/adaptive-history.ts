// The stored format of the adaptive practice history.
// This module has no imports, so the server can use it for validation
// without loading the rest of the lesson package.

/**
 * A letter combination or a whole word,
 * with its typing statistics and review schedule.
 */
export type AdaptivePattern = {
  /** Two or three letters of a combination, or all letters of a word. */
  readonly text: string;
  /** How many times the pattern was typed. */
  readonly samples: number;
  /** Smoothed time per transition, in milliseconds. */
  readonly time: number;
  /** How many of the samples contained a typo. */
  readonly errors: number;
  /** Smoothed share of samples with a typo in recent lessons, in range [0, 1]. */
  readonly errorRate: number;
  /** The number of consecutive lessons in which the pattern was typed well. */
  readonly streak: number;
  /** The lesson number at which the next review is due. */
  readonly due: number;
  /** The time stamp at which the next review is due. */
  readonly dueAt: number;
  /** The best smoothed time so far. */
  readonly best: number;
  /** The number of consecutive lessons without a new best time. */
  readonly stale: number;
  /** The smoothed time when enough samples were first collected, or zero. */
  readonly first: number;
  /** The number of lessons in which the pattern was a review target. */
  readonly reviews: number;
  /** The smoothed time before the first review, or zero if never reviewed. */
  readonly reviewedFrom: number;
};

/** A letter which was typed instead of another letter. */
export type AdaptiveConfusion = {
  /** The letter which should have been typed. */
  readonly expected: string;
  /** The letter which was typed instead. */
  readonly typed: string;
  /** How many times this happened. */
  readonly count: number;
  /** The number of the last lesson in which this happened. */
  readonly lesson: number;
};

export type AdaptiveHistory = {
  readonly version: 3;
  /** The number of completed lessons. */
  readonly lesson: number;
  /** Letter combinations ordered from the least to the most recently typed. */
  readonly patterns: readonly AdaptivePattern[];
  /** Whole words ordered from the least to the most recently typed. */
  readonly words: readonly AdaptivePattern[];
  /** Mistyped letters ordered from the least to the most recent. */
  readonly confusions: readonly AdaptiveConfusion[];
};

/** Something to review in the next lesson. */
export type AdaptiveTarget = {
  /**
   * The text of a `pattern` is a letter combination,
   * of a `word` is the whole word, and of a `confusion`
   * is the expected letter followed by the typed letter.
   */
  readonly kind: "pattern" | "word" | "confusion";
  readonly text: string;
};

export const maxAdaptivePatterns = 1000;
export const maxAdaptiveWords = 500;
export const maxAdaptiveConfusions = 200;

/** Lowercase and caseless letters, and the marks which combine with them. */
const letter = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}]$/u;
const patternText = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}]{2,3}$/u;
const wordText = /^[\p{Ll}\p{Lo}\p{Lm}\p{M}]{4,24}$/u;

/**
 * Returns whether the given character can be a part of a pattern.
 * Capitals, digits, punctuation and spaces cannot.
 */
export function isAdaptiveLetter(codePoint: number): boolean {
  return letter.test(String.fromCodePoint(codePoint));
}

/** Returns whether the given text is long enough to be tracked as a word. */
export function isAdaptiveWord(text: string): boolean {
  return wordText.test(text);
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
 * Invalid items are dropped. If the history itself is invalid,
 * then `null` is returned.
 */
export function parseAdaptiveHistory(data: unknown): AdaptiveHistory | null {
  if (!isRecord(data)) {
    return null;
  }
  const { version, lesson, patterns } = data;
  if (
    (version !== 1 && version !== 2 && version !== 3) ||
    !isLessonNumber(lesson) ||
    !Array.isArray(patterns)
  ) {
    return null;
  }
  // Words and confusions were added in version three.
  const words = version === 3 && Array.isArray(data.words) ? data.words : [];
  const confusions =
    version === 3 && Array.isArray(data.confusions) ? data.confusions : [];
  return {
    version: 3,
    lesson,
    patterns: parseList(patterns, maxAdaptivePatterns, (item) =>
      parsePattern(version, item, patternText),
    ),
    words: parseList(words, maxAdaptiveWords, (item) =>
      parsePattern(version, item, wordText),
    ),
    confusions: parseList(confusions, maxAdaptiveConfusions, parseConfusion),
  };
}

function parseList<T>(
  list: readonly unknown[],
  limit: number,
  parse: (item: unknown) => T | null,
): T[] {
  const result: T[] = [];
  for (const item of list) {
    const parsed = parse(item);
    if (parsed != null) {
      result.push(parsed);
    }
  }
  // The most recent items are at the end.
  return result.slice(-limit);
}

function parsePattern(
  version: 1 | 2 | 3,
  data: unknown,
  validText: RegExp,
): AdaptivePattern | null {
  if (!isRecord(data)) {
    return null;
  }
  const { text, samples, time, errors, streak, due, dueAt } = data;
  if (
    typeof text !== "string" ||
    !validText.test(text) ||
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
  // Earlier versions did not keep the progress of a pattern,
  // so it is measured from the moment of conversion.
  let best = time;
  let stale = 0;
  let first = time;
  let reviews = 0;
  let reviewedFrom = 0;
  if (version === 3) {
    if (
      !isCount(data.best) ||
      !isCount(data.stale) ||
      !isCount(data.first) ||
      !isCount(data.reviews) ||
      !isCount(data.reviewedFrom)
    ) {
      return null;
    }
    ({ best, stale, first, reviews, reviewedFrom } = data);
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
    best,
    stale,
    first,
    reviews,
    reviewedFrom,
  };
}

function parseConfusion(data: unknown): AdaptiveConfusion | null {
  if (!isRecord(data)) {
    return null;
  }
  const { expected, typed, count, lesson } = data;
  if (
    typeof expected !== "string" ||
    typeof typed !== "string" ||
    !letter.test(expected) ||
    !letter.test(typed) ||
    expected === typed ||
    !isCount(count) ||
    !isLessonNumber(lesson)
  ) {
    return null;
  }
  return { expected, typed, count, lesson };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function isLessonNumber(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) >= 0;
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

/** How much faster the patterns have become. */
export type AdaptiveSpeedGain = {
  /** The number of patterns which were measured. */
  readonly count: number;
  /** The mean gain of speed, where 0.1 is ten percent faster. */
  readonly gain: number;
};

/**
 * Compares the current speed of the patterns which were reviewed at least
 * twice with their speed before the first review, and the current speed of
 * the patterns which were never reviewed with their speed when they were
 * first measured.
 *
 * Patterns are picked for review because they are slow, and slow patterns
 * tend to get faster anyway, so the difference between the two groups is
 * a hint and not a proof that review helps.
 */
export function adaptiveSpeedGain(patterns: readonly AdaptivePattern[]): {
  readonly reviewed: AdaptiveSpeedGain | null;
  readonly other: AdaptiveSpeedGain | null;
} {
  const reviewed: number[] = [];
  const other: number[] = [];
  for (const { time, samples, first, reviews, reviewedFrom } of patterns) {
    if (time > 0) {
      if (reviews >= 2 && reviewedFrom > 0) {
        reviewed.push(reviewedFrom / time - 1);
      } else if (reviews === 0 && first > 0 && samples >= 6) {
        other.push(first / time - 1);
      }
    }
  }
  const mean = (list: readonly number[]): AdaptiveSpeedGain | null =>
    list.length > 0
      ? {
          count: list.length,
          gain: list.reduce((a, b) => a + b, 0) / list.length,
        }
      : null;
  return { reviewed: mean(reviewed), other: mean(other) };
}
