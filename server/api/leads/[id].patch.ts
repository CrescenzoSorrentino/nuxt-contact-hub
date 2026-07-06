export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  const { handled } = await readBody(event);
  const supabase = serverSupabase();

  const { error } = await supabase
    .from("leads")
    .update({ handled })
    .eq("id", id);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update lead status",
    });
  }

  return { ok: true };
});
