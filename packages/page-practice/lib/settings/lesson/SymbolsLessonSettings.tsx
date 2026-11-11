import { lessonProps, type SymbolsLesson } from "@keybr/lesson";
import { type BooleanProp, useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
  FieldSet,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { LessonLengthProp } from "./LessonLengthProp.tsx";
import { TargetSpeedProp } from "./TargetSpeedProp.tsx";

export function SymbolsLessonSettings({
  lesson,
}: {
  readonly lesson: SymbolsLesson;
}): ReactNode {
  const { formatMessage } = useIntl();
  return (
    <>
      <Explainer>
        <Description>
          <FormattedMessage
            id="lessonType.symbols.description"
            defaultMessage="Practice everything which is not a letter: punctuation, numbers and the symbols used in source code, typed in between common words. Like the guided lessons, this mode starts with a few keys, unlocks a next key when the previous keys are learned, and gives more practice to your weakest keys."
          />
        </Description>
      </Explainer>
      <FieldSet
        legend={formatMessage({
          id: "t_Lesson_options",
          defaultMessage: "Lesson options",
        })}
      >
        <FieldList>
          <Field>
            <FormattedMessage
              id="settings.symbols.kinds"
              defaultMessage="Practice:"
            />
          </Field>
          <Field>
            <Option
              prop={lessonProps.symbols.punctuation}
              label={formatMessage({
                id: "settings.symbols.punctuation",
                defaultMessage: "Punctuation",
              })}
            />
          </Field>
          <Field>
            <Option
              prop={lessonProps.symbols.digits}
              label={formatMessage({
                id: "settings.symbols.digits",
                defaultMessage: "Numbers",
              })}
            />
          </Field>
          <Field>
            <Option
              prop={lessonProps.symbols.symbols}
              label={formatMessage({
                id: "settings.symbols.symbols",
                defaultMessage: "Symbols",
              })}
            />
          </Field>
          <Field>
            <Option
              prop={lessonProps.symbols.capitals}
              label={formatMessage({
                id: "settings.symbols.capitals",
                defaultMessage: "Capital letters",
              })}
            />
          </Field>
        </FieldList>
        <FieldList>
          <Field>
            <Option
              prop={lessonProps.symbols.progressive}
              label={formatMessage({
                id: "settings.symbols.progressive.label",
                defaultMessage: "Unlock keys one by one",
              })}
            />
          </Field>
        </FieldList>
        <Explainer>
          <Description>
            <FormattedMessage
              id="settings.symbols.progressive.description"
              defaultMessage="Start with four keys and unlock a next key only when the previous keys are typed fast and accurately. Disable this option to practice all selected keys at once. These keys are harder to reach than letters, so a key is learned at six tenths of your target speed."
            />
          </Description>
        </Explainer>
        <TargetSpeedProp />
        <LessonLengthProp />
      </FieldSet>
    </>
  );
}

function Option({
  prop,
  label,
}: {
  readonly prop: BooleanProp;
  readonly label: string;
}): ReactNode {
  const { settings, updateSettings } = useSettings();
  return (
    <CheckBox
      label={label}
      checked={settings.get(prop)}
      onChange={(value) => {
        updateSettings(settings.set(prop, value));
      }}
    />
  );
}
