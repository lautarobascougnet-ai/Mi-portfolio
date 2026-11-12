// Formulario conectado a la API propia; no hay PHP ni funciones inline en el HTML.
const teacherForm = document.querySelector('#teacher-form');
const teacherFields = document.querySelector('#teacher-fields');
const teacherStatus = document.querySelector('#teacher-status');
const teacherSubmit = document.querySelector('#teacher-submit');
const certificate = document.querySelector('#teacher-certificate');
const studies = [...teacherForm.querySelectorAll('[name="estudios[]"]')];
let teacherCsrf = '';
let submitting = false;
let reviewTimer = null;
let checkingReview = false;

function showReview(application) {
	const exists = Boolean(application);
	document.querySelector('#teacher-application-card').hidden = exists;
	document.querySelector('#teacher-wait').hidden = !exists;
	if (!exists) return;
	const state = application.estado;
	const labels = {
		pendiente: ['Solicitud pendiente de revisión', 'Recibimos tu solicitud. Cuando el administrador la revise, esta pantalla cambiará automáticamente. También podés volver a entrar más tarde.'],
		aprobada: ['¡Fuiste aceptado como profesor!', 'Tu solicitud fue aprobada. Ya podés continuar y completar tu perfil de profesor.'],
		rechazada: ['Tu solicitud no fue aprobada', 'El administrador revisó tu solicitud y no la aprobó. A continuación podés consultar el mensaje de la revisión.'],
	};
	const [title, description] = labels[state] || ['Solicitud en revisión', 'Consultá nuevamente el estado.'];
	document.querySelector('#review-title').textContent = title;
	document.querySelector('#review-description').textContent = description;
	document.querySelector('#review-reason').textContent = [application.materia ? 'Materia solicitada: ' + application.materia : '', application.revision_motivo || ''].filter(Boolean).join(' · ');
	document.querySelector('#teacher-continue').hidden = state !== 'aprobada';
	document.querySelector('#review-poll-status').textContent = state === 'pendiente' ? 'Se comprueba el estado cada 6 segundos mientras esta pantalla esté abierta.' : 'Estado actualizado.';
	if (reviewTimer) clearInterval(reviewTimer);
	reviewTimer = state === 'pendiente' ? setInterval(() => { if (!document.hidden) refreshReview(); }, 6000) : null;
}

async function refreshReview() {
	if (checkingReview) return;
	checkingReview = true;
	try { const result = await teacherRequest(); showReview(result.application); }
	catch (error) { document.querySelector('#review-poll-status').textContent = error.message + ' Podés volver a comprobar el estado.'; }
	finally { checkingReview = false; }
}

function showTeacherStatus(message, error = false) {
	teacherStatus.textContent = message;
	teacherStatus.className = 'mb-4 rounded-lg p-3 text-[calc(.875rem+2px)] ' + (error ? 'bg-red-50 text-red-800' : 'bg-[#f5f7fa] text-[#171c24]');
}

function showSavedCertificate(filename) {
	document.querySelector('#saved-certificate').textContent = filename ? 'Título guardado: ' + filename : '';
	document.querySelector('#remove-certificate-label').classList.toggle('hidden', !filename);
	teacherForm.elements.eliminar_titulo.checked = false;
}

async function teacherRequest(body) {
	const response = await fetch(API_BASE_URL + '/teacher/application', {
		method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
		headers: body ? { 'X-CSRF-Token': teacherCsrf } : {}, body,
	});
	const data = await response.json();
	if (response.status === 401) window.location.replace('login.html?next=serprofe');
	if (!response.ok) throw new Error(data.error || 'No se pudo guardar el formulario.');
	return data;
}

// Carga datos de la cuenta y recupera una solicitud anterior sin sobrescribirla.
async function loadTeacherForm() {
	try {
		const user = await requireAuthenticatedPage('serprofe.html');
		const { application, csrf } = await teacherRequest();
		teacherCsrf = csrf;
		teacherForm.elements.email_solicitud.value = user.email || '';
		teacherForm.elements.nombre_completo.value = [user.nombre, user.apellido].filter(Boolean).join(' ');
		teacherForm.elements.nombre_usuario.value = user.username || '';
		if (application) {
			showReview(application);
		} else {
			showTeacherStatus('Completá el formulario para solicitar tu alta como profesor.');
			teacherFields.disabled = false;
		}
	} catch (error) {
		showTeacherStatus(error.message + ' Recargá la página para volver a intentar.', true);
	}
}

// "Ninguno" no puede coexistir con secundaria o universidad completas.
studies.forEach(input => input.addEventListener('change', () => {
	if (!input.checked) return;
	studies.forEach(other => {
		if (other !== input && (input.value === 'ninguno' || other.value === 'ninguno')) other.checked = false;
	});
}));

teacherForm.addEventListener('submit', async event => {
	event.preventDefault();
	if (submitting || teacherFields.disabled) return;
	if (!studies.some(input => input.checked)) {
		showTeacherStatus('Seleccioná al menos una opción de estudios.', true);
		studies[0].focus();
		return;
	}
	const file = certificate.files[0];
	if (file && (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
		showTeacherStatus('Adjuntá una imagen JPG, PNG o WEBP de hasta 2 MB.', true);
		certificate.focus();
		return;
	}
	const body = new FormData(teacherForm);
	submitting = true;
	teacherFields.disabled = true;
	teacherSubmit.textContent = 'Guardando…';
	try {
		const result = await teacherRequest(body);
		certificate.value = '';
		showReview({ estado: result.estado, materia: body.get('materia'), revision_motivo: null });
		document.querySelector('#teacher-wait').scrollIntoView({ block: 'center' });
	} catch (error) {
		showTeacherStatus(error.message, true);
		teacherSubmit.textContent = 'Reintentar envío';
		teacherStatus.scrollIntoView({ block: 'center' });
	} finally {
		submitting = false;
		teacherFields.disabled = false;
	}
});

loadTeacherForm();
document.querySelector('#review-refresh').addEventListener('click', refreshReview);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('#teacher-wait').hidden) refreshReview(); });
