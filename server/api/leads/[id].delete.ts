export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  const supabase = serverSupabase();

  const { error } = await supabase.from("leads").delete().eq("id", id);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete lead",
    });
  }

  return { ok: true };
});
