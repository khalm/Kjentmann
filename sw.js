/* Kjentmann service worker – gjør at appen og kartet virker uten dekning. */
const VERSION = '1.0.0';
const APP_CACHE = `kjentmann-app-${VERSION}`;
const TILE_CACHE = 'kjentmann-tiles-auto';     // kartbiter du har sett (ryddes automatisk)
const SAVED_CACHE = 'kjentmann-tiles-saved';   // kartbiter du har lastet ned (ryddes ikke)
const MAX_AUTO_TILES = 6000;

const APP_FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-64.png',
  'icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

const TILE_HOSTS = ['cache.kartverket.no', 'server.arcgisonline.com', 'tile.openstreetmap.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('kjentmann-app-') && k !== APP_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

let putsSinceTrim = 0;
async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  const extra = keys.length - MAX_AUTO_TILES;
  for (let i = 0; i < extra; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kartbiter: fra lager først, ellers nett
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {
          const c = await caches.open(TILE_CACHE);
          c.put(req.url, res.clone());
          if (++putsSinceTrim > 300) { putsSinceTrim = 0; trimTiles(); }
        }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // Selve appen: nett først (så du får nye versjoner), lager hvis du er uten dekning
  const isApp = url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com';
  if (!isApp) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const c = await caches.open(APP_CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return new Response('', { status: 504 });
    }
  })());
});
