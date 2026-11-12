// Cliente de la API propia. Nunca contiene credenciales de Didit.
window.AulifyIdentity = (() => {
	const endpoint = new URL('../Backend/conexiones/api/identity/', location.href);
	let csrf = '';
	async function request(action, body) {
		const response = await fetch(new URL(action, endpoint), {
			method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
			headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {},
			body: body ? JSON.stringify(body) : undefined,
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			const error = new Error(data.error || 'No se pudo consultar la verificación. Volvé a intentar.');
			error.code = data.code;
			throw error;
		}
		return data;
	}
	async function init() {
		const config = await request('config');
		csrf = config.csrf;
		return config;
	}
	const messages = {
		pending: 'Esperando que completes la verificación desde el teléfono.',
		in_review: 'Didit está revisando la verificación. Tu cuenta todavía no fue creada.',
		completed: 'Identidad verificada. Tu cuenta ya está creada. Te llevamos a iniciar sesión.',
		test_passed: 'Prueba sandbox completada. No se verificó una identidad real ni se creó una cuenta.',
		declined: 'La verificación no fue aprobada o venció. No se creó ninguna cuenta.',
		document_mismatch: 'El DNI no coincide con los datos del formulario o no es válido. Revisá nombre, apellido, número y vencimiento.',
		incomplete_checks: 'Falta una comprobación obligatoria de DNI, prueba de vida o comparación facial. No se creó la cuenta.',
		invalid_result: 'No se pudo validar la respuesta de Didit. No se creó la cuenta.',
		cancelled: 'Verificación cancelada. No se creó la cuenta.',
		expired: 'El enlace venció. Iniciá el registro nuevamente.',
	};
	return { init, request, messages, isPhone: () => /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent) };
})();
