import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encryptSecret } from "./_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  access_token: z.string().min(10).max(4000),
  refresh_token: z.string().min(10).max(4000).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { access_token, refresh_token } = parsed.data;
    const encryptedAccessToken = await encryptSecret(access_token);
    const encryptedRefreshToken = refresh_token ? await encryptSecret(refresh_token) : null;

    return new Response(
      JSON.stringify({
        success: true,
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error encrypting token", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
