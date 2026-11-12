// Interfaz con API simulada; persistencia real se comprueba en profesores/tests.php.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright-core');
const base = 'http://localhost/aulify/';

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		const actual = await browser.newContext();
		for (const method of ['get', 'post']) assert.equal((await actual.request[method](base + 'Backend/conexiones/api/teacher/application')).status(), 401);
		assert.equal((await actual.request.get(base + 'Backend/conexiones/profesores/schema.sql')).status(), 403);
		await actual.close();
		for (const options of [{ viewport: { width: 1920, height: 1080 } }, devices['Pixel 7']]) {
			const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
			let authenticated = false, application = null, saves = 0;
			await context.route('**/api/auth/**', route => {
				if (route.request().url().endsWith('/login')) authenticated = true;
				return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? { user: { id: 0, nombre: 'Prueba', apellido: 'Docente', username: 'prueba' } } : { error: 'Debes iniciar sesión.' } });
			});
			const values = { nombre_completo: 'Prueba Docente', nombre_usuario: 'prueba', experiencia: 'Experiencia de prueba enseñando en clases particulares.', descripcion: 'Clases personalizadas con ejemplos y ejercicios prácticos.', motivacion: 'Quiero compartir mis conocimientos y ayudar a aprender.' };
			await context.route('**/api/teacher/application', async route => {
				if (route.request().method() === 'POST') {
					assert.equal(route.request().headers()['x-csrf-token'], 'test-csrf');
					const body = route.request().postDataBuffer().toString('utf8');
					for (const value of Object.values(values)) assert(body.includes(value));
					assert(body.includes('secundaria'));
					saves++;
					application = { ...values, estudios: ['secundaria'], titulo_nombre: 'titulo.png', estado: 'pendiente' };
					return route.fulfill({ status: 201, json: { message: 'Solicitud guardada. Está pendiente de revisión.', titulo_nombre: 'titulo.png', estado: 'pendiente' } });
				}
				return route.fulfill({ json: { application, csrf: 'test-csrf' } });
			});
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(base + 'Frontend/Index.html');
			assert.equal(await page.locator('a[href="serprofe.html"]').count(), 0);
			await page.goto(base + 'Frontend/serprofe.html');
			await page.waitForURL('**/login.html?next=serprofe');
			await page.locator('[name=email]').fill('prueba');
			await page.locator('[name=password]').fill('solo-prueba');
			await page.locator('#submit-button').click();
			await page.waitForURL('**/serprofe.html');
			await page.waitForFunction(() => !document.querySelector('#teacher-fields').disabled);
			assert.equal(await page.locator('[name=nombre_completo]').inputValue(), values.nombre_completo);
			for (const [key,value] of Object.entries(values)) await page.locator(`[name=${key}]`).fill(value);
			await page.locator('#teacher-submit').click();
			assert.equal(saves, 0);
			await page.locator('[value=ninguno]').check();
			await page.locator('[value=secundaria]').check();
			assert(!await page.locator('[value=ninguno]').isChecked());
			await page.locator('#teacher-certificate').setInputFiles({ name: 'titulo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6t1cAAAAASUVORK5CYII=', 'base64') });
			await page.locator('#teacher-submit').click();
			await page.waitForFunction(() => !document.querySelector('#teacher-wait').hidden);
			assert.equal(saves, 1);
			await page.reload();
			await page.waitForFunction(() => !document.querySelector('#teacher-wait').hidden);
			assert(!await page.locator('#teacher-form').isVisible());
			assert(!await page.locator('#teacher-continue').isVisible());
			application.estado = 'aprobada';
			await page.locator('#review-refresh').click();
			await page.locator('#teacher-continue').waitFor({ state: 'visible' });
			assert((await page.locator('#review-title').textContent()).includes('aceptado'));
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
			assert.deepEqual(errors, []);
			const output = path.resolve(__dirname, '../logs/responsive');
			fs.mkdirSync(output, { recursive: true });
			await page.screenshot({ path: path.join(output, 'serprofe-' + (options.isMobile ? 'movil' : 'pc') + '.png'), fullPage: true });
			console.log((options.isMobile ? 'Móvil' : 'PC') + ': acceso desde inicio, login con retorno, campos, estudios, título y recuperación correctos.');
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
