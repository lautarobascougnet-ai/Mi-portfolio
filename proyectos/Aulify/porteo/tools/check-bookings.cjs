// Reserva, perfil y cancelación en UI; los datos de este test son simulados.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		for (const options of [{ viewport: { width: 1440, height: 900 } }, devices['Pixel 7'], { viewport: { width: 320, height: 740 } }]) {
			const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
			let reserved = false, first = true;
			const item = { id: 10, profesor_id: 2, materia: 'Clase real', profesor: 'Profesor Prueba', descripcion: 'Descripción segura <script>error</script>', precio: '15.00', modalidad: 'virtual', rating: null, foto_perfil: null, horarios: '{}' };
			await context.route('**/api/**', route => {
				const url = new URL(route.request().url()); const path = url.pathname.split('/api/')[1];
				const data = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
				if (path === 'auth/me') return route.fulfill({ json: { user: { id: 1, nombre: 'Alumno', apellido: 'Prueba' } } });
				if (path === 'classes') return route.fulfill({ json: { classes: [item] } });
				if (path === 'classes/detail') return route.fulfill({ json: { class: item } });
				if (path === 'teachers/profile') return route.fulfill({ json: { teacher: { id: 2, nombre: 'Profesor', apellido: 'Prueba', experiencia: 'Experiencia', descripcion: 'Descripción profesional', titulos: 'Título', rating: null }, classes: [item] } });
				if (path === 'classes/availability') return route.fulfill({ json: { csrf: 'booking-token', own_class: false, slots: [{ inicio: url.searchParams.get('date') + ' 10:00:00', fin: url.searchParams.get('date') + ' 11:00:00', hora: '10:00', available: first }, { inicio: url.searchParams.get('date') + ' 11:30:00', fin: url.searchParams.get('date') + ' 12:30:00', hora: '11:30', available: true }] } });
				if (path === 'bookings') {
					assert.equal(route.request().headers()['x-csrf-token'], 'booking-token'); assert.equal(data.class_id, 10);
					if (first) { first = false; return route.fulfill({ status: 409, json: { error: 'Horario tomado. Elegí otro.' } }); }
					reserved = true; return route.fulfill({ status: 201, json: { id: 1 } });
				}
				if (path === 'classes/mine') return route.fulfill({ json: { csrf: 'booking-token', is_professor: false, classes: [], scheduled: reserved ? [{ id: 1, clase_id: 10, materia: item.materia, profesor: 'Profesor Prueba', alumno: 'Alumno Prueba', inicio: '2026-12-01 11:00:00' }] : [] } });
				if (path === 'bookings/cancel') { assert.equal(data.id, 1); assert.equal(route.request().headers()['x-csrf-token'], 'booking-token'); reserved = false; return route.fulfill({ json: { message: 'Cancelada' } }); }
				if (path === 'bookings/detail') return route.fulfill({ json: { csrf: 'booking-token', user_id: 1, messages: [], booking: { id: 1, materia: item.materia, profesor: 'Profesor Prueba', alumno: 'Alumno Prueba', inicio: '2026-12-01 11:30:00', modalidad: 'virtual', precio: 15, estado: reserved ? 'pendiente' : 'cancelada', estado_vista: reserved ? 'pendiente' : 'cancelada', puede_cancelar: reserved, es_profesor: false, chat_activo: false } } });
				return route.fulfill({ status: 404, json: { error: 'Ruta no simulada' } });
			});
			const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
			await page.goto('http://localhost/aulify/Frontend/home.html');
			await page.locator('[data-class-id="10"]').waitFor();
			assert.equal(await page.locator('.teacher-card').count(), 1, 'Solo clase real, sin demos');
			assert.equal(await page.locator('#subject-filter option').count(), 11, 'Nueve materias populares y la materia nueva');
			assert.equal(await page.locator('.subject-card').count(), 9, 'Materias populares permanentes');
			await page.locator('[data-class-id="10"]').getByRole('button', { name: 'Ver perfil' }).click();
			await page.locator('#public-profile').waitFor();
			assert.equal(await page.locator('#teacher-name').textContent(), 'Profesor Prueba');
			await page.getByRole('link', { name: 'Ver horarios y agendar' }).click();
			await page.locator('#booking-slots [data-time="10:00"]').click();
			assert.equal(await page.locator('#booking-slots button').count(), 24, 'Grilla del día completo');
			assert.equal(await page.locator('#booking-slots [data-time="00:00"]').isDisabled(), true);
			assert.equal(await page.locator('#booking-slots [data-time="10:00"]').getAttribute('aria-pressed'), 'true');
			await page.waitForFunction(() => getComputedStyle(document.querySelector('#booking-slots [aria-pressed="true"]')).backgroundColor === 'rgb(200, 223, 243)');
			await page.locator('#booking-next').click();
			await page.locator('#booking-calendar button:not([disabled])').first().click();
			await page.waitForFunction(() => document.querySelector('#booking-slots [data-time="10:00"]'));
			assert.equal(await page.locator('#confirm-booking').isDisabled(), true, 'Cambiar fecha borra selección');
			await page.locator('#booking-slots [data-time="10:00"]').click();
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horario sin desborde');
			await page.screenshot({ path: 'porteo/logs/booking-layout-' + options.viewport.width + '.png', fullPage: true });
			await page.locator('#confirm-booking').click();
			await page.waitForFunction(() => document.querySelector('#booking-slots [data-time="10:00"]')?.disabled);
			assert((await page.locator('#booking-feedback').textContent()).includes('tomado'));
			await page.locator('#booking-slots [data-time="11:30"]').click();
			assert((await page.locator('#booking-selection').textContent()).includes('11:30'), 'Conserva minutos reales');
			await page.locator('#confirm-booking').click();
			await page.waitForURL('**/reserva.html?id=1');
			await page.locator('#reservation-detail').waitFor();
			assert.equal(await page.locator('#payment').isVisible(), false);
			await page.getByRole('button', { name: 'Cancelar reserva' }).click();
			await page.waitForFunction(() => document.querySelector('#reservation-status').textContent.includes('cancelada'));
			assert.equal(reserved, false);
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
			assert.deepEqual(errors, []);
			console.log(`${options.viewport.width}px: catálogo real, perfil, reserva, conflicto, agenda y cancelación OK.`);
			await context.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
