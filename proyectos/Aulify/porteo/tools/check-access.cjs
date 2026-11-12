// Acceso desde PC, navegador móvil y WebView emulado. Sin modificar usuarios reales.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const base = 'http://localhost/aulify/';

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		const pixel = devices['Pixel 7'];
		const scenarios = [
			{ name: 'PC', options: { viewport: { width: 1280, height: 900 } } },
			{ name: 'Navegador móvil', options: pixel },
			{ name: 'App Android emulada', native: true, options: { ...pixel, userAgent: pixel.userAgent + ' AulifyApp/1.1' } },
			{ name: 'Pantalla de 320px', native: true, options: { ...pixel, viewport: { width: 320, height: 740 }, userAgent: pixel.userAgent + ' AulifyApp/1.1' } },
		];
		for (const scenario of scenarios) {
			const context = await browser.newContext({ ...scenario.options, serviceWorkers: 'block' });
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(base + 'Frontend/Index.html');
			await page.waitForFunction(() => getComputedStyle(document.querySelector('header')).position === 'fixed');
			const login = page.locator('header a[href="login.html"]');
			assert(await login.isVisible());
			assert(await page.locator('header a[href="registro.html"]').isVisible());
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
			const bounds = await login.boundingBox();
			const rootSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
			assert(bounds.height >= 2.75 * rootSize && bounds.x >= 0 && bounds.x + bounds.width <= scenario.options.viewport.width);
			if (scenario.native) assert(!await page.locator('#install-help').isVisible());
			await login.click();
			await page.waitForURL('**/login.html');
			assert(await page.locator('#login-form').isVisible());

			// PHP real: el login acepta solicitudes de cualquier dispositivo, el registro directo no.
			const invalid = await context.request.post(base + 'Backend/conexiones/api/auth/login', {
				data: { email: 'access-test@example.invalid', password: 'PruebaInvalida123!' },
			});
			assert.equal(invalid.status(), 401);
			for (const route of ['api/auth/register', 'registro.php']) {
				const blocked = await context.request.post(base + 'Backend/conexiones/' + route, { data: {} });
				assert.equal(blocked.status(), 403);
				assert.equal((await blocked.json()).code, 'IDENTITY_REQUIRED');
			}

			// Navegación autenticada simulada: nunca utiliza credenciales ni cuentas existentes.
			let authenticated = false;
			await page.route('**/api/auth/**', async route => {
				const action = new URL(route.request().url()).pathname.split('/').pop();
				if (action === 'login') {
					assert.equal(route.request().postDataJSON().email, 'access-test@example.invalid');
					authenticated = true;
				}
				if (action === 'logout') authenticated = false;
				const status = action === 'me' && !authenticated ? 401 : 200;
				await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 401 ? { error: 'No hay sesión' } : { user: { id: 0, nombre: 'Prueba', apellido: 'Local', email: 'access-test@example.invalid' } }) });
			});
			await page.locator('[name=email]').fill('access-test@example.invalid');
			await page.locator('[name=password]').fill('PruebaInvalida123!');
			await page.locator('#submit-button').click();
			await page.waitForURL('**/home.html');
			await page.waitForFunction(() => document.querySelector('[data-user-greeting]').textContent.includes('Prueba'));
			await page.locator('#profile-button').click();
			await page.locator('#logout-button').click();
			await page.waitForURL('**/Index.html');
			await page.goto(base + 'Frontend/home.html');
			await page.waitForURL('**/login.html');
			assert.deepEqual(errors, []);
			console.log(scenario.name + ': login visible y navegable, sesión/cierre simulados y registro directo bloqueado.');
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
