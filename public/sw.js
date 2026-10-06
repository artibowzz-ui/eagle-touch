/* Eagle Touch : service worker.
   Garde sur le téléphone l'écran de l'application et ses fichiers, pour qu'elle s'ouvre sans réseau.
   Il ne touche jamais aux données : les échanges avec Supabase ne passent pas par lui. */
const CACHE = 'eagle-touch-v1';
const SHELL = '/app';
const isStatic = p => p.startsWith('/_next/static/') || p.startsWith('/icons/') || /^\/(icon\.svg|apple-icon\.png|favicon\.ico|manifest\.webmanifest)$/.test(p);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(SHELL, { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* La page indique les fichiers qu'elle a chargés avant que le service worker ne soit actif. */
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'cache' || !Array.isArray(d.urls)) return;
  const urls = d.urls.filter(u => { try { const x = new URL(u, location.origin); return x.origin === location.origin && isStatic(x.pathname); } catch (err) { return false; } }).slice(0, 200);
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.map(u => c.match(u).then(m => m || c.add(u).catch(() => {}))))));
});
const keep = (req, res) => { if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; };
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') {
    if (u.pathname !== SHELL) return;
    /* Réseau d'abord (toujours la dernière version) ; copie gardée si le réseau manque ou traîne. */
    const cached = () => caches.match(SHELL, { ignoreSearch: true });
    e.respondWith(new Promise(resolve => {
      let settled = false; const done = v => { if (!settled && v) { settled = true; resolve(v); } };
      const slow = setTimeout(() => cached().then(done), 4000);
      fetch(r).then(res => { clearTimeout(slow); if (res.ok) keep(SHELL, res); done(res); })
        .catch(() => { clearTimeout(slow); cached().then(m => { settled || resolve(m || Response.error()); settled = true; }); });
    }));
    return;
  }
  if (isStatic(u.pathname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => keep(r, res))));
    return;
  }
  if (u.pathname.startsWith('/_next/image')) {
    e.respondWith(caches.match(r).then(m => { const net = fetch(r).then(res => keep(r, res)); return m || net; }));
  }
});
