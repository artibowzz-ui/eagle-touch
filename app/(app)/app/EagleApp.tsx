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
    /* Réseau faible sur le parcours : une requête qui traîne est abandonnée après 20 secondes,
       la saisie reste sur le téléphone et repart plus tard. */
    const timedFetch: typeof fetch = (input, init) => {
      if (init?.signal || typeof AbortSignal === "undefined" || !("timeout" in AbortSignal)) return fetch(input, init);
      return fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
    };
    const sb = createClient(url, key, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: timedFetch },
    });
    /* Service worker : l'application s'ouvre sans réseau et peut s'installer sur l'écran d'accueil. */
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          const tell = () => {
            const urls = performance
              .getEntriesByType("resource")
              .map((e) => e.name)
              .filter((n) => n.startsWith(location.origin + "/_next/static/"));
            reg.active?.postMessage({ type: "cache", urls });
          };
          tell();
          setTimeout(tell, 5000);
        })
        .catch(() => {});
    }
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
