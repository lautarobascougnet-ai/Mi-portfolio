// Simula dos navegadores independientes; las decisiones reales se prueban con tablas temporales PHP.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const base = 'http://localhost/aulify/Frontend/';

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const options of [{ viewport: { width: 1920, height: 1080 } }, devices['Pixel 7']]) {
			const applicant = await browser.newContext({ ...options, serviceWorkers: 'block' });
			const reviewer = await browser.newContext({ ...options, serviceWorkers: 'block' });
			let state = 'pendiente', admin = false, reason = '', savedProfile = null;
			const row = () => ({ usuario_id: 101, nombre_completo: 'Docente <prueba>', nombre_usuario: 'test', email: 'test@example.invalid', experiencia: 'Experiencia de prueba', descripcion: 'Descripción de prueba', motivacion: 'Enseñar y ayudar', estudios: ['secundaria'], estado: state, revision_motivo: reason });
			await applicant.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 101, nombre: 'Docente', apellido: 'Prueba', email: 'test@example.invalid', rating: null, experiencia: 'Experiencia docente', titulos: 'Título de prueba', descripcion: 'Descripción de prueba', is_professor: state === 'aprobada' } } }));
			await applicant.route('**/api/teacher/application', route => route.fulfill({ json: { application: row(), csrf: 'teacher' } }));
			await applicant.route('**/api/user/profile', route => {
				savedProfile = route.request().postDataJSON();
				assert(!('rating' in savedProfile)); assert(!('is_professor' in savedProfile));
				if (state !== 'aprobada') assert(!('experiencia' in savedProfile));
				return route.fulfill({ json: { user: { ...savedProfile, id: 101, rating: null, is_professor: state === 'aprobada' } } });
			});
			await reviewer.route('**/api/admin/**', route => {
				const action = new URL(route.request().url()).pathname.split('/').pop();
				const data = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
				if (action === 'session') return route.fulfill({ json: { authenticated: admin, csrf: 'admin-token' } });
				if (action === 'login') { assert.equal(data.username, 'admin'); admin = true; return route.fulfill({ json: { authenticated: true } }); }
				if (action === 'logout') { admin = false; return route.fulfill({ json: { authenticated: false } }); }
				if (!admin) return route.fulfill({ status: 403, json: { error: 'No autorizado' } });
				if (action === 'teachers') return route.fulfill({ json: { applications: [row()], has_more: false } });
				if (action === 'teacher-review') { assert.equal(route.request().headers()['x-csrf-token'], 'admin-token'); state = data.estado; reason = data.motivo; return route.fulfill({ json: { message: 'Revisión guardada.' } }); }
				return route.abort();
			});
			const student = await applicant.newPage();
			await student.goto(base + 'user.html');
			await student.waitForFunction(() => document.querySelector('#profile-name').textContent.includes('Docente'));
			assert.equal(await student.locator('#profile-role').textContent(), 'Alumno');
			assert.equal(await student.locator('[data-teacher-only]:visible').count(), 0);
			await student.locator('#edit-profile-button').click();
			assert(!await student.locator('#experience').isVisible());
			assert.equal(await student.locator('#rating').count(), 0);
			await student.locator('#save-profile-button').click();
			await student.waitForFunction(() => document.querySelector('#feedback').textContent.includes('actualizado'));
			assert(savedProfile.nombre && savedProfile.apellido);
			await student.goto(base + 'serprofe.html');
			await student.locator('#teacher-wait').waitFor({ state: 'visible' });
			assert(!await student.locator('#teacher-continue').isVisible());
			const panel = await reviewer.newPage();
			panel.on('dialog', dialog => dialog.accept());
			await panel.goto(base + 'admin-profesores.html');
			await panel.locator('[name=username]').fill('admin');
			await panel.locator('[name=password]').fill('solo-prueba');
			await panel.locator('#admin-enter').click();
			await panel.locator('#applications article').waitFor();
			assert.equal(await panel.locator('#applications prueba').count(), 0);
			await panel.locator('#applications textarea').fill('Bienvenido al equipo');
			await panel.getByRole('button', { name: 'Aceptar profesor' }).click();
			await student.bringToFront();
			// Se actualiza sin recargar: por foco/visibilidad o la consulta de 6 segundos.
			await student.locator('#teacher-continue').waitFor({ state: 'visible', timeout: 15000 });
			assert((await student.locator('#review-reason').textContent()).includes('Bienvenido'));
			await student.locator('#teacher-continue').click();
			await student.waitForURL('**/user.html');
			await student.waitForFunction(() => document.querySelector('#profile-role').textContent === 'Profesor');
			assert.equal(await student.locator('section[data-teacher-only]:visible').count(), 2);
			await student.locator('#edit-profile-button').click();
			assert(await student.locator('#experience').isVisible());
			assert.equal(await student.locator('#rating').count(), 0);
			// Otra solicitud pendiente, ahora rechazada.
			state = 'pendiente';
			await panel.locator('#admin-refresh').click();
			await panel.getByRole('button', { name: 'Denegar solicitud' }).waitFor();
			await panel.locator('#applications textarea').fill('Falta documentación');
			await panel.getByRole('button', { name: 'Denegar solicitud' }).click();
			await student.goto(base + 'serprofe.html');
			await student.waitForFunction(() => document.querySelector('#review-title').textContent.includes('no fue aprobada'));
			assert(!await student.locator('#teacher-continue').isVisible());
			await panel.locator('#admin-logout').click();
			await panel.locator('#admin-access').waitFor({ state: 'visible' });
			assert.equal(await panel.locator('#applications article').count(), 0);
			console.log((options.isMobile ? 'Móvil' : 'PC') + ': alumno básico, panel privado, aprobación/rechazo, espera automática y perfil profesor correctos.');
			await applicant.close(); await reviewer.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
