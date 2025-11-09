import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateRequestSchema = z.object({
  topic: z.string().min(1).max(200),
  content: z.string().min(1).max(3000),
  tone: z.string().min(1).max(50),
  platforms: z.array(z.enum(['reddit', 'threads', 'instagram', 'twitter', 'pinterest'])).min(1).max(5),
});

const PLATFORM_PROMPTS = {
  reddit: `Create a Reddit post that:
- Starts with an engaging hook based on real experience
- Uses community-friendly tone (authentic, conversational)
- Includes a clear body with specific details
- Ends with a question to encourage discussion
- Keep it concise but informative (200-400 words)
- Avoid salesy language`,

  threads: `Create a Threads post that:
- Is extremely concise (50-100 characters ideal)
- Uses casual, conversational tone
- Includes relatable insight or observation
- Can include 1-2 relevant emojis
- Ends with subtle engagement hook
- Think Twitter brevity meets Instagram personality`,

  instagram: `Create an Instagram caption that:
- Starts with an attention-grabbing first line
- Uses warm, inspirational or aesthetic tone
- Include 3-4 short paragraphs with line breaks
- Add relevant emojis naturally throughout
- End with 20-30 highly relevant hashtags
- Mix popular and niche hashtags
- Make it visually scannable`,

  twitter: `Create a Twitter/X post that:
- Delivers one clear insight or value point
- Uses punchy, direct language
- Maximum 280 characters
- Can include 1-2 relevant hashtags
- Optional: Add a subtle CTA or question
- Make every word count`,

  pinterest: `Create a Pinterest description that:
- Starts with a clear, keyword-rich title (60 chars)
- Includes detailed description (150-500 words)
- Uses SEO-friendly keywords naturally
- Focuses on value and actionability
- Adds 5-10 relevant keyword tags
- Inspires saving/sharing
- Be helpful and discoverable`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const requestBody = await req.json();
    const validationResult = generateRequestSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { topic, content, tone, platforms } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating posts for platforms:", platforms);

    const posts: Record<string, string> = {};

    // Generate content for each selected platform
    for (const platform of platforms) {
      const prompt = PLATFORM_PROMPTS[platform as keyof typeof PLATFORM_PROMPTS];
      
      const systemPrompt = `You are an expert social media content creator specializing in ${platform}. 
Your task is to create viral-worthy, platform-native content that resonates with the audience.
Tone: ${tone}
Follow the platform-specific guidelines exactly.`;

      const userPrompt = `${prompt}

Topic: ${topic}
Content: ${content}

Generate ONLY the post content. Do not include any meta-commentary, explanations, or labels.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for ${platform}:`, response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      posts[platform] = data.choices?.[0]?.message?.content || "";
    }

    console.log("Successfully generated posts for all platforms");

    return new Response(
      JSON.stringify({ posts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-posts function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
