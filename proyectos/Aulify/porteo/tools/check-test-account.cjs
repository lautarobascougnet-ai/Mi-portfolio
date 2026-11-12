// Prueba la cuenta ya creada. Recibe su contraseña por stdin, no la almacena.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, devices } = require('playwright-core');
const password = fs.readFileSync(0, 'utf8').trim();
assert(password, 'Falta contraseña por stdin');
const base = 'http://localhost/aulify/';

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const options of [{ viewport: { width: 1280, height: 900 } }, devices['Pixel 7']]) {
			const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
			const api = base + 'Backend/conexiones/api/';
			assert.equal((await context.request.post(api + 'auth/login', { data: { email: 'admin', password: password + '-incorrecta' } })).status(), 401);
			assert.equal((await context.request.post(api + 'auth/login', { data: { email: 'no-existe@example.invalid', password } })).status(), 401);
			assert.equal((await context.request.post(api + 'auth/login', { data: { email: 'admin@aulify.invalid', password } })).status(), 200);
			await context.request.post(api + 'auth/logout');
			const page = await context.newPage();
			await page.goto(base + 'Frontend/login.html');
			await page.locator('[name=email]').fill('admin');
			await page.locator('[name=password]').fill(password);
			await page.locator('#submit-button').click();
			await page.waitForURL('**/home.html');
			const current = await context.request.get(api + 'auth/me');
			assert.equal(current.status(), 200);
			assert.equal((await current.json()).user.username, 'admin');
			await page.locator('#profile-button').click();
			await page.locator('#logout-button').click();
			await page.waitForURL('**/Index.html');
			assert.equal((await context.request.get(api + 'auth/me')).status(), 401);
			assert.equal((await context.request.post(api + 'auth/register', { data: {} })).status(), 403);
			assert.equal((await context.request.get(base + 'Backend/conexiones/crear_cuenta_prueba.php')).status(), 404);
			console.log(options.isMobile ? 'Móvil: login y logout reales correctos.' : 'PC: login y logout reales correctos.');
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
