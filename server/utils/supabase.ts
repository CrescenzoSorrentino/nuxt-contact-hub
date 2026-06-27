/**
 * Server-only Supabase client, created with the SECRET service_role key.
 *
 * The service_role key bypasses Row Level Security, so this module must never
 * be imported into client code. It lives in `server/utils`, which Nitro
 * auto-imports across the server, so any endpoint can call `serverSupabase()`
 * without an explicit import.
 *
 * Credentials come from runtimeConfig (see nuxt.config.ts and .env.example).
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js eagerly sets up a Realtime (WebSocket) client even though we only
// use the database. Node 20 has no global WebSocket, so we provide one from the
// "ws" package. Node 22+ ships WebSocket natively and skips this block.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

// Single shared client (singleton): created on first use and reused afterwards,
// so we don't open a new connection on every request.
let client: SupabaseClient | null = null;

export function serverSupabase(): SupabaseClient {
  if (client) return client;

  const config = useRuntimeConfig();
  const url = config.supabaseUrl;
  const key = config.supabaseServiceRoleKey;

  // Fail fast with a clear message if the env vars are missing, instead of a
  // cryptic error later when the first query runs.
  if (!url || !key) {
    throw new Error(
      "Supabase URL or service role key is not set in runtime config.",
    );
  }

  // persistSession: false because there is no logged-in user to remember on the
  // server; every call authenticates with the service_role key.
  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}
