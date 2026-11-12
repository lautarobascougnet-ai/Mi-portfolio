const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const width of [1440, 390]) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
   let role = 1, messages = [], methodUsed = '', state = 'pendiente', chat = true;
   const item = { id: 5, clase_id: 8, profesor_id: 2, alumno_id: 1, materia: 'Matemática', inicio: '2026-12-21 08:30:00', fin: '2026-12-21 09:30:00', precio: '50.00', profesor: 'Profesor Prueba', alumno: 'Alumno Prueba', modalidad: 'presencial', permite_chat: 1 };
   function booking() { return { ...item, estado: state, estado_vista: state, es_profesor: role === 2, puede_cancelar: ['pendiente','aceptada','pagada'].includes(state), devolucion_porcentaje: 50, chat_activo: chat && state === 'pagada', pago_referencia: methodUsed ? 'SIM-5-PRUEBA' : null, pago_metodo: methodUsed, pagado_en: '2026-10-12 12:00:00' }; }
   await context.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.split('/api/')[1], body = req.method() === 'POST' ? req.postDataJSON() : {};
    let data = {};
    if (path === 'auth/me') data = { user: { id: role, nombre: role === 1 ? 'Alumno' : 'Profesor' } };
    else if (path === 'classes/mine') data = { csrf: 'csrf', user_id: role, is_professor: role === 2, classes: [], scheduled: [booking()] };
    else if (path === 'classes') data = { classes: [] };
    else if (path === 'bookings/detail') data = { csrf: 'csrf', user_id: role, booking: booking(), messages: state === 'pagada' && chat ? messages.filter(m => m.id > Number(url.searchParams.get('after'))) : [] };
    else if (path.startsWith('bookings/')) {
     assert.equal(req.headers()['x-csrf-token'], 'csrf');
     if (path === 'bookings/accept') { assert.equal(role, 2); state = 'aceptada'; }
     else if (path === 'bookings/pay') { assert.equal(role, 1); assert.equal(state, 'aceptada'); state = 'pagada'; methodUsed = body.metodo; data = { message: 'Pago simulado realizado. No se movió dinero.' }; }
     else if (path === 'bookings/message') messages.push({ id: messages.length + 1, usuario_id: role, texto: body.texto, creado_en: '2026-10-12 12:00:00' });
     else if (path === 'bookings/cancel') state = 'cancelada';
    } else return route.fulfill({ status: 404, json: { error: 'Sin simulación para ' + path } });
    return route.fulfill({ json: data });
   });
   const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
   await page.goto('http://localhost/aulify/Frontend/reserva.html?id=5'); await page.locator('#reservation-detail').waitFor();
   assert.equal(await page.locator('#payment').isVisible(), false); assert.equal(await page.locator('#reservation-chat').isVisible(), false);
   role = 2; await page.reload(); await page.getByRole('button', { name: 'Aceptar reserva', exact: true }).click();
   await page.waitForFunction(() => document.querySelector('#reservation-status').textContent.includes('aceptó'));
   role = 1; await page.goto('http://localhost/aulify/Frontend/home.html'); await page.locator('#booking-notifications a').waitFor();
   assert((await page.locator('#booking-notifications').textContent()).includes('aceptó'));
   await page.locator('#booking-notifications a').click(); await page.locator('#demo-qr canvas').waitFor();
   assert.equal(await page.locator('#demo-qr canvas').evaluate(e => e.width > 0), true);
   await page.locator('#demo-qr').click(); await page.locator('#confirm-payment').click(); await page.locator('#receipt').waitFor();
   assert.equal(methodUsed, 'qr'); assert((await page.locator('#receipt').textContent()).includes('SIMULADO')); assert.equal(await page.locator('#payment').isVisible(), false);
   await page.locator('#message-input').fill('<script>Hola profe</script>'); await page.getByRole('button', { name: 'Enviar mensaje' }).click(); await page.locator('.message').waitFor();
   assert.equal(await page.locator('#messages script').count(), 0);
   role = 2; await page.goto('http://localhost/aulify/Frontend/misclases.html'); await page.locator('#paid-classes article').waitFor(); assert.equal(await page.locator('#booking-board.teacher > section').count(), 4);
   await page.locator('#paid-classes a').click(); await page.locator('.message').waitFor();
   await page.locator('#message-input').fill('Nos vemos en clase'); await page.getByRole('button', { name: 'Enviar mensaje' }).click(); await page.waitForFunction(() => document.querySelectorAll('.message').length === 2);
   for (const method of ['transferencia','efectivo']) {
    role = 1; state = 'aceptada'; methodUsed = ''; messages = []; await page.reload(); await page.locator('#payment').waitFor();
    await page.locator('#payment-method').selectOption(method); await page.locator('#open-payment').click(); await page.locator('#confirm-payment').click(); await page.locator('#receipt').waitFor(); assert.equal(methodUsed, method);
   }
   chat = false; await page.reload(); await page.locator('#reservation-detail').waitFor(); assert.equal(await page.locator('#reservation-chat').isVisible(), false);
   state = 'terminada'; await page.goto('http://localhost/aulify/Frontend/misclases.html'); await page.locator('#finished-classes article').waitFor(); assert.equal(await page.locator('#teacher-classes').isVisible(), false);
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Sin desborde ' + width);
   assert.deepEqual(errors, []); await context.close(); console.log('Aceptación, aviso, QR, transferencia, efectivo, comprobante y chat: ' + width + 'px OK');
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
