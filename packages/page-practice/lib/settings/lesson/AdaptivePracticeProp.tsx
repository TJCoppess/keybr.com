import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
} from "@keybr/widget";
import { FormattedMessage, useIntl } from "react-intl";

export function AdaptivePracticeProp() {
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
            checked={settings.get(lessonProps.guided.adaptivePractice)}
            onChange={(value) =>
              updateSettings(
                settings.set(lessonProps.guided.adaptivePractice, value),
              )
            }
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.adaptivePractice.description"
            defaultMessage="Practice difficult letter combinations, revisit learned patterns, and check mistakes again after a delay. Review uses only unlocked letters and up to one in four word selections. Learning history is saved separately for each layout. Sign in to your local account to back it up on this server and restore it in another browser."
          />
        </Description>
      </Explainer>
    </>
  );
}
