// Sesión y permiso reales antes de mostrar las herramientas del profesor.
const classesFeedback = document.querySelector('#classes-feedback');
const finishClassDialog = document.querySelector('#finish-class-dialog');
const confirmFinishClassButton = document.querySelector('#confirm-finish-class');
let myClassesCsrf = '';
let myClassesSnapshot = '';
let myClassesData = null;
let pendingFinishClass = null;
const classPages = { reserved: 1, paid: 1, finished: 1, owned: 1 };

function pageOfClasses(items, key, list) {
    const total = Math.max(1, Math.ceil(items.length / 4));
    classPages[key] = Math.min(classPages[key], total);
    document.getElementById('pages-' + key)?.remove();
    if (total > 1) {
        const nav = document.createElement('nav'); nav.id = 'pages-' + key; nav.className = 'class-pagination';
        nav.setAttribute('aria-label', 'Páginas de ' + list.closest('section').querySelector('h2').textContent);
        const add = (text, next, label) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
            button.setAttribute('aria-label', label); button.disabled = next < 1 || next > total;
            button.onclick = () => { classPages[key] = next; renderMyClasses(myClassesData); document.getElementById('pages-' + key)?.querySelector(next === total ? '[data-previous]' : '[data-next]')?.focus({ preventScroll: true }); };
            nav.append(button); return button;
        };
        add('←', classPages[key] - 1, 'Página anterior').dataset.previous = '1';
        const current = document.createElement('span'); current.textContent = `${classPages[key]} de ${total}`; current.setAttribute('aria-live', 'polite'); nav.append(current);
        add('→', classPages[key] + 1, 'Página siguiente').dataset.next = '1';
        list.after(nav);
    }
    return items.slice((classPages[key] - 1) * 4, classPages[key] * 4);
}

async function loadMyClasses() {
	const data = await apiRequest('/classes/mine');
	myClassesCsrf = data.csrf;
    const snapshot = JSON.stringify(data);
    if (snapshot === myClassesSnapshot) return;
    myClassesSnapshot = snapshot;
    myClassesData = data;
    renderMyClasses(data);
}

function renderMyClasses(data) {
    document.querySelector('#booking-board').classList.toggle('teacher', data.is_professor);
    const groups = { reserved: [], paid: [], finished: [] };
    for (const item of data.scheduled) {
        const state = item.estado_vista || item.estado;
        groups[state === 'pagada' ? 'paid' : state === 'terminada' ? 'finished' : 'reserved'].push(item);
    }
    const labels = { pendiente: 'Pendiente de aceptación', aceptada: 'Aceptada · Pendiente de pago', confirmada: 'Aceptada · Pendiente de pago', pagada: 'Paga · Simulación', terminada: 'Terminada', cancelada: 'Cancelada', rechazada: 'Rechazada', vencida: 'Vencida' };
    for (const [key, items] of Object.entries(groups)) {
        const list = document.querySelector(key === 'reserved' ? '#scheduled-classes' : '#' + key + '-classes'); list.replaceChildren();
        if (!items.length) list.textContent = 'No hay clases en esta sección.';
        for (const item of pageOfClasses(items, key, list)) {
            const card = document.createElement('article');
            const title = document.createElement('h3'); title.textContent = item.materia; title.className = 'font-semibold';
            const info = document.createElement('p'); info.textContent = `${item.inicio.slice(0,16)} (Buenos Aires) · ${item.modalidad} · ${item.es_profesor ? 'Alumno: ' + item.alumno : 'Profesor: ' + item.profesor}`;
            const status = document.createElement('p'); status.className = 'booking-status'; status.textContent = labels[item.estado_vista || item.estado];
            const link = document.createElement('a'); link.href = 'reserva.html?id=' + item.id;
            link.textContent = item.es_profesor && item.estado_vista === 'pendiente' ? 'Responder solicitud' : !item.es_profesor && ['aceptada', 'confirmada'].includes(item.estado_vista) ? 'Pagar (simulación)' : 'Ver reserva';
            card.append(title, info, status, link);
            if (!item.es_profesor && item.estado_vista === 'pagada') {
                const finish = document.createElement('button');
                finish.type = 'button';
                finish.textContent = 'Clase finalizada';
                finish.className = 'ml-3 mt-3 rounded-lg bg-[#06165e] px-4 py-2 text-[calc(.875rem+2px)] text-white disabled:cursor-not-allowed disabled:opacity-50';
                finish.addEventListener('click', async () => {
                    const classStart = new Date(item.inicio.replace(' ', 'T') + '-03:00');
                    const finishNow = async () => {
                        finish.disabled = true;
                        try {
                            const result = await apiRequest('/bookings/finish', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': myClassesCsrf },
                                body: { id: Number(item.id) },
                            });
                            classesFeedback.textContent = result.message;
                            myClassesSnapshot = '';
                            await loadMyClasses();
                        } catch (error) {
                            classesFeedback.textContent = error.message;
                            finish.disabled = false;
                        }
                    };
                    if (classStart > new Date()) {
                        pendingFinishClass = finishNow;
                        finishClassDialog.showModal();
                    } else {
                        await finishNow();
                    }
                });
                card.append(finish);
            }
            if (Number(item.mensajes_sin_leer) > 0) {
                const unread = document.createElement('p'); unread.className = 'unread-messages';
                const count = Number(item.mensajes_sin_leer);
                unread.textContent = `${count} ${count === 1 ? 'mensaje sin leer' : 'mensajes sin leer'} de ${item.es_profesor ? item.alumno : item.profesor}`;
                card.append(unread);
            }
            list.append(card);
        }
    }
	document.querySelector('#teacher-classes').hidden = !data.is_professor;
	const list = document.querySelector('#owned-classes');
	list.replaceChildren();
	if (!data.classes.length) list.textContent = 'Todavía no creaste ninguna clase.';
	// Cartas de las clases propias; texto seguro incluso con nombres personalizados.
	for (const item of pageOfClasses(data.classes, 'owned', list)) {
		const card = document.createElement('article');
		card.className = 'rounded-lg border border-[#bacbd8] bg-white p-4 shadow-md';
		const title = document.createElement('h3'); title.textContent = item.materia; title.className = 'font-semibold';
		const details = document.createElement('details');
		const summary = document.createElement('summary'); summary.textContent = 'Ver clase'; summary.className = 'mt-3 cursor-pointer text-right text-[calc(.875rem+2px)] text-[#06165e]';
		const description = document.createElement('p'); description.textContent = item.descripcion; description.className = 'mt-3 whitespace-pre-wrap text-[calc(.875rem+2px)]';
		const price = document.createElement('p'); price.textContent = `${new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.moneda || 'EUR' }).format(Number(item.precio))}/hora · ${item.modalidad}`; price.className = 'mt-3 text-[calc(.875rem+2px)]';
		details.append(summary, description, price);
		// Horarios guardados: las clases anteriores se conservan sin inventar disponibilidad.
		const hours = document.createElement('div'); hours.className = 'mt-4 space-y-2 text-[calc(.875rem+2px)]';
		const schedule = typeof item.horarios === 'string' ? JSON.parse(item.horarios) : item.horarios;
		if (schedule) {
			const zone = document.createElement('p'); zone.textContent = 'Horarios de Argentina (Buenos Aires, UTC−3)'; hours.append(zone);
			const names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
			for (const [day, ranges] of Object.entries(schedule.weekly)) {
				if (!ranges.length) continue;
				const line = document.createElement('p'); line.textContent = names[Number(day) - 1] + ': ' + ranges.map(r => r.start + '–' + r.end).join(', '); hours.append(line);
			}
			for (const [date, ranges] of Object.entries(schedule.exceptions)) {
				const line = document.createElement('p'); line.textContent = date + ': ' + (ranges.length ? ranges.map(r => r.start + '–' + r.end).join(', ') : 'No disponible'); hours.append(line);
			}
		} else hours.textContent = 'Esta clase se creó antes del editor de horarios; no tiene disponibilidad configurada.';
		const edit = document.createElement('a'); edit.href = 'crearclase.html?id=' + item.id; edit.textContent = 'Editar clase y horarios'; edit.className = 'mt-4 inline-block text-[calc(.875rem+2px)] text-[#06165e] underline';
		details.append(hours, edit); card.append(title, details); list.append(card);
	}
}

confirmFinishClassButton.addEventListener('click', async event => {
	event.preventDefault();
	if (!pendingFinishClass) return;
	const finish = pendingFinishClass;
	pendingFinishClass = null;
	confirmFinishClassButton.disabled = true;
	finishClassDialog.close();
	try {
		await finish();
	} finally {
		confirmFinishClassButton.disabled = false;
	}
});
finishClassDialog.addEventListener('close', () => { pendingFinishClass = null; });

requireAuthenticatedPage().then(loadMyClasses).then(() => {
	const params = new URLSearchParams(location.search);
	classesFeedback.textContent = params.has('reservada') ? 'Solicitud enviada al profesor.' : params.has('guardada') ? 'Clase y horarios guardados.' : params.has('creada') ? 'Clase publicada con sus horarios. Ya aparece en el catálogo.' : '';
}).catch(error => { classesFeedback.textContent = error.message; });

setInterval(() => { if (!document.hidden) loadMyClasses().catch(error => { classesFeedback.textContent = error.message; }); }, 15000);
