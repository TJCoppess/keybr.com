import type { Step } from "@keybr/textinput";
import type { WordGenerator } from "./text/words.ts";

type Pattern = {
  text: string;
  samples: number;
  time: number;
  errors: number;
  streak: number;
  due: number;
  dueAt: number;
};

const day = 86_400_000;

/** Bounded, local learning history. No full lesson text is retained. */
export class AdaptivePractice {
  #lesson = 0;
  #patterns = new Map<string, Pattern>();

  static restore(json: string | null): AdaptivePractice {
    const history = new AdaptivePractice();
    try {
      const data = JSON.parse(json ?? "null");
      if (
        data?.version !== 1 ||
        !Number.isSafeInteger(data.lesson) ||
        data.lesson < 0 ||
        !Array.isArray(data.patterns)
      ) {
        return history;
      }
      history.#lesson = data.lesson;
      for (const p of data.patterns.slice(0, 1000)) {
        if (
          typeof p.text === "string" &&
          /^\p{L}{1,3}$/u.test(p.text) &&
          [p.samples, p.time, p.errors, p.streak, p.due, p.dueAt].every(
            (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
          )
        ) {
          history.#patterns.set(p.text, p);
        }
      }
    } catch {
      // Corrupt or obsolete local history must never prevent practice.
    }
    return history;
  }

  toJSON() {
    return {
      version: 1,
      lesson: this.#lesson,
      patterns: [...this.#patterns.values()],
    };
  }

  record(steps: readonly Step[], targetTime: number, now = Date.now()) {
    this.#lesson++;
    const observations = new Map<string, { times: number[]; errors: number }>();
    let run: Step[] = [];
    for (const step of steps) {
      const char = String.fromCodePoint(step.codePoint);
      if (
        !/^\p{Ll}$/u.test(char) ||
        !Number.isFinite(step.timeToType) ||
        step.timeToType <= 0 ||
        step.timeToType > 2000
      ) {
        run = [];
        continue;
      }
      run = [...run.slice(-2), step];
      for (let size = 1; size <= run.length; size++) {
        const sequence = run.slice(-size);
        const text = sequence
          .map((s) => String.fromCodePoint(s.codePoint))
          .join("");
        const observation = observations.get(text) ?? { times: [], errors: 0 };
        // For combinations, measure transitions, not the pause before the word.
        const timed = size === 1 ? sequence : sequence.slice(1);
        observation.times.push(
          timed.reduce((sum, s) => sum + s.timeToType, 0) / timed.length,
        );
        observation.errors += Number(sequence.some((s) => s.typo));
        observations.set(text, observation);
      }
    }
    for (const [text, observation] of observations) {
      const previous = this.#patterns.get(text);
      const time =
        observation.times.reduce((a, b) => a + b, 0) / observation.times.length;
      const failed = observation.errors > 0 || time > targetTime;
      const streak = failed ? 0 : Math.min((previous?.streak ?? 0) + 1, 6);
      const interval = failed ? 1 : 2 ** streak;
      this.#patterns.delete(text);
      this.#patterns.set(text, {
        text,
        samples: Math.min(
          (previous?.samples ?? 0) + observation.times.length,
          1000,
        ),
        time: previous ? previous.time * 0.5 + time * 0.5 : time,
        errors: observation.errors,
        streak,
        due: this.#lesson + interval,
        dueAt: now + (failed ? day / 24 : interval * day),
      });
    }
    while (this.#patterns.size > 1000) {
      this.#patterns.delete(this.#patterns.keys().next().value!);
    }
  }

  targets(
    allowed: ReadonlySet<number>,
    targetTime: number,
    now = Date.now(),
  ): string[] {
    const eligible = [...this.#patterns.values()].filter(
      (p) =>
        p.samples >= 3 &&
        [...p.text].every((c) => allowed.has(c.codePointAt(0)!)) &&
        (p.due <= this.#lesson + 1 || p.dueAt <= now),
    );
    const priority = (p: Pattern) =>
      p.errors * 4 +
      Math.max(0, p.time / targetTime - 1) +
      Math.min(3, Math.max(0, this.#lesson + 1 - p.due) / 4) +
      Math.min(3, Math.max(0, now - p.dueAt) / day);
    return eligible
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, 6)
      .map((p) => p.text);
  }
}

/** Keep three out of four words on the existing focused-key path. */
export function adaptiveWords(
  normal: WordGenerator,
  review: WordGenerator,
  targets: readonly string[],
): WordGenerator {
  let index = 0;
  let targetIndex = 0;
  return () => {
    if (targets.length === 0 || ++index % 4 !== 0) {
      return normal();
    }
    const target = targets[targetIndex++ % targets.length];
    for (let attempt = 0; attempt < 32; attempt++) {
      const word = review();
      if (word?.includes(target)) {
        return word;
      }
    }
    return normal();
  };
}
