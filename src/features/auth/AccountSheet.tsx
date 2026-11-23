import { useRef, useState } from "react";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useToast } from "~/ui/Toast";
import { useAuth } from "./AuthProvider";
import {
  CODE_MIN,
  codeDigits,
  findLink,
  isStandalone,
  isWholeCode,
  pendingSignIn,
  sendSignInEmail,
  signInWithCode,
  signInWithPastedLink,
} from "./signIn";

const onlyCodeChars = (v: string) => /^[\d\s-]*$/.test(v);

interface CodeFormProps {
  email: string;
  /** Emails a new code. Resolves to an error message, or null. */
  onResend: () => Promise<string | null>;
  onBack: () => void;
}

/**
 * The code from the email. A whole code pasted or filled in from Mail signs in straight away; a typed one
 * signs in on Sign in, since the code's length is a project setting. The email's link pasted here works too.
 * Sending a new code stays on this screen, so a refused resend never loses the code already sent.
 */
function CodeForm({ email, onResend, onBack }: CodeFormProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const tried = useRef("");
  const { toast } = useToast();
  const link = findLink(value);
  const ready = link !== null || isWholeCode(value);

  const attempt = async (v: string, force = false) => {
    const url = findLink(v);
    if (busy || (!url && !isWholeCode(v)) || (!force && tried.current === v)) return;
    tried.current = v;
    setBusy(true);
    setError("");
    const err = url ? await signInWithPastedLink(url) : await signInWithCode(email, v);
    setBusy(false);
    if (err) setError(err);
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setError("");
    const err = await onResend();
    setResending(false);
    if (err) {
      setError(`Couldn't send a new code: ${err}`);
      return;
    }
    setValue("");
    tried.current = "";
    toast(`Sent a new code to ${email}`);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void attempt(value, true);
        else setError("Enter the code from the email, or paste its link.");
      }}
    >
      <div className="msg">
        Enter the code sent to <b>{email}</b>.
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
          if (error) setError("");
          const url = findLink(raw);
          if (url) {
            setValue(url);
            // A link that arrives in one go is a paste: try it. One typed by hand waits for Sign in.
            if (!link) void attempt(url);
          } else if (onlyCodeChars(raw)) {
            const digits = codeDigits(raw);
            const prev = codeDigits(value);
            // A whole code arriving at once, new or over the old one, is a paste or Mail's suggestion:
            // sign in without a tap.
            const arrivedWhole =
              digits.length - prev.length > 1 || (digits.length >= prev.length && !digits.startsWith(prev));
            setValue(digits);
            if (arrivedWhole && isWholeCode(digits)) void attempt(digits);
          } else {
            setValue(raw);
          }
        }}
        inputMode={value && !onlyCodeChars(value) ? "url" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={"0".repeat(CODE_MIN)}
        aria-label="Sign-in code from the email"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "code-error" : undefined}
        enterKeyHint="done"
        autoFocus
      />
      {error ? (
        <p className="code-error" id="code-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn primary" type="submit" disabled={busy || !ready}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="code-links">
        <button className="linkbtn" type="button" onClick={() => void resend()} disabled={resending}>
          {resending ? "Sending…" : "Send a new code"}
        </button>
        <button className="linkbtn" type="button" onClick={onBack}>
          Use a different email
        </button>
      </div>
    </form>
  );
}

type SignInState = "idle" | "sending" | { code: string } | { error: string };

function SignInForm() {
  // A code sent in the last hour reopens on the code screen, even after the phone closed the app.
  const [email, setEmail] = useState(() => pendingSignIn.get() ?? "");
  const [state, setState] = useState<SignInState>(() => {
    const pending = pendingSignIn.get();
    return pending ? { code: pending } : "idle";
  });
  const emailInput = useRef<HTMLInputElement>(null);

  const send = async (to: string) => {
    setState("sending");
    const error = await sendSignInEmail(to);
    setState(error ? { error } : { code: to });
  };

  if (typeof state === "object" && "code" in state)
    return (
      <CodeForm
        key={state.code}
        email={state.code}
        onResend={() => sendSignInEmail(state.code)}
        onBack={() => {
          pendingSignIn.clear();
          setState("idle");
        }}
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
        ref={emailInput}
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
      <div className="code-links">
        <button
          className="linkbtn"
          type="button"
          onClick={() => {
            if (!emailInput.current?.reportValidity()) return;
            pendingSignIn.set(email.trim());
            setState({ code: email.trim() });
          }}
        >
          Already have a code or link?
        </button>
      </div>
    </form>
  );
}

function SignOutButton({ signOut }: { signOut: () => Promise<boolean> }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut().then((ok) => {
          setBusy(false);
          if (!ok)
            toast(
              navigator.onLine
                ? "Couldn't sign out. Try again."
                : "You're offline, so you're still signed in. Try again once you're back.",
            );
        });
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
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
            <SignOutButton signOut={signOut} />
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
