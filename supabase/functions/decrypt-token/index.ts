import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { decryptSecret } from "./_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-role-key",
};

const requestSchema = z.object({
  encrypted_value: z.string().min(10),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const providedServiceKey = req.headers.get("x-service-role-key");
    const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!expectedServiceKey || providedServiceKey !== expectedServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const decrypted = await decryptSecret(parsed.data.encrypted_value);

    return new Response(
      JSON.stringify({ success: true, value: decrypted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error decrypting token", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
