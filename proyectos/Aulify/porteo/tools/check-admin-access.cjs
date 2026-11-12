// Acceso real de solo lectura. No acepta/deniega solicitudes ni modifica perfiles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { request } = require('playwright-core');
const password = fs.readFileSync(0, 'utf8').trim();
(async () => {
	const client = await request.newContext({ baseURL: 'http://localhost/aulify/Backend/conexiones/api/' });
	try {
		assert.equal((await client.get('admin/teachers')).status(), 403);
		assert.equal((await client.get('admin/teacher-title?user_id=1')).status(), 403);
		const { csrf } = await (await client.get('admin/session')).json();
		assert.equal((await client.post('admin/login', { headers: { 'X-CSRF-Token': csrf }, data: { username: 'admin', password } })).status(), 200);
		assert.equal((await client.get('admin/teachers')).status(), 200);
		assert.equal((await client.post('admin/logout', { headers: { 'X-CSRF-Token': csrf }, data: {} })).status(), 200);
		assert.equal((await client.get('admin/teachers')).status(), 403);
		console.log('Admin real: acceso y cierre correctos, datos privados bloqueados sin autorización. Sin revisar solicitudes.');
	} finally { await client.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
