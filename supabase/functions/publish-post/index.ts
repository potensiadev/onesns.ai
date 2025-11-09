import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublishRequest {
  platform: string;
  content: string;
  accountId: string;
}

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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { platform, content, accountId }: PublishRequest = await req.json();

    console.log(`Publishing to ${platform} for user ${user.id}`);

    // Fetch the account with tokens
    const { data: account, error: accountError } = await supabase
      .from("social_accounts")
      .select("access_token, refresh_token, platform")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found or unauthorized");
    }

    let result;
    switch (platform) {
      case "twitter":
        result = await publishToTwitter(content, account.access_token);
        break;
      case "reddit":
        result = await publishToReddit(content, account.access_token);
        break;
      case "threads":
        result = await publishToThreads(content, account.access_token);
        break;
      case "instagram":
        result = await publishToInstagram(content, account.access_token);
        break;
      case "pinterest":
        result = await publishToPinterest(content, account.access_token);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Successfully published to ${platform}`);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error publishing post:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function publishToTwitter(content: string, accessToken: string) {
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twitter API error: ${error}`);
  }

  return await response.json();
}

async function publishToReddit(content: string, accessToken: string) {
  // Reddit requires subreddit - this is a simplified example
  // In production, you'd need to store subreddit preference
  throw new Error("Reddit posting requires additional configuration (subreddit selection)");
}

async function publishToThreads(content: string, accessToken: string) {
  // Threads API endpoint (Meta's Threads)
  const response = await fetch("https://graph.threads.net/v1.0/me/threads", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      media_type: "TEXT",
      text: content 
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Threads API error: ${error}`);
  }

  const data = await response.json();
  
  // Publish the thread
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ creation_id: data.id }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.text();
    throw new Error(`Threads publish error: ${error}`);
  }

  return await publishResponse.json();
}

async function publishToInstagram(content: string, accessToken: string) {
  throw new Error("Instagram posting requires image/video media - text-only posts are not supported");
}

async function publishToPinterest(content: string, accessToken: string) {
  // Pinterest requires image URL and board_id
  throw new Error("Pinterest posting requires additional configuration (image URL and board selection)");
}
