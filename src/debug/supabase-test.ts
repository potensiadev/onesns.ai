import { supabase } from "@/integrations/supabase/client";

export async function runSupabaseDiagnostics() {
  try {
    console.log("🚀 Running OneSNS Supabase Diagnostics...");

    console.log("Env:", {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKeyPresent: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    });

    const sessionRes = await supabase.auth.getSession();
    console.log("Session:", sessionRes);

    const userRes = await supabase.auth.getUser();
    console.log("User:", userRes);

    if (!userRes.data?.user) {
      console.warn("⚠️ Not logged in");
      return;
    }

    const user = userRes.data.user;

    // Fetch profile using id column
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Profile:", profile, profileErr);

    console.log("🎉 Diagnostics complete.");
  } catch (err) {
    console.error("❌ Diagnostics failed:", err);
  }
}
