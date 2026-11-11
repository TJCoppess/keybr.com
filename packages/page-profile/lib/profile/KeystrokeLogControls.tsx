import { openKeystrokeLog } from "@keybr/lesson-ui";
import { Button, Explainer, Field, FieldList, Figure } from "@keybr/widget";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

/** Lets the user take away or delete the keys typed in the past lessons. */
export function KeystrokeLogControls(): ReactNode {
  const { formatMessage } = useIntl();
  const log = useMemo(openKeystrokeLog, []);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    log
      ?.count()
      .then((value) => {
        if (active) setCount(value);
      })
      .catch(() => {
        // The log is optional, the browser may refuse to open the database.
      });
    return () => {
      active = false;
    };
  }, [log]);

  if (log == null || count == null) {
    return null;
  }

  const handleDownload = async () => {
    const blob = new Blob([JSON.stringify(await log.read())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keybr-keystrokes.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    const confirmed = window.confirm(
      formatMessage({
        id: "profile.keystrokeLog.confirmClear",
        defaultMessage:
          "Delete the keystroke log from this browser? This cannot be undone.",
      }),
    );
    if (confirmed) {
      await log.clear();
      setCount(0);
    }
  };

  return (
    <>
      <FieldList>
        <Field>
          <FormattedMessage
            id="profile.keystrokeLog.count"
            defaultMessage="Keystroke log: {count, plural, one {# lesson} other {# lessons}} in this browser."
            values={{ count }}
          />
        </Field>
        <Field>
          <Button
            label={formatMessage({
              id: "profile.keystrokeLog.download",
              defaultMessage: "Download",
            })}
            disabled={count === 0}
            onClick={() => {
              handleDownload().catch(() => {});
            }}
          />
        </Field>
        <Field>
          <Button
            label={formatMessage({
              id: "profile.keystrokeLog.clear",
              defaultMessage: "Delete",
            })}
            disabled={count === 0}
            onClick={() => {
              handleClear().catch(() => {});
            }}
          />
        </Field>
      </FieldList>
      <Explainer>
        <Figure.Description>
          <FormattedMessage
            id="profile.keystrokeLog.description"
            defaultMessage="Every key typed in a completed lesson is kept in this browser, with its timing and whether it was a mistake, for up to two thousand lessons. Results keep only the averages, so this log is what lets new statistics be computed from your past practice. It includes the text of the lessons you typed, and it is never sent to the server."
          />
        </Figure.Description>
      </Explainer>
    </>
  );
}
