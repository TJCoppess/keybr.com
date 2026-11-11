import { lessonProps } from "@keybr/lesson";
import { type BooleanProp, useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
} from "@keybr/widget";
import { FormattedMessage, useIntl } from "react-intl";

export function AdaptivePracticeProp({
  prop = lessonProps.guided.adaptivePractice,
}: {
  readonly prop?: BooleanProp;
}) {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "settings.adaptivePractice.label",
              defaultMessage: "Mix in adaptive review",
            })}
            checked={settings.get(prop)}
            onChange={(value) => updateSettings(settings.set(prop, value))}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.adaptivePractice.description"
            defaultMessage="Practice the letter combinations and words which you type slower than usual or with mistakes, and the letters which you type one for another. Learned patterns are checked again after a delay. Review uses only unlocked letters and up to one in four word selections. Learning history is saved separately for each layout. Sign in to your local account to back it up on this server and restore it in another browser."
          />
        </Description>
      </Explainer>
    </>
  );
}
