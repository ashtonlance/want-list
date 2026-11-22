import { SUPABASE_URL, supabase } from "~/lib/supabase";

/** True in the installed home-screen app, where email links open in Safari instead. */
export const isStandalone = (): boolean =>
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export async function sendSignInLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL },
  });
  return error ? error.message : null;
}

const OTP_TYPES = { signup: "signup", invite: "invite" } as const;

/**
 * Signs in with the link from the sign-in email, pasted in. Lets the home-screen app sign in, since
 * tapping the link opens Safari, which keeps its own storage. Resolves to an error message, or null.
 */
export async function signInWithPastedLink(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return "That doesn't look like the link from the email.";
  }
  const access = new URLSearchParams(u.hash.slice(1));
  const accessToken = access.get("access_token");
  const refreshToken = access.get("refresh_token");
  const token = u.searchParams.get("token") ?? u.searchParams.get("token_hash");
  const type = u.searchParams.get("type") ?? "magiclink";
  let message: string | null;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    message = error?.message ?? null;
  } else if (token && u.host === new URL(SUPABASE_URL).host) {
    const otpType = type in OTP_TYPES ? OTP_TYPES[type as keyof typeof OTP_TYPES] : "magiclink";
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: otpType });
    message = error?.message ?? null;
  } else {
    return "That isn't the link from the sign-in email.";
  }
  if (!message) return null;
  return /expired|invalid/i.test(message)
    ? "That link has expired or was already used. Send a new one."
    : `Couldn't sign in: ${message}`;
}
