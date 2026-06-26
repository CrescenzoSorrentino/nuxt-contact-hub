import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js prepara una connessione "Realtime" (WebSocket) anche se noi usiamo
// solo il database. Node 20 non ha un WebSocket integrato, quindi gliene
// forniamo uno (dal pacchetto "ws") rendendolo disponibile globalmente.
// Su Node 22+ questo blocco non serve, perché WebSocket è già presente.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

let client: SupabaseClient | null = null;

export function serverSupabase(): SupabaseClient {
  if (client) return client;

  const config = useRuntimeConfig();
  const url = config.supabaseUrl;
  const key = config.supabaseServiceRoleKey;

  if (!url || !key) {
    throw new Error(
      "Supabase URL or service role key is not set in runtime config.",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}
