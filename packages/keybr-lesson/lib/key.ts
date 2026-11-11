import { type Letter } from "@keybr/phonetic-model";
import { type KeySample, type KeyStats, type KeyStatsMap } from "@keybr/result";
import { type CodePoint } from "@keybr/unicode";
import { type Target } from "./target.ts";

export class LessonKey implements KeyStats {
  static from(keyStats: KeyStats, target: Target): LessonKey {
    const { letter, samples, timeToType, bestTimeToType } = keyStats;
    return new LessonKey({
      letter,
      samples,
      timeToType,
      bestTimeToType,
      confidence: target.confidence(timeToType),
      bestConfidence: target.confidence(bestTimeToType),
      accuracy: recentAccuracy(samples),
    });
  }

  readonly letter: Letter;
  readonly samples: readonly KeySample[];
  readonly timeToType: number | null;
  readonly bestTimeToType: number | null;
  readonly confidence: number | null;
  readonly bestConfidence: number | null;
  /**
   * The share of correct hits in the most recent lessons, in range [0, 1],
   * or `null` if the key was not typed enough.
   */
  readonly accuracy: number | null;
  readonly isIncluded: boolean;
  readonly isFocused: boolean;
  readonly isForced: boolean;

  constructor({
    letter,
    samples,
    timeToType,
    bestTimeToType,
    confidence,
    bestConfidence,
    accuracy = null,
    isIncluded = false,
    isFocused = false,
    isForced = false,
  }: {
    letter: Letter;
    samples: readonly KeySample[];
    timeToType: number | null;
    bestTimeToType: number | null;
    confidence: number | null;
    bestConfidence: number | null;
    accuracy?: number | null;
    isIncluded?: boolean;
    isFocused?: boolean;
    isForced?: boolean;
  }) {
    this.letter = letter;
    this.samples = samples;
    this.timeToType = timeToType;
    this.bestTimeToType = bestTimeToType;
    this.confidence = confidence;
    this.bestConfidence = bestConfidence;
    this.accuracy = accuracy;
    this.isIncluded = isIncluded;
    this.isFocused = isFocused;
    this.isForced = isForced;
    Object.freeze(this);
  }

  asIncluded(): LessonKey {
    return new LessonKey({
      ...this,
      isIncluded: true,
    });
  }

  asExcluded(): LessonKey {
    return new LessonKey({
      ...this,
      isIncluded: false,
      isFocused: false,
      isForced: false,
    });
  }

  asForced(): LessonKey {
    return new LessonKey({
      ...this,
      isIncluded: true,
      isForced: true,
    });
  }

  asFocused(): LessonKey {
    return new LessonKey({
      ...this,
      isIncluded: true,
      isFocused: true,
    });
  }
}

/**
 * Returns the share of correct hits of a key in the most recent lessons
 * in which the key was typed, or `null` if it was not typed enough.
 */
export function recentAccuracy(
  samples: readonly KeySample[],
  lessons: number = 5,
  minHitCount: number = 10,
): number | null {
  let hitCount = 0;
  let missCount = 0;
  for (const sample of samples.slice(-lessons)) {
    hitCount += sample.hitCount;
    missCount += sample.missCount;
  }
  return hitCount >= minHitCount ? 1 - missCount / hitCount : null;
}

export class LessonKeys implements Iterable<LessonKey> {
  static includeAll(keyStatsMap: KeyStatsMap, target: Target): LessonKeys {
    return new LessonKeys(
      [...keyStatsMap].map((keyStats) =>
        LessonKey.from(keyStats, target).asIncluded(),
      ),
    );
  }

  readonly #letters: readonly Letter[];
  readonly #keys: Map<CodePoint, LessonKey>;

  constructor(keys: readonly LessonKey[]) {
    this.#letters = [...keys.map(({ letter }) => letter)];
    this.#keys = new Map(keys.map((key) => [key.letter.codePoint, key]));
  }

  get letters(): readonly Letter[] {
    return this.#letters;
  }

  [Symbol.iterator](): IterableIterator<LessonKey> {
    return this.#keys.values();
  }

  findIncludedKeys(): LessonKey[] {
    return [...this.#keys.values()].filter((key) => key.isIncluded);
  }

  findExcludedKeys(): LessonKey[] {
    return [...this.#keys.values()].filter((key) => !key.isIncluded);
  }

  findFocusedKey(): LessonKey | null {
    return [...this.#keys.values()].find((key) => key.isFocused) ?? null;
  }

  include({ codePoint }: Letter): void {
    this.#keys.set(codePoint, this.#keys.get(codePoint)!.asIncluded());
  }

  exclude({ codePoint }: Letter): void {
    this.#keys.set(codePoint, this.#keys.get(codePoint)!.asExcluded());
  }

  force({ codePoint }: Letter): void {
    this.#keys.set(codePoint, this.#keys.get(codePoint)!.asForced());
  }

  focus({ codePoint }: Letter): void {
    this.#keys.set(codePoint, this.#keys.get(codePoint)!.asFocused());
  }

  find(codePoint: CodePoint): LessonKey | null {
    return this.#keys.get(codePoint) ?? null;
  }
}
