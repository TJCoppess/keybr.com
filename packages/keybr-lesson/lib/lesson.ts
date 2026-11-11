import {
  type Keyboard,
  KeyboardOptions,
  type WeightedCodePointSet,
} from "@keybr/keyboard";
import { type Letter, PhoneticModel } from "@keybr/phonetic-model";
import { LCG, type RNGStream } from "@keybr/rand";
import { type KeyStatsMap, type Result, ResultGroups } from "@keybr/result";
import { type Settings } from "@keybr/settings";
import { type StyledText } from "@keybr/textinput";
import { type AdaptivePractice } from "./adaptive.ts";
import { type AdaptiveTarget } from "./adaptive-history.ts";
import { type LessonKeys } from "./key.ts";

export abstract class Lesson {
  static rng: RNGStream = LCG(Date.now());

  readonly settings: Settings;
  readonly keyboard: Keyboard;
  readonly codePoints: WeightedCodePointSet;
  readonly model: PhoneticModel;
  /**
   * The history of typed letter combinations to which this lesson adapts,
   * or `null` if this lesson does not adapt to it. Lessons which keep
   * a history start with an empty one, to be replaced with the stored one.
   */
  adaptivePractice: AdaptivePractice | null = null;
  /** What the most recently generated text was made to review. */
  reviewTargets: readonly AdaptiveTarget[] = [];

  protected constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
  ) {
    this.settings = settings;
    this.keyboard = keyboard;
    this.codePoints = keyboard.getCodePoints();
    this.model = PhoneticModel.restrict(model, this.codePoints);
  }

  filter(results: readonly Result[]): readonly Result[] {
    return ResultGroups.byLayoutFamily(results).get(
      KeyboardOptions.from(this.settings).layout.family,
    );
  }

  abstract get letters(): readonly Letter[];

  abstract update(keyStatsMap: KeyStatsMap): LessonKeys;

  abstract generate(lessonKeys: LessonKeys, rng: RNGStream): StyledText;
}
