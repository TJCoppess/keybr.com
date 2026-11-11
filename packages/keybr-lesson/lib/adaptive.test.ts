import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import type { Step } from "@keybr/textinput";
import {
  AdaptivePractice,
  adaptiveWords,
  findGeneratedWord,
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
    (target) => (target === "th" ? "thin" : null),
    ["th"],
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
    ["zz"],
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
    findGeneratedWord(() => {
      attempts++;
      return attempts === 5 ? "thin" : "nine";
    }, "th"),
    "thin",
  );
  equal(attempts, 5);
  attempts = 0;
  equal(
    findGeneratedWord(() => {
      attempts++;
      return null;
    }, "zz"),
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

test("history of the previous version is converted", () => {
  const history = AdaptivePractice.restore(
    JSON.stringify({
      version: 1,
      lesson: 7,
      patterns: [
        {
          text: "t",
          samples: 9,
          time: 90,
          errors: 0,
          streak: 1,
          due: 9,
          dueAt: 5,
        },
        {
          text: "th",
          samples: 9,
          time: 90,
          errors: 2,
          streak: 0,
          due: 8,
          dueAt: 5,
        },
        {
          text: "hi",
          samples: 4,
          time: 80,
          errors: 0,
          streak: 2,
          due: 11,
          dueAt: 6,
        },
        {
          text: "Th",
          samples: 4,
          time: 80,
          errors: 0,
          streak: 2,
          due: 11,
          dueAt: 6,
        },
      ],
    }),
  );
  deepStrictEqual(history.toJSON(), {
    version: 2,
    lesson: 7,
    patterns: [
      {
        text: "th",
        samples: 9,
        time: 90,
        errors: 2,
        errorRate: 1,
        streak: 0,
        due: 8,
        dueAt: 5,
      },
      {
        text: "hi",
        samples: 4,
        time: 80,
        errors: 0,
        errorRate: 0,
        streak: 2,
        due: 11,
        dueAt: 6,
      },
    ],
  });
  deepStrictEqual(
    AdaptivePractice.restore(JSON.stringify(history)).toJSON(),
    history.toJSON(),
  );
});

test("corrupt storage is ignored", () => {
  for (const value of [
    "{",
    "null",
    '{"version":1,"lesson":0,"patterns":[{}]}',
    '{"version":2,"lesson":0,"patterns":[null,{"text":"th"}]}',
    '{"version":3,"lesson":0,"patterns":[]}',
    '{"version":2,"lesson":-1,"patterns":[]}',
  ]) {
    deepStrictEqual(AdaptivePractice.restore(value).targets(allowed, 200), []);
  }
});
