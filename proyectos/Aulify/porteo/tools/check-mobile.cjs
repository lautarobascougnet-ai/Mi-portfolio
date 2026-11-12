const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const sharp = require("sharp");
const decodeQR = require("jsqr");
const { chromium, devices } = require("playwright-core");

(async () => {
	const base = "http://localhost/aulify/";
	const png = await sharp(path.join(__dirname, "../icons/registro-qr.png"))
		.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const qr = decodeQR(new Uint8ClampedArray(png.data), png.info.width, png.info.height);
	assert.equal(qr?.data, "AULIFY - REGISTRO MOVIL - QR DE PRUEBA SIN ENLACE");
	console.log("Recurso histórico de QR de muestra válido; el registro actual genera su QR dinámico.");
	for (const file of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
		const info = await sharp(path.join(__dirname, "../icons", file)).metadata();
		assert.equal(info.width, file === "icon-192.png" ? 192 : file === "icon-512.png" ? 512 : 180);
	}
	const browser = await chromium.launch({ channel: "msedge", headless: true });
	const profile = await fs.mkdtemp(path.join(os.tmpdir(), "aulify-pwa-check-"));
	const desktop = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true });
	try {
		const page = await desktop.newPage();
		await page.goto(base + "Frontend/registro.html");
		assert.equal(await page.locator("#verification-step").isVisible(), false);
		assert.equal(await page.locator("#register-form").isVisible(), true);
		await page.setViewportSize({ width: 390, height: 844 });
		assert.equal(await page.locator("#register-form").isVisible(), true);
		for (const endpoint of ["api/auth/register", "registro.php"]) {
			const response = await desktop.request.post(base + "Backend/conexiones/" + endpoint, { data: {} });
			assert.equal(response.status(), 403);
			assert.equal((await response.json()).code, "IDENTITY_REQUIRED");
		}
		console.log("Escritorio: formulario visible, QR inicialmente oculto y ambas API de registro bloqueadas.");
		for (const device of ["iPhone 13", "Pixel 7"]) {
			const mobile = await browser.newContext({ ...devices[device] });
			const phone = await mobile.newPage();
			await phone.goto(base + "Frontend/registro.html");
			await phone.waitForFunction(() => !document.querySelector("#registration-step").hidden);
			assert.equal(await phone.locator("#register-form").isVisible(), true);
			assert.equal(await phone.locator("#verification-step").isVisible(), false);
			assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			const response = await mobile.request.post(base + "Backend/conexiones/api/auth/register", { data: {} });
			assert.equal(response.status(), 403); // Registro directo bloqueado: exige identidad verificada.
			console.log(device + ": formulario visible y registro directo sin identidad bloqueado.");
			await mobile.close();
		}
		await page.goto(base + "Frontend/Index.html");
		await page.evaluate(() => navigator.serviceWorker.ready);
		await page.reload();
		assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
		const cdp = await desktop.newCDPSession(page);
		await cdp.send("Page.enable");
		const manifest = await cdp.send("Page.getAppManifest");
		assert.equal(manifest.errors.length, 0);
		const installability = await cdp.send("Page.getInstallabilityErrors");
		assert.deepEqual(installability.installabilityErrors, []);
		console.log("Manifest válido, service worker activo y sin errores de instalabilidad en Chromium.");
		// En Chromium la emulación offline de la página no siempre alcanza al
		// worker en localhost. Simula también la caída de red dentro del worker.
		const worker = desktop.serviceWorkers().find((item) => item.url().endsWith("/js/service-worker.js"));
		assert(worker);
		await worker.evaluate(() => {
			self.fetch = () => Promise.reject(new TypeError("Red no disponible (prueba)"));
		});
		await desktop.setOffline(true);
		await page.goto(base + "Frontend/user.html");
		assert.match(await page.textContent("h1"), /sin conexión/);
		const cached = await page.evaluate(async () => {
			const cache = await caches.open("aulify-install-v2");
			return (await cache.keys()).map((r) => r.url);
		});
		assert(!cached.some((url) => /auth|user\.html|home\.html/.test(url)));
		console.log("Sin conexión: aviso visible y ningún perfil, sesión o API en caché.");
	} finally {
		await desktop.close();
		await browser.close();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
