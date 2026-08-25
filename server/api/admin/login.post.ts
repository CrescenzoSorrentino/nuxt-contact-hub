/**
 * POST /api/admin/login
 *
 * Effettua il login nell'area admin con un'unica password condivisa
 * (NUXT_ADMIN_PASSWORD). In caso di successo apre un cookie di sessione
 * sigillato via setUserSession; è quella sessione che requireUserSession
 * controlla sugli endpoint protetti (es. GET /api/leads).
 */
export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);
  const config = useRuntimeConfig(event);

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
