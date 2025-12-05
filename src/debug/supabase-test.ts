import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/config/supabase";

export async function runSupabaseDiagnostics() {
  console.group("🔎 OneSNS.ai Supabase Diagnostics");

  try {
    // ======================================================
    // 1) Supabase Configuration (hardcoded override)
    // ======================================================
    console.group("🌐 Supabase Configuration");
    console.log("SUPABASE_URL:", SUPABASE_URL);
    console.log("SUPABASE_ANON_KEY present:", !!SUPABASE_ANON_KEY);
    console.groupEnd();

    // ======================================================
    // 2) AUTH SESSION
    // ======================================================
    console.group("🔐 Auth Session");

    const sessionRes = await supabase.auth.getSession();
    console.log("session.getSession():", sessionRes);

    const userRes = await supabase.auth.getUser();
    console.log("auth.getUser():", userRes);

    if (!userRes.data?.user) {
      console.warn("⚠️ Not logged in – login required for RLS tests.");
      console.groupEnd();
      console.groupEnd();
      return;
    }
    const user = userRes.data.user;
    console.groupEnd();

    // ======================================================
    // 3) RLS Tests
    // ======================================================
    console.group("📄 Profiles Table (RLS Test)");

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, plan, limits")
      .eq("id", user.id)
      .maybeSingle();

    console.log("profiles.select:", { profile, profileErr });
    console.groupEnd();

    // ======================================================
    // 4) brand_voices
    // ======================================================
    console.group("🎤 Brand Voices");

    const { data: voices, error: voicesErr } = await supabase.from("brand_voices").select("*").eq("user_id", user.id);

    console.log("brand_voices:", { voices, voicesErr });
    console.groupEnd();

    // ======================================================
    // 5) usage_events
    // ======================================================
    console.group("📊 Usage Events");

    const { data: usage, error: usageErr } = await supabase
      .from("usage_events")
      .select("*")
      .eq("user_id", user.id)
      .limit(5);

    console.log("usage_events:", { usage, usageErr });
    console.groupEnd();

    // ======================================================
    // 6) **Edge Function CORS Test** — 핵심
    // ======================================================
    console.group("⚙️ Edge Function CORS Tests");

    async function testEdge(functionName: string, payload: any) {
      const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionRes.data.session?.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(`❌ ${functionName} returned HTTP ${res.status}`, text);
        } else {
          const json = await res.json();
          console.log(`✅ ${functionName}`, json);
        }
      } catch (err) {
        console.error(`❌ ${functionName} error:`, err);
      }
    }

    // Minimal safe payloads to test CORS only:
    await testEdge("generate-post", {
      type: "simple",
      topic: "Hello world",
      platforms: ["twitter"],
    });

    await testEdge("generate-variations", {
      base_text: "Hello world",
      count: 1,
    });

    await testEdge("blog-to-sns", {
      url: "",
      content: "This is a test post.",
      platforms: ["twitter"],
    });

    await testEdge("brand-voice-extract", {
      samples: ["This is a test writing sample."],
    });

    await testEdge("get-generations", {
      limit: 5,
      offset: 0,
    });

    console.groupEnd();

    console.info("🎉 Diagnostics complete.");
  } catch (err) {
    console.error("❌ Diagnostics failure:", err);
  }

  console.groupEnd();
}
