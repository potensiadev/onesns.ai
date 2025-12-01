import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const allowedPlatforms = ["reddit", "threads", "instagram", "twitter", "pinterest", "facebook", "linkedin", "youtube"] as const;

export type Platform = typeof allowedPlatforms[number];

export const platformEnum = z.enum(allowedPlatforms);

export const platformModelMap: Record<string, { provider: "anthropic" | "openai"; model: string }> = {
  twitter: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  x: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  threads: { provider: "openai", model: "gpt-4.1-mini" },
  instagram: { provider: "openai", model: "gpt-4.1-mini" },
  linkedin: { provider: "openai", model: "gpt-4.1-mini" },
  tiktok: { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  youtube: { provider: "openai", model: "gpt-4.1-mini" },
  reddit: { provider: "openai", model: "gpt-4.1-mini" },
  pinterest: { provider: "openai", model: "gpt-4.1-mini" },
  facebook: { provider: "openai", model: "gpt-4.1-mini" },
};

export const platformRules: Record<Platform, string> = {
  twitter: "- Max 280 characters.\n- Punchy, direct.\n- 1-2 relevant hashtags.\n- Optional subtle CTA or question.",
  instagram:
    "- Hook in first line.\n- Conversational and visual.\n- 3-5 relevant hashtags at end.\n- Use line breaks for readability.",
  reddit:
    "- Story-driven, authentic, non-promotional.\n- Encourage discussion.\n- Respect subreddit norms.\n- Clear takeaway.",
  threads: "- Conversational, first-person.\n- Multi-line friendly.\n- Encourage replies.\n- Keep it light.",
  pinterest: "- Keyword-rich, action oriented.\n- Inspire saving/clicking.\n- 2-4 hashtags.\n- 500 characters max.",
  facebook: "- Engaging, community-focused.\n- 1-3 paragraphs.\n- Encourage comments/shares.\n- Use emojis sparingly.",
  linkedin: "- Professional tone, value-driven.\n- Share insights or expertise.\n- 1-3 paragraphs.\n- Industry-relevant hashtags.",
  youtube: "- Compelling description.\n- Front-load key info.\n- Call to action (like, subscribe).\n- Relevant keywords.",
};
