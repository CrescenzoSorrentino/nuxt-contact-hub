/**
 * Client Supabase solo lato server, creato con la chiave SEGRETA service_role.
 *
 * La chiave service_role bypassa la Row Level Security, quindi questo modulo
 * non va MAI importato nel codice client. Vive in `server/utils`, che Nitro
 * auto-importa su tutto il server, quindi ogni endpoint può chiamare
 * `serverSupabase()` senza un import esplicito.
 *
 * Le credenziali arrivano da runtimeConfig (vedi nuxt.config.ts e .env.example).
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js configura sempre un client Realtime (WebSocket) anche se qui
// usiamo solo il database. Node 20 non ha un WebSocket globale, quindi ne
// forniamo uno dal pacchetto "ws". Node 22+ ha WebSocket nativo e salta questo blocco.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

// Client unico condiviso (singleton): creato al primo utilizzo e riusato dopo,
// così non apriamo una nuova connessione a ogni richiesta.
let client: SupabaseClient | null = null;

export function serverSupabase(): SupabaseClient {
  if (client) return client;

  const config = useRuntimeConfig();
  const url = config.supabaseUrl;
  const key = config.supabaseServiceRoleKey;

  // Fallisce subito con un messaggio chiaro se mancano le variabili d'ambiente,
  // invece di un errore criptico più tardi alla prima query.
  if (!url || !key) {
    throw new Error(
      "Supabase URL or service role key is not set in runtime config.",
    );
  }

  // persistSession: false perché sul server non c'è un utente loggato da
  // ricordare; ogni chiamata si autentica con la chiave service_role.
  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}
