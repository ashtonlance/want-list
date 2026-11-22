import { useState, type SubmitEvent } from "react";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useToast } from "~/ui/Toast";
import { useAuth } from "./AuthProvider";
import { isStandalone, sendSignInLink, signInWithPastedLink } from "./signIn";

function PasteLinkForm({ standalone }: { standalone: boolean }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    const error = await signInWithPastedLink(link);
    setBusy(false);
    if (error) toast(error);
  };
  return (
    <form style={{ marginTop: 14 }} onSubmit={(e) => void submit(e)}>
      <p className="hint">
        {standalone
          ? "Using the home-screen app: copy the link from the email instead of tapping it, then paste it here."
          : "Paste the link from the sign-in email to sign in here."}
      </p>
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Paste the sign-in link"
        aria-label="Sign-in link from the email"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={!standalone}
      />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in with link"}
      </button>
    </form>
  );
}

function SignInForm() {
  const standalone = isStandalone();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | { sent: string } | { error: string }>("idle");
  const [showPaste, setShowPaste] = useState(standalone);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const to = email.trim();
    setState("sending");
    const error = await sendSignInLink(to);
    setState(error ? { error } : { sent: to });
    setShowPaste(true);
  };

  return (
    <>
      {typeof state === "object" ? (
        <div className="msg">
          {"error" in state
            ? `Couldn't send the link: ${state.error}`
            : `Check ${state.sent} for a sign-in link.` +
              (standalone
                ? " Since you're in the home-screen app, don't tap the link: press and hold it, tap Copy Link, then paste it below."
                : " Open it on this device.")}
        </div>
      ) : (
        <form autoComplete="on" onSubmit={(e) => void submit(e)}>
          <p className="hint">Anyone can view the list. Editors sign in with an email link, no password.</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            aria-label="Email to sign in"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="send"
          />
          <button className="btn primary" type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {showPaste ? (
        <PasteLinkForm standalone={standalone} />
      ) : (
        <button
          className="linkbtn"
          type="button"
          style={{ marginTop: 10 }}
          onClick={() => setShowPaste(true)}
        >
          Got a link already? Paste it
        </button>
      )}
    </>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { email, canWrite, signOut } = useAuth();
  return (
    <Sheet label="Account" onClose={onClose}>
      <SheetHead title={email ? "Account" : "Sign in to edit"} />
      <div className="acct">
        {email ? (
          <div className="acct">
            <div className="acct-who">
              <span className="avatar" aria-hidden="true">
                {email.charAt(0).toUpperCase()}
              </span>
              <div>
                <b>{email}</b>
                <span className="hint">
                  {canWrite ? "You can edit the list." : "This account can view the list but not change it."}
                </span>
              </div>
            </div>
            <button className="btn" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <SignInForm />
        )}
        <h4 className="sec-title">How prices work</h4>
        <footer className="about">
          <p>
            A price marked &quot;shipped&quot; is the best deal found with shipping included. Other prices are
            the TCGplayer market price (recent sales, before shipping) on the date shown, with the cheapest
            current listing beside it.
          </p>
          <p>
            &quot;Check price&quot; queues a card for Claude to find the cheapest seller including shipping.
            The DoubleHolo link opens the card&apos;s set on DoubleHolo, or the card itself once you save its
            DoubleHolo link. Card images and prices from TCGplayer.
          </p>
        </footer>
      </div>
    </Sheet>
  );
}
