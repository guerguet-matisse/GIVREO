// Service worker : l'app marche hors-ligne, et les tuiles de carte déjà vues sont gardées.
const APP = "gps-salage-app-v1", TUILES = "gps-salage-tuiles-v1";
const FICHIERS = ["./", "index.html", "data.js", "manifest.webmanifest", "icon.svg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(APP).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.endsWith("openstreetmap.org")) {           // tuiles : cache puis réseau
    e.respondWith(caches.open(TUILES).then(async (c) => {
      const hit = await c.match(e.request); if (hit) return hit;
      const rep = await fetch(e.request); c.put(e.request, rep.clone()); return rep;
    }).catch(() => Response.error()));
  } else if (url.hostname.includes("osrm.org")) {             // routes : toujours le réseau
    return;
  } else {                                                    // reste de l'app : réseau puis cache
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(APP).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request)));
  }
});
