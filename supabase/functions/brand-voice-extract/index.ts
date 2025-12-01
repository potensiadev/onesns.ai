// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { aiRouter } from "../_shared/aiRouter.ts";
import { jsonError, jsonOk } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { brandVoiceAnalysisPromptBuilder } from "../_shared/promptBuilder.ts";
import { createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";
import { usageGuard } from "../_shared/usageGuard.ts";

const requestSchema = z.object({
  samples: z.array(z.string().min(50).max(2000)).min(1).max(3),
  title: z.string().min(1).max(50).optional(),
});

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\n;]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function clampStrictness(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.min(1, Math.max(0, num));
}

function parseVoice(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const vocabulary = normalizeStringArray(parsed?.vocabulary);
    const formatTraits = normalizeStringArray(parsed?.format ?? parsed?.formatTraits);
    const voice: {
      tone: string;
      sentenceStyle: string;
      vocabulary: string[];
      strictness: number;
      formatTraits?: string[];
    } = {
      tone: typeof parsed?.tone === "string" ? parsed.tone.trim() : "",
      sentenceStyle: typeof parsed?.sentenceStyle === "string" ? parsed.sentenceStyle.trim() : "",
      vocabulary,
      strictness: clampStrictness(parsed?.strictness),
    };

    if (formatTraits.length) {
      voice.formatTraits = formatTraits;
    }

    return voice;
  } catch (error) {
    throw new Error(
      `Failed to parse AI output as JSON: ${error instanceof Error ? error.message : String(error)} | Raw: ${raw}`,
    );
  }
}

async function resolveBrandVoice(
  supabase: SupabaseClient,
  userId: string,
  voice: ReturnType<typeof parseVoice>,
  title?: string,
) {
  const insertPayload = {
    user_id: userId,
    title: title ?? null,
    voice_json: voice,
    extracted_style: voice,
  } as Record<string, any>;

  const { data, error } = await supabase.from("brand_voices").insert(insertPayload).select("id").single();

  if (error || !data) {
    throw new Error(`Failed to save brand voice: ${error?.message ?? "unknown"}`);
  }

  return data.id as string;
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
      await usageGuard(supabase, user.id, "brand_voice_extract");
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error("Usage guard error", error);
      return jsonError("INTERNAL_ERROR", "Failed to enforce usage limits", 500);
    }

    const prompt = brandVoiceAnalysisPromptBuilder({ samples: payload.samples });
    let aiResult;
    try {
      aiResult = await aiRouter.generate({
        systemPrompt: "You are an expert linguist and brand voice analyst. Return JSON only.",
        userPrompt: prompt,
        providerPreference: "anthropic",
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

    let voice;
    try {
      voice = parseVoice(aiResult.text);
    } catch (error) {
      console.error(error);
      return jsonError(
        "PROVIDER_ERROR",
        "AI response could not be parsed",
        502,
        error instanceof Error ? error.message : String(error),
      );
    }

    let brandVoiceId: string;
    try {
      brandVoiceId = await resolveBrandVoice(supabase, user.id, voice, payload.title);
    } catch (error) {
      console.error(error);
      return jsonError("INTERNAL_ERROR", "Failed to save brand voice", 500);
    }

    return jsonOk({ brandVoiceId, voice });
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
