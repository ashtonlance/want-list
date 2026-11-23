import { useOverlayNav } from "~/app/overlayNav";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { useAuth } from "./AuthProvider";

/**
 * Tells someone who can't make changes why, in one place, worded for whether they're signed out or signed in
 * with an account that can only view. `line` is the short form for a spot where an action would have been.
 */
export function SignInHint({ line = false, action = "make changes" }: { line?: boolean; action?: string }) {
  const { ready, canWrite, email } = useAuth();
  const { open } = useOverlayNav();
  if (!ready || canWrite) return null;

  const button = <SignInLink signedIn={!!email} onClick={() => open({ panel: "account" })} />;
  if (line)
    return (
      <p className="hint mt-1">
        {email ? `${email} can view this list but not change it.` : `Sign in to ${action}.`} {button}
      </p>
    );
  return (
    <Alert>
      {email
        ? `You're signed in as ${email}, which can view Ashton's list but not change it.`
        : `You're viewing Ashton's list. Sign in to ${action}.`}{" "}
      {button}
    </Alert>
  );
}

/** The inline "Sign in" (or "Account") link that opens the account sheet, set in running text. */
export function SignInLink({ signedIn, onClick }: { signedIn: boolean; onClick: () => void }) {
  return (
    <Button
      variant="link"
      className="-my-2.5 px-0.5 py-2.5 align-baseline text-[length:inherit] decoration-current"
      onClick={onClick}
    >
      {signedIn ? "Account" : "Sign in"}
    </Button>
  );
}
