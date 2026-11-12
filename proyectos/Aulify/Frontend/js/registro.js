// Registro pendiente: no se guarda la contraseña en el navegador.
const form = document.querySelector('#register-form');
const feedback = document.querySelector('#feedback');
const registrationStep = document.querySelector('#registration-step');
const verificationStep = document.querySelector('#verification-step');
const submit = document.querySelector('#submit-button');
const statusText = document.querySelector('#identity-status');
const identity = window.AulifyIdentity;
let ticket = sessionStorage.getItem('aulify.identity.ticket') || '';
let timer;
let polling = false;

submit.addEventListener('click', (event) => {
	const requiredFields = ['nombre', 'apellido', 'email', 'dni', 'password', 'password_confirm'];
	if (requiredFields.some(name => form.elements[name].value.trim())) return;
	event.preventDefault();
	feedback.classList.add('hidden');
	startSandboxDemo();
});

function showError(message) {
	feedback.textContent = message;
	feedback.className = 'mt-5 rounded-lg border border-red-700 bg-red-50 px-4 py-3 text-[calc(.875rem+2px)] !text-red-800';
}

async function startSandboxDemo() {
	submit.disabled = true;
	submit.textContent = 'Preparando QR de prueba…';
	try {
		const config = await identity.init();
		if (!config.enabled || config.environment !== 'sandbox') {
			throw new Error('El QR sin completar datos solo está disponible en Sandbox. Para un registro real, completá el formulario y aceptá la verificación.');
		}
		const result = await identity.request('demo', {});
		ticket = result.ticket;
		sessionStorage.setItem('aulify.identity.ticket', ticket);
		if (identity.isPhone()) location.assign('verificacion.html');
		else showQR();
	} catch (error) {
		showError(error.message);
	} finally {
		submit.disabled = false;
		submit.textContent = 'Registrarse';
	}
}

function clearPending() {
	clearTimeout(timer);
	ticket = '';
	sessionStorage.removeItem('aulify.identity.ticket');
	sessionStorage.removeItem('aulify.identity.launched');
	verificationStep.hidden = true;
	registrationStep.hidden = false;
	form.elements.nombre.focus();
}

function showQR() {
	registrationStep.hidden = true;
	verificationStep.hidden = false;
	AulifyQR.toCanvas(document.querySelector('#identity-qr'), 'aulify://verification?ticket=' + ticket, { width: 320, margin: 4 });
	statusText.textContent = identity.messages.pending;
	document.querySelector('#verification-title').focus();
	void checkStatus();
}

// Nunca se interpreta un parámetro "Approved" del navegador.
async function checkStatus() {
	clearTimeout(timer);
	if (!ticket || polling || document.hidden) return;
	polling = true;
	try {
		const result = await identity.request('status', { ticket });
		statusText.textContent = identity.messages[result.state] || 'Esperando resultado.';
		if (result.state === 'completed') {
			sessionStorage.removeItem('aulify.identity.ticket');
			setTimeout(() => location.replace('login.html?registro=ok'), 1500);
		} else if (['pending', 'in_review'].includes(result.state)) timer = setTimeout(checkStatus, 6000);
	} catch (error) { statusText.textContent = error.message + ' Podés volver a comprobar el resultado.'; }
	finally { polling = false; }
}

form.addEventListener('submit', async (event) => {
	event.preventDefault();
	feedback.classList.add('hidden');
	if (!form.reportValidity()) return;
	if (form.elements.password.value !== form.elements.password_confirm.value) { showError('Las contraseñas no coinciden.'); return; }
	submit.disabled = true;
	submit.textContent = 'Preparando verificación…';
	try {
		const config = await identity.init();
		if (!config.enabled) throw new Error('La verificación todavía no está habilitada. Falta configurar la cuenta de Didit; tus datos no se enviaron.');
		const input = Object.fromEntries(new FormData(form));
		input.consent = form.elements.consent.checked;
		const result = await identity.request('start', input);
		ticket = result.ticket;
		sessionStorage.setItem('aulify.identity.ticket', ticket);
		form.elements.password.value = '';
		form.elements.password_confirm.value = '';
		if (identity.isPhone()) location.assign('verificacion.html');
		else showQR();
	} catch (error) { showError(error.message); }
	finally { submit.disabled = false; submit.textContent = 'Registrarse'; }
});

document.querySelector('#back-to-registration').addEventListener('click', async () => {
	try {
		const result = await identity.request('cancel', { ticket });
		if (result.state === 'completed') return location.replace('login.html?registro=ok');
		clearPending();
	} catch (error) {
		// Un ticket vencido o eliminado no debe impedir empezar un registro nuevo.
		if (['EXPIRED_TICKET', 'INVALID_TICKET'].includes(error.code)) clearPending();
		else statusText.textContent = error.message;
	}
});
document.querySelector('#retry-status').addEventListener('click', checkStatus);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !verificationStep.hidden) void checkStatus(); });
if (ticket) identity.init().then(() => {
	if (identity.isPhone()) location.replace('verificacion.html');
	else showQR();
}).catch((error) => showError(error.message));
