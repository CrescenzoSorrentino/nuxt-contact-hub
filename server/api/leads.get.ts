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
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return data;
});
