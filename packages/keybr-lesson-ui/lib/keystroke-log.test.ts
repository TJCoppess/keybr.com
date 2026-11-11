import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { KeystrokeLog, toLoggedLesson, toSteps } from "./keystroke-log.ts";

const steps = [
  { timeStamp: 1100, codePoint: 0x0061, timeToType: 100.4, typo: false },
  { timeStamp: 1350, codePoint: 0x0062, timeToType: 250, typo: true },
];

test("convert steps", () => {
  const lesson = toLoggedLesson("en-us", "generated", 1000, steps, [
    { expected: 0x0062, typed: 0x0063 },
  ]);
  deepStrictEqual(lesson, {
    layout: "en-us",
    textType: "generated",
    timeStamp: 1000,
    steps: [0x0061, 100, 0, 0x0062, 250, 1],
    confusions: [0x0062, 0x0063],
  });
  deepStrictEqual(toSteps(lesson), [
    { timeStamp: 1100, codePoint: 0x0061, timeToType: 100, typo: false },
    { timeStamp: 1350, codePoint: 0x0062, timeToType: 250, typo: true },
  ]);
});

test("append, read and clear", async () => {
  // The test environment provides a database in memory.
  const options = { name: "test-append-read-clear" };
  const log = new KeystrokeLog(indexedDB, options);
  equal(await log.count(), 0);
  deepStrictEqual(await log.read(), []);
  const a = toLoggedLesson("en-us", "generated", 1, steps, []);
  const b = toLoggedLesson("en-us", "natural", 2, steps, []);
  await log.append(a);
  await log.append(b);
  // The log is kept in the database, not in the object.
  const other = new KeystrokeLog(indexedDB, options);
  equal(await other.count(), 2);
  deepStrictEqual(await other.read(), [a, b]);
  await other.clear();
  equal(await log.count(), 0);
});

test("delete the oldest lessons over the limit", async () => {
  const log = new KeystrokeLog(indexedDB, {
    name: "test-limit",
    limit: 3,
  });
  for (let timeStamp = 1; timeStamp <= 5; timeStamp++) {
    await log.append(toLoggedLesson("en-us", "generated", timeStamp, [], []));
  }
  deepStrictEqual(
    (await log.read()).map(({ timeStamp }) => timeStamp),
    [3, 4, 5],
  );
});
