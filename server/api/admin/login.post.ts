export default defineEventHandler(async (event) => {
  const { password } = await readBody(event);
  const config = useRuntimeConfig(event);

  if (!password || password !== config.adminPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  await setUserSession(event, { user: { admin: true } });

  return { ok: true };
});
