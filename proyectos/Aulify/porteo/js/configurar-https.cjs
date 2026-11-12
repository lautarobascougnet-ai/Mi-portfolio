// Certificados de desarrollo local; las claves nunca se exponen por HTTP.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const openssl = process.env.AULIFY_OPENSSL || "C:/xampp/apache/bin/openssl.exe";
const candidates = Object.values(os.networkInterfaces()).flat()
	.filter((item) => item.family === "IPv4" && !item.internal)
	.map((item) => item.address)
	.filter((ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
const ip = process.argv[2] || candidates[0];
if (!ip || net.isIP(ip) !== 4) throw new Error("Indica la IPv4 de la PC: node js/configurar-https.cjs 192.168.0.201");
for (const dir of ["privado", "certificados", "estado", "logs"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
const file = (name) => path.join(root, name);
const run = (...args) => execFileSync(openssl, args, {
	cwd: root, stdio: ["ignore", "pipe", "pipe"],
	env: { ...process.env, OPENSSL_CONF: file("privado/openssl.cnf") },
});
fs.writeFileSync(file("privado/openssl.cnf"), "[req]\ndistinguished_name=dn\n[dn]\n");
const caKey = file("privado/ca.key");
const caCert = file("certificados/aulify-local-ca.pem");
if (fs.existsSync(caKey) !== fs.existsSync(caCert)) throw new Error("Falta parte de la CA local; recupera el certificado o su clave antes de continuar.");
if (!fs.existsSync(caKey)) {
	run("req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256",
		"-days", "1825", "-keyout", caKey, "-out", caCert,
		"-subj", "/CN=Aulify Local Development CA",
		"-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
		"-addext", "keyUsage=critical,keyCertSign,cRLSign");
}
const conf = file("estado/config.json");
const previous = fs.existsSync(conf) ? JSON.parse(fs.readFileSync(conf)) : {};
const key = file("privado/servidor.key");
const cert = file("certificados/servidor.pem");
const valid = fs.existsSync(cert) && new Date(new X509Certificate(fs.readFileSync(cert)).validTo) > new Date(Date.now() + 86400000);
if (previous.ip !== ip || !fs.existsSync(key) || !valid) {
	fs.writeFileSync(file("privado/servidor.ext"), [
		"basicConstraints=critical,CA:FALSE", "keyUsage=critical,digitalSignature,keyEncipherment",
		"extendedKeyUsage=serverAuth", "subjectKeyIdentifier=hash", "authorityKeyIdentifier=keyid,issuer",
		"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:" + ip, "",
	].join("\n"));
	run("req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256", "-keyout", key,
		"-out", file("privado/servidor.csr"), "-subj", "/CN=" + ip);
	run("x509", "-req", "-in", file("privado/servidor.csr"), "-CA", caCert, "-CAkey", caKey,
		"-CAcreateserial", "-days", "365", "-sha256", "-extfile", file("privado/servidor.ext"), "-out", cert);
}
run("x509", "-in", caCert, "-outform", "DER", "-out", file("certificados/aulify-local-ca.cer"));
const config = { ip, httpsPort: 8443, certificatePort: 8081, projectPath: "/aulify/" };
fs.writeFileSync(conf, JSON.stringify(config, null, 2) + "\n");
const fingerprint = new X509Certificate(fs.readFileSync(caCert)).fingerprint256;
const instructions = [
	"AULIFY - ACCESO LOCAL DESDE EL TELEFONO",
	"Conecta el telefono al mismo router que esta computadora.",
	"1. Descarga e instala la CA: http://" + ip + ":8081/certificado.cer",
	"2. Confia en el certificado Aulify Local Development CA desde los ajustes del telefono.",
	"3. Abre: https://" + ip + ":8443/aulify/Frontend/Index.html",
	"4. Usa Instalar aplicacion / Agregar a inicio.",
	"Huella SHA-256 del certificado: " + fingerprint,
	"Consulta LEEME.txt para los pasos de Android/iPhone. No compartas la carpeta privado.",
];
fs.writeFileSync(file("estado/ACCESO_TELEFONO.txt"), instructions.join("\r\n") + "\r\n");
console.log(instructions.join("\n"));
