const PROJECT_SUPABASE_URL = "https://voalboudivbezmjlzicd.supabase.co";

function getEnv(key: string): string | null {
  if (typeof import.meta === "undefined") return null;
  return (import.meta as any).env?.[key] ?? null;
}

function validateUrl(value: string | null): string {
  const url = (value ?? PROJECT_SUPABASE_URL).trim();
  if (!url) {
    throw new Error("Missing Supabase URL (expected VITE_ONESNS_SUPABASE_URL)");
  }

  if (url.includes("gsfsidffh")) {
    throw new Error("Lovable Supabase URL detected. Please supply your project URL.");
  }

  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid Supabase URL format: "${url}"`);
  }

  return url;
}

function validateAnonKey(value: string | null): string {
  const key = (value ?? "").trim();
  if (!key) {
    throw new Error("Missing Supabase anon key (expected VITE_ONESNS_SUPABASE_ANON_KEY)");
  }

  return key;
}

export const SUPABASE_URL = validateUrl(getEnv("VITE_ONESNS_SUPABASE_URL"));
export const SUPABASE_ANON_KEY = validateAnonKey(getEnv("VITE_ONESNS_SUPABASE_ANON_KEY"));

export function createSupabaseBrowserConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}
