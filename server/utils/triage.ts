import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const category = z.enum([
  "commercial",
  "support",
  "spam",
  "collaboration",
  "other",
]);
const priority = z.enum(["low", "medium", "high"]);

const triageSchema = z.object({
  category,
  priority,
});

export async function triageLead(message: string) {
  const client = serverAnthropic();
  if (!client) return null;

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: `You triage incoming contact-form messages for a business. Classify the message into exactly one category and one priority.

Categories:
- commercial: asking about pricing, products, services, or wants to buy something.
- support: has a problem, question, or complaint about something they already have.
- spam: unsolicited advertising, phishing, or irrelevant automated content.
- collaboration: partnership, sponsorship, guest post, or collaboration proposal.
- other: anything that doesn't clearly fit the categories above.

Priority:
- high: urgent, time-sensitive, or a high-value opportunity/problem.
- medium: normal business inquiry, no urgency signaled.
- low: no urgency, purely informational, or low value.

Respond only with the classification. Do not add any explanation or extra text.`,
    messages: [{ role: "user", content: message }],
    output_config: { format: zodOutputFormat(triageSchema) },
  });
  return response.parsed_output;
}
