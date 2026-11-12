const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      let folders = [], notes = [], id = 0, failSave = false;
      await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname.split('/api/')[1];
        const data = req.method() === 'POST' ? req.postDataJSON() : {};
        let result = {};
        if (path === 'auth/me') result = { user: { id: 1, nombre: 'Prueba' } };
        else if (path === 'notes') {
          if (url.searchParams.has('id')) result = { note: notes.find(n => n.id === Number(url.searchParams.get('id'))) };
          else {
            const folder = url.searchParams.has('folder') ? Number(url.searchParams.get('folder')) : null;
            const all = folder === null ? folders : notes.filter(n => n.carpeta_id === folder);
            const size = folder === null ? 4 : 12, pages = Math.max(1, Math.ceil(all.length / size)), page = Math.min(pages, Number(url.searchParams.get('page') || 1));
            result = { items: [...all].reverse().slice((page - 1) * size, page * size), folder: folders.find(f => f.id === folder), page, pages, total: all.length, csrf: 'notes-token' };
          }
        } else {
          assert.equal(req.headers()['x-csrf-token'], 'notes-token');
          if (path === 'notes/folder-save') { if (data.id) Object.assign(folders.find(f => f.id === data.id), data); else folders.push({ ...data, id: ++id, cantidad: 0 }); }
          else if (path === 'notes/save') {
            if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { error: 'Conexión interrumpida.' } }); }
            result = { id: data.id || ++id, version: (data.version || 0) + 1 };
            if (data.id) Object.assign(notes.find(n => n.id === data.id), data, result); else notes.push({ ...data, ...result });
          } else if (path === 'notes/delete') notes = notes.filter(n => n.id !== data.id);
          else if (path === 'notes/folder-delete') { folders = folders.filter(f => f.id !== data.id); notes = notes.filter(n => n.carpeta_id !== data.id); }
          else return route.fulfill({ status: 404, json: { error: 'No simulado' } });
        }
        return route.fulfill({ json: result });
      });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost/aulify/Frontend/apuntes.html');
      await page.locator('#create-folder').waitFor();
      for (let i = 1; i <= 5; i++) {
        await page.locator('#create-folder').click(); await page.locator('#folder-input').fill('Matemática ' + i);
        await page.locator('#folder-detail').fill('Temas de clase'); await page.getByRole('button', { name: 'Guardar carpeta', exact: true }).click();
        await page.waitForFunction(n => document.querySelector('#feedback').textContent.startsWith(n + ' carpetas'), i);
      }
      assert.equal(await page.locator('.card').count(), 4);
      await page.getByRole('button', { name: 'Página siguiente' }).click(); await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
      await page.getByRole('button', { name: 'Ver →', exact: true }).click(); await page.locator('#create-note').click();
      await page.locator('#note-name').fill('Álgebra <script>alert(1)</script>'); await page.locator('#note-description').fill('Ecuaciones');
      const content = 'Fórmulas, ñ y ejercicios\n'.repeat(500); await page.locator('#note-content').fill(content);
      await page.locator('#save-note').click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Todos los cambios'));
      await page.locator('#close-editor').click(); await page.getByRole('button', { name: 'Abrir →', exact: true }).click();
      assert.equal(await page.locator('#note-content').inputValue(), content);
      failSave = true; await page.locator('#note-content').fill(content + 'Editado'); await page.locator('#save-note').click();
      await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('interrumpida'));
      assert.equal(await page.locator('#note-content').inputValue(), content + 'Editado');
      await page.locator('#save-note').click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Todos los cambios'));
      await page.locator('#close-editor').click(); await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await page.locator('#cancel-delete').click(); assert.equal(notes.length, 1);
      await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await page.locator('#delete-form button[type=submit]').click(); await page.locator('#empty').waitFor(); assert.equal(notes.length, 0);
      await page.locator('#back-folders').click(); await page.locator('.card').first().waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sin desborde en ' + width);
      await page.reload(); await page.locator('.card').first().waitFor(); assert.equal(await page.locator('.card').count(), 4);
      assert.deepEqual(errors, []); await context.close(); console.log('Carpetas, editor, errores y paginación correctos: ' + width + 'px');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
