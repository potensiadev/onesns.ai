import { useEffect } from "react";
import { runSupabaseDiagnostics } from "@/debug/supabase-test";

export default function Debug() {
  useEffect(() => {
    runSupabaseDiagnostics();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Supabase Diagnostics</h1>
      <p className="opacity-70">Check DevTools console for output.</p>
    </div>
  );
}
