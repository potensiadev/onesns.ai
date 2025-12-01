import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonError } from "./errors.ts";
import { MVP_LIMITS, PMF_READY_LIMITS, type LimitsConfig, type PlanName } from "./limitsConfig.ts";

export type UsageEventType =
  | "generate_post"
  | "generate_variations"
  | "blog_to_sns"
  | "brand_voice_extract";

export type UsageContext = {
  platformCount?: number;
  blogLength?: number;
  variationsRequested?: number;
  brandVoiceRequested?: boolean;
};

export type UsageGuardResult = {
  plan: PlanName;
  limits: LimitsConfig;
  remaining: number | null;
};

const LIMIT_SET = MVP_LIMITS;
export const PMF_READY_LIMITS_CONFIG = PMF_READY_LIMITS;

function quotaExceeded(
  limit: keyof LimitsConfig | "blog_to_sns" | "brand_voice",
  allowed: number | boolean | null,
  used: number,
  message: string,
): Response {
  return jsonError("QUOTA_EXCEEDED", message, 429, {
    limit,
    allowed,
    used,
  });
}

async function ensureProfile(supabase: SupabaseClient, userId: string) {
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("plan, limits")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile for usage guard: ${error.message}`);
  }

  if (existing) return existing;

  const bootstrap = { id: userId, plan: "free", limits: LIMIT_SET.free };
  const { error: insertError } = await supabase.from("profiles").insert(bootstrap);

  if (insertError) {
    throw new Error(`Failed to bootstrap profile: ${insertError.message}`);
  }

  return { plan: "free", limits: LIMIT_SET.free };
}

async function countTodayUsage(supabase: SupabaseClient, userId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", startIso);

  if (error) {
    throw new Error(`Failed to count usage events: ${error.message}`);
  }

  return count ?? 0;
}

export async function usageGuard(
  supabase: SupabaseClient,
  userId: string,
  eventType: UsageEventType,
  context: UsageContext = {},
): Promise<UsageGuardResult> {
  const profile = await ensureProfile(supabase, userId);
  const plan = (profile.plan as PlanName) ?? "free";
  const planLimits = LIMIT_SET[plan as "free" | "pro"] ?? LIMIT_SET.free;
  const limits: LimitsConfig = {
    ...planLimits,
    ...(profile.limits as Partial<LimitsConfig> | null | undefined),
  };

  // Daily quota
  const usedToday = await countTodayUsage(supabase, userId);
  if (limits.daily_generations !== null && usedToday >= limits.daily_generations) {
    throw quotaExceeded(
      "daily_generations",
      limits.daily_generations,
      usedToday,
      "Daily generation limit reached",
    );
  }

  // Feature gating & per-request limits
  if (context.brandVoiceRequested && !limits.brand_voice) {
    throw quotaExceeded("brand_voice", limits.brand_voice, 1, "Brand voice is not available on this plan");
  }

  if (eventType === "blog_to_sns" && !limits.blog_to_sns) {
    throw quotaExceeded("blog_to_sns", limits.blog_to_sns, 1, "Blog-to-SNS is not available on this plan");
  }

  if (
    typeof limits.max_platforms_per_request === "number" &&
    limits.max_platforms_per_request !== null &&
    typeof context.platformCount === "number" &&
    context.platformCount > limits.max_platforms_per_request
  ) {
    throw quotaExceeded(
      "max_platforms_per_request",
      limits.max_platforms_per_request,
      context.platformCount,
      "Platform selection exceeds plan allowance",
    );
  }

  if (
    typeof limits.max_blog_length === "number" &&
    limits.max_blog_length !== null &&
    typeof context.blogLength === "number" &&
    (limits.max_blog_length === 0 || context.blogLength > limits.max_blog_length)
  ) {
    throw quotaExceeded(
      "max_blog_length",
      limits.max_blog_length,
      context.blogLength,
      "Blog content length exceeds plan allowance",
    );
  }

  if (
    typeof limits.variations_per_request === "number" &&
    limits.variations_per_request !== null &&
    typeof context.variationsRequested === "number" &&
    context.variationsRequested > limits.variations_per_request
  ) {
    throw quotaExceeded(
      "variations_per_request",
      limits.variations_per_request,
      context.variationsRequested,
      "Requested variations exceed plan allowance",
    );
  }

  const usedAfter = usedToday + 1;
  const remaining = limits.daily_generations !== null ? Math.max(limits.daily_generations - usedAfter, 0) : null;

  const { error: eventError } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    meta: { ...context, plan, limits_version: "mvp" },
  });

  if (eventError) {
    throw new Error(`Failed to record usage event: ${eventError.message}`);
  }

  return { plan, limits, remaining };
}
