import { type WordList } from "@keybr/content";
import { type Keyboard } from "@keybr/keyboard";
import { Filter, Letter, type PhoneticModel } from "@keybr/phonetic-model";
import {
  randomSample,
  type RNGStream,
  weightedRandomSample,
} from "@keybr/rand";
import { type KeyStatsMap } from "@keybr/result";
import { type Settings } from "@keybr/settings";
import { filterWordList } from "./dictionary.ts";
import { LessonKey, LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";

/** The characters of each kind, in the order in which they are unlocked. */
const punctuation = ".,'\"?!;:-";
const digits = "1234567890";
const symbols = "()=_/[]{}+*<>@#$%&|\\^~`";

/** Placeholders for a word and for a number in a template. */
const W = "\u0001";
const N = "\u0002";

/**
 * The ways to type each character in a context which looks like
 * the punctuation of a natural language or like a piece of source code.
 * Every template of a character contains that character.
 */
const templates: Record<string, readonly string[]> = {
  ".": [`${W}.`, `${W}.${W}`, `${N}.${N}`],
  ",": [`${W},`, `${N},${N}`],
  "'": [`${W}'s`, `'${W}'`],
  '"': [`"${W}"`],
  "?": [`${W}?`],
  "!": [`${W}!`, `!${W}`],
  ";": [`${W};`],
  ":": [`${W}:`, `${W}: ${N}`, `${N}:${N}`],
  "-": [`${W}-${W}`, `-${N}`, `${N}-${N}`],
  "(": [`(${W})`, `${W}(${W})`, `${W}()`],
  ")": [`(${W})`, `${W}(${W})`, `${W}()`],
  "=": [`${W} = ${N}`, `${W}=${W}`, `${W} == ${W}`],
  "_": [`${W}_${W}`, `_${W}`],
  "/": [`${W}/${W}`, `${N}/${N}`, `/${W}`],
  "[": [`[${W}]`, `${W}[${N}]`, `[${N}]`],
  "]": [`[${W}]`, `${W}[${N}]`, `[${N}]`],
  "{": [`{${W}}`, `{ ${W} }`],
  "}": [`{${W}}`, `{ ${W} }`],
  "+": [`${N} + ${N}`, `${W} + ${W}`, `${W}++`],
  "*": [`${N} * ${N}`, `${W} * ${W}`, `*${W}`],
  "<": [`<${W}>`, `${N} < ${N}`, `${W} < ${W}`],
  ">": [`<${W}>`, `${N} > ${N}`, `${W} > ${W}`],
  "@": [`${W}@${W}`, `@${W}`],
  "#": [`#${N}`, `#${W}`],
  "$": [`$${N}`, `$${W}`],
  "%": [`${N}%`, `${W} % ${N}`, `%${W}`],
  "&": [`${W} & ${W}`, `${W} && ${W}`, `&${W}`],
  "|": [`${W} | ${W}`, `${W} || ${W}`],
  "\\": [`${W}\\${W}`, `\\${W}`],
  "^": [`${N}^${N}`, `^${W}`],
  "~": [`~${W}`, `~/${W}`],
  "`": ["`" + W + "`"],
};

/** Keys with Shift and keys far from the home row are typed slower than letters. */
const targetSpeedRatio = 0.6;
/** A key typed with a lower accuracy must be practiced more. */
const minKeyAccuracy = 0.9;
/** The number of keys to start with. */
const minSize = 4;
/** How often a word is about the focused key. */
const focusRatio = 0.4;

/**
 * Practice everything which is not a letter: punctuation, digits and
 * the symbols used in source code. Like the guided lesson, it starts with
 * a few keys, unlocks a next key when the previous keys are learned,
 * and gives more practice to the weakest keys.
 */
export class SymbolsLesson extends Lesson {
  readonly #letters: readonly Letter[];
  readonly #words: readonly string[];
  readonly #target: Target;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    const kinds = [
      settings.get(lessonProps.symbols.punctuation) ? punctuation : "",
      settings.get(lessonProps.symbols.digits) ? digits : "",
      settings.get(lessonProps.symbols.symbols) ? symbols : "",
    ];
    // With nothing selected there is nothing to practice, so select all.
    const all = kinds.join("") || punctuation + digits + symbols;
    const codePoints = [...all]
      .map((char) => char.codePointAt(0)!)
      .filter((codePoint) => this.codePoints.has(codePoint));
    this.#letters = codePoints.map(
      (codePoint, index) => new Letter(codePoint, codePoints.length - index),
    );
    this.#words = filterWordList(wordList, this.codePoints)
      .filter((word) => word.length > 1)
      .slice(0, 500);
    const { min, max } = lessonProps.targetSpeed;
    this.#target = new Target(
      settings.set(
        lessonProps.targetSpeed,
        Math.min(
          max,
          Math.max(
            min,
            settings.get(lessonProps.targetSpeed) * targetSpeedRatio,
          ),
        ),
      ),
    );
  }

  override get letters() {
    return this.#letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    const lessonKeys = new LessonKeys(
      this.#letters.map((letter) =>
        LessonKey.from(keyStatsMap.get(letter), this.#target),
      ),
    );

    const isAccurate = ({ accuracy }: LessonKey): boolean =>
      accuracy == null || accuracy >= minKeyAccuracy;
    const isLearned = (key: LessonKey): boolean =>
      (key.bestConfidence ?? 0) >= 1 && isAccurate(key);

    if (this.settings.get(lessonProps.symbols.progressive)) {
      for (const lessonKey of lessonKeys) {
        const includedKeys = lessonKeys.findIncludedKeys();
        if (
          includedKeys.length < minSize ||
          (lessonKey.bestConfidence ?? 0) >= 1 ||
          includedKeys.every(isLearned)
        ) {
          lessonKeys.include(lessonKey.letter);
        }
      }
    } else {
      for (const lessonKey of lessonKeys) {
        lessonKeys.include(lessonKey.letter);
      }
    }

    // Focus on the slowest key, or else on the least accurate one.
    const includedKeys = lessonKeys.findIncludedKeys();
    const slowKeys = includedKeys
      .filter((key) => (key.confidence ?? 0) < 1)
      .sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
    const inaccurateKeys = includedKeys
      .filter((key) => !isAccurate(key))
      .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));
    const [focusedKey] = [...slowKeys, ...inaccurateKeys];
    if (focusedKey != null) {
      lessonKeys.focus(focusedKey.letter);
    }

    return lessonKeys;
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const includedKeys = lessonKeys.findIncludedKeys();
    const focusedKey = lessonKeys.findFocusedKey();
    const included = new Set(
      includedKeys.map(({ letter }) => String.fromCodePoint(letter.codePoint)),
    );
    const length =
      100 + Math.round(this.settings.get(lessonProps.length) * 100);
    const items: string[] = [];
    let itemsLength = 0;
    while (itemsLength < length) {
      const key =
        focusedKey != null && rng() < focusRatio
          ? focusedKey
          : weightedRandomSample(
              includedKeys,
              // The weaker a key is, the more often it is typed.
              (key) => 3 - 2 * Math.min(1, key.confidence ?? 0),
              rng,
            );
      const item = this.#makeItem(
        String.fromCodePoint(key.letter.codePoint),
        included,
        rng,
      );
      items.push(item);
      itemsLength += item.length;
    }
    return items.join(" ");
  }

  /** Makes a piece of text with the given character and other unlocked characters. */
  #makeItem(char: string, included: ReadonlySet<string>, rng: RNGStream) {
    const includedDigits = [...digits].filter((digit) => included.has(digit));
    if (digits.includes(char)) {
      return this.#makeNumber(includedDigits, rng, char);
    }
    const usable = (templates[char] ?? []).filter((template) =>
      [...template].every(
        (c) =>
          c === W ||
          c === " " ||
          c === "s" ||
          (c === N ? includedDigits.length > 0 : included.has(c)),
      ),
    );
    // A character of another layout, or a bracket whose pair is still locked.
    const template = usable.length > 0 ? randomSample(usable, rng) : W + char;
    return [...template]
      .map((c) =>
        c === W
          ? this.#makeWord(rng)
          : c === N
            ? this.#makeNumber(includedDigits, rng)
            : c,
      )
      .join("");
  }

  #makeWord(rng: RNGStream): string {
    const word =
      this.#words.length > 0
        ? randomSample(this.#words, rng)
        : this.model.nextWord(Filter.empty, rng) || "word";
    return this.settings.get(lessonProps.symbols.capitals) && rng() < 0.25
      ? this.model.language.capitalCase(word)
      : word;
  }

  /** Makes a number of the given digits, with the required digit if any. */
  #makeNumber(
    includedDigits: readonly string[],
    rng: RNGStream,
    required: string | null = null,
  ): string {
    const length = 1 + Math.floor(rng() * 3);
    const number = Array.from({ length }, () =>
      randomSample(includedDigits, rng),
    );
    if (required != null) {
      number[Math.floor(rng() * length)] = required;
    }
    // Numbers do not start with zero, if that can be helped.
    const start = number.findIndex((digit) => digit !== "0");
    if (start > 0) {
      [number[0], number[start]] = [number[start], number[0]];
    }
    return number.join("");
  }
}
