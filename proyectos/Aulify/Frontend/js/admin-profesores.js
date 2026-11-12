// Panel privado: la contraseña solo se envía al backend; no hay claves en el JS.
const adminBase = new URL('../Backend/conexiones/api/', location.href);
const access = document.querySelector('#admin-access');
const panel = document.querySelector('#admin-panel');
const applications = document.querySelector('#applications');
const adminFeedback = document.querySelector('#admin-feedback');
let csrf = '', pageNumber = 0, loading = false;

function message(text) { adminFeedback.textContent = text; }
function showAccess(authenticated) {
	access.hidden = authenticated;
	panel.hidden = !authenticated;
	if (!authenticated) applications.replaceChildren();
}
async function adminRequest(path, body) {
	// Una API sin respuesta no debe dejar el formulario bloqueado.
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000);
	try {
	const response = await fetch(new URL(path, adminBase), { signal: controller.signal, credentials: 'same-origin', cache: 'no-store', method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}, body: body ? JSON.stringify(body) : undefined });
	const result = await response.json().catch(() => { throw new Error('El servidor no devolvió JSON. Revisá Apache y MySQL en XAMPP.'); });
	if (!response.ok) {
		if (response.status === 403) showAccess(false);
		throw new Error(result.error || 'No se pudo completar la operación.');
	}
	return result;
	} catch (error) {
		if (controller.signal.aborted) throw new Error('El servidor tardó demasiado. Revisá Apache y MySQL en XAMPP y volvé a intentar. Si enviaste una revisión, actualizá la lista antes de repetirla.');
		throw error;
	} finally { clearTimeout(timeout); }
}
function node(tag, text, className = '') {
	const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
}

// Datos externos se insertan como texto, nunca mediante HTML concatenado.
function renderApplication(item) {
	const card = node('article', '', 'min-w-0 rounded-xl bg-[#dce9f3] p-6 shadow-lg');
	card.dataset.userId = item.usuario_id;
	card.append(node('p', 'Materia: ' + (item.materia || 'No indicada en la solicitud anterior'), 'mb-3 font-semibold'));
	card.append(node('h2', item.nombre_completo, 'text-[calc(1.25rem+2px)] font-semibold'), node('p', item.estado.toUpperCase(), 'mt-2 text-[calc(.875rem+2px)] font-semibold'), node('p', item.email, 'mt-2 break-all text-[calc(.875rem+2px)]'));
	for (const [title, value] of [['Usuario propuesto', item.nombre_usuario], ['Experiencia y títulos', item.experiencia], ['Descripción', item.descripcion], ['Motivación', item.motivacion], ['Estudios', item.estudios.join(', ')], ['Motivo de la revisión', item.revision_motivo]]) {
		if (!value) continue;
		card.append(node('h3', title, 'mt-4 text-[calc(.875rem+2px)] font-semibold'), node('p', value, 'mt-1 whitespace-pre-wrap text-[calc(.875rem+2px)] text-[#52616b]'));
	}
	if (item.titulo_nombre) {
		const button = node('button', 'Ver título adjunto', 'mt-4 rounded-lg border border-[#06165e] px-4 py-2 text-[calc(.875rem+2px)]');
		button.type = 'button';
		button.addEventListener('click', async () => {
			button.disabled = true;
			try {
				const file = await adminRequest('admin/teacher-title?user_id=' + encodeURIComponent(item.usuario_id));
				if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mime)) throw new Error('Formato no admitido.');
				const image = document.createElement('img'); image.alt = 'Título adjunto'; image.className = 'mt-4 max-h-96 w-full rounded-lg object-contain'; image.src = 'data:' + file.mime + ';base64,' + file.data;
				button.replaceWith(image);
			} catch (error) { message(error.message); button.disabled = false; }
		}); card.append(button);
	}
	if (item.estado === 'pendiente') {
		const label = node('label', 'Mensaje para el solicitante (opcional)', 'mt-5 block text-[calc(.875rem+2px)]');
		const reason = node('textarea', '', 'mt-2 w-full rounded-lg border border-[#bacbd8] bg-white p-3'); reason.maxLength = 1000; reason.rows = 2; label.append(reason); card.append(label);
		const actions = node('div', '', 'mt-4 flex flex-wrap gap-3');
		for (const [state, text, color] of [['aprobada', 'Aceptar profesor', 'bg-green-800'], ['rechazada', 'Denegar solicitud', 'bg-red-800']]) {
			const button = node('button', text, 'rounded-full px-5 py-3 text-white disabled:opacity-50 ' + color); button.type = 'button';
			button.addEventListener('click', async () => {
				if (!confirm(text + ': ' + item.nombre_completo + '?')) return;
				actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
				try { const result = await adminRequest('admin/teacher-review', { user_id: Number(item.usuario_id), estado: state, motivo: reason.value }); await loadApplications(true); message(result.message); }
				catch (error) { message(error.message); actions.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
			}); actions.append(button);
		} card.append(actions);
	}
	applications.append(card);
}
async function loadApplications(reset = false) {
	if (loading) return;
	loading = true;
	try {
		if (reset) { pageNumber = 0; await loadSubjectRequests(); }
		const result = await adminRequest('admin/teachers?page=' + pageNumber);
		if (reset) applications.replaceChildren();
		result.applications.forEach(renderApplication);
		document.querySelector('#admin-more').hidden = !result.has_more;
		if (!applications.children.length) applications.append(node('p', 'No hay solicitudes todavía.', 'text-white'));
		pageNumber++;
	} finally { loading = false; }
}
document.querySelector('#admin-login').addEventListener('submit', async event => {
	event.preventDefault(); const button = document.querySelector('#admin-enter'); button.disabled = true;
	message('Comprobando acceso…');
	try {
		const session = await adminRequest('admin/session'); csrf = session.csrf;
		const credentials = Object.fromEntries(new FormData(event.target));
		await adminRequest('admin/login', credentials); event.target.elements.password.value = '';
		showAccess(true); await loadApplications(true); message('Acceso administrativo habilitado.');
	} catch (error) { message(error.message); } finally { button.disabled = false; }
});
document.querySelector('#admin-refresh').addEventListener('click', () => loadApplications(true).catch(error => message(error.message)));
document.querySelector('#admin-more').addEventListener('click', () => loadApplications().catch(error => message(error.message)));
document.querySelector('#admin-logout').addEventListener('click', async () => {
	try { await adminRequest('admin/logout', {}); showAccess(false); message('Acceso administrativo cerrado.'); }
	catch (error) { message(error.message); }
});
async function bootAdmin() {
	const button = document.querySelector('#admin-enter');
	button.disabled = true;
	try { const session = await adminRequest('admin/session'); csrf = session.csrf; showAccess(session.authenticated); if (session.authenticated) await loadApplications(true); message(session.authenticated ? 'Solicitudes cargadas.' : 'Ingresá con la cuenta administrativa.'); }
	catch (error) { message(error.message); }
	finally { button.disabled = false; }
}
window.addEventListener('pageshow', event => { if (event.persisted) bootAdmin(); });
bootAdmin();

// Revisión de materias independiente de la aprobación del profesor.
async function loadSubjectRequests() {
	const result = await adminRequest('admin/subjects');
	const list = document.querySelector('#subject-applications'); list.replaceChildren();
	for (const item of result.subjects) {
		const card = node('article', '', 'rounded-xl bg-[#dce9f3] p-5');
		card.append(node('h3', item.nombre, 'font-semibold'), node('p', (item.solicitante || 'Usuario') + ' · ' + item.estado, 'mt-2 text-[calc(.875rem+2px)]'));
		if (item.motivo) card.append(node('p', item.motivo, 'mt-2 text-[calc(.875rem+2px)]'));
		if (item.estado === 'pendiente') {
			const reason = node('textarea', '', 'mt-3 w-full rounded-lg bg-white p-3'); reason.placeholder = 'Motivo (opcional)'; reason.setAttribute('aria-label', 'Motivo para ' + item.nombre); reason.maxLength = 1000; card.append(reason);
			for (const [state, label] of [['aprobada','Aceptar materia'],['rechazada','Denegar materia']]) {
				const button = node('button', label, 'mr-3 mt-3 rounded-lg bg-[#06165e] px-4 py-2 text-white'); button.type = 'button';
				button.addEventListener('click', async () => {
					if (!confirm(label + ': ' + item.nombre + '?')) return;
					card.querySelectorAll('button').forEach(b => { b.disabled = true; });
					try { const response = await adminRequest('admin/subject-review', {id:Number(item.id),estado:state,motivo:reason.value}); await loadSubjectRequests(); message(response.message); }
					catch (error) { message(error.message); card.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
				}); card.append(button);
			}
		}
		list.append(card);
	}
	if (!result.subjects.length) list.append(node('p','No hay propuestas nuevas.','text-white'));
}
