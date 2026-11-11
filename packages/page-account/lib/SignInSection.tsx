import { Article, Button, Header, Para } from "@keybr/widget";
import { FormattedMessage } from "react-intl";
import { AccountName } from "./AccountName.tsx";
import { AccountPricePreview } from "./AccountPricePreview.tsx";
import { type SignInActions } from "./actions.ts";
import { EmailLoginForm } from "./EmailLoginForm.tsx";
import { OAuthLoginForm } from "./OAuthLoginForm.tsx";

export function SignInSection({
  actions,
  localProfile = false,
}: {
  actions: SignInActions;
  localProfile?: boolean;
}) {
  if (localProfile) {
    return (
      <Article>
        <Header level={1}>Local profile</Header>
        <Para>
          Save your typing progress, settings, and adaptive history on this
          computer. No Google account, email, password, or internet connection
          is needed.
        </Para>
        <Para>
          This is one shared profile for people using this computer. Your data
          stays on this local server and is separate from keybr.com.
        </Para>
        <form method="post" action="/auth/login/local">
          <Button label="Use local profile" />
        </form>
      </Article>
    );
  }
  return (
    <Article>
      <AccountName user={null} />

      <FormattedMessage
        id="account.signInPage.description"
        defaultMessage={
          "<p>Create an account to store your typing data on our servers in the cloud. This allows you to access your profile from any computer or browser. If you don’t have an account then your typing data is stored locally and is accessible only from your current computer.</p>" +
          "<p>We don’t store any passwords. Instead we use third-party services to authenticate our users. We offer several convenient ways to create an account and sign-in.</p>" +
          "<p>You can opt-out at any time. Deleting an account is as simple as creating one.</p>"
        }
      />

      <Header level={2}>
        <FormattedMessage
          id="t_Premium_account"
          defaultMessage="Premium account"
        />
      </Header>

      <FormattedMessage
        id="account.freeAccount.description"
        defaultMessage={
          "<p>Buy a <strong>premium account</strong> to unlock additional features and enjoy an ad-free experience. Here is the list of premium account benefits:</p>" +
          "<ul>" +
          "<li><strong>No ads.</strong> Ads may be distracting and impede your learning progress. This is a good way to get rid of them.</li>" +
          "<li><strong>No trackers.</strong> Trackers inevitably come with ads. Remove all trackers for complete online privacy.</li>" +
          "<li><strong>Ultra-fast responsiveness.</strong> Ads take quite some time to load. Getting rid of them means faster loading times for all pages.</li>" +
          "</ul>" +
          "<p>It is a single time payment that provides lifetime access. It is NOT a recurring subscription.</p>"
        }
      />

      <AccountPricePreview />

      <Header level={2}>
        <FormattedMessage
          id="t_Signin_with_social_"
          defaultMessage="Sign-in with social networks"
        />
      </Header>

      <OAuthLoginForm />

      <Header level={2}>
        <FormattedMessage
          id="t_Signin_with_email"
          defaultMessage="Sign-in with e-mail"
        />
      </Header>

      <EmailLoginForm actions={actions} />
    </Article>
  );
}
