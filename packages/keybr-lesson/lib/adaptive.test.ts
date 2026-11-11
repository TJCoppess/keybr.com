import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import type { Step } from "@keybr/textinput";
import {
  AdaptivePractice,
  adaptiveWords,
  findGeneratedWord,
  matchesAdaptiveTarget,
} from "./adaptive.ts";

const allowed = new Set([..."thin"].map((c) => c.codePointAt(0)!));
function steps(text = "thin thin thin", typo = false, time = 100): Step[] {
  return [...text].map((c, index) => ({
    codePoint: c.codePointAt(0)!,
    timeStamp: index * time,
    timeToType: time,
    typo: typo && c === "h",
  }));
}

test("mistakes receive immediate practice and a delayed check after success", () => {
  const history = new AdaptivePractice();
  equal(history.lesson, 0);
  equal(history.patterns.length, 0);
  history.record(steps(undefined, true), 200, 0);
  equal(history.lesson, 1);
  ok(history.patterns.some((p) => p.text === "th" && p.errors > 0));
  ok(history.targets(allowed, 200, 0).includes("th"));
  history.record(steps(), 200, 1);
  equal(history.targets(allowed, 200, 1).length, 0);
  history.record(steps("nnn"), 200, 2);
  ok(history.targets(allowed, 200, 2).includes("th"));
});

test("mastered patterns return after time away and survive serialization", () => {
  const history = new AdaptivePractice();
  history.record(steps(), 200, 0);
  const restored = AdaptivePractice.restore(JSON.stringify(history));
  equal(restored.targets(allowed, 200, 0).length, 0);
  ok(restored.targets(allowed, 200, 3 * 86_400_000).includes("th"));
  equal(restored.targets(new Set([120]), 200, 3 * 86_400_000).length, 0);
});

test("slow combinations are eligible while pauses and word boundaries are excluded", () => {
  const history = new AdaptivePractice();
  history.record(steps(undefined, false, 400), 200, 0);
  ok(history.targets(allowed, 200, 0).includes("th"));
  const paused = new AdaptivePractice();
  paused.record(steps(undefined, false, 3000), 200, 0);
  equal(paused.targets(allowed, 200, 0).length, 0);
  const patterns = history.toJSON().patterns.map((p) => p.text);
  ok(!patterns.includes("nt"));
  ok(patterns.includes("thi"));
});

test("one observation does not trigger remedial drilling", () => {
  const history = new AdaptivePractice();
  history.record(steps("thin", true), 200, 0);
  deepStrictEqual(history.targets(allowed, 200, 0), []);
});

test("review occupies only one of every four selections and falls back safely", () => {
  const next = adaptiveWords(
    () => "normal",
    (target) => (target.text === "th" ? "thin" : null),
    [{ kind: "pattern", text: "th" }],
  );
  deepStrictEqual(Array.from({ length: 8 }, next), [
    "normal",
    "normal",
    "normal",
    "thin",
    "normal",
    "normal",
    "normal",
    "thin",
  ]);
  const missing = adaptiveWords(
    () => "normal",
    () => null,
    [{ kind: "pattern", text: "zz" }],
  );
  deepStrictEqual(Array.from({ length: 4 }, missing), [
    "normal",
    "normal",
    "normal",
    "normal",
  ]);
});

test("generated words are searched in a bounded number of attempts", () => {
  let attempts = 0;
  equal(
    findGeneratedWord(
      () => {
        attempts++;
        return attempts === 5 ? "thin" : "nine";
      },
      { kind: "pattern", text: "th" },
    ),
    "thin",
  );
  equal(attempts, 5);
  attempts = 0;
  equal(
    findGeneratedWord(
      () => {
        attempts++;
        return null;
      },
      { kind: "pattern", text: "zz" },
    ),
    null,
  );
  equal(attempts, 32);
});

test("a single slip in a frequent combination does not reset its progress", () => {
  const history = new AdaptivePractice();
  const lesson = steps(Array.from({ length: 10 }, () => "thin").join(" "));
  history.record(lesson, 200, 0);
  equal(history.patterns.find((p) => p.text === "th")!.streak, 1);
  // One typo out of ten samples is within the allowed error rate.
  const slip = lesson.map((step, index) =>
    index === 1 ? { ...step, typo: true } : step,
  );
  history.record(slip, 200, 0);
  const th = history.patterns.find((p) => p.text === "th")!;
  equal(th.streak, 2);
  equal(th.samples, 20);
  equal(th.errors, 1);
  equal(th.errorRate, 0.05);
  // Two typos out of ten samples are not.
  history.record(
    lesson.map((step, index) =>
      index === 1 || index === 6 ? { ...step, typo: true } : step,
    ),
    200,
    0,
  );
  equal(history.patterns.find((p) => p.text === "th")!.streak, 0);
});

test("errors accumulate together with samples", () => {
  const history = new AdaptivePractice();
  history.record(steps(undefined, true), 200, 0);
  history.record(steps(), 200, 0);
  history.record(steps(undefined, true), 200, 0);
  const th = history.patterns.find((p) => p.text === "th")!;
  equal(th.samples, 9);
  equal(th.errors, 6);
  equal(th.errorRate, 0.75);
});

test("only combinations of lowercase or caseless letters are recorded", () => {
  const history = new AdaptivePractice();
  history.record(steps("Thin a b2c שלום"), 200, 0);
  deepStrictEqual(
    history.patterns.map((p) => p.text),
    ["hi", "in", "hin", "של", "לו", "שלו", "ום", "לום"],
  );
});

test("history of the previous versions is converted", () => {
  const v1 = { samples: 9, time: 90, streak: 0, due: 8, dueAt: 5 };
  const progress = {
    best: 90,
    stale: 0,
    first: 90,
    reviews: 0,
    reviewedFrom: 0,
  };
  const history = AdaptivePractice.restore(
    JSON.stringify({
      version: 1,
      lesson: 7,
      patterns: [
        { ...v1, text: "t", errors: 0 },
        { ...v1, text: "th", errors: 2 },
        { ...v1, text: "hi", errors: 0 },
        { ...v1, text: "Th", errors: 0 },
      ],
    }),
  );
  const expected = {
    version: 3,
    lesson: 7,
    patterns: [
      { ...v1, ...progress, text: "th", errors: 2, errorRate: 1 },
      { ...v1, ...progress, text: "hi", errors: 0, errorRate: 0 },
    ],
    words: [],
    confusions: [],
  };
  deepStrictEqual(history.toJSON(), expected);
  deepStrictEqual(
    AdaptivePractice.restore(JSON.stringify(history)).toJSON(),
    expected,
  );
  deepStrictEqual(
    AdaptivePractice.from({
      version: 2,
      lesson: 7,
      patterns: [
        { ...v1, text: "th", errors: 2, errorRate: 1 },
        { ...v1, text: "hi", errors: 0, errorRate: 0 },
      ],
    }).toJSON(),
    expected,
  );
});

test("whole words are tracked apart from combinations", () => {
  const history = new AdaptivePractice();
  // Short words, capitalized words and words with punctuation are not words.
  history.record(steps("think the Think thin, think think"), 200, 0);
  deepStrictEqual(
    history.words.map(({ text, samples }) => [text, samples]),
    [["think", 3]],
  );
  // A pause inside of a word spoils it, a pause before a word does not.
  const paused = steps("think think").map((step, index) =>
    index === 2 || index === 6 ? { ...step, timeToType: 5000 } : step,
  );
  const other = new AdaptivePractice();
  other.record(paused, 200, 0);
  deepStrictEqual(
    other.words.map(({ text, samples }) => [text, samples]),
    [["think", 1]],
  );
});

test("slow words and confused letters become review targets", () => {
  const history = new AdaptivePractice();
  const confusions = [
    { expected: 0x0069, typed: 0x006e },
    { expected: 0x0069, typed: 0x006e },
    { expected: 0x0069, typed: 0x006e },
    { expected: 0x0074, typed: 0x0054 }, // Not a lowercase letter.
    { expected: 0x0074, typed: 0x0074 }, // The same letter.
  ];
  history.record(steps("thin thin thin", false, 400), 200, 0, { confusions });
  deepStrictEqual(history.confusions, [
    { expected: "i", typed: "n", count: 3, lesson: 1 },
  ]);
  const targets = history.reviewTargets(allowed, 200, 0);
  deepStrictEqual(targets.slice(0, 3), [
    { kind: "pattern", text: "th" },
    { kind: "word", text: "thin" },
    { kind: "confusion", text: "in" },
  ]);
  equal(targets.filter(({ kind }) => kind === "pattern").length, 5);
  equal(matchesAdaptiveTarget("thin", targets[0]), true);
  equal(matchesAdaptiveTarget("thine", targets[1]), false);
  equal(matchesAdaptiveTarget("nail", targets[2]), true);
  equal(matchesAdaptiveTarget("nut", targets[2]), false);
  // The confusion needs letters which are not unlocked yet.
  const unlocked = new Set([..."thi"].map((c) => c.codePointAt(0)!));
  deepStrictEqual(history.reviewTargets(unlocked, 200, 0), [
    { kind: "pattern", text: "th" },
    { kind: "pattern", text: "hi" },
    { kind: "pattern", text: "thi" },
  ]);
  // The confusion is forgotten if it does not happen again.
  for (let i = 0; i < 30; i++) {
    history.record([], 200, 0);
  }
  equal(
    history
      .reviewTargets(allowed, 200, 0)
      .some(({ kind }) => kind === "confusion"),
    false,
  );
});

test("combinations are compared with the typical speed of the user", () => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const pairs = [
    ...letters.match(/../g)!,
    ...letters.slice(1).match(/../g)!,
  ].join(" ");
  const text = [pairs, pairs, pairs].join(" ");
  const everything = new Set([...letters].map((c) => c.codePointAt(0)!));
  // Twenty five combinations, all slower than the target.
  const history = new AdaptivePractice();
  history.record(steps(text, false, 400), 200, 0);
  equal(history.patterns.length, 25);
  equal(history.slowTime(200), 500);
  // Slower than the target, but as fast as everything else.
  history.record(steps(text, false, 400), 200, 0);
  equal(
    history.patterns.every(({ streak }) => streak === 1),
    true,
  );
  // One combination is much slower than the others.
  history.record(
    steps(text, false, 400).map((step, index) =>
      text[index - 1] === "a" ? { ...step, timeToType: 900 } : step,
    ),
    200,
    0,
  );
  deepStrictEqual(
    history.patterns.filter(({ streak }) => streak === 0).map((p) => p.text),
    ["ab"],
  );
  deepStrictEqual(history.targets(everything, 200, 0), ["ab"]);
});

test("a combination which does not get faster is not reviewed for speed", () => {
  const history = new AdaptivePractice();
  for (let lesson = 1; lesson <= 8; lesson++) {
    history.record(steps(undefined, false, 400), 200, 0);
    const th = history.patterns.find((p) => p.text === "th")!;
    equal(th.stale, lesson - 1);
    equal(th.streak, 0);
  }
  // It was not getting faster for eight lessons.
  history.record(steps(undefined, false, 400), 200, 0);
  equal(history.patterns.find((p) => p.text === "th")!.streak, 1);
  // Any progress makes it worth reviewing again.
  history.record(steps(undefined, false, 300), 200, 0);
  const th = history.patterns.find((p) => p.text === "th")!;
  equal(th.stale, 0);
  equal(th.best, 350);
  equal(th.streak, 0);
});

test("the outcome of reviews is recorded", () => {
  const history = new AdaptivePractice();
  history.record(steps("thin", false, 400), 200, 0);
  equal(history.patterns.find((p) => p.text === "th")!.first, 0);
  history.record(steps("thin thin", false, 400), 200, 0);
  const before = history.patterns.find((p) => p.text === "th")!;
  equal(before.first, 400);
  equal(before.reviews, 0);
  equal(before.reviewedFrom, 0);
  const reviewed = [{ kind: "pattern", text: "th" }] as const;
  history.record(steps("thin thin", false, 200), 200, 0, { reviewed });
  history.record(steps("thin thin", false, 200), 200, 0, { reviewed });
  const after = history.patterns.find((p) => p.text === "th")!;
  equal(after.first, 400);
  equal(after.reviews, 2);
  equal(after.reviewedFrom, 400);
  equal(after.time, 250);
  equal(history.patterns.find((p) => p.text === "hi")!.reviews, 0);
});

test("corrupt storage is ignored", () => {
  for (const value of [
    "{",
    "null",
    '{"version":1,"lesson":0,"patterns":[{}]}',
    '{"version":2,"lesson":0,"patterns":[null,{"text":"th"}]}',
    '{"version":4,"lesson":0,"patterns":[]}',
    '{"version":2,"lesson":-1,"patterns":[]}',
  ]) {
    deepStrictEqual(AdaptivePractice.restore(value).targets(allowed, 200), []);
  }
});
