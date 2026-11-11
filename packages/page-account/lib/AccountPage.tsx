import {
  type AnyUser,
  usePageData,
  type UserDetails,
} from "@keybr/pages-shared";
import { AccountSection } from "./AccountSection.tsx";
import { useAccountActions, useSignInActions } from "./actions.ts";
import { SignInSection } from "./SignInSection.tsx";

export function AccountPage() {
  const { user, publicUser, localProfile = false } = usePageData();
  if (user != null) {
    return (
      <AccountSectionWithActions
        user={user}
        publicUser={publicUser}
        localProfile={localProfile}
      />
    );
  } else {
    return <SignInSectionWithActions localProfile={localProfile} />;
  }
}

function AccountSectionWithActions(props: {
  user: UserDetails;
  publicUser: AnyUser;
  localProfile: boolean;
}) {
  const { user, publicUser, actions } = useAccountActions(props);
  return (
    <AccountSection
      user={user}
      publicUser={publicUser}
      actions={actions}
      localProfile={props.localProfile}
    />
  );
}

function SignInSectionWithActions({ localProfile }: { localProfile: boolean }) {
  const { actions } = useSignInActions();
  return <SignInSection actions={actions} localProfile={localProfile} />;
}
