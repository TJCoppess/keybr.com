import { keyboardProps, type KeyId } from "@keybr/keyboard";
import {
  type DailyGoal,
  GuidedLesson,
  Lesson,
  type LessonKeys,
  lessonProps,
} from "@keybr/lesson";
import {
  type KeyStatsMap,
  Result,
  type StreakList,
  type SummaryStats,
} from "@keybr/result";
import { type Settings } from "@keybr/settings";
import {
  type Feedback,
  type LineList,
  makeStats,
  type StyledText,
  type TextDisplaySettings,
  TextInput,
  type TextInputSettings,
  toTextDisplaySettings,
  toTextInputSettings,
} from "@keybr/textinput";
import { type IInputEvent } from "@keybr/textinput-events";
import { type CodePoint } from "@keybr/unicode";
import {
  loadAdaptivePractice,
  saveAdaptivePractice,
} from "./adaptive-storage.ts";
import { type LastLesson } from "./last-lesson.ts";
import { type Progress } from "./progress.ts";

export class LessonState {
  readonly #onResult: (result: Result, textInput: TextInput) => void;
  readonly settings: Settings;
  readonly lesson: Lesson;
  readonly textInputSettings: TextInputSettings;
  readonly textDisplaySettings: TextDisplaySettings;
  readonly keyStatsMap: KeyStatsMap;
  readonly summaryStats: SummaryStats;
  readonly streakList: StreakList;
  readonly dailyGoal: DailyGoal;
  readonly lessonKeys: LessonKeys;

  lastLesson: LastLesson | null = null;

  textInput!: TextInput; // Mutable.
  lines!: LineList; // Mutable.
  suffix!: readonly CodePoint[]; // Mutable.
  depressedKeys: readonly KeyId[] = []; // Mutable.

  constructor(
    progress: Progress,
    onResult: (result: Result, textInput: TextInput) => void,
    readonly adaptiveStorage = {
      load: loadAdaptivePractice,
      save: saveAdaptivePractice,
    },
  ) {
    this.#onResult = onResult;
    this.settings = progress.settings;
    this.lesson = progress.lesson;
    this.textInputSettings = toTextInputSettings(this.settings);
    this.textDisplaySettings = toTextDisplaySettings(this.settings);
    this.keyStatsMap = progress.keyStatsMap.copy();
    this.summaryStats = progress.summaryStats.copy();
    this.streakList = progress.streakList.copy();
    this.dailyGoal = progress.dailyGoal.copy();
    this.lessonKeys = this.lesson.update(this.keyStatsMap);
    if (this.lesson instanceof GuidedLesson) {
      this.lesson.adaptivePractice = adaptiveStorage.load(this.settings);
    }
    this.#reset(this.lesson.generate(this.lessonKeys, Lesson.rng));
  }

  resetLesson() {
    this.#reset(this.textInput.text);
  }

  skipLesson() {
    this.#reset(this.lesson.generate(this.lessonKeys, Lesson.rng));
  }

  onInput(event: IInputEvent): Feedback {
    const feedback = this.textInput.onInput(event);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.remaining.map(({ codePoint }) => codePoint);
    if (this.textInput.completed) {
      const result = this.#makeResult();
      if (
        result.validate() &&
        this.lesson instanceof GuidedLesson &&
        this.settings.get(lessonProps.guided.adaptivePractice)
      ) {
        this.lesson.adaptivePractice.record(
          this.textInput.steps.map((step, index) => ({
            ...step,
            codePoint: this.textInput.at(index).codePoint,
          })),
          60000 / this.settings.get(lessonProps.targetSpeed),
        );
        this.adaptiveStorage.save(this.settings, this.lesson.adaptivePractice);
      }
      this.#onResult(result, this.textInput);
    }
    return feedback;
  }

  #reset(fragment: StyledText) {
    this.textInput = new TextInput(fragment, this.textInputSettings);
    this.lines = this.textInput.lines;
    this.suffix = this.textInput.remaining.map(({ codePoint }) => codePoint);
  }

  #makeResult(timeStamp = Date.now()) {
    return Result.fromStats(
      this.settings.get(keyboardProps.layout),
      this.settings.get(lessonProps.type).textType,
      timeStamp,
      makeStats(this.textInput.steps),
    );
  }
}
