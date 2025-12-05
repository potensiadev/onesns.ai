// Public Supabase config - anon keys are safe to expose client-side
const PROJECT_SUPABASE_URL = "https://voalboudivbezmjlzicd.supabase.co";
const PROJECT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYWxib3VkaXZiZXptamx6aWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTg0NTksImV4cCI6MjA4MDA5NDQ1OX0.tB_kktKJ50umNOQApC5uWNVFaxa4a8f4iM4R64F37JY";

function getEnv(key: string): string | null {
  if (typeof import.meta === "undefined") return null;
  return (import.meta as any).env?.[key] ?? null;
}

export const SUPABASE_URL = getEnv("VITE_ONESNS_SUPABASE_URL") || PROJECT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = getEnv("VITE_ONESNS_SUPABASE_ANON_KEY") || PROJECT_SUPABASE_ANON_KEY;

export function createSupabaseBrowserConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}
