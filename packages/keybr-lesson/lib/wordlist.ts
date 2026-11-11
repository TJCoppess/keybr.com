import { type WordList } from "@keybr/content";
import { type Keyboard } from "@keybr/keyboard";
import { Letter, type PhoneticModel } from "@keybr/phonetic-model";
import { randomSample, type RNGStream } from "@keybr/rand";
import { type KeyStatsMap } from "@keybr/result";
import { type Settings } from "@keybr/settings";
import {
  AdaptivePractice,
  adaptiveWords,
  matchesAdaptiveTarget,
} from "./adaptive.ts";
import { type AdaptiveTarget } from "./adaptive-history.ts";
import { filterWordList } from "./dictionary.ts";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import { mangledWords, randomWords, uniqueWords } from "./text/words.ts";

export class WordListLesson extends Lesson {
  readonly wordList: WordList;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    const wordListSize = settings.get(lessonProps.wordList.wordListSize);
    const longWordsOnly = settings.get(lessonProps.wordList.longWordsOnly);
    this.wordList = filterWordList(wordList, this.codePoints)
      .filter((word) => !longWordsOnly || word.length > 3)
      .slice(0, wordListSize);
    if (settings.get(lessonProps.wordList.adaptivePractice)) {
      this.adaptivePractice = new AdaptivePractice();
    }
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(lessonKeys: LessonKeys, rng: RNGStream) {
    const normal = randomWords(this.wordList, rng);
    // All letters are available in this lesson, so unlike the guided
    // lesson it adapts only by reviewing what the user finds difficult.
    const targets =
      this.adaptivePractice?.reviewTargets(
        new Set(this.model.letters.map(({ codePoint }) => codePoint)),
        60000 / this.settings.get(lessonProps.targetSpeed),
      ) ?? [];
    this.reviewTargets = targets;
    const wordGenerator =
      targets.length === 0
        ? normal
        : adaptiveWords(normal, this.#makeWordFinder(rng), targets);
    const words = mangledWords(
      uniqueWords(wordGenerator),
      this.model.language,
      Letter.restrict(Letter.punctuators, this.codePoints),
      {
        withCapitals: this.settings.get(lessonProps.capitals),
        withPunctuators: this.settings.get(lessonProps.punctuators),
      },
      rng,
    );
    return generateFragment(this.settings, words, {
      repeatWords: this.settings.get(lessonProps.repeatWords),
    });
  }

  /** Makes a function which finds a word for the given review target. */
  #makeWordFinder(rng: RNGStream) {
    const matches = new Map<AdaptiveTarget, readonly string[]>();
    return (target: AdaptiveTarget): string | null => {
      let words = matches.get(target);
      if (words == null) {
        words = this.wordList
          .filter((word) => matchesAdaptiveTarget(word, target))
          .slice(0, 100);
        matches.set(target, words);
      }
      return words.length > 0 ? randomSample(words, rng) : null;
    };
  }
}
