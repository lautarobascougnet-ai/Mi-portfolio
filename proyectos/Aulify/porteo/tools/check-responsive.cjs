// Pruebas de layout con datos ficticios: no crean cuentas ni sesiones de Didit.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const base = 'http://localhost/aulify/Frontend/';
const sizes = [[320,740], [360,800], [390,844], [844,390], [768,1024], [1024,768], [1366,768], [1920,1080], [2560,1440], [3840,2160]];
const pages = ['Index.html', 'login.html', 'registro.html', 'home.html', 'user.html', 'serprofe.html', 'verificacion.html'];

async function checkLayout(page, label) {
	const problems = await page.evaluate(() => {
		const problems = [];
		if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('desborde horizontal');
		for (const element of document.querySelectorAll('header a, header button, main input, main select, main button, footer')) {
			const box = element.getBoundingClientRect();
			if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden') continue;
			if (box.left < -1 || box.right > innerWidth + 1) problems.push('fuera de pantalla: ' + (element.id || element.tagName));
		}
		const footer = document.querySelector('footer');
		if (footer) {
			const box = footer.getBoundingClientRect();
			const paragraphs = [...footer.querySelectorAll('p')].map(p => p.getBoundingClientRect()).filter(r => r.width && r.height);
			for (let i = 1; i < paragraphs.length; i++) if (paragraphs[i].top < paragraphs[i - 1].bottom) problems.push('textos del footer superpuestos');
			if (getComputedStyle(footer).position !== 'static') problems.push('footer fuera del flujo');
			for (const element of footer.querySelectorAll('a, button, span')) {
				const child = element.getBoundingClientRect();
				if (child.width && child.height && (child.bottom > box.bottom + 1 || child.top < box.top - 1)) problems.push('contenido fuera del footer');
			}
			// El footer queda después del contenido, dentro del flujo normal.
			const previousY = scrollY;
			scrollTo(0, document.documentElement.scrollHeight);
			const main = document.querySelector('main');
			if (main && main.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1) problems.push('final del contenido tapado');
			scrollTo(0, previousY);
		}
		return problems;
	});
	assert.deepEqual(problems, [], label);
}

(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	const output = path.resolve(__dirname, '../logs/responsive');
	fs.mkdirSync(output, { recursive: true });
	try {
		const context = await browser.newContext({ serviceWorkers: 'block' });
		await context.route('**/api/auth/me', route => route.fulfill({ json: { user: {
			id: 1, nombre: 'Prueba', apellido: 'Pantalla', username: 'Prueba',
			email: 'correo.largo.para.comprobar.el.perfil@example.invalid', rating: 5,
			experiencia: 'Experiencia de prueba', descripcion: 'Descripción de prueba',
		} } }));
		await context.route('**/api/identity/config', route => route.fulfill({ json: { enabled: true, environment: 'sandbox', csrf: 'prueba' } }));
		await context.route('**/api/teacher/application', route => route.fulfill({ json: { application: null, csrf: 'prueba' } }));
		const page = await context.newPage();
		for (const [width, height] of sizes) {
			await page.setViewportSize({ width, height });
			for (const file of pages) {
				await page.goto(base + file, { waitUntil: 'domcontentloaded' });
				await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(98, 103, 128)');
				await page.evaluate(() => document.fonts.ready);
				if (file === 'serprofe.html') await page.waitForFunction(() => !document.querySelector('#teacher-fields').disabled);
				assert(new URL(page.url()).pathname.endsWith('/' + file), 'Se mantiene la página que se está probando');
				// Escala compacta solo en escritorio; celular/tablet mantienen su tamaño.
				const expectedSize = width >= 1024 ? 13 : 16;
				assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)), expectedSize, `Escala ${file} ${width}px`);
				await checkLayout(page, `${file} ${width}x${height}`);
				if (file === 'home.html') {
					const type = await page.evaluate(() => {
						const card = document.querySelector('.subject-card');
						return [parseFloat(getComputedStyle(card.querySelector('h2')).fontSize), parseFloat(getComputedStyle(card.querySelector('p')).fontSize)];
					});
					assert(type[0] > type[1], 'Título con mayor jerarquía');
					assert(type[1] >= expectedSize * .75 + 2, 'Descripción aumenta al menos 2 px');
				}
				if (file === 'user.html') {
					await page.locator('#edit-profile-button').click();
					await checkLayout(page, `editor ${width}x${height}`);
					await page.locator('#close-editor').click();
				}
				if ([390, 1920, 3840].includes(width) && ['Index.html','home.html','user.html'].includes(file)) {
					await page.screenshot({ path: path.join(output, `${file}-${width}.png`) });
				}
			}
			console.log(`${width}x${height}: 7 páginas y editor sin desbordes; footer al final del contenido.`);
		}
		await context.close();
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
