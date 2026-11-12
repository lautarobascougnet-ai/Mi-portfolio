// Compilación reproducible con herramientas Android oficiales, sin Gradle global.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const file = (...parts) => path.join(root, ...parts);
const config = JSON.parse(fs.readFileSync(file("estado/config.json")));
const build = file("android/build");
const sdkTools = file("sdk/build-tools/android-15");
const androidJar = file("sdk/platform/android-35/android.jar");
function run(exe, args) { execFileSync(exe, args, { cwd: root, stdio: "inherit" }); }
if (!fs.existsSync(androidJar) || !fs.existsSync(path.join(sdkTools, "aapt2.exe"))) throw new Error("Primero ejecuta preparar-sdk.ps1.");
for (const dir of ["res/xml", "res/raw", "res/values", "res/mipmap", "generated", "classes", "dex"]) fs.mkdirSync(path.join(build, dir), { recursive: true });
fs.mkdirSync(file("dist"), { recursive: true });
fs.copyFileSync(file("icons/icon-192.png"), path.join(build, "res/mipmap/ic_launcher.png"));
fs.copyFileSync(file("certificados/aulify-local-ca.pem"), path.join(build, "res/raw/aulify_ca.pem"));
fs.writeFileSync(path.join(build, "res/values/strings.xml"),
	'<resources><string name="aulify_url">https://' + config.ip + ':8443/aulify/Frontend/Index.html</string></resources>');
// La CA de desarrollo se confía solamente dentro de esta app y para esta IP.
fs.writeFileSync(path.join(build, "res/xml/network_security_config.xml"),
	'<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system"/></trust-anchors></base-config><domain-config cleartextTrafficPermitted="false"><domain>' +
	config.ip + '</domain><trust-anchors><certificates src="@raw/aulify_ca"/></trust-anchors></domain-config></network-security-config>');
const resourceZip = path.join(build, "resources.zip");
const unsigned = path.join(build, "unsigned.apk");
const aligned = path.join(build, "aligned.apk");
run(path.join(sdkTools, "aapt2.exe"), ["compile", "--dir", path.join(build, "res"), "-o", resourceZip]);
run(path.join(sdkTools, "aapt2.exe"), ["link", "-o", unsigned, "-I", androidJar, "--manifest", file("android/AndroidManifest.xml"),
	"--java", path.join(build, "generated"), resourceZip]);
run("javac", ["--release", "8", "-encoding", "UTF-8", "-classpath", androidJar, "-d", path.join(build, "classes"),
	file("android/src/com/aulify/local/MainActivity.java"), path.join(build, "generated/com/aulify/local/R.java")]);
const classesJar = path.join(build, "classes.jar");
run("jar", ["--create", "--file", classesJar, "-C", path.join(build, "classes"), "."]);
run("java", ["-cp", path.join(sdkTools, "lib/d8.jar"), "com.android.tools.r8.D8", "--lib", androidJar,
	"--min-api", "26", "--output", path.join(build, "dex"), classesJar]);
run("jar", ["--update", "--file", unsigned, "-C", path.join(build, "dex"), "classes.dex"]);
run(path.join(sdkTools, "zipalign.exe"), ["-f", "-p", "4", unsigned, aligned]);
const keystore = file("privado/android-local.keystore");
if (!fs.existsSync(keystore)) run("keytool", ["-genkeypair", "-keystore", keystore, "-storepass", "android",
	"-keypass", "android", "-alias", "aulifylocal", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
	"-dname", "CN=Aulify Local,O=Aulify,C=AR", "-storetype", "JKS"]);
const apk = file("dist/Aulify-local.apk");
run("java", ["-jar", path.join(sdkTools, "lib/apksigner.jar"), "sign", "--ks", keystore,
	"--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", apk, aligned]);
run("java", ["-jar", path.join(sdkTools, "lib/apksigner.jar"), "verify", "--verbose", apk]);
console.log("APK de uso local: " + apk);
