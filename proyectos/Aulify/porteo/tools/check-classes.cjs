// UI con datos simulados; la API real se prueba con tablas temporales en clases/tests.php.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const base = 'http://localhost/aulify/Frontend/';
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const options of [{ viewport: { width: 1440, height: 900 } }, devices['Pixel 7']]) {
			const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
			let professor = false, classes = [];
			await context.route('**/uploads/perfiles/prueba.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8l8AAAAASUVORK5CYII=', 'base64') }));
			await context.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 2, nombre: 'Docente', apellido: 'Prueba', is_professor: professor } } }));
			await context.route('**/api/classes/mine', route => route.fulfill({ json: { is_professor: professor, classes: professor ? classes : [], scheduled: [], csrf: 'test-token' } }));
			await context.route('**/api/classes', route => {
				if (route.request().method() === 'POST') {
					assert.equal(route.request().headers()['x-csrf-token'], 'test-token');
					classes.push({ ...route.request().postDataJSON(), id: 1, profesor_id: 2, profesor: 'Docente Prueba', rating: 4.5, foto_perfil: 'Backend/conexiones/uploads/perfiles/prueba.png' });
					return route.fulfill({ status: 201, json: { message: 'Clase publicada.' } });
				}
				return route.fulfill({ json: { classes } });
			});
			const page = await context.newPage();
			const errors = []; page.on('pageerror', error => errors.push(error.message));
			await page.goto(base + 'misclases.html');
			await page.waitForFunction(() => document.querySelector('#classes-feedback').textContent === '');
			assert.equal(await page.locator('#teacher-classes').isVisible(), false);
			assert.equal(await page.locator('#scheduled-classes').isVisible(), true);
			professor = true; await page.reload();
			await page.locator('#show-create-class').click();
			await page.locator('[name=materia]').fill('Clash Royale');
			await page.locator('[name=descripcion]').fill('Estrategia de prueba <img src=x onerror=alert(1)>');
			await page.locator('[name=precio]').fill('75.50');
			await page.locator('[name=modalidad]').selectOption('ambas');
			await page.locator('[name=permite_chat]').check();
			await page.locator('[data-preset="0"]').click();
			await page.locator('#publish-class').click();
			await page.waitForURL('**/misclases.html?creada=1');
			assert.equal(classes[0].modalidad, 'ambas');
			assert.equal(classes[0].permite_chat, '1');
			await page.locator('#owned-classes article').waitFor();
			assert.equal(await page.locator('#owned-classes img').count(), 0);
			await page.reload(); await page.locator('#owned-classes article').waitFor();
			for (const path of ['home.html?materia=clash%20royale#profesores', 'Index.html']) {
				await page.goto(base + path);
				await page.locator('[data-class-id="1"]').waitFor();
				const filter = page.locator('#subject-filter, #public-class-filter');
				await filter.selectOption('clash royale');
				assert.equal(await page.locator('.teacher-card:visible').count(), 1);
				const card = page.locator('[data-class-id="1"]');
				assert.equal(await card.locator('img').count(), 1);
				assert.equal(await card.locator('h3').textContent(), 'Clash Royale');
				assert((await card.textContent()).includes('4.5 / 5'));
				assert((await card.textContent()).includes('<img src=x onerror=alert(1)>'));
				assert.equal(await card.locator('button').count(), 2);
				assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Sin desborde horizontal');
			}
			classes[0].rating = null; classes[0].foto_perfil = 'https://example.invalid/photo.png';
			await page.goto(base + 'Index.html');
			await page.locator('[data-class-id="1"]').waitFor();
			assert.equal(await page.locator('[data-class-id="1"] img').count(), 0, 'Foto externa rechazada');
			assert((await page.locator('[data-class-id="1"]').textContent()).includes('Sin calificación'));
			classes[0].foto_perfil = 'Backend/conexiones/uploads/perfiles/inexistente.png';
			await context.route('**/uploads/perfiles/inexistente.png', route => route.fulfill({ status: 404, body: '' }));
			await page.reload();
			await page.locator('[data-class-id="1"]').scrollIntoViewIfNeeded();
			await page.locator('[data-class-id="1"] svg').waitFor();
			await page.goto(base + 'misclases.html'); await page.locator('#teacher-classes').waitFor();
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Formulario responsive');
			assert.deepEqual(errors, []);
			console.log((options.viewport?.width === 1440 ? 'PC' : 'Móvil') + ': permisos visuales, creación, persistencia, materias nuevas y filtros correctos.');
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
