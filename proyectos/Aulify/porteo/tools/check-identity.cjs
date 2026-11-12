const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const decodeQR = require('jsqr');
const base = 'http://localhost/aulify/';
const ticket = 'a'.repeat(64);
const formValues = { nombre: 'Prueba', apellido: 'Local', email: 'qa@example.invalid', dni: '12345678', password: 'Prueba123!', password_confirm: 'Prueba123!' };

async function fill(page) {
	for (const [name, value] of Object.entries(formValues)) await page.locator('[name="' + name + '"]').fill(value);
	await page.locator('[name=consent]').check();
}

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		// Comprobaciones contra PHP real: ningún POST de registro válido ni llamadas a Didit.
		const actual = await browser.newContext();
		for (const endpoint of ['api/auth/register', 'registro.php']) {
			const response = await actual.request.post(base + 'Backend/conexiones/' + endpoint, { data: {} });
			assert.equal(response.status(), 403);
			assert.equal((await response.json()).code, 'IDENTITY_REQUIRED');
		}
		const csrf = await actual.request.post(base + 'Backend/conexiones/api/identity/start', { data: {} });
		assert.equal(csrf.status(), 403);
		for (const filename of ['config.local.php', 'schema.sql', 'tests.php']) {
			assert.equal((await actual.request.get(base + 'Backend/conexiones/identidad/' + filename)).status(), 403);
		}
		const config = await actual.request.get(base + 'Backend/conexiones/api/identity/config', { headers: { Origin: 'https://other.example' } });
		assert.equal(config.headers()['access-control-allow-origin'], undefined);
		assert.equal(config.headers()['cache-control'], 'no-store');
		assert(!JSON.stringify(await config.json()).includes('api_key'));
		await actual.close();
		console.log('PHP real: rutas antiguas bloqueadas, CSRF, archivos privados y ausencia de CORS abierto correctos.');

		for (const device of [null, 'Pixel 7']) {
			const context = await browser.newContext(device ? { ...devices[device], serviceWorkers: 'block' } : { serviceWorkers: 'block' });
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', (error) => errors.push(error.message));
			let state = 'pending', enabled = true, launches = 0, starts = 0, expired = false;
			await page.route('**/api/identity/**', async (route) => {
				const action = new URL(route.request().url()).pathname.split('/').pop();
				const data = route.request().postDataJSON();
				if (expired && action !== 'config') return route.fulfill({ status: 410, contentType: 'application/json', body: JSON.stringify({ code: 'EXPIRED_TICKET', error: 'El enlace venció.' }) });
				let response;
				if (action === 'config') response = { enabled, csrf: 'test-csrf', environment: 'sandbox' };
				else {
					assert.equal(route.request().headers()['x-csrf-token'], 'test-csrf');
					if (action === 'start') { starts++; assert.equal(data.consent, true); response = { ticket, environment: 'sandbox' }; }
					if (action === 'context') response = { state, started: launches > 0, environment: 'sandbox', account: { name: '<b>Prueba Local</b>', email: 'qa@example.invalid', dni_ending: '5678' } };
					if (action === 'status') response = { state };
					if (action === 'cancel') { state = 'cancelled'; response = { state }; }
					if (action === 'launch') { launches++; response = { url: 'https://verify.didit.me/es/session/MockOnly123' }; }
				}
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
			});
			// No accede a Didit: sustituye la página externa por una pantalla de prueba.
			await page.route('https://verify.didit.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Proveedor simulado</h1>' }));
			await page.goto(base + 'Frontend/registro.html');
			assert(await page.locator('#register-form').isVisible());
			assert(!await page.locator('#verification-step').isVisible());
			await page.locator('#submit-button').click();
			assert.equal(starts, 0);
			await fill(page);
			await page.locator('[name=password_confirm]').fill('Diferente123!');
			await page.locator('#submit-button').click();
			assert.match(await page.locator('#feedback').textContent(), /no coinciden/);
			await page.locator('[name=password_confirm]').fill(formValues.password);
			await page.locator('#submit-button').click();
			if (!device) {
				await page.locator('#identity-qr').waitFor({ state: 'visible' });
				const raw = await page.locator('#identity-qr').evaluate((canvas) => ({ width: canvas.width, height: canvas.height, data: Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data) }));
				assert.equal(decodeQR(new Uint8ClampedArray(raw.data), raw.width, raw.height).data, 'aulify://verification?ticket=' + ticket);
				assert.equal(await page.locator('[name=password]').inputValue(), '');
				await page.locator('#back-to-registration').click();
				await page.locator('#register-form').waitFor({ state: 'visible' });
				assert.equal(await page.locator('[name=nombre]').inputValue(), 'Prueba');
				await page.evaluate((value) => sessionStorage.setItem('aulify.identity.ticket', value), ticket);
				expired = true;
				await page.reload();
				await page.locator('#back-to-registration').click();
				await page.locator('#register-form').waitFor({ state: 'visible' });
				assert.equal(await page.evaluate(() => sessionStorage.getItem('aulify.identity.ticket')), null);
				console.log('Escritorio simulado: formulario, validaciones, QR decodificado y cancelación correctos.');
			} else {
				await page.waitForURL('**/verificacion.html');
				await page.locator('#capture-step').waitFor({ state: 'visible' });
				assert.equal(await page.locator('#account-summary b').count(), 0);
				await page.locator('#start-verification').click();
				assert.equal(launches, 0);
				await page.locator('#identity-consent').check();
				await page.locator('#start-verification').click();
				await page.waitForURL('https://verify.didit.me/**');
				// Un callback falsificado no convierte "pending" en "completed".
				await page.goto(base + 'Frontend/verificacion.html?status=Approved&verificationSessionId=forged');
				await page.locator('#check-verification').waitFor({ state: 'visible' });
				assert(!await page.locator('#go-login').isVisible());
				assert(!page.url().includes('status='));
				state = 'completed';
				await page.locator('#check-verification').click();
				await page.waitForURL('**/login.html?registro=ok');
				assert.equal(await page.evaluate(() => sessionStorage.getItem('aulify.identity.ticket')), null);
				expired = true;
				await page.goto(base + 'Frontend/verificacion.html#ticket=' + ticket);
				await page.waitForFunction(() => document.querySelector('#verification-status').textContent.includes('venció'));
				assert.equal(await page.evaluate(() => sessionStorage.getItem('aulify.identity.ticket')), null);
				await page.goto(base + 'Frontend/registro.html');
				assert(await page.locator('#register-form').isVisible());
				console.log('Celular simulado: consentimiento, ida y vuelta, callback falsificado ignorado y resultado confirmado por API.');
			}
			assert.deepEqual(errors, []);
			await context.close();
		}
		const off = await browser.newContext();
		const page = await off.newPage();
		let sent = false;
		await page.route('**/api/identity/**', (route) => {
			if (route.request().method() === 'POST') sent = true;
			return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: false, csrf: 'test' }) });
		});
		await page.goto(base + 'Frontend/registro.html');
		await fill(page);
		await page.locator('#submit-button').click();
		await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Falta configurar'));
		assert.equal(sent, false);
		await off.close();
		console.log('Sin configuración: no se envían datos del formulario. Pruebas sin biometría real.');
	} finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
