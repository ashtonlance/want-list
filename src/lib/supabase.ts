import { createClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Every list table stores one JSON document per row. */
interface DocTable {
  Row: { id: string; data: Json; updated_at: string };
  Insert: { id: string; data: Json; updated_at?: string };
  Update: { id?: string; data?: Json; updated_at?: string };
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      cards: DocTable;
      discover: DocTable;
      layouts: DocTable;
      editors: {
        Row: { email: string };
        Insert: { email: string };
        Update: { email?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const supabase = createClient<Database>(SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true },
});
