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

    /* Mise à jour automatique : une application installée peut rester ouverte en arrière-plan
       pendant des jours. À chaque retour au premier plan (et toutes les 30 minutes), on compare
       sa version à celle du site ; si elle a changé, la page se recharge. Rien n'est perdu :
       les saisies en cours sont déjà gardées sur le téléphone. */
    const mine = process.env.NEXT_PUBLIC_BUILD_ID || "";
    let checking = false;
    const checkUpdate = async (auto: boolean) => {
      if (!mine || checking || navigator.onLine === false) return;
      checking = true;
      try {
        const res = await fetch("/version?t=" + Date.now(), { cache: "no-store" });
        const live = res.ok ? (await res.text()).trim() : "";
        if (!live || live === mine) return;
        /* Une seule tentative par version, pour ne jamais recharger en boucle. */
        let tried = "";
        try { tried = sessionStorage.getItem("eagletouch.update") || ""; } catch {}
        if (tried === live) return;
        /* Pas de rechargement pendant que le joueur écrit dans un champ. */
        const el = document.activeElement;
        if (auto && el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        try { sessionStorage.setItem("eagletouch.update", live); } catch {}
        try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
        location.reload();
      } catch {
        /* pas de réseau : on réessaiera */
      } finally {
        checking = false;
      }
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(false); });
    window.addEventListener("online", () => checkUpdate(true));
    window.addEventListener("pageshow", (e) => { if (e.persisted) checkUpdate(false); });
    setInterval(() => checkUpdate(true), 30 * 60 * 1000);
    setTimeout(() => checkUpdate(true), 8000);
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
