// Comprueba todos los HTML sin escribir datos ni iniciar sesiones reales.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
	const browser = await chromium.launch({ channel: 'msedge', headless: true });
	try {
		const context = await browser.newContext({ serviceWorkers: 'block' });
		await context.route('**/api/**', route => route.fulfill({ json: {
			user: { id: 1, nombre: 'Prueba', apellido: 'Footer', email: 'test@example.invalid' },
			csrf: 'test', authenticated: false, application: null, is_professor: true,
			classes: [], scheduled: [], subjects: [], folders: [], notes: [], applications: [],
		} }));
		const page = await context.newPage();
		const files = fs.readdirSync('Frontend').filter(f => f.endsWith('.html'));
		for (const [width, height] of [[320,740],[844,390],[1366,768],[3840,2160]]) {
			await page.setViewportSize({ width, height });
			for (const file of files) {
				await page.goto('http://localhost/aulify/Frontend/' + file, { waitUntil: 'domcontentloaded' });
				await page.waitForFunction(() => !document.body.hidden && getComputedStyle(document.querySelector('footer')).position === 'static');
				assert(page.url().includes(file), 'Verifica la página correcta: ' + file);
				const errors = await page.evaluate(() => {
					const errors = [], footer = document.querySelector('footer'), box = footer.getBoundingClientRect();
					if (document.documentElement.scrollWidth>innerWidth+1) errors.push('Desborde horizontal');
					if (box.bottom < innerHeight-1) errors.push('Footer demasiado arriba en página corta');
					const main = document.querySelector('main');
					if (main && main.getBoundingClientRect().bottom>box.top+1) errors.push('Footer antes del final del contenido');
					for (const p of footer.querySelectorAll('p,a')) {
						const r = p.getBoundingClientRect();
						if (r.width && r.height && (r.bottom>box.bottom+1 || r.top<box.top-1 || r.right>innerWidth+1 || r.left<0)) errors.push('Texto fuera del footer');
					}
					scrollTo(0,document.documentElement.scrollHeight);
					if (Math.abs(footer.getBoundingClientRect().bottom-innerHeight)>1) errors.push('No se alcanza el footer al bajar');
					// En páginas largas no debe seguir visible al volver al principio.
					const spacer = document.createElement('div'); spacer.style.height = '200vh';
					(main || footer.parentElement).insertBefore(spacer, main ? null : footer);
					scrollTo(0,0);
					if (footer.getBoundingClientRect().top<innerHeight) errors.push('Footer flotante sobre contenido largo');
					spacer.remove();
					return errors;
				});
				assert.deepEqual(errors, [], file + ' ' + width + 'x' + height);
			}
			console.log(`${files.length} footers correctos: ${width}x${height}`);
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
