import { serve } from "https://deno.land/std/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { jsonError, jsonOk } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";

const typeEnum = z.enum(["simple", "variation", "blog"]);

const requestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  types: z.array(typeEnum).min(1).optional().nullable(),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
});

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

    const limit = payload.limit ?? 20;
    const offset = payload.offset ?? 0;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("limits")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load profile", profileError);
      return jsonError("INTERNAL_ERROR", "Failed to load profile", 500);
    }

    const historyLimit = typeof profile?.limits?.history_limit === "number"
      ? profile.limits.history_limit
      : null;

    let countQuery = supabase
      .from("generations")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id);

    if (payload.types && payload.types.length > 0) {
      countQuery = countQuery.in("source", payload.types);
    }

    if (payload.from) {
      countQuery = countQuery.gte("created_at", payload.from);
    }

    if (payload.to) {
      countQuery = countQuery.lte("created_at", payload.to);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Failed to count generations", countError);
      return jsonError("INTERNAL_ERROR", "Failed to fetch generations", 500);
    }

    const totalRecords = count ?? 0;
    const effectiveTotal = historyLimit !== null ? Math.min(totalRecords, historyLimit) : totalRecords;

    if (historyLimit !== null && offset >= historyLimit) {
      return jsonOk({ items: [], total: effectiveTotal, history_limit: historyLimit });
    }

    const rangeStart = offset;
    const rangeEnd = historyLimit !== null ? Math.min(offset + limit - 1, historyLimit - 1) : offset + limit - 1;

    let dataQuery = supabase
      .from("generations")
      .select("id,source,content,outputs,platforms,topic,tone,variant_type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (payload.types && payload.types.length > 0) {
      dataQuery = dataQuery.in("source", payload.types);
    }

    if (payload.from) {
      dataQuery = dataQuery.gte("created_at", payload.from);
    }

    if (payload.to) {
      dataQuery = dataQuery.lte("created_at", payload.to);
    }

    const { data, error } = await dataQuery.range(rangeStart, rangeEnd);

    if (error) {
      console.error("Failed to fetch generations", error);
      return jsonError("INTERNAL_ERROR", "Failed to fetch generations", 500);
    }

    return jsonOk({
      items: data ?? [],
      total: effectiveTotal,
      history_limit: historyLimit,
    });
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