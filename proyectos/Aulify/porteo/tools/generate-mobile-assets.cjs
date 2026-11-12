// Genera archivos estáticos locales; el QR no contiene ninguna URL.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const QRCode = require("qrcode");

(async () => {
	const frontend = path.resolve(__dirname, "..");
	await fs.mkdir(path.join(frontend, "icons"), { recursive: true });
	for (const size of [192, 512, 180]) {
		const filename = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
		await sharp(path.join(frontend, "../Frontend/aulify-icon.svg"))
			.resize(size, size).flatten({ background: "#626780" }).png()
			.toFile(path.join(frontend, "icons", filename));
	}
	await QRCode.toFile(path.join(frontend, "icons", "registro-qr.png"),
		"AULIFY - REGISTRO MOVIL - QR DE PRUEBA SIN ENLACE",
		{ width: 320, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
})();
