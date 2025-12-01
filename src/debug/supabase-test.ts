import { supabase } from "@/lib/supabaseClient";

export async function runSupabaseDiagnostics() {
  console.log("🚀 Running OneSNS Supabase Diagnostics...");

  const versionTest = await supabase.rpc("version").catch(() => null);
  console.log("DB version:", versionTest);

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

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userRes.data.user.id)
    .single();

  console.log("Profile:", profile, profileErr);

  console.log("🎉 Diagnostics complete.");
}
