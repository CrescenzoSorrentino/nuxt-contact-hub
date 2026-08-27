import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * POST /api/admin/login
 *
 * Effettua il login nell'area admin con un'unica password condivisa
 * (NUXT_ADMIN_PASSWORD): rate limit -> controllo password -> apertura
 * sessione. In caso di successo apre un cookie di sessione sigillato via
 * setUserSession; è quella sessione che requireUserSession controlla sugli
 * endpoint protetti (es. GET /api/leads).
 */
export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);
  const config = useRuntimeConfig(event);

  // Rate limiting (fail-open): al massimo 5 tentativi di login all'ora per
  // IP, per rendere impraticabile indovinare NUXT_ADMIN_PASSWORD a forza
  // bruta. Controllato PRIMA della password, così un IP che ha già esaurito
  // i tentativi viene bloccato senza che il codice gli dica nemmeno se
  // l'ultima password provata era giusta o sbagliata.
  let limitExceeded = false;
  try {
    const redis = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
    });
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    limitExceeded = !success;
  } catch (e) {
    // Redis irraggiungibile -> fail open: non blocchiamo la richiesta.
    console.error("Rate limiting unavailable (failing open):", e);
  }

  if (limitExceeded) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests",
    });
  }

  // Rifiuta una password mancante o sbagliata. 401 = non autenticato.
  if (!password || password !== config.adminPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Emette il cookie di sessione. Il wrapper `user` è importante:
  // requireUserSession considera la richiesta loggata solo se session.user è impostato.
  await setUserSession(event, { user: { admin: true } });

  return { ok: true };
});
