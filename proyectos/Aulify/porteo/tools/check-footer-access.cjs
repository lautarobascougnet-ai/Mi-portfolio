// Navegación y sesión simuladas: no modifica usuarios ni clases reales.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		const context = await browser.newContext({ serviceWorkers: 'block' });
		let mode = 'unauthorized';
		await context.route('**/api/auth/me', route => route.fulfill({ status: mode === 'unauthorized' ? 401 : 200, json: mode === 'valid' ? { user: { id: 2, nombre: 'Prueba' } } : {} }));
		const page = await context.newPage();
		const base = 'http://localhost/aulify/Frontend/';
		for (const state of ['unauthorized', 'invalid']) {
			mode = state;
			await page.goto(base + 'home.html');
			await page.waitForURL('**/login.html');
		}
		mode = 'valid';
		await page.goto(base + 'home.html');
		await page.waitForFunction(() => !document.body.hidden);
		assert(page.url().endsWith('home.html'));
		for (const file of ['Index.html', 'login.html', 'registro.html']) {
			await page.goto(base + file);
			const footer = page.locator('footer');
			assert.equal(await footer.locator('button').count(), 0);
			assert.equal(await footer.locator('a[href="mailto:aulify@soporte.com"]').count(), 1);
			assert(!/Términos de uso|Política de privacidad|Comunidad/.test(await footer.textContent()));
			await footer.getByRole('link', { name: 'Mis clases', exact: true }).click();
			await page.waitForURL('**/login.html');
		}
		console.log('OK: footer público, acceso sin sesión, respuesta inválida y sesión válida.');
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
