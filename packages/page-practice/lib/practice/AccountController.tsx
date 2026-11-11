import { LoadingProgress, usePageData } from "@keybr/pages-shared";
import { type Result } from "@keybr/result";
import { Button, Para } from "@keybr/widget";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Controller } from "./Controller.tsx";
import {
  AdaptiveAccount,
  AdaptiveSyncError,
} from "./state/adaptive-account.ts";
import { type Progress } from "./state/progress.ts";

export function AccountController(props: {
  readonly progress: Progress;
  readonly onResult: (result: Result) => void;
}) {
  const { publicUser } = usePageData();
  if (publicUser.id == null || props.progress.lesson.adaptivePractice == null) {
    return <Controller {...props} />;
  }
  return <SignedInController {...props} userId={publicUser.id} />;
}

function SignedInController({
  progress,
  onResult,
  userId,
}: {
  readonly progress: Progress;
  readonly onResult: (result: Result) => void;
  readonly userId: string;
}) {
  const { formatMessage } = useIntl();
  const account = useMemo(
    () => new AdaptiveAccount(progress.settings, userId),
    [progress.settings, userId],
  );
  const [ready, setReady] = useState<AdaptiveAccount | null>(null);
  const [error, setError] = useState<"load" | "save" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    account
      .open()
      .then(() => {
        if (active) setReady(account);
      })
      .catch(() => {
        // Practice cannot start until the history is loaded and saved once,
        // so that a newer history on the server is never overwritten.
        if (active) setError("load");
      });
    return () => {
      active = false;
    };
  }, [account, attempt]);
  const flush = () =>
    account
      .flush()
      .then(() => setError(null))
      .catch((err) =>
        setError(err instanceof AdaptiveSyncError ? err.action : "save"),
      );
  return (
    <>
      {error != null && (
        <Para align="center">
          <span role="alert">
            {error === "load" ? (
              <FormattedMessage
                id="practice.adaptive.loadError"
                defaultMessage="Cannot load the adaptive review history from your account."
              />
            ) : (
              <FormattedMessage
                id="practice.adaptive.saveError"
                defaultMessage="Cannot save the adaptive review history to your account. Keep this page open and retry when the server is available."
              />
            )}
          </span>{" "}
          <Button
            label={formatMessage({
              id: "practice.adaptive.retry",
              defaultMessage: "Retry",
            })}
            onClick={() => {
              if (ready === account) void flush();
              else setAttempt(attempt + 1);
            }}
          />
        </Para>
      )}
      {ready === account ? (
        <Controller
          progress={progress}
          adaptiveStorage={account}
          onResult={(result) => {
            onResult(result);
            void flush();
          }}
        />
      ) : (
        error == null && <LoadingProgress />
      )}
    </>
  );
}
