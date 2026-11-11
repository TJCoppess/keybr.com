import type { Step } from "@keybr/textinput";
import {
  type AdaptiveHistory,
  type AdaptivePattern,
  isAdaptiveLetter,
  isAdaptivePatternDue,
  maxAdaptivePatterns,
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
const maxTargets = 6;

/** Bounded, local learning history. No full lesson text is retained. */
export class AdaptivePractice {
  #lesson = 0;
  #patterns = new Map<string, AdaptivePattern>();

  get patterns(): readonly AdaptivePattern[] {
    return [...this.#patterns.values()];
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
    }
    return history;
  }

  toJSON(): AdaptiveHistory {
    return {
      version: 2,
      lesson: this.#lesson,
      patterns: [...this.#patterns.values()],
    };
  }

  record(steps: readonly Step[], targetTime: number, now = Date.now()) {
    this.#lesson++;
    const observations = new Map<
      string,
      { time: number; count: number; errors: number }
    >();
    let run: Step[] = [];
    for (const step of steps) {
      if (
        !isAdaptiveLetter(step.codePoint) ||
        !Number.isFinite(step.timeToType) ||
        step.timeToType <= 0 ||
        step.timeToType > maxTimeToType
      ) {
        run = [];
        continue;
      }
      run = [...run.slice(-2), step];
      for (let size = 2; size <= run.length; size++) {
        const sequence = run.slice(-size);
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
      }
    }
    for (const [text, observation] of observations) {
      const previous = this.#patterns.get(text);
      const time = observation.time / observation.count;
      const errorRate = observation.errors / observation.count;
      const failed = errorRate > maxErrorRate || time > targetTime;
      const streak = failed
        ? 0
        : Math.min((previous?.streak ?? 0) + 1, maxStreak);
      const interval = failed ? 1 : 2 ** streak;
      // Move the pattern to the end to keep the most recent ones.
      this.#patterns.delete(text);
      this.#patterns.set(text, {
        text,
        samples: (previous?.samples ?? 0) + observation.count,
        time: previous ? (previous.time + time) / 2 : time,
        errors: (previous?.errors ?? 0) + observation.errors,
        errorRate: previous ? (previous.errorRate + errorRate) / 2 : errorRate,
        streak,
        due: this.#lesson + interval,
        dueAt: now + (failed ? day / 24 : interval * day),
      });
    }
    while (this.#patterns.size > maxAdaptivePatterns) {
      this.#patterns.delete(this.#patterns.keys().next().value!);
    }
  }

  targets(
    allowed: ReadonlySet<number>,
    targetTime: number,
    now = Date.now(),
  ): string[] {
    const eligible = [...this.#patterns.values()].filter(
      (p) =>
        p.samples >= minSamples &&
        [...p.text].every((c) => allowed.has(c.codePointAt(0)!)) &&
        isAdaptivePatternDue(p, this.#lesson, now),
    );
    const priority = (p: AdaptivePattern) =>
      p.errorRate * 8 +
      Math.max(0, p.time / targetTime - 1) +
      Math.min(3, Math.max(0, this.#lesson + 1 - p.due) / 4) +
      Math.min(3, Math.max(0, now - p.dueAt) / day);
    return eligible
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, maxTargets)
      .map((p) => p.text);
  }
}

/**
 * Keep three out of four words on the existing focused-key path.
 *
 * @param normal Generates the ordinary words.
 * @param review Finds a word with the given target, if there is any.
 * @param targets The combinations to review.
 */
export function adaptiveWords(
  normal: WordGenerator,
  review: (target: string) => string | null,
  targets: readonly string[],
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

/** Generates words until one has the given target, in a bounded number of attempts. */
export function findGeneratedWord(
  words: WordGenerator,
  target: string,
  attempts: number = 32,
): string | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const word = words();
    if (word?.includes(target)) {
      return word;
    }
  }
  return null;
}
