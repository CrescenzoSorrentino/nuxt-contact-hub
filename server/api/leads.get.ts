/**
 * GET /api/leads
 *
 * Returns every stored lead, newest first, for the admin area.
 *
 * Protected: requireUserSession throws a 401 when the request has no valid
 * admin session, so the leads are never exposed without logging in first.
 */
export default defineEventHandler(async (event) => {
  // Gate the endpoint before touching the database.
  await requireUserSession(event);

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});
