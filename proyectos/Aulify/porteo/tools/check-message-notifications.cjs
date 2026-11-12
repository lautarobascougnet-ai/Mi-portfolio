const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const width of [1440, 320]) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
   let professor = false, multiple = false, read = false;
   const base = { clase_id: 1, profesor_id: 2, alumno_id: 1, materia: 'Matemática', inicio: '2026-12-01 11:00:00', fin: '2026-12-01 12:00:00', modalidad: 'virtual', precio: 15, profesor: 'Lucía', alumno: 'Martín', permite_chat: 1 };
   const reservations = () => ['pendiente','pagada','terminada'].flatMap((state, group) => Array.from({ length: group === 0 ? 9 : 6 }, (_, i) => ({ ...base, id: group * 10 + i + 1, materia: 'Tema ' + (group * 10 + i + 1), estado: state, estado_vista: state, es_profesor: professor, mensajes_sin_leer: state === 'pagada' && !read && (i === 0 || (multiple && i === 1)) ? 2 : 0 })));
   await context.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.split('/api/')[1];
    let data;
    if (path === 'auth/me') data = { user: { id: professor ? 2 : 1, nombre: 'Prueba' } };
    else if (path === 'classes/mine') data = { csrf: 'test', is_professor: professor, scheduled: reservations(), classes: professor ? Array.from({ length: 5 }, (_, i) => ({ id: i + 1, materia: 'Clase ' + i, precio: 15, modalidad: 'virtual', descripcion: 'Clase de prueba', horarios: null })) : [] };
    else if (path === 'classes') data = { classes: [] };
    else if (path === 'bookings/detail') data = { csrf: 'test', user_id: professor ? 2 : 1, booking: { ...reservations().find(r => r.id === 11), chat_activo: true }, messages: Number(url.searchParams.get('after')) ? [] : [{ id: 1, usuario_id: professor ? 1 : 2, texto: 'Hola', creado_en: '2026-10-12 12:00:00' }] };
    else if (path === 'bookings/read') { assert.equal(req.postDataJSON().last_id, 1); assert.equal(req.headers()['x-csrf-token'], 'test'); read = true; data = {}; }
    else return route.fulfill({ status: 404, json: { error: path } });
    return route.fulfill({ json: data });
   });
   const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
   for (const role of [false, true]) {
    professor = role; multiple = false; read = false;
    await page.goto('http://localhost/aulify/Frontend/home.html'); await page.locator('#booking-notifications h2').waitFor();
    assert((await page.locator('#booking-notifications').textContent()).includes(role ? 'Martín' : 'Lucía'));
    assert.equal(await page.locator('#booking-notifications a').getAttribute('href'), 'reserva.html?id=11');
    multiple = true; await page.reload(); await page.locator('#booking-notifications h2').waitFor(); assert((await page.locator('#booking-notifications').textContent()).includes('varios mensajes de 2 reservas'));
    await page.locator('#booking-notifications a').click(); await page.locator('#pages-reserved').waitFor();
    assert.equal(await page.locator('#scheduled-classes article').count(), 4); assert.equal(await page.locator('#paid-classes article').count(), 4); assert.equal(await page.locator('#finished-classes article').count(), 4);
    assert.equal(await page.locator('#paid-classes .unread-messages').count(), 2);
    assert(await page.locator('#paid-classes article').first().evaluate(e => e.querySelector('a').nextElementSibling.classList.contains('unread-messages')));
    await page.locator('#pages-reserved').getByRole('button', { name: 'Página siguiente' }).click();
    assert.equal(await page.locator('#scheduled-classes h3').first().textContent(), 'Tema 5');
    await page.locator('#pages-reserved').getByRole('button', { name: 'Página siguiente' }).click();
    assert.equal(await page.locator('#scheduled-classes article').count(), 1); assert.equal(await page.locator('#paid-classes article').count(), 4);
    await page.locator('#pages-paid').getByRole('button', { name: 'Página siguiente' }).click(); assert.equal(await page.locator('#paid-classes article').count(), 2);
    multiple = false; await page.evaluate(() => loadMyClasses()); assert.equal(await page.locator('#pages-reserved span').textContent(), '3 de 3'); assert.equal(await page.locator('#pages-paid span').textContent(), '2 de 2');
    if (role) { assert.equal(await page.locator('#owned-classes article').count(), 4); await page.locator('#pages-owned').getByRole('button', { name: 'Página siguiente' }).click(); assert.equal(await page.locator('#owned-classes article').count(), 1); }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const reading = page.waitForResponse(r => r.url().endsWith('/bookings/read'));
    await page.goto('http://localhost/aulify/Frontend/reserva.html?id=11'); await page.locator('.message').waitFor(); await reading;
    assert(read); const refreshed = page.waitForResponse(r => r.url().endsWith('/classes/mine')); await page.goto('http://localhost/aulify/Frontend/home.html'); await refreshed; assert.equal(await page.locator('#booking-notifications').isVisible(), false);
   }
   assert.deepEqual(errors, []); await context.close(); console.log(width + 'px: avisos para ambos roles, lectura y paginación independiente OK');
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
