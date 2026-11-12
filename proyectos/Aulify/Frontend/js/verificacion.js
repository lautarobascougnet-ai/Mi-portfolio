// Volver del proveedor no aprueba nada: consulta autenticada al backend.
(() => {
	const identity = window.AulifyIdentity;
	const status = document.querySelector('#verification-status');
	const capture = document.querySelector('#capture-step');
	const start = document.querySelector('#start-verification');
	const check = document.querySelector('#check-verification');
	const cancel = document.querySelector('#cancel-verification');
	const incoming = new URLSearchParams(location.hash.slice(1)).get('ticket');
	const ticket = /^[a-f0-9]{64}$/.test(incoming || '') ? incoming : sessionStorage.getItem('aulify.identity.ticket');
	history.replaceState(null, '', location.pathname);
	if (ticket) sessionStorage.setItem('aulify.identity.ticket', ticket);
	let timer;
	let busy = false;
	let finished = false;
	let sandbox = false;
	let launched = sessionStorage.getItem('aulify.identity.launched') === ticket;

	function renderState(state) {
		status.textContent = identity.messages[state] || 'Esperando la respuesta de Didit.';
		finished = !['pending', 'in_review'].includes(state);
		if (finished) {
			clearTimeout(timer);
			capture.hidden = check.hidden = cancel.hidden = true;
			sessionStorage.removeItem('aulify.identity.ticket');
			sessionStorage.removeItem('aulify.identity.launched');
			if (state === 'completed') {
				document.querySelector('#go-login').hidden = false;
				setTimeout(() => location.replace('login.html?registro=ok'), 1500);
			}
		}
	}

	async function refresh() {
		clearTimeout(timer);
		if (busy || finished || !ticket || document.hidden) return;
		busy = true;
		try {
			const result = await identity.request('status', { ticket });
			renderState(result.state);
			if (!finished && launched) timer = setTimeout(refresh, 6000);
		} catch (error) { status.textContent = error.message + ' Podés volver a comprobar el resultado.'; check.hidden = false; }
		finally { busy = false; }
	}

	start.addEventListener('click', async () => {
		if (!sandbox && !document.querySelector('#identity-consent').checked) { status.textContent = 'Confirmá tu consentimiento antes de continuar.'; return; }
		start.disabled = true;
		status.textContent = 'Abriendo la página segura de Didit…';
		try {
			const result = await identity.request('launch', { ticket, consent: sandbox || document.querySelector('#identity-consent').checked });
			const url = new URL(result.url);
			if (url.protocol !== 'https:' || url.hostname !== 'verify.didit.me') throw new Error('El enlace del proveedor no es válido.');
			launched = true;
			sessionStorage.setItem('aulify.identity.launched', ticket);
			check.hidden = false;
			location.assign(url.href);
		} catch (error) { status.textContent = error.message; }
		finally { start.disabled = false; }
	});
	check.addEventListener('click', refresh);
	cancel.addEventListener('click', async () => {
		try { renderState((await identity.request('cancel', { ticket })).state); }
		catch (error) { status.textContent = error.message; }
	});
	document.addEventListener('visibilitychange', () => { if (!document.hidden && launched) void refresh(); });
	window.addEventListener('aulify:resume', () => { if (launched) void refresh(); });

	(async () => {
		try {
			if (!ticket) throw new Error('No hay un registro pendiente. Volvé al formulario o escaneá su QR.');
			const config = await identity.init();
			if (!config.enabled) throw new Error('La verificación aún no está habilitada. Falta configurar la cuenta Didit.');
			const info = await identity.request('context', { ticket });
			sandbox = info.environment === 'sandbox';
			launched = launched || info.started;
			document.querySelector('#sandbox-notice').hidden = info.environment !== 'sandbox';
			renderState(info.state);
			if (finished) return;
			cancel.hidden = false;
			check.hidden = !launched;
			if (identity.isPhone() && info.account) {
				capture.hidden = false;
				document.querySelector('#account-summary').textContent = info.account.name + ' · ' + info.account.email + ' · DNI terminado en ' + info.account.dni_ending;
				if (sandbox) {
					document.querySelector('#identity-consent').closest('label').hidden = true;
					start.textContent = 'Abrir prueba de Didit';
				}
			} else status.textContent = 'Continuá desde el teléfono con el QR del formulario.';
			await refresh();
		} catch (error) {
			status.textContent = error.message;
			if (['EXPIRED_TICKET', 'INVALID_TICKET'].includes(error.code)) {
				sessionStorage.removeItem('aulify.identity.ticket');
				sessionStorage.removeItem('aulify.identity.launched');
			}
		}
	})();
})();
