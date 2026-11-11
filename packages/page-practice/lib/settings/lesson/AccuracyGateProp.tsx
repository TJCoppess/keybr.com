import { lessonProps } from "@keybr/lesson";
import { useSettings } from "@keybr/settings";
import {
  CheckBox,
  Description,
  Explainer,
  Field,
  FieldList,
} from "@keybr/widget";
import { type ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";

export function AccuracyGateProp(): ReactNode {
  const { formatMessage } = useIntl();
  const { settings, updateSettings } = useSettings();
  return (
    <>
      <FieldList>
        <Field>
          <CheckBox
            label={formatMessage({
              id: "settings.accuracyGate.label",
              defaultMessage: "Require accurate typing to unlock keys",
            })}
            checked={settings.get(lessonProps.guided.accuracyGate)}
            onChange={(value) => {
              updateSettings(
                settings.set(lessonProps.guided.accuracyGate, value),
              );
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Description>
          <FormattedMessage
            id="settings.accuracyGate.description"
            defaultMessage="A key which you type fast but with many mistakes is not learned yet. When this option is enabled, a next key is unlocked only when the previous keys are typed correctly at least nine times out of ten in the recent lessons, and the least accurate key gets the focus when all keys are fast enough."
          />
        </Description>
      </Explainer>
    </>
  );
}
