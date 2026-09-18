import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import type { Step } from "@keybr/textinput";
import { AdaptivePractice, adaptiveWords } from "./adaptive.ts";

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
  history.record(steps(undefined, true), 200, 0);
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
    () => "thin",
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
  let attempts = 0;
  const missing = adaptiveWords(
    () => "normal",
    () => {
      attempts++;
      return null;
    },
    ["zz"],
  );
  deepStrictEqual(Array.from({ length: 4 }, missing), [
    "normal",
    "normal",
    "normal",
    "normal",
  ]);
  equal(attempts, 32);
});

test("corrupt storage is ignored", () => {
  for (const value of [
    "{",
    "null",
    '{"version":1,"lesson":0,"patterns":[{}]}',
  ]) {
    deepStrictEqual(AdaptivePractice.restore(value).targets(allowed, 200), []);
  }
});
