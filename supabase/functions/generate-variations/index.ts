// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { aiRouter } from "../_shared/aiRouter.ts";
import { jsonError, jsonOk } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { BrandVoice, variationPromptBuilder, VariationStyle } from "../_shared/promptBuilder.ts";
import { createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";
import { usageGuard } from "../_shared/usageGuard.ts";

const styleEnum = z.enum(["short", "long", "casual", "formal", "hook-first", "emotional"]);

const requestSchema = z.object({
  baseText: z.string().min(1).max(3000),
  styles: z.array(styleEnum).min(1),
  brandVoiceId: z.string().uuid().nullable().optional(),
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

    try {
      await usageGuard(supabase, user.id, "generate_variations", {
        variationsRequested: payload.styles.length,
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

    const variations: Partial<Record<VariationStyle, string>> = {};

    for (const style of payload.styles) {
      const prompt = variationPromptBuilder({ baseText: payload.baseText, style, brandVoice });
      let aiResult;
      try {
        aiResult = await aiRouter.generate({
          systemPrompt: "You are an expert social content editor. Return plain text only.",
          userPrompt: prompt,
        });
      } catch (error) {
        console.error("AI provider error", error);
        return jsonError(
          "PROVIDER_ERROR",
          "All AI providers failed",
          502,
          error instanceof Error ? error.message : String(error),
        );
      }

      const content = aiResult.text?.trim();
      if (!content) {
        console.error("Empty AI content for style", style);
        return jsonError("PROVIDER_ERROR", "AI response missing content", 502);
      }

      variations[style] = content;
    }

    const insertPayload = {
      user_id: user.id,
      type: "variation",
      input: { baseText: payload.baseText, styles: payload.styles },
      output: variations,
    };

    const { error: generationError } = await supabase.from("generations").insert(insertPayload);

    if (generationError) {
      console.error("Failed to save variations", generationError);
      return jsonError("INTERNAL_ERROR", "Failed to save variations", 500);
    }

    return jsonOk({ variations });
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
