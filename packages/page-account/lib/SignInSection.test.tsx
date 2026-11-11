import { test } from "node:test";
import { FakeIntlProvider } from "@keybr/intl";
import { render } from "@testing-library/react";
import { equal,isNotNull, isNull } from "rich-assert";
import { type SignInActions } from "./actions.ts";
import { SignInSection } from "./SignInSection.tsx";

test("local mode offers a local form instead of unconfigured external login", () => {
  const r = render(
    <FakeIntlProvider>
      <SignInSection localProfile={true} actions={{} as SignInActions} />
    </FakeIntlProvider>,
  );
  const button = r.getByRole("button", { name: "Use local profile" });
  equal(button.closest("form")?.getAttribute("action"), "/auth/login/local");
  equal(button.closest("form")?.getAttribute("method"), "post");
  isNull(r.queryByText("Google"));
  r.unmount();
});

test("render", () => {
  const r = render(
    <FakeIntlProvider>
      <SignInSection actions={{} as SignInActions} />
    </FakeIntlProvider>,
  );

  isNotNull(
    r.queryByText("Simple sign-in that does not use passwords.", {
      exact: false,
    }),
  );
  isNotNull(
    r.queryByText("Sign-in with your preferred social network.", {
      exact: false,
    }),
  );
  isNotNull(r.queryByText("Google", { exact: false }));
  isNotNull(r.queryByText("Microsoft", { exact: false }));
  isNotNull(r.queryByText("Facebook", { exact: false }));

  r.unmount();
});
