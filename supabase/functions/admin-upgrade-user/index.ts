import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/errors.ts";
import { MVP_LIMITS } from "../_shared/limitsConfig.ts";
import { createServiceSupabaseClient } from "../_shared/supabaseClient.ts";

const requestSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["pro", "free"]),
});

function constantTimeEquals(a: string | null, b: string | null) {
  if (!a || !b) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceSupabaseClient();
  } catch (error) {
    console.error("Failed to create Supabase client", error);
    return jsonError("INTERNAL_ERROR", "Server configuration error", 500);
  }

  const adminSecret = Deno.env.get("ADMIN_UPGRADE_SECRET") ?? "";
  const headerSecret = req.headers.get("x-admin-secret");

  if (!constantTimeEquals(headerSecret, adminSecret)) {
    return jsonError("AUTH_REQUIRED", "Admin authentication required", 401);
  }

  try {
    let payload: z.infer<typeof requestSchema>;
    try {
      const body = await req.json();
      const parsed = requestSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.format());
      }
      payload = parsed.data;
    } catch (error) {
      return jsonError(
        "VALIDATION_ERROR",
        "Malformed JSON body",
        400,
        error instanceof Error ? error.message : String(error),
      );
    }

    const targetLimits = payload.plan === "pro" ? MVP_LIMITS.pro : MVP_LIMITS.free;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ plan: payload.plan, limits: targetLimits })
      .eq("user_id", payload.userId);

    if (updateError) {
      console.error("Failed to update user plan", updateError);
      return jsonError("INTERNAL_ERROR", "Failed to update user", 500);
    }

    return jsonOk({ userId: payload.userId, plan: payload.plan, updated: true });
  } catch (error) {
    console.error("Unhandled error", error);
    return jsonError(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
});
