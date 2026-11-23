import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { queryKeys } from "~/data/keys";
import { supabase } from "~/lib/supabase";
import { pendingSignIn } from "./signIn";

interface Auth {
  /** False until the saved session has been read and, if signed in, the account checked. */
  ready: boolean;
  email: string | null;
  /** True once the signed-in account is confirmed as an editor of the list. */
  canWrite: boolean;
  /** True only when it's known that changes aren't allowed: signed out, or an account confirmed as view-only. */
  cantEdit: boolean;
  /** Called when the database refuses a write: the app stops offering changes. */
  markReadOnly: () => void;
  /** Resolves false if signing out didn't go through (the session is kept, so nothing changes). */
  signOut: () => Promise<boolean>;
}

const AuthContext = createContext<Auth | null>(null);

async function isEditor(email: string): Promise<boolean> {
  const { data, error } = await supabase.from("editors").select("email").eq("email", email).maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [refused, setRefused] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Signed in, by code or link: the code screen has done its job.
      if (next) pendingSignIn.clear();
      // What the database lets you read can depend on who you are: fetch everything again.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void qc.invalidateQueries();
      setRefused(false);
      setReady(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [qc]);

  const email = session?.user.email?.toLowerCase() ?? null;
  const editor = useQuery({
    queryKey: queryKeys.editor(email ?? ""),
    queryFn: () => isEditor(email ?? ""),
    enabled: email !== null,
    staleTime: Infinity,
  });

  const markReadOnly = useCallback(() => setRefused(true), []);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return !error;
  }, []);

  const value = useMemo<Auth>(
    () => ({
      ready: ready && (email === null || !editor.isPending),
      email,
      canWrite: editor.data === true && !refused,
      cantEdit: ready && (email === null || editor.data === false || refused),
      markReadOnly,
      signOut,
    }),
    [ready, email, editor.isPending, editor.data, refused, markReadOnly, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) throw new Error("useAuth needs an AuthProvider");
  return auth;
}
