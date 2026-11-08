// © 2026 Matisse Guerguet – Tous droits réservés. Voir le fichier LICENSE.
// Service worker : démarrage instantané, mode hors-ligne, tuiles de carte conservées (plafonnées).
const APP = "givreo-app-v1", TUILES = "gps-salage-tuiles-v1", MAX_TUILES = 1200; // la zone téléchargée est dans le cache "gps-salage-zone" (jamais purgé ici)
const FICHIERS = ["./", "index.html", "style.css", "app.js", "lib.js", "data.js", "manifest.webmanifest", "icon.svg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"];

self.addEventListener("install", (e) => e.waitUntil(
  caches.open(APP).then((c) => Promise.all(FICHIERS.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("givreo-app-") && k !== APP).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())));

async function limiter(cache) { // supprime les plus anciennes tuiles au-delà du plafond
  const cles = await cache.keys();
  if (cles.length > MAX_TUILES) await Promise.all(cles.slice(0, cles.length - MAX_TUILES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.includes("osrm.org") || url.hostname.includes("open-meteo.com")) return; // données en direct : réseau seul
  if (url.hostname.endsWith("openstreetmap.org")) { // tuiles : zone hors-ligne et cache d'abord, réseau ensuite
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreVary: true }); if (hit) return hit;
      try { const rep = await fetch(req); if (rep.ok) { const c = await caches.open(TUILES); c.put(req, rep.clone()); limiter(c); } return rep; }
      catch (err) { return Response.error(); }
    })());
    return;
  }
  // application : on répond tout de suite avec le cache, et on le met à jour en arrière-plan
  e.respondWith(caches.open(APP).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const reseau = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await reseau) || Response.error();
  }));
});
