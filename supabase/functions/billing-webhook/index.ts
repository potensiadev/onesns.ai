// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { jsonError } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { MVP_LIMITS } from "../_shared/limitsConfig.ts";
import { createServiceSupabaseClient } from "../_shared/supabaseClient.ts";

const requestSchema = z.object({
  event: z.enum([
    "subscription_created",
    "subscription_updated",
    "subscription_cancelled",
    "payment_failed",
  ]),
  userId: z.string().uuid(),
  plan: z.enum(["free", "pro"]),
  periodEnd: z.number().int().optional(),
  meta: z.any().optional(),
});

type RequestPayload = z.infer<typeof requestSchema>;

function toUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

async function verifySignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!signature || !secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    toUint8Array(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, toUint8Array(rawBody));
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const provided = signature.trim();
  if (expected.length !== provided.length) return false;

  let isMatch = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected.charCodeAt(i) !== provided.charCodeAt(i)) {
      isMatch = false;
    }
  }

  return isMatch;
}

async function handler(req: Request) {
  if (req.method !== "POST") {
    return jsonError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const signature = req.headers.get("x-webhook-signature");
  const secret = Deno.env.get("BILLING_WEBHOOK_SECRET");

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (error) {
    console.error("Failed to read raw body", error);
    return jsonError("INTERNAL_ERROR", "Unable to read request body", 500);
  }

  let isValidSignature = false;
  try {
    isValidSignature = await verifySignature(rawBody, signature, secret);
  } catch (error) {
    console.error("Signature verification error", error);
    return jsonError("INTERNAL_ERROR", "Signature verification failed", 500);
  }

  if (!isValidSignature) {
    return jsonError("WEBHOOK_INVALID_SIGNATURE", "Invalid webhook signature", 401);
  }

  let payload: RequestPayload;
  try {
    const parsed = JSON.parse(rawBody);
    const validated = requestSchema.safeParse(parsed);
    if (!validated.success) {
      return jsonError("VALIDATION_ERROR", "Invalid request body", 400, validated.error.format());
    }
    payload = validated.data;
  } catch (error) {
    return jsonError(
      "VALIDATION_ERROR",
      "Malformed JSON body",
      400,
      error instanceof Error ? error.message : String(error),
    );
  }

  let supabase;
  try {
    supabase = createServiceSupabaseClient();
  } catch (error) {
    console.error("Supabase client init error", error);
    return jsonError("INTERNAL_ERROR", "Server configuration error", 500);
  }

  const { userId, event, plan, periodEnd, meta } = payload;

  try {
    const { data: existingSubscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("plan, period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
    }

    let nextPlan = existingSubscription?.plan ?? plan;
    let status: string = "active";
    let nextLimits = MVP_LIMITS[nextPlan as "free" | "pro"] ?? MVP_LIMITS.free;

    switch (event) {
      case "subscription_created":
      case "subscription_updated": {
        nextPlan = plan;
        status = "active";
        nextLimits = MVP_LIMITS[nextPlan as "free" | "pro"] ?? MVP_LIMITS.free;
        break;
      }
      case "subscription_cancelled": {
        nextPlan = "free";
        status = "cancelled";
        nextLimits = MVP_LIMITS.free;
        break;
      }
      case "payment_failed": {
        status = "past_due";
        break;
      }
      default:
        status = "active";
    }

    const resolvedPeriodEnd = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : existingSubscription?.period_end ?? null;

    const subscriptionRecord = {
      user_id: userId,
      plan: nextPlan,
      status,
      period_end: resolvedPeriodEnd,
      raw_payload: meta ?? payload,
    };

    const { error: upsertSubError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionRecord, { onConflict: "user_id" });

    if (upsertSubError) {
      throw new Error(`Failed to upsert subscription: ${upsertSubError.message}`);
    }

    if (event === "subscription_created" || event === "subscription_updated" || event === "subscription_cancelled") {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ user_id: userId, plan: nextPlan, limits: nextLimits });

      if (profileError) {
        throw new Error(`Failed to update profile plan: ${profileError.message}`);
      }
    }

    const { error: logError } = await supabase.from("billing_events").insert({
      user_id: userId,
      event,
      plan: nextPlan,
      raw_payload: meta ?? payload,
    });

    if (logError) {
      throw new Error(`Failed to log billing event: ${logError.message}`);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Billing webhook error", error);
    if (error instanceof Response) {
      return error;
    }
    return jsonError(
      "INTERNAL_ERROR",
      "Failed to process billing webhook",
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
