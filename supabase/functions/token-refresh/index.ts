import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { decryptSecret, encryptSecret } from "../_shared/encryption.ts";

type Provider = "facebook" | "instagram" | "threads";

const providerConfig: Record<Provider, () => {
    clientId: string;
    clientSecret: string;
}> = {
    facebook: () => ({
        clientId: getEnv("FACEBOOK_APP_ID"),
        clientSecret: getEnv("FACEBOOK_APP_SECRET"),
    }),
    instagram: () => ({
        clientId: getEnv("INSTAGRAM_APP_ID"),
        clientSecret: getEnv("INSTAGRAM_APP_SECRET"),
    }),
    threads: () => ({
        clientId: getEnv("THREADS_APP_ID"),
        clientSecret: getEnv("THREADS_APP_SECRET"),
    }),
};

function getEnv(key: string): string {
    const value = Deno.env.get(key);
    if (!value) throw new Error(`${key} is not set`);
    return value;
}

async function refreshFacebookLikeToken(provider: Provider, accessToken: string) {
    const { clientId, clientSecret } = providerConfig[provider]();
    const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("fb_exchange_token", accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

async function refreshInstagramLongLived(accessToken: string) {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

serve(async () => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const refreshWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tokens, error } = await supabase
        .from("users_social_tokens")
        .select("*")
        .lte("expires_at", refreshWindow)
        .eq("needs_reconnect", false);

    if (error) {
        console.error("Failed to load tokens", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = [] as unknown[];

    for (const token of tokens ?? []) {
        try {
            const provider = token.provider as Provider;
            const decrypted = await decryptSecret(token.long_lived_token || token.access_token);
            let refreshed;

            if (provider === "instagram") {
                refreshed = await refreshInstagramLongLived(decrypted);
            } else {
                refreshed = await refreshFacebookLikeToken(provider, decrypted);
            }

            const accessToken = refreshed.access_token as string;
            const expiresIn = (refreshed.expires_in as number | undefined) ?? 0;
            const expiresAt = expiresIn
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null;

            const encryptedAccess = await encryptSecret(accessToken);

            const { error: updateError, data } = await supabase
                .from("users_social_tokens")
                .update({
                    access_token: encryptedAccess,
                    long_lived_token: encryptedAccess,
                    expires_at: expiresAt,
                    long_lived_expires_at: expiresAt,
                    status: "connected",
                    needs_reconnect: false,
                    last_synced_at: new Date().toISOString(),
                    last_error: null,
                })
                .eq("id", token.id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            results.push({ id: token.id, status: "refreshed", expires_at: data?.expires_at });
        } catch (tokenError) {
            console.error(`Failed to refresh token ${token.id}`, tokenError);
            await supabase
                .from("users_social_tokens")
                .update({
                    status: "reconnect_required",
                    needs_reconnect: true,
                    last_error: tokenError instanceof Error ? tokenError.message : "Unknown error",
                })
                .eq("id", token.id);
            results.push({ id: token.id, status: "failed" });
        }
    }

    return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json" },
    });
});
