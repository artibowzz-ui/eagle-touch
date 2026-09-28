"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

let booted = false;

export function EagleApp() {
  const [missingConfig, setMissingConfig] = useState(false);

  useEffect(() => {
    if (booted) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setMissingConfig(true);
      return;
    }
    booted = true;
    const sb = createClient(url, key, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    import("@/lib/eagle/eagle-app").then((m) => m.boot(sb));
  }, []);

  if (missingConfig) {
    return (
      <div className="setup">
        <div>
          <b>Configuration manquante</b>
          <p>
            Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d&apos;environnement,
            puis redéployez.
          </p>
        </div>
      </div>
    );
  }
  return <div id="app" />;
}
