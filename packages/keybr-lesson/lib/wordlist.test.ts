import { describe, it, test } from "node:test";
import { Layout, loadKeyboard } from "@keybr/keyboard";
import { FakePhoneticModel } from "@keybr/phonetic-model";
import { makeKeyStatsMap } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { deepEqual, equal, isNull } from "rich-assert";
import { LessonKey } from "./key.ts";
import { lessonProps } from "./settings.ts";
import { WordListLesson } from "./wordlist.ts";

test("provide key set", () => {
  const settings = new Settings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "ghi"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  deepEqual(lessonKeys.findIncludedKeys(), [
    new LessonKey({
      letter: FakePhoneticModel.letter1,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter2,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter3,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter4,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter5,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter6,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter7,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter8,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter9,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter10,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
  ]);
  deepEqual(lessonKeys.findExcludedKeys(), []);
  isNull(lessonKeys.findFocusedKey());
});

test("filter words", () => {
  const settings = new Settings();
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "こんにちは"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);

  deepEqual(lesson.wordList, ["abc", "def"]);
});

describe("generate randomized text using settings", () => {
  const keyboard = loadKeyboard(Layout.EN_US);

  it("should transform to lower case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 0)
      .set(lessonProps.punctuators, 0);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def " +
        "ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc",
    );
  });

  it("should preserve case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 1)
      .set(lessonProps.punctuators, 1);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, " +
        "Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc,",
    );
  });
});

test("adaptive review takes words with difficult combinations", () => {
  const keyboard = loadKeyboard(Layout.EN_US);
  const model = new FakePhoneticModel();
  const wordList = ["abc", "bcd", "cde", "def", "efg", "gfe", "ghij"];
  const count = (text: string) =>
    text.split(" ").filter((word) => word === "ghij").length;

  const lesson = new WordListLesson(new Settings(), keyboard, model, wordList);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  deepEqual(lesson.reviewTargets, []);
  lesson.adaptivePractice!.record(
    [..."ghij ghij ghij"].map((c, index) => ({
      codePoint: c.codePointAt(0)!,
      timeStamp: index * 100,
      timeToType: 100,
      typo: c === "h",
    })),
    200,
  );
  const text = String(lesson.generate(lessonKeys, model.rng));
  deepEqual(lesson.reviewTargets, [
    { kind: "pattern", text: "gh" },
    { kind: "word", text: "ghij" },
    { kind: "pattern", text: "hi" },
    { kind: "pattern", text: "ghi" },
    { kind: "pattern", text: "hij" },
  ]);

  const disabled = new WordListLesson(
    new Settings().set(lessonProps.wordList.adaptivePractice, false),
    keyboard,
    model,
    wordList,
  );
  isNull(disabled.adaptivePractice);
  const plain = String(disabled.generate(lessonKeys, model.rng));
  deepEqual(disabled.reviewTargets, []);

  // The only word with the targets takes every fourth selection.
  const words = text.split(" ").length;
  equal(count(text) >= Math.floor(words / 4), true);
  equal(count(text) > count(plain), true);
});
