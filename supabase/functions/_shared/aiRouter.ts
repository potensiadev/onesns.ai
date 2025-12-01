import { platformModelMap } from "./platformRules.ts";

export type Provider = "openai" | "anthropic";

const providerConfig: Record<Provider, { endpoint: string; model: string }> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
  },
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-sonnet-latest",
  },
};

export type GenerateParams = {
  systemPrompt: string;
  userPrompt: string;
  providerPreference?: Provider;
  model?: string;
  platform?: string;
};

export type GenerateResult = { text: string; provider: Provider };

function maskKey(key?: string | null): string {
  if (!key) return "missing";
  return `${key.slice(0, 4)}...`;
}

async function callOpenAI({
  systemPrompt,
  userPrompt,
  model,
  apiKey,
}: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  apiKey?: string;
}): Promise<GenerateResult> {
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured");
  }

  const response = await fetch(providerConfig.openai.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model ?? providerConfig.openai.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response missing content");
  }

  return { text: content, provider: "openai" };
}

async function callAnthropic({
  systemPrompt,
  userPrompt,
  model,
  apiKey,
}: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  apiKey?: string;
}): Promise<GenerateResult> {
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured");
  }

  const response = await fetch(providerConfig.anthropic.endpoint, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model ?? providerConfig.anthropic.model,
      max_tokens: 2048,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  if (!content || typeof content !== "string") {
    throw new Error("Anthropic response missing content");
  }

  return { text: content, provider: "anthropic" };
}

export const aiRouter = {
  async generate({ systemPrompt, userPrompt, providerPreference, model, platform }: GenerateParams): Promise<GenerateResult> {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!openaiApiKey && !anthropicApiKey) {
      throw new Error("No AI providers are configured. Please add OPENAI_API_KEY or ANTHROPIC_API_KEY.");
    }

    const platformSpec = platform ? platformModelMap[platform] : undefined;
    const preferredProvider = providerPreference ?? platformSpec?.provider;
    const orderedProviders: Provider[] = preferredProvider
      ? preferredProvider === "anthropic"
        ? ["anthropic", "openai"]
        : ["openai", "anthropic"]
      : ["openai", "anthropic"];

    const errors: string[] = [];

    for (const provider of orderedProviders) {
      try {
        if (provider === "openai") {
          return await callOpenAI({
            systemPrompt,
            userPrompt,
            model: model ?? platformSpec?.model,
            apiKey: openaiApiKey ?? undefined,
          });
        }

        return await callAnthropic({
          systemPrompt,
          userPrompt,
          model: model ?? platformSpec?.model,
          apiKey: anthropicApiKey ?? undefined,
        });
      } catch (error) {
        const safeKey = provider === "openai" ? maskKey(openaiApiKey) : maskKey(anthropicApiKey);
        console.error(`[aiRouter] ${provider} failed (key: ${safeKey})`, error);
        errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`All providers failed: ${errors.join(" | ")}`);
  },
};
