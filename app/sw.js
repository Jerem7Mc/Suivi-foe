// Mise en cache pour l'usage hors ligne. Changer VERSION à chaque mise en ligne.
const VERSION = "suivi-foe-1";
const FICHIERS = ["./", "index.html", "style.css", "app.js", "logique.js", "rappel.html", "manifest.webmanifest", "icone.svg", "icone-180.png", "icone-512.png"];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys().then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c)))).then(() => self.clients.claim()));
});

// Réseau d'abord pour recevoir les mises à jour, cache si l'appareil est hors ligne.
self.addEventListener("fetch", ev => {
  if (ev.request.method !== "GET") return;
  ev.respondWith(
    fetch(ev.request).then(reponse => {
      const copie = reponse.clone();
      caches.open(VERSION).then(c => c.put(ev.request, copie));
      return reponse;
    }).catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
