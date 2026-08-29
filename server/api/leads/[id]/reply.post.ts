import { Resend } from "resend";

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  const { message } = await readBody(event);

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("email, name")
    .eq("id", id)
    .single();

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message });

  const config = useRuntimeConfig(event);

  if (!config.resendApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Email not configured",
    });
  }

  const resend = new Resend(config.resendApiKey);
  const { error: sendError } = await resend.emails.send({
    from: config.contactFromEmail,
    to: data.email,
    subject: "Re: your message",
    html: escapeHtml(message),
  });

  if (sendError)
    throw createError({
      statusCode: 500,
      statusMessage: "Email sending failed",
    });
  return { ok: true };
});
