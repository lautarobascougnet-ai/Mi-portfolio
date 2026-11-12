const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const ca = fs.readFileSync(path.join(root, "certificados/aulify-local-ca.pem"));
const config = JSON.parse(fs.readFileSync(path.join(root, "estado/config.json")));
function request(resource, method = "GET", agent = "Desktop", port = config.httpsPort) {
	return new Promise((resolve, reject) => {
		const req = https.request({ hostname: process.env.AULIFY_TEST_HOST || config.ip, port, path: resource, method, ca,
			headers: { "User-Agent": agent, "Content-Type": "application/json" } }, (res) => {
			let body = ""; res.on("data", (chunk) => body += chunk); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
		});
		req.on("error", reject);
		req.setTimeout(10000, () => req.destroy(new Error("Tiempo de conexión agotado")));
		req.end(method === "POST" ? "{}" : undefined);
	});
}
(async () => {
	for (const url of ["/aulify/Frontend/admin-profesores.html", "/aulify/Frontend/js/admin-profesores.js"]) assert.equal((await request(url)).status, 200, url);
	assert.equal((await request('/aulify/Backend/conexiones/api/teacher/application')).status, 401);
	assert.equal((await request('/aulify/Backend/conexiones/api/admin/teachers')).status, 403);
	assert.equal((await request('/aulify/Backend/conexiones/api/admin/session')).status, 200);
	for (const url of ["/aulify/Frontend/Index.html", "/aulify/Frontend/registro.html", "/aulify/Frontend/verificacion.html", "/aulify/Frontend/js/identidad.js", "/aulify/Frontend/js/verificacion.js", "/aulify/Frontend/js/vendor/qrcode.js", "/aulify/porteo/manifest.webmanifest", "/aulify/porteo/js/service-worker.js"]) {
		const response = await request(url); assert.equal(response.status, 200, url);
		if (url.endsWith("service-worker.js")) assert.equal(response.headers["service-worker-allowed"], "/aulify/");
		if (/\/(registro|verificacion)\.html$/.test(url)) {
			assert.equal(response.headers['cache-control'], 'no-store');
			assert.equal(response.headers['referrer-policy'], 'no-referrer');
		}
	}
	for (const url of ["/aulify/porteo/privado/ca.key", "/aulify/porteo/estado/config.json", "/aulify/Backend/conexiones/identidad/config.local.php", "/aulify/Backend/conexiones/identidad/schema.sql", "/aulify/Backend/base%20de%20datos/aulifyb.sql", "/dashboard/"]) {
		assert.equal((await request(url)).status, 404, url);
	}
	const blocked = await request("/aulify/Backend/conexiones/api/auth/register", "POST");
	assert.equal(blocked.status, 403);
	const mobile = await request("/aulify/Backend/conexiones/api/auth/register", "POST", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36");
	assert.equal(mobile.status, 403);
	assert(mobile.headers["set-cookie"].every((cookie) => /;\s*Secure(?:;|$)/i.test(cookie)));
	const identity = await request('/aulify/Backend/conexiones/api/identity/config');
	assert.equal(identity.status, 200);
	assert.equal(identity.headers['cache-control'], 'no-store');
	assert(!Object.hasOwn(JSON.parse(identity.body), 'api_key'));
	assert.equal((await request('/aulify/Backend/conexiones/api/identity/start', 'POST')).status, 403);
	const apk = await request('/aulify/porteo/dist/Aulify-local.apk', 'HEAD');
	assert.equal(apk.status, 200);
	assert.match(apk.headers['content-type'], /application\/vnd.android.package-archive/);
	assert.match(apk.headers['content-disposition'], /attachment/);
	assert(Number(apk.headers['content-length']) > 10000);
	console.log("HTTPS: certificado válido, recursos de identidad y descarga APK accesibles, secretos bloqueados, registro directo cerrado y cookies Secure correctas.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
