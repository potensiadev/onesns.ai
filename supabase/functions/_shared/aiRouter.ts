import { platformModelMap } from "./platformRules.ts";

export type AIRouterMode = "primary" | "analysis";
export type AIRouterResult = { content: string; provider: string };
type Provider = "openai" | "anthropic" | "google";

async function callProvider(provider: Provider, model: string, prompt: string): Promise<AIRouterResult> {
  if (provider === "openai") {
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API key not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return concise, well-structured answers." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("OpenAI response missing content");
    }
    return { content, provider: "openai" };
  }

  if (provider === "anthropic") {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("Anthropic API key not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: "Return concise, well-structured answers.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;
    if (!content || typeof content !== "string") {
      throw new Error("Anthropic response missing content");
    }
    return { content, provider: "anthropic" };
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("Gemini API key not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || typeof content !== "string") {
    throw new Error("Gemini response missing content");
  }
  return { content, provider: "gemini" };
}

function buildProviderAttempts(prompt: string, mode: AIRouterMode): Array<() => Promise<AIRouterResult>> {
  const providerAttempts: Array<() => Promise<AIRouterResult>> = [];

  if (Deno.env.get("OPENAI_API_KEY")) {
    providerAttempts.push(() => callProvider("openai", mode === "primary" ? "gpt-4.1" : "gpt-4o-mini", prompt));
  }

  if (Deno.env.get("ANTHROPIC_API_KEY")) {
    providerAttempts.push(() =>
      callProvider("anthropic", mode === "primary" ? "claude-3-5-sonnet-20240620" : "claude-3-haiku-20240307", prompt)
    );
  }

  if (Deno.env.get("GEMINI_API_KEY")) {
    providerAttempts.push(() => callProvider("google", mode === "primary" ? "gemini-pro" : "gemini-flash-lite", prompt));
  }

  return providerAttempts;
}

export async function aiRouter(
  prompt: string,
  mode: AIRouterMode = "primary",
  platform?: string,
): Promise<AIRouterResult> {
  const errors: string[] = [];
  const platformSpec = platform ? platformModelMap[platform] : undefined;

  if (platformSpec) {
    try {
      return await callProvider(platformSpec.provider, platformSpec.model, prompt);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const providerAttempts = buildProviderAttempts(prompt, mode);

  for (const attempt of providerAttempts) {
    try {
      return await attempt();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}
