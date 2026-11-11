import type { Step } from "@keybr/textinput";
import {
  type AdaptiveConfusion,
  type AdaptiveHistory,
  type AdaptivePattern,
  type AdaptiveTarget,
  isAdaptiveLetter,
  isAdaptivePatternDue,
  isAdaptiveWord,
  maxAdaptiveConfusions,
  maxAdaptivePatterns,
  maxAdaptiveWords,
  parseAdaptiveHistory,
} from "./adaptive-history.ts";
import type { WordGenerator } from "./text/words.ts";

const day = 86_400_000;
/** A longer pause means that the user was distracted. */
const maxTimeToType = 2000;
/** A pattern fails a lesson if a larger share of its samples has typos. */
const maxErrorRate = 0.1;
const maxStreak = 6;
const minSamples = 3;
/** A personal baseline needs this many patterns with enough samples. */
const minBaselinePatterns = 20;
/** A pattern is slow if it takes this much longer than the baseline. */
const slowRatio = 1.25;
/** A new best time must be this much shorter than the previous one. */
const bestRatio = 0.98;
/** After this many lessons without a new best time a pattern is as fast as it gets. */
const maxStale = 8;
/** A confusion needs this many repetitions to be reviewed. */
const minConfusions = 3;
/** A confusion which did not happen for this many lessons is forgotten. */
const confusionLessons = 30;
const maxPatternTargets = 6;
const maxWordTargets = 3;
const maxConfusionTargets = 2;

/** A letter which was typed instead of the expected one. */
export type TypedConfusion = {
  readonly expected: number;
  readonly typed: number;
};

/** What else is known about a completed lesson. */
export type RecordDetails = {
  /** The wrong letters which were typed. */
  readonly confusions?: readonly TypedConfusion[];
  /** The review targets for which the lesson text was generated. */
  readonly reviewed?: readonly AdaptiveTarget[];
};

type Observation = { time: number; count: number; errors: number };

/** Bounded, local learning history. No full lesson text is retained. */
export class AdaptivePractice {
  #lesson = 0;
  #patterns = new Map<string, AdaptivePattern>();
  #words = new Map<string, AdaptivePattern>();
  #confusions = new Map<string, AdaptiveConfusion>();

  /** The letter combinations, from the least to the most recently typed. */
  get patterns(): readonly AdaptivePattern[] {
    return [...this.#patterns.values()];
  }

  /** The whole words, from the least to the most recently typed. */
  get words(): readonly AdaptivePattern[] {
    return [...this.#words.values()];
  }

  /** The mistyped letters, from the least to the most recent. */
  get confusions(): readonly AdaptiveConfusion[] {
    return [...this.#confusions.values()];
  }

  get lesson(): number {
    return this.#lesson;
  }

  /** Corrupt or obsolete history must never prevent practice. */
  static restore(json: string | null): AdaptivePractice {
    try {
      return AdaptivePractice.from(JSON.parse(json ?? "null"));
    } catch {
      return new AdaptivePractice();
    }
  }

  static from(data: unknown): AdaptivePractice {
    const history = new AdaptivePractice();
    const parsed = parseAdaptiveHistory(data);
    if (parsed != null) {
      history.#lesson = parsed.lesson;
      for (const pattern of parsed.patterns) {
        history.#patterns.set(pattern.text, pattern);
      }
      for (const word of parsed.words) {
        history.#words.set(word.text, word);
      }
      for (const confusion of parsed.confusions) {
        history.#confusions.set(
          confusion.expected + confusion.typed,
          confusion,
        );
      }
    }
    return history;
  }

  toJSON(): AdaptiveHistory {
    return {
      version: 3,
      lesson: this.#lesson,
      patterns: [...this.#patterns.values()],
      words: [...this.#words.values()],
      confusions: [...this.#confusions.values()],
    };
  }

  /**
   * The time per transition above which a pattern is slow.
   *
   * Patterns are compared with the typical speed of this user, not with
   * a fixed target, so that review goes to what is slow for this user.
   * The target is used until there is enough history.
   */
  slowTime(targetTime: number): number {
    const times = [];
    for (const { samples, time } of this.#patterns.values()) {
      if (samples >= minSamples) {
        times.push(time);
      }
    }
    if (times.length < minBaselinePatterns) {
      return targetTime;
    }
    times.sort((a, b) => a - b);
    const middle = times.length >> 1;
    const median =
      times.length % 2 === 1
        ? times[middle]
        : (times[middle - 1] + times[middle]) / 2;
    return median * slowRatio;
  }

  record(
    steps: readonly Step[],
    targetTime: number,
    now = Date.now(),
    { confusions = [], reviewed = [] }: RecordDetails = {},
  ) {
    this.#lesson++;
    const patterns = new Map<string, Observation>();
    const words = new Map<string, Observation>();
    const observe = (
      observations: Map<string, Observation>,
      sequence: readonly Step[],
    ) => {
      const text = String.fromCodePoint(
        ...sequence.map(({ codePoint }) => codePoint),
      );
      let observation = observations.get(text);
      if (observation == null) {
        observations.set(
          text,
          (observation = { time: 0, count: 0, errors: 0 }),
        );
      }
      // Measure the transitions, not the pause before the first letter.
      const timed = sequence.slice(1);
      observation.time +=
        timed.reduce((sum, s) => sum + s.timeToType, 0) / timed.length;
      observation.count += 1;
      observation.errors += Number(sequence.some((s) => s.typo));
    };
    let run: Step[] = [];
    // The letters of the current word, or null if it cannot be measured.
    let word: Step[] | null = [];
    const endWord = () => {
      if (
        word != null &&
        isAdaptiveWord(
          String.fromCodePoint(...word.map(({ codePoint }) => codePoint)),
        )
      ) {
        observe(words, word);
      }
      word = [];
    };
    for (const step of steps) {
      const timed =
        Number.isFinite(step.timeToType) &&
        step.timeToType > 0 &&
        step.timeToType <= maxTimeToType;
      const letter = isAdaptiveLetter(step.codePoint);
      if (letter && timed) {
        run = [...run.slice(-2), step];
        for (let size = 2; size <= run.length; size++) {
          observe(patterns, run.slice(-size));
        }
      } else {
        run = [];
      }
      if (step.codePoint === 0x0020) {
        endWord();
      } else if (word != null) {
        // The time of the first letter is the pause before the word.
        if (letter && (timed || word.length === 0)) {
          word.push(step);
        } else {
          word = null;
        }
      }
    }
    endWord();
    const slowTime = this.slowTime(targetTime);
    const targets = new Set(reviewed.map(({ text }) => text));
    this.#update(this.#patterns, patterns, slowTime, targets, now);
    this.#update(this.#words, words, slowTime, targets, now);
    trim(this.#patterns, maxAdaptivePatterns);
    trim(this.#words, maxAdaptiveWords);
    for (const { expected, typed } of confusions) {
      if (
        expected !== typed &&
        isAdaptiveLetter(expected) &&
        isAdaptiveLetter(typed)
      ) {
        const a = String.fromCodePoint(expected);
        const b = String.fromCodePoint(typed);
        const count = (this.#confusions.get(a + b)?.count ?? 0) + 1;
        this.#confusions.delete(a + b);
        this.#confusions.set(a + b, {
          expected: a,
          typed: b,
          count,
          lesson: this.#lesson,
        });
      }
    }
    trim(this.#confusions, maxAdaptiveConfusions);
  }

  #update(
    history: Map<string, AdaptivePattern>,
    observations: Map<string, Observation>,
    slowTime: number,
    targets: ReadonlySet<string>,
    now: number,
  ) {
    for (const [text, observation] of observations) {
      const previous = history.get(text);
      const time = observation.time / observation.count;
      const errorRate = observation.errors / observation.count;
      const smoothed = previous ? (previous.time + time) / 2 : time;
      const improved = previous == null || smoothed < previous.best * bestRatio;
      const stale = improved ? 0 : previous.stale + 1;
      // A pattern which does not get faster anymore is as fast as it gets
      // for this user, and reviewing it for speed is a waste of effort.
      const slow = time > slowTime && stale < maxStale;
      const failed = errorRate > maxErrorRate || slow;
      const streak = failed
        ? 0
        : Math.min((previous?.streak ?? 0) + 1, maxStreak);
      const interval = failed ? 1 : 2 ** streak;
      const samples = (previous?.samples ?? 0) + observation.count;
      const reviewed = targets.has(text);
      // Move the pattern to the end to keep the most recent ones.
      history.delete(text);
      history.set(text, {
        text,
        samples,
        time: smoothed,
        errors: (previous?.errors ?? 0) + observation.errors,
        errorRate: previous ? (previous.errorRate + errorRate) / 2 : errorRate,
        streak,
        due: this.#lesson + interval,
        dueAt: now + (failed ? day / 24 : interval * day),
        best: previous ? Math.min(previous.best, smoothed) : smoothed,
        stale,
        first: previous?.first || (samples >= minSamples ? smoothed : 0),
        reviews: (previous?.reviews ?? 0) + Number(reviewed),
        reviewedFrom:
          previous?.reviewedFrom || (reviewed ? (previous?.time ?? time) : 0),
      });
    }
  }

  /** Returns the letter combinations to review in the next lesson. */
  targets(
    allowed: ReadonlySet<number>,
    targetTime: number,
    now = Date.now(),
  ): string[] {
    return this.#due(
      this.#patterns,
      allowed,
      this.slowTime(targetTime),
      now,
      maxPatternTargets,
    );
  }

  /**
   * Returns everything to review in the next lesson: letter combinations,
   * whole words, and pairs of letters which are typed one for another.
   */
  reviewTargets(
    allowed: ReadonlySet<number>,
    targetTime: number,
    now = Date.now(),
  ): AdaptiveTarget[] {
    const slowTime = this.slowTime(targetTime);
    const patterns = this.#due(
      this.#patterns,
      allowed,
      slowTime,
      now,
      maxPatternTargets,
    );
    const words = this.#due(
      this.#words,
      allowed,
      slowTime,
      now,
      maxWordTargets,
    );
    const confusions = [...this.#confusions.values()]
      .filter(
        ({ expected, typed, count, lesson }) =>
          count >= minConfusions &&
          lesson > this.#lesson - confusionLessons &&
          allowed.has(expected.codePointAt(0)!) &&
          allowed.has(typed.codePointAt(0)!),
      )
      .sort((a, b) => b.count - a.count || b.lesson - a.lesson)
      .slice(0, maxConfusionTargets)
      .map(({ expected, typed }) => expected + typed);
    // Take turns, so that every kind is reviewed in a short lesson.
    const result: AdaptiveTarget[] = [];
    for (let i = 0; i < maxPatternTargets; i++) {
      if (i < patterns.length) {
        result.push({ kind: "pattern", text: patterns[i] });
      }
      if (i < words.length) {
        result.push({ kind: "word", text: words[i] });
      }
      if (i < confusions.length) {
        result.push({ kind: "confusion", text: confusions[i] });
      }
    }
    return result;
  }

  #due(
    history: Map<string, AdaptivePattern>,
    allowed: ReadonlySet<number>,
    slowTime: number,
    now: number,
    limit: number,
  ): string[] {
    const eligible = [...history.values()].filter(
      (p) =>
        p.samples >= minSamples &&
        [...p.text].every((c) => allowed.has(c.codePointAt(0)!)) &&
        isAdaptivePatternDue(p, this.#lesson, now),
    );
    const priority = (p: AdaptivePattern) =>
      p.errorRate * 8 +
      (p.stale < maxStale ? Math.max(0, p.time / slowTime - 1) : 0) +
      Math.min(3, Math.max(0, this.#lesson + 1 - p.due) / 4) +
      Math.min(3, Math.max(0, now - p.dueAt) / day);
    return eligible
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, limit)
      .map((p) => p.text);
  }
}

function trim(map: Map<string, unknown>, limit: number) {
  while (map.size > limit) {
    map.delete(map.keys().next().value!);
  }
}

/**
 * Keep three out of four words on the existing focused-key path.
 *
 * @param normal Generates the ordinary words.
 * @param review Finds a word for the given target, if there is any.
 * @param targets What to review.
 */
export function adaptiveWords(
  normal: WordGenerator,
  review: (target: AdaptiveTarget) => string | null,
  targets: readonly AdaptiveTarget[],
): WordGenerator {
  let index = 0;
  let targetIndex = 0;
  return () => {
    if (targets.length === 0 || ++index % 4 !== 0) {
      return normal();
    }
    return review(targets[targetIndex++ % targets.length]) ?? normal();
  };
}

/** Returns whether the given word is good for reviewing the given target. */
export function matchesAdaptiveTarget(
  word: string,
  { kind, text }: AdaptiveTarget,
): boolean {
  switch (kind) {
    case "pattern":
      return word.includes(text);
    case "word":
      return word === text;
    case "confusion":
      // A word with both letters makes the user tell them apart.
      return [...text].every((letter) => word.includes(letter));
  }
}

/** Generates words until one matches the given target, in a bounded number of attempts. */
export function findGeneratedWord(
  words: WordGenerator,
  target: AdaptiveTarget,
  attempts: number = 32,
): string | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const word = words();
    if (word != null && matchesAdaptiveTarget(word, target)) {
      return word;
    }
  }
  return null;
}
