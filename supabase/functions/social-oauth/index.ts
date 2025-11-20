import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { encryptSecret } from "../_shared/encryption.ts";

type Provider = "facebook" | "instagram" | "threads";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const providerConfig: Record<Provider, () => {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string;
    tokenEndpoint: string;
}> = {
    facebook: () => ({
        clientId: getEnv("FACEBOOK_APP_ID"),
        clientSecret: getEnv("FACEBOOK_APP_SECRET"),
        redirectUri: getEnv("FACEBOOK_REDIRECT_URI"),
        scope: "public_profile pages_show_list pages_read_engagement instagram_basic instagram_manage_insights",
        tokenEndpoint: "https://graph.facebook.com/v21.0/oauth/access_token",
    }),
    instagram: () => ({
        clientId: getEnv("INSTAGRAM_APP_ID"),
        clientSecret: getEnv("INSTAGRAM_APP_SECRET"),
        redirectUri: getEnv("INSTAGRAM_REDIRECT_URI"),
        scope: "instagram_basic instagram_manage_insights pages_show_list",
        tokenEndpoint: "https://api.instagram.com/oauth/access_token",
    }),
    threads: () => ({
        clientId: getEnv("THREADS_APP_ID"),
        clientSecret: getEnv("THREADS_APP_SECRET"),
        redirectUri: getEnv("THREADS_REDIRECT_URI"),
        scope: "basic pages_show_list",
        tokenEndpoint: "https://graph.facebook.com/v21.0/oauth/access_token",
    }),
};

const startSchema = z.object({
    action: z.literal("start"),
    provider: z.enum(["facebook", "instagram", "threads"]),
    redirect_uri: z.string().url().optional(),
});

const exchangeSchema = z.object({
    action: z.literal("exchange"),
    provider: z.enum(["facebook", "instagram", "threads"]),
    code: z.string(),
    code_verifier: z.string(),
    state: z.string().optional(),
    redirect_uri: z.string().url().optional(),
});

function getEnv(key: string): string {
    const value = Deno.env.get(key);
    if (!value) {
        throw new Error(`${key} is not set`);
    }
    return value;
}

function generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function exchangeCodeForToken(
    provider: Provider,
    code: string,
    codeVerifier: string,
    redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string | null; expires_in?: number } & Record<string, unknown>> {
    const config = providerConfig[provider]();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
    });

    // Some providers require client_secret in body
    params.append("client_secret", config.clientSecret);
    params.append("grant_type", "authorization_code");

    const response = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenResponse = await response.json();
    return tokenResponse;
}

async function exchangeInstagramLongLivedToken(accessToken: string, clientSecret: string) {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Instagram long-lived exchange failed: ${errorText}`);
    }

    return response.json();
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const startParsed = startSchema.safeParse(body);
        const exchangeParsed = exchangeSchema.safeParse(body);

        if (startParsed.success) {
            const { provider, redirect_uri } = startParsed.data;
            const config = providerConfig[provider]();
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            const redirectUri = redirect_uri || config.redirectUri;
            const state = crypto.randomUUID();

            const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
            authUrl.searchParams.set("client_id", config.clientId);
            authUrl.searchParams.set("redirect_uri", redirectUri);
            authUrl.searchParams.set("response_type", "code");
            authUrl.searchParams.set("scope", config.scope);
            authUrl.searchParams.set("state", state);
            authUrl.searchParams.set("code_challenge", codeChallenge);
            authUrl.searchParams.set("code_challenge_method", "S256");

            return new Response(JSON.stringify({
                authorization_url: authUrl.toString(),
                code_verifier: codeVerifier,
                state,
                provider,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (exchangeParsed.success) {
            const { provider, code, code_verifier, redirect_uri } = exchangeParsed.data;
            const config = providerConfig[provider]();
            const redirectUri = redirect_uri || config.redirectUri;

            const tokenResponse = await exchangeCodeForToken(provider, code, code_verifier, redirectUri);
            const baseAccessToken = tokenResponse.access_token as string;
            const refreshToken = tokenResponse.refresh_token as string | undefined | null;
            let accessTokenToStore = baseAccessToken;
            let longLivedToken: string | undefined;
            let expiresInSeconds = (tokenResponse.expires_in as number | undefined) ?? 0;
            let longLivedExpiresIn: number | undefined;

            if (provider === "instagram") {
                const longLived = await exchangeInstagramLongLivedToken(baseAccessToken, config.clientSecret);
                accessTokenToStore = longLived.access_token;
                longLivedToken = longLived.access_token;
                longLivedExpiresIn = longLived.expires_in;
            }

            const expiresAt = expiresInSeconds
                ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
                : null;
            const longLivedExpiresAt = longLivedExpiresIn
                ? new Date(Date.now() + longLivedExpiresIn * 1000).toISOString()
                : null;

            const encryptedAccess = await encryptSecret(accessTokenToStore);
            const encryptedRefresh = refreshToken ? await encryptSecret(refreshToken) : null;
            const encryptedLongLived = longLivedToken ? await encryptSecret(longLivedToken) : null;

            const { data, error } = await supabase
                .from("users_social_tokens")
                .upsert({
                    provider,
                    user_id: user.id,
                    access_token: encryptedAccess,
                    refresh_token: encryptedRefresh,
                    long_lived_token: encryptedLongLived,
                    scopes: config.scope.split(" "),
                    expires_at: expiresAt,
                    long_lived_expires_at: longLivedExpiresAt,
                    status: "connected",
                    needs_reconnect: false,
                    last_synced_at: new Date().toISOString(),
                    last_error: null,
                }, { onConflict: "user_id,provider" })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new Response(JSON.stringify({
                success: true,
                record: data,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Invalid request" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("social-oauth error", error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
