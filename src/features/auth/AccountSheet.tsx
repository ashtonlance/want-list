import { useRef, useState } from "react";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useToast } from "~/ui/Toast";
import { useAuth } from "./AuthProvider";
import {
  CODE_LENGTH,
  codeDigits,
  isStandalone,
  sendSignInEmail,
  signInWithCode,
  signInWithPastedLink,
} from "./signIn";

const looksLikeLink = (v: string) => /^\s*https?:\/\//i.test(v);

/**
 * The 6-digit code from the email, which signs in as soon as the last digit is in. The email's link
 * pasted here works too, as a fallback.
 */
function CodeForm({ email, onResend, onBack }: { email: string; onResend: () => void; onBack: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tried = useRef("");
  const link = looksLikeLink(value);

  const attempt = async (v: string, force = false) => {
    const isLink = looksLikeLink(v);
    if (busy || (!isLink && v.length !== CODE_LENGTH) || (!force && tried.current === v)) return;
    tried.current = v;
    setBusy(true);
    setError("");
    const err = isLink ? await signInWithPastedLink(v) : await signInWithCode(email, v);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void attempt(value, true);
      }}
    >
      <div className="msg">
        Enter the {CODE_LENGTH}-digit code sent to <b>{email}</b>.
        {isStandalone()
          ? " Or press and hold the email's link, tap Copy Link, and paste it here."
          : " Or open the email's link on this device."}
      </div>
      <input
        className={link ? undefined : "code-input"}
        type="text"
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const v = looksLikeLink(raw) ? raw.trim() : codeDigits(raw);
          setValue(v);
          if (error) setError("");
          if (looksLikeLink(v)) void attempt(v);
          else if (v.length === CODE_LENGTH) void attempt(v);
        }}
        inputMode={link ? "url" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={"0".repeat(CODE_LENGTH)}
        aria-label="Sign-in code from the email"
        aria-invalid={error ? true : undefined}
        enterKeyHint="done"
        autoFocus
      />
      {error ? (
        <p className="code-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="btn primary"
        type="submit"
        disabled={busy || (!link && value.length !== CODE_LENGTH)}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="code-links">
        <button className="linkbtn" type="button" onClick={onResend}>
          Send a new code
        </button>
        <button className="linkbtn" type="button" onClick={onBack}>
          Use a different email
        </button>
      </div>
    </form>
  );
}

type SignInState = "idle" | "sending" | { sent: string } | { error: string };

function SignInForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SignInState>("idle");
  const { toast } = useToast();

  const send = async (to: string) => {
    setState("sending");
    const error = await sendSignInEmail(to);
    setState(error ? { error } : { sent: to });
    return error;
  };

  if (typeof state === "object" && "sent" in state)
    return (
      <CodeForm
        key={state.sent}
        email={state.sent}
        onResend={() =>
          void send(state.sent).then((err) =>
            toast(err ? `Couldn't send it: ${err}` : `Sent a new code to ${state.sent}`),
          )
        }
        onBack={() => setState("idle")}
      />
    );

  return (
    <form
      autoComplete="on"
      onSubmit={(e) => {
        e.preventDefault();
        void send(email.trim());
      }}
    >
      <p className="hint">
        Anyone can view the list. Editors sign in with a code from their email, no password.
      </p>
      {typeof state === "object" ? (
        <div className="msg">Couldn&apos;t send the code: {state.error}</div>
      ) : null}
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
        {state === "sending" ? "Sending…" : "Email me a sign-in code"}
      </button>
    </form>
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
