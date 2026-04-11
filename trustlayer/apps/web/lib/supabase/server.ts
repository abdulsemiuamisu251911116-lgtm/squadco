import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabaseEnv, supabaseAnonKey, supabaseUrl } from "./config";

export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // In Server Components, cookie mutation is not allowed.
          // Session refresh is handled by middleware and Server Actions.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // In Server Components, cookie mutation is not allowed.
          // Session refresh is handled by middleware and Server Actions.
        }
      }
    }
  });
}
