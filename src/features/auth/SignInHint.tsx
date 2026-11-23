import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "./AuthProvider";

/**
 * Tells someone who can't make changes why, in one place, worded for whether they're signed out or signed in
 * with an account that can only view. `line` is the short form for a spot where an action would have been.
 */
export function SignInHint({ line = false, action = "make changes" }: { line?: boolean; action?: string }) {
  const { ready, canWrite, email } = useAuth();
  const { open } = useOverlayNav();
  if (!ready || canWrite) return null;

  const button = (
    <button className="link-btn" type="button" onClick={() => open({ panel: "account" })}>
      {email ? "Account" : "Sign in"}
    </button>
  );
  if (line)
    return (
      <p className="hint signin-hint">
        {email ? `${email} can view this list but not change it.` : `Sign in to ${action}.`} {button}
      </p>
    );
  return (
    <div className="banner">
      {email
        ? `You're signed in as ${email}, which can view Ashton's list but not change it.`
        : `You're viewing Ashton's list. Sign in to ${action}.`}{" "}
      {button}
    </div>
  );
}
