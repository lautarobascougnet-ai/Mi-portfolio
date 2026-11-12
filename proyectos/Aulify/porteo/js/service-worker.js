// Solo guarda recursos públicos de instalación. Nunca almacena perfiles ni API.
const CACHE = "aulify-install-v2";
const asset = (path) => new URL("../" + path, self.location.href).href;
const PUBLIC_ASSETS = [
	"offline.html", "../Frontend/aulify-icon.svg", "icons/icon-192.png",
	"icons/icon-512.png", "icons/apple-touch-icon.png",
];
self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) =>
		cache.addAll(PUBLIC_ASSETS.map(asset))));
	self.skipWaiting();
});
self.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		for (const key of await caches.keys()) {
			if (key.startsWith("aulify-install-") && key !== CACHE) await caches.delete(key);
		}
		await self.clients.claim();
	})());
});
self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	const url = new URL(event.request.url);
	if (!url.href.startsWith(self.registration.scope) && !PUBLIC_ASSETS.map(asset).includes(url.href)) return;
	if (event.request.mode === "navigate") {
		// Siempre consulta la red: no recupera pantallas privadas desde la caché.
		event.respondWith(fetch(event.request, { cache: "no-store" })
			.catch(() => caches.match(asset("offline.html"))));
	} else if (PUBLIC_ASSETS.map(asset).includes(url.href)) {
		event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
	}
});
