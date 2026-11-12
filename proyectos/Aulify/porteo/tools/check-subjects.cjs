// Materias derivadas de clases reales; API simulada, sin datos de demostración en la página.
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const options of [{ viewport: { width: 1440, height: 900 } }, devices['Pixel 7']]) {
   const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
   const classes = [{ id: 1, profesor_id: 2, materia: 'Inglés', profesor: 'Docente', precio: 20, rating: 4, modalidad: 'virtual', descripcion: 'Clase de idiomas' }, { id: 2, profesor_id: 2, materia: 'Clash Royale', profesor: 'Docente', precio: 75, rating: 4, modalidad: 'virtual', descripcion: 'Clase de estrategia' }];
   await context.route('**/api/auth/me', r => r.fulfill({ json: { user: { id: 1, nombre: 'Alumno' } } }));
   await context.route('**/api/classes', r => r.fulfill({ json: { classes } }));
   const page = await context.newPage();
   await page.goto('http://localhost/aulify/Frontend/home.html');
   await page.locator('[data-class-id="2"]').waitFor();
   assert.equal(await page.locator('.teacher-card').count(), 2);
   assert.equal(await page.locator('.subject-card').count(), 9);
   assert.equal(await page.locator('#subject-filter option').count(), 11);
   for (const subject of ['ingles']) {
    await page.locator('#search-filter').fill('sin coincidencias');
    await page.locator('.subject-card[data-subject="' + subject + '"]').click();
    assert.equal(await page.locator('#subject-filter').inputValue(), subject);
    assert.equal(await page.locator('.teacher-card:visible').count(), 1);
    assert.equal(await page.locator('#search-filter').inputValue(), '');
    assert.equal(await page.locator('#price-filter').inputValue(), '75');
   }
   await page.locator('.subject-card[data-subject="dibujo"]').click();
   assert.equal(await page.locator('.teacher-card:visible').count(), 0, 'Materia sin clases queda vacía');
   assert.equal(await page.locator('#empty-state').isVisible(), true);
   await page.locator('#subject-filter').selectOption('clash royale');
   await page.reload(); await page.locator('[data-class-id="2"]').waitFor();
   assert.equal(await page.locator('#subject-filter').inputValue(), 'clash royale');
   await page.goBack();
   await page.waitForFunction(() => document.querySelector('#subject-filter').value === 'ingles');
   await page.locator('#clear-filters').click();
   assert.equal(await page.locator('.teacher-card:visible').count(), 2);
   assert.equal(await page.locator('#result-count').textContent(), '2');
   await page.locator('.rating-option[data-value="5"]').click();
   assert.equal(await page.locator('.teacher-card:visible').count(), 0);
   await page.locator('.rating-option[data-value="5"]').click();
   assert.equal(await page.locator('#rating-label').textContent(), 'Todas');
   assert.equal(await page.locator('.teacher-card:visible').count(), 2);
   await page.locator('#subject-filter').selectOption('ingles');
   await page.locator('.rating-option[data-value="3"]').click();
   await page.locator('#search-filter').fill('no coincide');
   await page.locator('input[name="mode"][value="presencial"]').check();
   await page.locator('#sort-filter').selectOption('price');
   await page.locator('#price-filter').evaluate(input => { input.value = 0; input.dispatchEvent(new Event('input')); });
   await page.getByRole('button', { name: 'Restablecer filtros' }).click();
   assert.equal(await page.locator('#rating-label').textContent(), 'Todas');
   assert.equal(await page.locator('.rating-option[aria-pressed="true"]').count(), 0);
   assert.equal(await page.locator('#search-filter').inputValue(), '');
   assert.equal(await page.locator('#subject-filter').inputValue(), '');
   assert.equal(await page.locator('#sort-filter').inputValue(), 'rating');
   assert.equal(await page.locator('#price-filter').inputValue(), '75');
   assert.equal(await page.locator('input[name="mode"]:checked').inputValue(), '');
   assert.equal(await page.locator('.teacher-card:visible').count(), 2);
   assert(!new URL(page.url()).searchParams.has('materia'));
   console.log(options.viewport.width + 'px: materias reales, filtros, recarga e historial OK.');
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
