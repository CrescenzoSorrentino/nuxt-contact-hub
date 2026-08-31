export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const { originalMessage, draft } = await readBody(event);

  const client = serverAnthropic();
  if (!client)
    throw createError({ statusCode: 500, statusMessage: "AI not configured" });

  const system = draft
    ? "You are helping an admin revise a draft reply to a customer message. Improve clarity and tone while preserving the draft's meaning. Respond only with the revised text, no explanation."
    : "You are helping an admin write a reply to a customer message. Write a short, professional, friendly reply. Respond only with the reply text, no explanation.";

  const messageWithDraft = `${originalMessage} ${draft}`;

  const userContent = draft ? messageWithDraft : originalMessage;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  return { draft: textBlock?.text ?? "Could not generate a reply." };
});
