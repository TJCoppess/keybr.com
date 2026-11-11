import { GuidedLesson } from "@keybr/lesson";
import { usePageData } from "@keybr/pages-shared";
import { type Result } from "@keybr/result";
import { useEffect, useMemo, useState } from "react";
import { Controller } from "./Controller.tsx";
import { AdaptiveAccount } from "./state/adaptive-account.ts";
import { type Progress } from "./state/progress.ts";

export function AccountController(props: {
  readonly progress: Progress;
  readonly onResult: (result: Result) => void;
}) {
  const { publicUser } = usePageData();
  if (
    publicUser.id == null ||
    !(props.progress.lesson instanceof GuidedLesson)
  ) {
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
  const account = useMemo(
    () => new AdaptiveAccount(progress.settings, userId),
    [progress.settings, userId],
  );
  const [ready, setReady] = useState<AdaptiveAccount | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    account
      .open()
      .then(() => {
        if (active) setReady(account);
      })
      .catch((err) => {
        if (active) setError(String(err.message));
      });
    return () => {
      active = false;
    };
  }, [account, attempt]);
  const flush = () =>
    account
      .flush()
      .then(() => setError(""))
      .catch((err) => setError(String(err.message)));
  return (
    <>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => {
              if (ready === account) void flush();
              else setAttempt(attempt + 1);
            }}
          >
            Retry backup
          </button>
        </div>
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
        <p>Loading adaptive history…</p>
      )}
    </>
  );
}
