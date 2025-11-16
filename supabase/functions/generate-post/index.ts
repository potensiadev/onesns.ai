import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for consistent JSON responses
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const allowedPlatforms = ["twitter", "instagram", "reddit", "threads", "pinterest"] as const;
const platformEnum = z.enum(allowedPlatforms);

const simpleGenerateSchema = z.object({
  type: z.literal("simple"),
  topic: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  tone: z.string().min(1).max(50),
  platforms: z.array(platformEnum).min(1).max(5),
});

const blogGenerateSchema = z.object({
  type: z.literal("blog"),
  blogContent: z.string().min(1).max(10000),
  keyMessage: z.string().max(500).optional(),
  platforms: z.array(platformEnum).min(1).max(5),
});

const generateRequestSchema = z.discriminatedUnion("type", [simpleGenerateSchema, blogGenerateSchema]);

const PLATFORM_PROMPTS = {
  twitter: `Create a Twitter/X post that:
- Delivers one clear insight or value point
- Uses punchy, direct language
- Maximum 280 characters
- Can include 1-2 relevant hashtags
- Optional: Add a subtle CTA or question
- Make every word count`,

  instagram: `Create an Instagram caption that:
- Starts with a hook to grab attention
- Tells a mini-story or shares valuable insight
- Maximum 1200 characters but be concise
- Include 5-10 relevant hashtags at the end
- Use line breaks for readability
- Engaging and visual language`,

  reddit: `Create a Reddit post that:
- Has an informative, specific title
- Provides genuine value to the community
- Conversational and authentic tone
- Maximum 20000 characters but be concise
- Avoid promotional language
- Encourage discussion with a question`,

  threads: `Create a Threads post that:
- Conversational and personal tone
- Maximum 500 characters
- Can be part of a thread (indicate if continues)
- Authentic and engaging
- Use emojis sparingly
- Encourage interaction`,

  pinterest: `Create a Pinterest pin description that:
- SEO-optimized with keywords
- Maximum 500 characters
- Action-oriented language
- Include relevant hashtags
- Clear value proposition
- Inspire saving and clicking`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Required authentication check
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized. Please log in to generate content." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error("Authentication failed:", {
        error: authError,
        hasUser: !!user,
        authHeader: authHeader ? "present" : "missing"
      });
      return jsonResponse({ error: "Unauthorized. Invalid or expired authentication token." }, 401);
    }

    const userId = user.id;
    console.log(`Generate post request from user: ${userId}`);

    // Validate input
    const requestBody = await req.json();
    const validationResult = generateRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return jsonResponse(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        400,
      );
    }

    const requestData = validationResult.data;
    const platforms = requestData.platforms;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Request type:", requestData.type, "Platforms:", platforms);

    const posts: Record<string, string> = {};

    // Helper function to call AI
    async function callAI(
      systemPrompt: string,
      userPrompt: string,
    ): Promise<{ content?: string; error?: string; status: number }> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);

        if (response.status === 429) {
          return { error: "Rate limit exceeded. Please try again in a moment.", status: 429 };
        }
        if (response.status === 402) {
          return { error: "AI credits depleted. Please add credits to continue.", status: 402 };
        }
        return {
          error: `AI model error: ${response.status} - ${errorText.substring(0, 200)}`,
          status: 502,
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse AI response JSON:", parseError);
        return {
          error: "AI model returned invalid response format",
          status: 502,
        };
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        console.error("AI response missing content:", data);
        return {
          error: "AI model did not generate any content. Please try again.",
          status: 502,
        };
      }

      return { content, status: 200 };
    }

    // Branch based on request type
    if (requestData.type === "simple") {
      // Original simple generation logic
      const { topic, content, tone } = requestData;

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

        const result = await callAI(systemPrompt, userPrompt);

        if (result.error) {
          return jsonResponse({ error: result.error }, result.status);
        }

        posts[platform] = result.content!;
      }
    } else {
      // Blog analysis and conversion logic
      const { blogContent, keyMessage } = requestData;

      console.log("Analyzing blog content (length: " + blogContent.length + " chars)");

      // Step 1: Analyze and summarize the blog
      const analysisSystemPrompt = `You are an expert content analyst and social media strategist.
Your task is to analyze blog content and extract key insights for social media distribution.`;

      const analysisUserPrompt = `Analyze the following blog post and extract:
1. Main topic/theme
2. 3-5 key takeaways or insights
3. Target audience
4. Emotional tone
5. Call-to-action (if any)

${keyMessage ? `The author wants to emphasize: ${keyMessage}\n\n` : ""}

Blog content:
${blogContent}

Provide a structured summary in JSON format:
{
  "mainTopic": "...",
  "keyTakeaways": ["...", "...", "..."],
  "targetAudience": "...",
  "tone": "...",
  "cta": "..."
}`;

      const analysisResult = await callAI(analysisSystemPrompt, analysisUserPrompt);

      if (analysisResult.error) {
        return jsonResponse({ error: analysisResult.error }, analysisResult.status);
      }

      console.log("Blog analysis complete:", analysisResult.content);

      let blogSummary;
      try {
        blogSummary = JSON.parse(analysisResult.content!);
      } catch (e) {
        // If JSON parsing fails, create a simple summary
        console.error("Failed to parse blog analysis, using fallback");
        blogSummary = {
          mainTopic: "Blog content",
          keyTakeaways: [blogContent.substring(0, 200)],
          targetAudience: "General audience",
          tone: "Professional",
          cta: "",
        };
      }

      // Step 2: Generate platform-specific posts based on the summary
      for (const platform of platforms) {
        const platformPrompt = PLATFORM_PROMPTS[platform as keyof typeof PLATFORM_PROMPTS];

        const systemPrompt = `You are an expert social media content creator specializing in ${platform}.
Your task is to transform blog content into viral-worthy, platform-native posts.
Follow the platform-specific guidelines exactly.`;

        const userPrompt = `${platformPrompt}

Based on this blog analysis:
- Main Topic: ${blogSummary.mainTopic}
- Key Takeaways: ${blogSummary.keyTakeaways.join(", ")}
- Target Audience: ${blogSummary.targetAudience}
- Tone: ${blogSummary.tone}
- CTA: ${blogSummary.cta}

${keyMessage ? `IMPORTANT: Make sure to emphasize this key message: ${keyMessage}\n` : ""}

Create a ${platform} post that captures the essence of the blog while being optimized for ${platform}'s unique format and audience.

Generate ONLY the post content. Do not include any meta-commentary, explanations, or labels.`;

        const result = await callAI(systemPrompt, userPrompt);

        if (result.error) {
          return jsonResponse({ error: result.error }, result.status);
        }

        posts[platform] = result.content!;
      }
    }

    console.log("Successfully generated posts for all platforms");

    return jsonResponse({ posts });
  } catch (error) {
    console.error("Error in generate-posts function:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
