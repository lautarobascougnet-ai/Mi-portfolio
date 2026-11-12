// Entrada HTTPS local delante de Apache. No publica XAMPP ni archivos internos.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const root = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "estado/config.json")));
const cert = fs.readFileSync(path.join(root, "certificados/servidor.pem"));
const key = fs.readFileSync(path.join(root, "privado/servidor.key"));
const caDownload = fs.readFileSync(path.join(root, "certificados/aulify-local-ca.cer"));
const prefix = config.projectPath;
const publicMobile = new Set([
	"manifest.webmanifest", "offline.html", "js/pwa.js", "js/service-worker.js",
	"icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/registro-qr.png",
	"dist/Aulify-local.apk",
]);
const publicFrontend = new Set([
	"Index.html", "home.html", "login.html", "registro.html", "user.html", "serprofe.html",
	"aulify-icon.svg", "js/api.js", "js/home.js", "js/login.js", "js/registro.js", "js/user.js", "js/serprofe.js",
	"verificacion.html", "js/identidad.js", "js/verificacion.js", "js/vendor/qrcode.js",
	"admin-profesores.html", "js/admin-profesores.js",
	"misclases.html", "js/misclases.js", "js/catalogo-clases.js",
	"crearclase.html", "js/crearclase.js",
	"clase.html", "js/clase.js", "profesor.html", "js/profesor.js",
]);
const apiRoutes = new Set(["", "auth/register", "auth/login", "auth/me", "auth/logout", "user/profile", "user/password", "user/delete"]);
for (const action of ["config", "start", "context", "launch", "status", "cancel"]) apiRoutes.add("identity/" + action);
apiRoutes.add("teacher/application");
apiRoutes.add("classes");
apiRoutes.add("classes/mine");
for (const route of ['classes/detail', 'classes/availability', 'classes/update', 'teachers/profile', 'bookings', 'bookings/cancel']) apiRoutes.add(route);
for (const action of ["session", "login", "logout", "teachers", "teacher-title", "teacher-review"]) apiRoutes.add("admin/" + action);
function allowed(urlPath) {
	if (urlPath.startsWith(prefix + "Frontend/")) return publicFrontend.has(urlPath.slice((prefix + "Frontend/").length));
	if (urlPath.startsWith(prefix + "porteo/")) return publicMobile.has(urlPath.slice((prefix + "porteo/").length));
	if (urlPath.startsWith(prefix + "Backend/conexiones/api/")) return apiRoutes.has(urlPath.slice((prefix + "Backend/conexiones/api/").length));
	if (urlPath === prefix + "Backend/conexiones/registro.php") return true;
	return new RegExp("^" + prefix + "Backend/conexiones/uploads/perfiles/[a-zA-Z0-9_]+\\.(jpg|png|webp)$").test(urlPath);
}
function reply(res, status, message) {
	res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
	res.end(message);
}
function certificate(req, res) {
	if (req.method !== "GET" && req.method !== "HEAD") return reply(res, 405, "Solo GET o HEAD.");
	if (req.url === "/certificado.cer") {
		res.writeHead(200, {
			"Content-Type": "application/x-x509-ca-cert",
			"Content-Disposition": 'attachment; filename="aulify-local-ca.cer"',
			"Cache-Control": "no-store",
		});
		return res.end(req.method === "HEAD" ? undefined : caDownload);
	}
	if (req.url === "/") return reply(res, 200, "Aulify: descarga /certificado.cer. Pasos completos en porteo/LEEME.txt de la computadora.");
	reply(res, 404, "Recurso no disponible.");
}
const secureServer = https.createServer({ cert, key, minVersion: "TLSv1.2" }, (req, res) => {
	const host = req.headers.host;
	if (![config.ip, "localhost", "127.0.0.1"].some((name) => host === name + ":" + config.httpsPort)) return reply(res, 400, "Host no permitido.");
	if (req.headers.origin && req.headers.origin !== "https://" + host) return reply(res, 403, "Origen no permitido.");
	if (req.url === "/" || req.url === prefix) {
		res.writeHead(302, { Location: prefix + "Frontend/Index.html" }); return res.end();
	}
	if (req.url === "/certificado.cer") return certificate(req, res);
	let url;
	try { url = new URL(req.url, "https://" + host); } catch { return reply(res, 400, "URL no valida."); }
	if (!allowed(url.pathname)) return reply(res, 404, "Recurso no disponible.");
	const headers = { ...req.headers, host: "localhost", "x-forwarded-proto": "https" };
	delete headers["x-forwarded-host"];
	delete headers["x-forwarded-for"];
	const upstream = http.request({
		hostname: "127.0.0.1", port: 80, path: url.pathname + url.search, method: req.method, headers, timeout: 20000,
	}, (response) => {
		const output = { ...response.headers };
		// PHP trabaja con Apache local por HTTP, pero la cookie viaja al telefono por HTTPS.
		if (output["set-cookie"]) output["set-cookie"] = output["set-cookie"].map((cookie) =>
			/;\s*secure(?:;|$)/i.test(cookie) ? cookie : cookie + "; Secure");
		if (url.pathname.includes("/api/")) output["cache-control"] = "no-store";
		if (url.pathname.endsWith("/verificacion.html") || url.pathname.endsWith("/registro.html")) {
			output["cache-control"] = "no-store";
			output["referrer-policy"] = "no-referrer";
		}
		if (url.pathname.endsWith("/service-worker.js")) {
			output["service-worker-allowed"] = prefix;
			output["cache-control"] = "no-cache";
		}
		res.writeHead(response.statusCode, output);
		response.pipe(res);
	});
	upstream.on("timeout", () => upstream.destroy(new Error("Apache no responde")));
	upstream.on("error", () => {
		if (!res.headersSent) reply(res, 502, "Inicia Apache y MySQL en XAMPP y vuelve a intentar.");
		else res.destroy();
	});
	req.on("aborted", () => upstream.destroy());
	req.pipe(upstream);
});
const downloadServer = http.createServer(certificate);
for (const server of [secureServer, downloadServer]) server.on("error", (error) => {
	console.error(error.message); process.exitCode = 1; secureServer.close(); downloadServer.close();
});
secureServer.listen(config.httpsPort, "0.0.0.0", () => console.log("Aulify HTTPS: https://" + config.ip + ":" + config.httpsPort + prefix + "Frontend/Index.html"));
downloadServer.listen(config.certificatePort, "0.0.0.0", () => console.log("Certificado: http://" + config.ip + ":" + config.certificatePort + "/certificado.cer"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
	secureServer.close(); downloadServer.close();
});
