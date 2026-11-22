import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { queryKeys } from "~/data/keys";
import { supabase } from "~/lib/supabase";

interface Auth {
  /** False until the saved session has been read. */
  ready: boolean;
  email: string | null;
  /** True once the signed-in account is confirmed as an editor of the list. */
  canWrite: boolean;
  /** Called when the database refuses a write: the app stops offering changes. */
  markReadOnly: () => void;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRefused(false);
      setReady(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user.email?.toLowerCase() ?? null;
  const editor = useQuery({
    queryKey: queryKeys.editor(email ?? ""),
    queryFn: () => isEditor(email ?? ""),
    enabled: email !== null,
    staleTime: Infinity,
  });

  const markReadOnly = useCallback(() => setRefused(true), []);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Auth>(
    () => ({ ready, email, canWrite: editor.data === true && !refused, markReadOnly, signOut }),
    [ready, email, editor.data, refused, markReadOnly, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) throw new Error("useAuth needs an AuthProvider");
  return auth;
}
