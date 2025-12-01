// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { aiRouter } from "../_shared/aiRouter.ts";
import { jsonError, jsonOk } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { BrandVoice, promptBuilder, RequestShape } from "../_shared/promptBuilder.ts";
import { createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";
import { platformEnum, platformRules, type Platform } from "../_shared/platformRules.ts";
import { usageGuard } from "../_shared/usageGuard.ts";

const requestSchema = z
  .object({
    sourceType: z.enum(["url", "text"]),
    url: z.string().url().optional(),
    blogContent: z.string().min(1).optional(),
    platforms: z.array(platformEnum).min(1).max(5),
    tone: z.string().min(1).optional(),
    brandVoiceId: z.string().uuid().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.sourceType === "url" && !val.url) {
      ctx.addIssue({ code: "custom", message: "url is required when sourceType is 'url'" });
    }
    if (val.sourceType === "text" && !val.blogContent) {
      ctx.addIssue({ code: "custom", message: "blogContent is required when sourceType is 'text'" });
    }
  });

async function resolveBrandVoice(
  supabase: SupabaseClient,
  userId: string,
  brandVoiceId?: string | null,
): Promise<BrandVoice> {
  if (!brandVoiceId) return null;

  const { data, error } = await supabase
    .from("brand_voices")
    .select("extracted_style,label")
    .eq("id", brandVoiceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load brand voice: ${error.message}`);
  }

  return data ?? null;
}

function parsePosts(raw: string, requestedPlatforms: Platform[]) {
  try {
    const parsed = JSON.parse(raw);
    const result: Partial<Record<Platform, string>> = {};
    for (const platform of requestedPlatforms) {
      if (typeof parsed?.[platform] !== "string" || !parsed[platform].trim()) {
        throw new Error(`Missing content for ${platform}`);
      }
      result[platform] = parsed[platform].trim();
    }
    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse AI output as JSON: ${error instanceof Error ? error.message : String(error)} | Raw: ${raw}`,
    );
  }
}

function extractTextFromHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  const text = withoutScripts.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

async function handler(req: Request) {
  let supabase: SupabaseClient;
  try {
    supabase = createSupabaseClient(req);
  } catch (error) {
    console.error(error);
    return jsonError("INTERNAL_ERROR", "Server configuration error", 500);
  }

  try {
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      return jsonError("AUTH_REQUIRED", "Authentication required", 401);
    }

    let payload: z.infer<typeof requestSchema>;
    try {
      const body = await req.json();
      const result = requestSchema.safeParse(body);
      if (!result.success) {
        return jsonError("VALIDATION_ERROR", "Invalid request body", 400, result.error.format());
      }
      payload = result.data;
    } catch (error) {
      return jsonError(
        "VALIDATION_ERROR",
        "Malformed JSON body",
        400,
        error instanceof Error ? error.message : String(error),
      );
    }

    let sourceContent = payload.blogContent ?? "";
    if (payload.sourceType === "url") {
      try {
        const response = await fetch(payload.url!);
        if (!response.ok) {
          return jsonError("PROVIDER_ERROR", `Failed to fetch URL: ${response.status}`, 502);
        }
        const html = await response.text();
        sourceContent = extractTextFromHtml(html);
        if (!sourceContent) {
          return jsonError("PROVIDER_ERROR", "Fetched content was empty", 502);
        }
      } catch (error) {
        console.error("Fetch error", error);
        return jsonError(
          "PROVIDER_ERROR",
          "Failed to fetch or parse source URL",
          502,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    try {
      await usageGuard(supabase, user.id, "blog_to_sns", {
        platformCount: payload.platforms.length,
        blogLength: sourceContent.length,
        brandVoiceRequested: Boolean(payload.brandVoiceId),
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error("Usage guard error", error);
      return jsonError("INTERNAL_ERROR", "Failed to enforce usage limits", 500);
    }

    let brandVoice: BrandVoice = null;
    try {
      brandVoice = await resolveBrandVoice(supabase, user.id, payload.brandVoiceId ?? null);
    } catch (error) {
      console.error(error);
      return jsonError("INTERNAL_ERROR", "Failed to load brand voice", 500);
    }

    let summary = sourceContent;
    try {
      const summaryPrompt =
        "Summarize the following blog/article content into a concise, well-structured summary (max 220 words). Return plain text only.\n" +
        sourceContent;
      const summaryResult = await aiRouter(summaryPrompt);
      if (!summaryResult.content || !summaryResult.content.trim()) {
        return jsonError("PROVIDER_ERROR", "AI response missing summary content", 502);
      }
      summary = summaryResult.content.trim();
    } catch (error) {
      console.error("AI summary error", error);
      return jsonError(
        "PROVIDER_ERROR",
        "All AI providers failed during summarization",
        502,
        error instanceof Error ? error.message : String(error),
      );
    }

    const posts: Partial<Record<Platform, string>> = {};

    for (const platform of payload.platforms) {
      const rules = { [platform]: platformRules[platform] } as Record<Platform, string>;
      const requestShape: RequestShape = {
        type: "blog",
        blogContent: payload.tone ? `Tone hint: ${payload.tone}\n\n${summary}` : summary,
        platforms: [platform],
        brandVoiceId: payload.brandVoiceId ?? null,
      };

      const generationPrompt = promptBuilder({ request: requestShape, platformRules: rules, brandVoice });

      let aiResult;
      try {
        aiResult = await aiRouter(generationPrompt, "primary", platform);
      } catch (error) {
        console.error("AI provider error", error);
        return jsonError(
          "PROVIDER_ERROR",
          "All AI providers failed", 502, error instanceof Error ? error.message : String(error),
        );
      }

      try {
        const parsed = parsePosts(aiResult.content, [platform]);
        posts[platform] = parsed[platform];
      } catch (error) {
        console.error(error);
        return jsonError(
          "PROVIDER_ERROR",
          "AI response could not be parsed",
          502,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const insertPayload = {
      user_id: user.id,
      type: "blog_to_sns",
      input: {
        sourceType: payload.sourceType,
        url: payload.url ?? null,
        blogContent: sourceContent,
        platforms: payload.platforms,
      },
      output: posts,
    };

    const { data: generationInsert, error: generationError } = await supabase
      .from("generations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (generationError || !generationInsert) {
      console.error("Failed to save generation", generationError);
      return jsonError("INTERNAL_ERROR", "Failed to save generation", 500);
    }

    return jsonOk({ generation_id: generationInsert.id, posts });
  } catch (error) {
    console.error("Unhandled error", error);
    return jsonError(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const response = await handler(req);

    if (response instanceof Response) {
      const text = await response.text();
      return new Response(text, {
        status: response.status || 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (response as any)?.body ?? response;
    return new Response(JSON.stringify(body), {
      status: (response as any)?.status ?? 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Edge Error]", err);
    return new Response(
      JSON.stringify({ error: String((err as any)?.message ?? err) }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
