/**
 * POST /api/admin/login
 *
 * Logs into the admin area with a single shared password
 * (NUXT_ADMIN_PASSWORD). On success it opens a sealed session cookie via
 * setUserSession; that session is what requireUserSession checks on the
 * protected endpoints (e.g. GET /api/leads).
 */
export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);
  const config = useRuntimeConfig(event);

  // Reject a missing or wrong password. 401 = not authenticated.
  if (!password || password !== config.adminPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Issue the session cookie. The `user` wrapper matters: requireUserSession
  // treats the request as logged in only when session.user is set.
  await setUserSession(event, { user: { admin: true } });

  return { ok: true };
});
