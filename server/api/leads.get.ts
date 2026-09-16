/**
 * GET /api/leads
 *
 * Restituisce tutti i lead salvati, dal più recente, per l'area admin.
 *
 * Protetto: requireUserSession lancia un 401 se la richiesta non ha una
 * sessione admin valida, quindi i lead non sono mai esposti senza login.
 */
export default defineEventHandler(async (event) => {
  // Blocca l'endpoint prima di toccare il database.
  await requireUserSession(event);

  const supabase = serverSupabase();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: deleteError } = await supabase
    .from("leads")
    .delete()
    .lt("deleted_at", thirtyDaysAgo);

  if (deleteError) {
    console.error("Trash cleanup failed (continuing anyway):", deleteError);
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});
