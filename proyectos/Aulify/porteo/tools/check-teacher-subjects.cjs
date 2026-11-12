const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const width of [1440, 390]) {
			const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' });
			await context.route('**/api/auth/me', r => r.fulfill({ json: { user: { id: 1, nombre: 'Prueba', email: 'prueba@example.invalid' } } }));
			await context.route('**/api/teacher/application', r => r.fulfill({ json: { application: null, csrf: 'test' } }));
			await context.route('**/api/admin/session', r => r.fulfill({ json: { authenticated: true, csrf: 'test' } }));
			await context.route('**/api/admin/teachers?*', r => r.fulfill({ json: { applications: [{ usuario_id: 1, nombre_completo: 'Prueba', email: 'prueba@example.invalid', materia: 'Astronomía', estado: 'pendiente', estudios: [] }], has_more: false } }));
			await context.route('**/api/admin/subjects', r => r.fulfill({ json: { subjects: [{ id: 1, nombre: 'Astronomía', estado: 'pendiente', solicitante: 'Prueba' }] } }));
			const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
			await page.goto('http://localhost/aulify/Frontend/serprofe.html');
			await page.waitForFunction(() => !document.querySelector('#teacher-fields').disabled);
			assert.equal(await page.locator('[name=email_solicitud]').inputValue(), 'prueba@example.invalid');
			assert.equal(await page.locator('[name=materia]').getAttribute('required'), '');
			await page.goto('http://localhost/aulify/Frontend/admin-profesores.html');
			await page.getByRole('button', { name: 'Aceptar materia', exact: true }).waitFor();
			assert((await page.locator('#applications').textContent()).includes('Astronomía'));
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
			assert.deepEqual(errors, []); await context.close(); console.log(width + 'px: formulario y panel de materias OK');
		}
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
