import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function serverAnthropic() {
  if (client) return client;

  const config = useRuntimeConfig();
  const key = config.anthropicApiKey;

  if (!key) return null;

  client = new Anthropic({ apiKey: key });
  return client;
}
