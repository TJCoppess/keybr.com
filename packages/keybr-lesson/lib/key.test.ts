import { test } from "node:test";
import { FakePhoneticModel } from "@keybr/phonetic-model";
import { deepEqual, equal } from "rich-assert";
import { LessonKey, LessonKeys, recentAccuracy } from "./key.ts";

const { letter1, letter2, letter3 } = FakePhoneticModel;

test("mutate lesson keys", () => {
  // Arrange.

  const keys = new LessonKeys([
    new LessonKey({
      letter: letter1,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
    }),
    new LessonKey({
      letter: letter2,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
    }),
    new LessonKey({
      letter: letter3,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
    }),
  ]);

  // Act.

  keys.focus(letter1);

  // Assert.

  deepEqual(keys.letters, [letter1, letter2, letter3]);
  deepEqual(
    [...keys],
    [
      new LessonKey({
        letter: letter1,
        samples: [],
        timeToType: 300,
        bestTimeToType: 300,
        confidence: 1.0,
        bestConfidence: 1.0,
        isIncluded: true,
        isForced: false,
        isFocused: true,
      }),
      new LessonKey({
        letter: letter2,
        samples: [],
        timeToType: 300,
        bestTimeToType: 300,
        confidence: 1.0,
        bestConfidence: 1.0,
        isIncluded: false,
        isForced: false,
        isFocused: false,
      }),
      new LessonKey({
        letter: letter3,
        samples: [],
        timeToType: 300,
        bestTimeToType: 300,
        confidence: 1.0,
        bestConfidence: 1.0,
        isIncluded: false,
        isForced: false,
        isFocused: false,
      }),
    ],
  );
  deepEqual(keys.findIncludedKeys(), [
    new LessonKey({
      letter: letter1,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
      isIncluded: true,
      isForced: false,
      isFocused: true,
    }),
  ]);
  deepEqual(keys.findExcludedKeys(), [
    new LessonKey({
      letter: letter2,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
      isIncluded: false,
      isForced: false,
      isFocused: false,
    }),
    new LessonKey({
      letter: letter3,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
      isIncluded: false,
      isForced: false,
      isFocused: false,
    }),
  ]);
  deepEqual(
    keys.findFocusedKey(),
    new LessonKey({
      letter: letter1,
      samples: [],
      timeToType: 300,
      bestTimeToType: 300,
      confidence: 1.0,
      bestConfidence: 1.0,
      isIncluded: true,
      isForced: false,
      isFocused: true,
    }),
  );
});

test("recent accuracy", () => {
  const sample = (hitCount: number, missCount: number) => ({
    index: 0,
    timeStamp: 0,
    hitCount,
    missCount,
    timeToType: 100,
    filteredTimeToType: 100,
  });
  equal(recentAccuracy([]), null);
  equal(recentAccuracy([sample(9, 9)]), null);
  equal(recentAccuracy([sample(10, 0)]), 1);
  equal(recentAccuracy([sample(10, 1), sample(10, 3)]), 0.8);
  // Only the most recent lessons count.
  equal(
    recentAccuracy([
      sample(10, 10),
      sample(10, 0),
      sample(10, 0),
      sample(10, 0),
      sample(10, 0),
      sample(10, 5),
    ]),
    0.9,
  );
});
