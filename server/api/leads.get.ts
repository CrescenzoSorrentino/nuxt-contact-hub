export default defineEventHandler(async (event) => {
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
