import { test } from "node:test";
import { Layout, loadKeyboard } from "@keybr/keyboard";
import { FakePhoneticModel } from "@keybr/phonetic-model";
import { LCG } from "@keybr/rand";
import { makeKeyStatsMap } from "@keybr/result";
import { Settings } from "@keybr/settings";
import { deepEqual, equal, isNull, match } from "rich-assert";
import { fakeKeyStatsMap } from "./fakes.ts";
import { lessonProps } from "./settings.ts";
import { SymbolsLesson } from "./symbols.ts";

const keyboard = loadKeyboard(Layout.EN_US);
const model = new FakePhoneticModel();
const wordList = ["one", "two", "three", "four"];

const labels = (lesson: SymbolsLesson) =>
  lesson.letters.map(({ label }) => label).join("");

test("provide the selected kinds of keys", () => {
  equal(
    labels(new SymbolsLesson(new Settings(), keyboard, model, wordList)),
    ".,'\"?!;:-1234567890()=_/[]{}+*<>@#$%&|\\^~`",
  );
  equal(
    labels(
      new SymbolsLesson(
        new Settings()
          .set(lessonProps.symbols.punctuation, false)
          .set(lessonProps.symbols.symbols, false),
        keyboard,
        model,
        wordList,
      ),
    ),
    "1234567890",
  );
  // Nothing selected means everything.
  equal(
    labels(
      new SymbolsLesson(
        new Settings()
          .set(lessonProps.symbols.punctuation, false)
          .set(lessonProps.symbols.digits, false)
          .set(lessonProps.symbols.symbols, false),
        keyboard,
        model,
        wordList,
      ),
    ).length,
    42,
  );
});

test("unlock keys one by one and focus on the weakest key", () => {
  const settings = new Settings();
  const lesson = new SymbolsLesson(settings, keyboard, model, wordList);
  isNull(lesson.adaptivePractice);

  // No results yet.
  const first = lesson.update(makeKeyStatsMap(lesson.letters, []));
  deepEqual(
    first.findIncludedKeys().map(({ letter }) => letter.label),
    [".", ",", "'", '"'],
  );
  equal(first.findFocusedKey()?.letter.label, ".");

  // The target of this lesson is lower than the target of the letters,
  // so these four keys are learned, and a next key is unlocked.
  const stats = (confidence: number) =>
    fakeKeyStatsMap(
      settings,
      lesson.letters.map((letter, index) =>
        index < 4 ? [letter, confidence, confidence] : [letter, null, null],
      ),
    );
  equal(lesson.update(stats(0.5)).findIncludedKeys().length, 4);
  const next = lesson.update(stats(0.7));
  equal(next.findIncludedKeys().length, 5);
  equal(next.findFocusedKey()?.letter.label, "?");

  // Everything at once.
  const all = new SymbolsLesson(
    settings.set(lessonProps.symbols.progressive, false),
    keyboard,
    model,
    wordList,
  );
  equal(
    all.update(makeKeyStatsMap(all.letters, [])).findIncludedKeys().length,
    42,
  );
});

test("generate text only with words and unlocked keys", () => {
  const settings = new Settings().set(lessonProps.symbols.capitals, false);
  const lesson = new SymbolsLesson(settings, keyboard, model, wordList);
  const rng = LCG(1);

  const first = lesson.update(makeKeyStatsMap(lesson.letters, []));
  for (let i = 0; i < 20; i++) {
    const text = lesson.generate(first, rng);
    match(text, /^[a-z.,'" ]+$/);
    equal(text.length >= 100, true);
    // Four words out of ten are about the focused key.
    equal(text.split(".").length - 1 >= 5, true);
  }

  const all = new SymbolsLesson(
    settings.set(lessonProps.symbols.progressive, false),
    keyboard,
    model,
    wordList,
  );
  const keys = all.update(makeKeyStatsMap(all.letters, []));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    for (const char of all.generate(keys, rng)) {
      seen.add(char);
    }
  }
  // Every key is practiced, with nothing but the words in between.
  deepEqual(
    [...seen].filter((char) => !/[a-z ]/.test(char)).sort(),
    [...labels(all)].sort(),
  );
});

test("numbers are made of unlocked digits", () => {
  const lesson = new SymbolsLesson(
    new Settings()
      .set(lessonProps.symbols.punctuation, false)
      .set(lessonProps.symbols.symbols, false),
    keyboard,
    model,
    wordList,
  );
  const keys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  const rng = LCG(1);
  for (let i = 0; i < 20; i++) {
    match(lesson.generate(keys, rng), /^[1234 ]+$/);
  }
});

test("capitalize some words", () => {
  const lesson = new SymbolsLesson(new Settings(), keyboard, model, wordList);
  const keys = lesson.update(makeKeyStatsMap(lesson.letters, []));
  const rng = LCG(1);
  let text = "";
  for (let i = 0; i < 20; i++) {
    text += lesson.generate(keys, rng);
  }
  match(text, /One|Two|Three|Four/);
  match(text, /one|two|three|four/);
});
