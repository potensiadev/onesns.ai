import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createSupabaseClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const simpleGenerateSchema = z.object({
  type: z.literal("simple"),
  topic: z.string().min(1).max(200),
  content: z.string().min(1).max(3000),
  tone: z.string().min(1).max(50),
  platforms: z.array(z.enum(['reddit', 'threads', 'instagram', 'twitter', 'pinterest'])).min(1).max(5),
});

const blogGenerateSchema = z.object({
  type: z.literal("blog"),
  blogContent: z.string().min(1).max(10000),
  keyMessage: z.string().max(500).optional(),
  platforms: z.array(z.enum(['reddit', 'threads', 'instagram', 'twitter', 'pinterest'])).min(1).max(5),
});

const generateRequestSchema = z.discriminatedUnion("type", [
  simpleGenerateSchema,
  blogGenerateSchema,
]);

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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    let supabase;
    try {
      supabase = createSupabaseClient(req);
    } catch (error) {
      console.error("Supabase configuration error", error);
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: "Invalid or expired authentication token" },
        403
      );
    }

    // Validate input
    const requestBody = await req.json();
    const validationResult = generateRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return jsonResponse(
        {
          error: "Invalid request data",
          details: validationResult.error.flatten(),
        },
        400
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

    // Helper function to call OpenAI
    async function callOpenAI(systemPrompt: string, userPrompt: string) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // 저렴하고 빠른 모델 (gpt-4o, gpt-3.5-turbo도 가능)
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);

        if (response.status === 429) {
          return { error: "Rate limit exceeded. Please try again in a moment.", status: 429 };
        }
        if (response.status === 401) {
          return { error: "Invalid OpenAI API key.", status: 401 };
        }
        if (response.status === 402 || response.status === 403) {
          return { error: "OpenAI account has insufficient credits or quota exceeded.", status: 402 };
        }
        return {
          error: `OpenAI API responded with status ${response.status}`,
          status: 502
        };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse OpenAI response", parseError);
        return { error: "OpenAI returned an unreadable response", status: 502 };
      }

      const aiContent = data?.choices?.[0]?.message?.content;
      if (typeof aiContent !== "string" || aiContent.trim().length === 0) {
        console.error("Unexpected OpenAI payload", data);
        return {
          error: "OpenAI response missing content",
          status: 502
        };
      }

      return { content: aiContent, status: 200 };
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

        const result = await callOpenAI(systemPrompt, userPrompt);

        if (result.error) {
          return jsonResponse(
            { error: result.error },
            result.status
          );
        }

        posts[platform] = result.content || "";
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

${keyMessage ? `The author wants to emphasize: ${keyMessage}\n\n` : ''}

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

      const analysisResult = await callOpenAI(analysisSystemPrompt, analysisUserPrompt);

      if (analysisResult.error) {
        return jsonResponse(
          { error: analysisResult.error },
          analysisResult.status
        );
      }

      console.log("Blog analysis complete:", analysisResult.content);

      let blogSummary;
      try {
        // Extract JSON from markdown code blocks if present
        let jsonText = (analysisResult.content || "").trim();
        if (jsonText.includes('```json')) {
          jsonText = jsonText.split('```json')[1].split('```')[0].trim();
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.split('```')[1].split('```')[0].trim();
        }
        blogSummary = JSON.parse(jsonText);
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

${keyMessage ? `IMPORTANT: Make sure to emphasize this key message: ${keyMessage}\n` : ''}

Create a ${platform} post that captures the essence of the blog while being optimized for ${platform}'s unique format and audience.

Generate ONLY the post content. Do not include any meta-commentary, explanations, or labels.`;

        const result = await callOpenAI(systemPrompt, userPrompt);

        if (result.error) {
          return jsonResponse(
            { error: result.error },
            result.status
          );
        }

        posts[platform] = result.content || "";
      }
    }

    console.log("Successfully generated posts for all platforms");

    return jsonResponse({ posts });
  } catch (error) {
    console.error("Error in generate-post function:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
