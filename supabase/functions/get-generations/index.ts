import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/errors.ts";
import { createSupabaseClient, getAuthenticatedUser } from "../_shared/supabaseClient.ts";

const typeEnum = z.enum(["simple", "variation", "blog"]);

const requestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  types: z.array(typeEnum).min(1).optional().nullable(),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    let query = supabase
      .from("generations")
      .select("id,source,content,outputs,platforms,topic,tone,variant_type,created_at", { count: "exact" })
      .eq("user_id", user.id);

    if (payload.types && payload.types.length > 0) {
      query = query.in("source", payload.types);
    }

    if (payload.from) {
      query = query.gte("created_at", payload.from);
    }

    if (payload.to) {
      query = query.lte("created_at", payload.to);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to fetch generations", error);
      return jsonError("INTERNAL_ERROR", "Failed to fetch generations", 500);
    }

    return jsonOk({
      items: data ?? [],
      total: count ?? 0,
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
});
