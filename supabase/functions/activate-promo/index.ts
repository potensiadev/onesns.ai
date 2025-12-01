import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/errors.ts";
import { MVP_LIMITS } from "../_shared/limitsConfig.ts";
import { createServiceSupabaseClient, createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";

const requestSchema = z.object({
  code: z.string().min(1).max(50),
});

/*
CREATE TABLE IF NOT EXISTS promo_codes (
  code text PRIMARY KEY,
  plan text NOT NULL,
  expires_at timestamptz,
  max_uses integer,
  used_count integer DEFAULT 0 NOT NULL,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL REFERENCES promo_codes(code),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
*/

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let authSupabase: SupabaseClient;
  let serviceSupabase: SupabaseClient;
  try {
    authSupabase = createSupabaseClient(req);
    serviceSupabase = createServiceSupabaseClient();
  } catch (error) {
    console.error("Failed to create Supabase clients", error);
    return jsonError("INTERNAL_ERROR", "Server configuration error", 500);
  }

  try {
    const user = await getAuthenticatedUser(authSupabase);
    if (!user) {
      return jsonError("AUTH_REQUIRED", "Authentication required", 401);
    }

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

    const { data: promo, error: promoError } = await serviceSupabase
      .from("promo_codes")
      .select("code, plan, expires_at, max_uses, used_count")
      .eq("code", payload.code)
      .maybeSingle();

    if (promoError) {
      console.error("Failed to fetch promo code", promoError);
      return jsonError("INTERNAL_ERROR", "Failed to validate promo code", 500);
    }

    if (!promo) {
      return jsonError("VALIDATION_ERROR", "Invalid promo code", 400);
    }

    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return jsonError("VALIDATION_ERROR", "Promo code expired", 400);
    }

    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      return jsonError("VALIDATION_ERROR", "Promo code already fully used", 400);
    }

    const { error: updateProfileError } = await serviceSupabase
      .from("profiles")
      .update({ plan: "pro", limits: MVP_LIMITS.pro })
      .eq("user_id", user.id);

    if (updateProfileError) {
      console.error("Failed to update profile", updateProfileError);
      return jsonError("INTERNAL_ERROR", "Failed to apply promo", 500);
    }

    const { error: incrementError } = await serviceSupabase
      .from("promo_codes")
      .update({ used_count: (promo.used_count ?? 0) + 1 })
      .eq("code", payload.code);

    if (incrementError) {
      console.error("Failed to increment promo usage", incrementError);
      return jsonError("INTERNAL_ERROR", "Failed to record promo usage", 500);
    }

    const { error: redemptionError } = await serviceSupabase
      .from("promo_code_redemptions")
      .insert({ user_id: user.id, code: payload.code });

    if (redemptionError) {
      console.error("Failed to log promo redemption", redemptionError);
      return jsonError("INTERNAL_ERROR", "Failed to record promo redemption", 500);
    }

    return jsonOk({ plan: "pro", activated: true, promo: payload.code });
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
