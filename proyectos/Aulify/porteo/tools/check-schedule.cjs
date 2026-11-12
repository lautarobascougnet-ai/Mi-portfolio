// Editor de horarios: UI simulada sin crear clases ni modificar usuarios reales.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const base = 'http://localhost/aulify/Frontend/';
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const options of [{ viewport: { width: 1440, height: 1000 } }, devices['Pixel 7'], { viewport: { width: 320, height: 640 } }]) {
			const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
			let approved = false, body = null, attempts = 0;
			await context.route('**/api/subjects', route => route.fulfill({ json: { subjects: [{ nombre: 'Prueba de horarios' }] } }));
			await context.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 2, nombre: 'Profesor', apellido: 'Prueba' } } }));
			await context.route('**/api/classes/mine', route => route.fulfill({ json: { is_professor: approved, csrf: 'schedule-token', classes: [], scheduled: [] } }));
			await context.route('**/api/classes', route => {
				attempts++; body = route.request().postDataJSON();
				assert.equal(route.request().headers()['x-csrf-token'], 'schedule-token');
				// Mantiene el formulario para comprobar los datos y que no se pierde el borrador tras un error.
				return route.fulfill({ status: 422, json: { error: 'Error simulado de prueba' } });
			});
			const page = await context.newPage(); const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			page.on('dialog', dialog => dialog.accept());
			await page.goto(base + 'crearclase.html');
			await page.waitForFunction(() => document.querySelector('#create-feedback').textContent.includes('Solo los profesores'));
			assert.equal(await page.locator('#create-class').isVisible(), false);
			approved = true; await page.reload(); await page.locator('#create-class').waitFor();
			await page.locator('[name=materia]').selectOption({ label: 'Prueba de horarios' });
			await page.locator('[name=descripcion]').fill('Descripción de la clase de prueba');
			await page.locator('[name=precio]').fill('12');
			await page.locator('#publish-class').click();
			assert.equal(attempts, 0, 'No publica disponibilidad vacía');
			assert((await page.locator('#schedule-feedback').textContent()).includes('al menos'));
			const expected = [[7, '08:00', '20:00'], [5, '09:00', '17:00'], [7, '09:00', '14:00'], [5, '16:00', '20:00']];
			for (let i = 0; i < expected.length; i++) {
				await page.locator(`[data-preset="${i}"]`).click();
				const response = page.waitForResponse(r => r.request().method() === 'POST');
				await page.locator('#publish-class').click(); await response;
				assert.equal(Object.keys(body.horarios.weekly).length, expected[i][0]);
				for (const ranges of Object.values(body.horarios.weekly)) assert.deepEqual(ranges, [{ start: expected[i][1], end: expected[i][2] }]);
				await page.waitForFunction(() => !document.querySelector('#publish-class').disabled);
			}
			await page.locator('#schedule-clear').click();
			await page.locator('#weekdays input[value="1"]').check();
			await page.locator('#weekly-start').fill('08:30'); await page.locator('#weekly-end').fill('12:15');
			await page.locator('#add-weekly').click();
			await page.locator('#weekly-start').fill('11:00'); await page.locator('#weekly-end').fill('14:45');
			await page.locator('#add-weekly').click(); // Une las dos franjas.
			await page.locator('#close-date').click();
			await page.locator('#date-start').fill('08:35'); await page.locator('#date-end').fill('09:10');
			await page.locator('#add-date').click();
			assert.equal(await page.locator('[data-hour="8"]').getAttribute('aria-pressed'), 'mixed');
			await page.locator('[data-hour="8"]').click();
			assert.equal(await page.locator('[data-hour="8"]').getAttribute('aria-pressed'), 'true');
			await page.locator('[data-hour="8"]').click();
			assert.equal(await page.locator('[data-hour="8"]').getAttribute('aria-pressed'), 'false');
			const date = await page.locator('#schedule-calendar [aria-pressed="true"]').getAttribute('data-date');
			await page.locator('[data-hour="23"]').click(); // 23:00–24:00.
			const response = page.waitForResponse(r => r.request().method() === 'POST');
			await page.locator('#publish-class').click(); await response;
			assert.deepEqual(body.horarios.weekly['1'], [{ start: '08:30', end: '14:45' }]);
			assert.deepEqual(body.horarios.exceptions[date], [{ start: '09:00', end: '09:10' }, { start: '23:00', end: '24:00' }]);
			assert.equal(body.horarios.timezone, 'America/Argentina/Buenos_Aires');
			await page.locator('#restore-date').click();
			assert((await page.locator('#date-mode').textContent()).includes('habitual'));
			await page.locator('#next-month').click();
			await page.locator('#schedule-calendar button:not([disabled])').last().click();
			await page.locator('#close-date').click();
			assert.equal(await page.locator('#hour-grid [aria-pressed="true"]').count(), 0);
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Sin desborde horizontal');
			await page.locator('#schedule-clear').click();
			assert.equal(await page.locator('#weekdays input:checked').count(), 0);
			assert.equal(await page.locator('#weekly-summary button').count(), 0);
			assert.equal(await page.locator('#date-ranges button').count(), 0);
			assert.equal(await page.locator('#weekly-start').inputValue(), '08:00');
			assert.equal(await page.locator('#weekly-end').inputValue(), '20:00');
			assert.equal(await page.locator('#date-start').inputValue(), '08:30');
			assert.equal(await page.locator('#date-end').inputValue(), '10:15');
			assert.equal(await page.locator('#schedule-calendar [aria-pressed="true"]').getAttribute('data-date'), date);
			assert.equal(await page.locator('[name=materia]').inputValue(), 'Prueba de horarios');
			assert.equal(await page.locator('[name=precio]').inputValue(), '12');
			assert.equal(await page.getByRole('heading', { name: 'Horarios predefinidos' }).count(), 1);
			assert.equal(await page.getByRole('heading', { name: 'Selección manual' }).count(), 1);
			const previousAttempts = attempts;
			await page.locator('#publish-class').click();
			assert.equal(attempts, previousAttempts, 'Reset no conserva horarios ocultos');
			assert.deepEqual(errors, []);
			const width = options.viewport.width;
			if (width === 1440) await page.screenshot({ path: 'porteo/logs/schedule-desktop.png', fullPage: true });
			if (width === 320) await page.screenshot({ path: 'porteo/logs/schedule-mobile.png', fullPage: true });
			console.log(`${width}px: permisos, cuatro plantillas, modo libre, minutos, excepciones, calendario, errores y adaptación OK.`);
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
