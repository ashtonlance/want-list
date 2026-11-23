import { isRecord } from "~/lib/json";
import { storage } from "~/lib/storage";
import { SUPABASE_URL, supabase } from "~/lib/supabase";

/** True in the installed home-screen app, where email links open in Safari instead. */
export const isStandalone = (): boolean =>
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/**
 * Digits in the emailed code. Supabase's OTP length is a project setting, 6 by default and at most 10,
 * so any length in that range is accepted.
 */
export const CODE_MIN = 6;
export const CODE_MAX = 10;

/** Only the digits of a typed or pasted code, at most CODE_MAX of them. */
export const codeDigits = (raw: string): string => raw.replace(/\D/g, "").slice(0, CODE_MAX);

/**
 * The first web address in pasted text, so "Sign in: https://…" still counts as the link. Brackets, quotes
 * and a closing full stop or comma around it are left out.
 */
export const findLink = (raw: string): string | null =>
  /https?:\/\/[^\s<>"'()[\]]+/i.exec(raw)?.[0].replace(/[.,;:!?]+$/, "") ?? null;

/** Whether typed or pasted text is a code: only digits, spaces and dashes, and enough digits. */
export const isWholeCode = (raw: string): boolean =>
  /^[\d\s-]+$/.test(raw.trim()) && codeDigits(raw).length >= CODE_MIN;

/** How long a sent code stays worth reopening on: Supabase's default code lifetime. */
const PENDING_TTL = 60 * 60 * 1000;
const PENDING_KEY = "wl-signin-pending";

/**
 * The email a code was last sent to, saved so the code screen comes back when the phone closes the app
 * while the person is in Mail. Null when none was sent in the last hour.
 */
export function readPendingSignIn(raw: string | null, now = Date.now()): string | null {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(v) || typeof v.email !== "string" || !v.email || typeof v.at !== "number") return null;
    const age = now - v.at;
    return age >= 0 && age < PENDING_TTL ? v.email : null;
  } catch {
    return null;
  }
}

export const pendingSignIn = {
  get: (): string | null => readPendingSignIn(storage.get(PENDING_KEY)),
  set: (email: string): void => storage.set(PENDING_KEY, JSON.stringify({ email, at: Date.now() })),
  clear: (): void => storage.remove(PENDING_KEY),
};

/** Emails a sign-in code, with a link as well. Resolves to an error message, or null. */
export async function sendSignInEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL },
  });
  if (error) return error.message;
  pendingSignIn.set(email);
  return null;
}

/** Signs in with the code from the sign-in email. Works the same in Safari and the home-screen app. */
export async function signInWithCode(email: string, code: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email, token: codeDigits(code), type: "email" });
  if (!error) return null;
  return /expired|invalid/i.test(error.message)
    ? "That code has expired or isn't right. Check it, or send a new one."
    : `Couldn't sign in: ${error.message}`;
}

const OTP_TYPES = { signup: "signup", invite: "invite" } as const;

/**
 * Signs in with the link from the sign-in email, pasted in: the fallback to the code. Resolves to an
 * error message, or null.
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
  // Tokens in the address only count from Supabase or this app's own address, never another site.
  const trusted = u.host === new URL(SUPABASE_URL).host || u.host === location.host;
  if (accessToken && refreshToken && trusted) {
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
