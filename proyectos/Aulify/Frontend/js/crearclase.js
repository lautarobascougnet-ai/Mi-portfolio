// Editor local: los horarios se envían al servidor solo al publicar la clase.
const classForm = document.querySelector('#create-class');
const createFeedback = document.querySelector('#create-feedback');
const scheduleFeedback = document.querySelector('#schedule-feedback');
const subjectRequestFeedback = document.querySelector('#subject-request-feedback');
const subjectRequestButton = document.querySelector('#request-subject');
const newSubjectName = document.querySelector('#new-subject-name');
const zone = 'America/Argentina/Buenos_Aires';
const editClassId = new URLSearchParams(location.search).get('id');
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${parts.year}-${parts.month}-${parts.day}`;
const dateObject = value => new Date(value + 'T12:00:00Z');
const isoDate = value => value.toISOString().slice(0, 10);
const lastDate = dateObject(today);
lastDate.setUTCFullYear(lastDate.getUTCFullYear() + 1);
const lastDay = isoDate(lastDate);
let selectedDate = today, month = dateObject(today), csrf = '', publishing = false, published = false;
let weekly = {}, exceptions = {};
month.setUTCDate(1);
const mins = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const weekday = date => String(dateObject(date).getUTCDay() || 7);
const rangesFor = date => exceptions[date] ?? weekly[weekday(date)] ?? [];
const softGreen = 'bg-[#d7eadf] text-[#245c42]';
const softRed = 'bg-[#f2dede] text-[#804747]';
const el = (tag, text, classes = '') => {
	const node = document.createElement(tag);
	node.textContent = text; node.className = classes;
	return node;
};
function button(text, classes, action) {
	const node = el('button', text, classes);
	node.type = 'button'; node.addEventListener('click', action);
	return node;
}

// Une franjas adyacentes o superpuestas sin duplicar horas.
function mergeRanges(ranges) {
	const sorted = ranges.map(r => ({ ...r })).sort((a, b) => a.start.localeCompare(b.start));
	const result = [];
	for (const range of sorted) {
		const previous = result.at(-1);
		if (previous && range.start <= previous.end) previous.end = previous.end > range.end ? previous.end : range.end;
		else result.push(range);
	}
	return result;
}
function readRange(prefix) {
	const start = document.querySelector(`#${prefix}-start`).value;
	const end = document.querySelector(`#${prefix}-end`).value;
	if (!start || !end || start >= end) {
		scheduleFeedback.textContent = 'Elegí una hora final posterior al inicio. Para cruzar medianoche, usá dos días.';
		return null;
	}
	return { start, end };
}
function renderWeek() {
	const summary = document.querySelector('#weekly-summary'); summary.replaceChildren();
	dayNames.forEach((name, index) => {
		const day = String(index + 1), ranges = weekly[day] || [];
		const row = el('div', '', 'rounded-lg bg-white/70 p-3 text-[calc(.875rem+2px)]');
		row.append(el('h3', name, 'font-semibold'));
		if (!ranges.length) row.append(el('p', 'No disponible', 'mt-1 text-[#804747]'));
		ranges.forEach((range, i) => row.append(button(`${range.start}–${range.end} ×`, 'mr-2 mt-2 rounded-lg px-3 py-2 ' + softGreen, () => {
			weekly[day].splice(i, 1); render();
		})));
		summary.append(row);
	});
}
function renderCalendar() {
	document.querySelector('#calendar-month').textContent = month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
	document.querySelector('#previous-month').disabled = isoDate(month).slice(0, 7) <= today.slice(0, 7);
	document.querySelector('#next-month').disabled = isoDate(month).slice(0, 7) >= lastDay.slice(0, 7);
	const calendar = document.querySelector('#schedule-calendar'); calendar.replaceChildren();
	for (let blank = 0; blank < (month.getUTCDay() + 6) % 7; blank++) calendar.append(el('span', ''));
	const total = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
	for (let day = 1; day <= total; day++) {
		const date = isoDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 12)));
		const available = rangesFor(date).length > 0;
		const node = button(String(day), 'min-h-9 rounded-lg text-[calc(.75rem+2px)] disabled:opacity-30 ' + (available ? softGreen : softRed) + (date === selectedDate ? ' ring-2 ring-[#06165e] ring-offset-1' : ''), () => {
			selectedDate = date; render();
		});
		node.disabled = date < today || date > lastDay;
		node.dataset.date = date;
		node.setAttribute('aria-label', `${date}: ${available ? 'disponible' : 'no disponible'}`);
		node.setAttribute('aria-pressed', String(date === selectedDate));
		calendar.append(node);
	}
}
function renderDate() {
	const ranges = rangesFor(selectedDate);
	document.querySelector('#selected-date').textContent = dateObject(selectedDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
	document.querySelector('#date-mode').textContent = Object.hasOwn(exceptions, selectedDate) ? 'Excepción para esta fecha' : 'Horario de tu semana habitual';
	const grid = document.querySelector('#hour-grid'); grid.replaceChildren();
	for (let hour = 0; hour < 24; hour++) {
		const start = hour * 60, end = start + 60;
		const overlap = ranges.some(r => mins(r.start) < end && mins(r.end) > start);
		const full = ranges.some(r => mins(r.start) <= start && mins(r.end) >= end);
		const node = button('', 'min-h-16 rounded-lg border border-white/30 p-2 text-center text-[calc(.75rem+2px)] ' + (overlap ? softGreen : softRed), () => {
			// Una hora parcial se completa en el primer clic y se quita en el segundo.
			if (!full) exceptions[selectedDate] = mergeRanges([...ranges, { start: time(start), end: time(end) }]);
			else {
				exceptions[selectedDate] = ranges.flatMap(r => {
					if (mins(r.end) <= start || mins(r.start) >= end) return [{ ...r }];
					const result = [];
					if (mins(r.start) < start) result.push({ start: r.start, end: time(start) });
					if (mins(r.end) > end) result.push({ start: time(end), end: r.end });
					return result;
				});
			}
			render();
		});
		node.dataset.hour = hour;
		node.setAttribute('aria-pressed', full ? 'true' : overlap ? 'mixed' : 'false');
		node.append(el('span', full ? 'Disponible' : overlap ? 'Parcial' : 'No disponible', 'block'), el('span', `${time(start)}–${time(end)}`, 'mt-1 block font-semibold'));
		grid.append(node);
	}
	const list = document.querySelector('#date-ranges'); list.replaceChildren();
	if (!ranges.length) list.append(el('p', 'Sin horas disponibles.', 'text-[calc(.875rem+2px)] text-[#804747]'));
	ranges.forEach((range, i) => list.append(button(`${range.start}–${range.end} ×`, 'rounded-lg px-3 py-2 text-[calc(.875rem+2px)] ' + softGreen, () => {
		exceptions[selectedDate] = ranges.filter((_, index) => index !== i); render();
	})));
}
function render() {
	renderWeek(); renderCalendar(); renderDate();
	scheduleFeedback.textContent = '';
}

// Cuatro plantillas explícitas; no reemplazan ajustes previos sin confirmación.
const presets = [
	['Todos los días · 8 a 20', [1, 2, 3, 4, 5, 6, 7], '08:00', '20:00'],
	['Lun a vie · 9 a 17 (8 h)', [1, 2, 3, 4, 5], '09:00', '17:00'],
	['Todos los días · 9 a 14 (5 h)', [1, 2, 3, 4, 5, 6, 7], '09:00', '14:00'],
	['Lun a vie · 16 a 20', [1, 2, 3, 4, 5], '16:00', '20:00'],
];
function canReplace() {
	return (!Object.keys(weekly).length && !Object.keys(exceptions).length) || confirm('Esto reemplaza tu semana y las excepciones por fecha. ¿Continuar?');
}
presets.forEach(([label, days, start, end], index) => {
	const node = button(label, 'rounded-lg border border-[#bacbd8] bg-white p-3 text-[calc(.875rem+2px)] hover:bg-[#d7eadf]', () => {
		if (!canReplace()) return;
		weekly = Object.fromEntries(days.map(day => [day, [{ start, end }]])); exceptions = {}; render();
	});
	node.dataset.preset = index; document.querySelector('#schedule-presets').append(node);
});
dayNames.forEach((name, index) => {
	const label = el('label', '', 'rounded-lg bg-white px-3 py-2 text-[calc(.875rem+2px)]');
	const input = document.createElement('input');
	input.type = 'checkbox'; input.value = String(index + 1); input.className = 'mr-2 accent-[#06165e]';
	label.append(input, document.createTextNode(name)); document.querySelector('#weekdays').append(label);
});
document.querySelector('#schedule-clear').addEventListener('click', () => {
	// Restablece solo la disponibilidad, sin borrar los datos de la clase.
	if (!canReplace()) return;
	weekly = {}; exceptions = {};
	document.querySelectorAll('#weekdays input').forEach(input => { input.checked = false; });
	for (const id of ['weekly-start', 'weekly-end', 'date-start', 'date-end']) {
		const input = document.getElementById(id);
		input.value = input.defaultValue;
	}
	selectedDate = today; month = dateObject(today); month.setUTCDate(1);
	render();
	scheduleFeedback.textContent = 'Horarios restablecidos. Elegí una plantilla o usá la selección manual. Los datos de la clase se conservaron.';
});
document.querySelector('#add-weekly').addEventListener('click', () => {
	const range = readRange('weekly'); if (!range) return;
	const days = [...document.querySelectorAll('#weekdays input:checked')];
	if (!days.length) { scheduleFeedback.textContent = 'Marcá al menos un día de la semana.'; return; }
	days.forEach(day => { weekly[day.value] = mergeRanges([...(weekly[day.value] || []), range]); }); render();
});
document.querySelector('#add-date').addEventListener('click', () => {
	const range = readRange('date');
	if (range) { exceptions[selectedDate] = mergeRanges([...rangesFor(selectedDate), range]); render(); }
});
document.querySelector('#close-date').addEventListener('click', () => { exceptions[selectedDate] = []; render(); });
document.querySelector('#restore-date').addEventListener('click', () => { delete exceptions[selectedDate]; render(); });
document.querySelector('#previous-month').addEventListener('click', () => { month.setUTCMonth(month.getUTCMonth() - 1); renderCalendar(); });
document.querySelector('#next-month').addEventListener('click', () => { month.setUTCMonth(month.getUTCMonth() + 1); renderCalendar(); });

subjectRequestButton.addEventListener('click', async () => {
	const name = newSubjectName.value.trim();
	if (!name) { subjectRequestFeedback.textContent = 'Escribí el nombre de la materia que querés proponer.'; return; }
	subjectRequestButton.disabled = true;
	subjectRequestFeedback.textContent = 'Enviando propuesta…';
	try {
		const result = await apiRequest('/subjects/request', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: { nombre: name } });
		subjectRequestFeedback.textContent = result.message;
		newSubjectName.value = '';
		if (result.subject?.estado === 'aprobada') {
			const select = classForm.elements.materia;
			if (![...select.options].some(option => option.value === result.subject.nombre)) select.add(new Option(result.subject.nombre, result.subject.nombre));
			select.value = result.subject.nombre;
		}
	} catch (error) {
		subjectRequestFeedback.textContent = error.message;
	} finally {
		subjectRequestButton.disabled = false;
	}
});

// Publicación: PHP vuelve a comprobar el rol, el CSRF y las franjas.
classForm.addEventListener('submit', async event => {
	event.preventDefault(); if (publishing || published) return;
	if (![...Object.values(weekly), ...Object.values(exceptions)].some(r => r.length)) {
		scheduleFeedback.textContent = 'Elegí al menos un horario disponible antes de publicar.'; return;
	}
	publishing = true;
	const submit = document.querySelector('#publish-class'); submit.disabled = true;
	createFeedback.textContent = 'Publicando clase con sus horarios…';
	try {
		await apiRequest(editClassId ? '/classes/update' : '/classes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: { ...Object.fromEntries(new FormData(classForm)), ...(editClassId ? { id: Number(editClassId) } : {}), horarios: { timezone: zone, weekly, exceptions } } });
		published = true; window.location.replace(editClassId ? 'misclases.html?guardada=1' : 'misclases.html?creada=1');
	} catch (error) { createFeedback.textContent = error.message; scheduleFeedback.textContent = error.message; }
	finally { publishing = false; submit.disabled = published; }
});
requireAuthenticatedPage().then(async user => {
	const data = await apiRequest('/classes/mine');
	if (!data.is_professor) { createFeedback.textContent = 'Solo los profesores aprobados pueden crear clases. Volvé a Mis clases.'; return; }
	csrf = data.csrf;
	const approvedSubjects = await apiRequest('/subjects');
	const subjectSelect = classForm.elements.materia;
	for (const subject of approvedSubjects.subjects) subjectSelect.add(new Option(subject.nombre, subject.nombre));
	if (editClassId) {
		const item = data.classes.find(c => String(c.id) === editClassId);
		if (!item) throw new Error('Clase no encontrada entre tus publicaciones.');
		if (![...subjectSelect.options].some(option => option.value === item.materia)) subjectSelect.add(new Option(item.materia, item.materia));
		for (const field of ['materia', 'descripcion', 'precio', 'moneda', 'modalidad']) classForm.elements[field].value = item[field];
		classForm.elements.permite_chat.checked = Boolean(Number(item.permite_chat));
		const schedule = typeof item.horarios === 'string' ? JSON.parse(item.horarios) : item.horarios;
		weekly = schedule?.weekly || {};
		exceptions = Object.fromEntries(Object.entries(schedule?.exceptions || {}).filter(([date]) => date >= today && date <= lastDay));
		document.querySelector('h1').textContent = 'Editar clase';
		document.querySelector('#publish-class').textContent = 'Guardar cambios';
	}
	document.querySelector('#class-professor').textContent = `${user.nombre} ${user.apellido || ''}`.trim();
	if (/^Backend\/conexiones\/uploads\/perfiles\/[a-zA-Z0-9_]+\.(jpg|png|webp)$/.test(user.foto_perfil || '')) {
		const avatar = document.querySelector('#class-avatar');
		avatar.addEventListener('error', () => { avatar.src = 'aulify-icon.svg'; }, { once: true });
		avatar.src = new URL('../' + user.foto_perfil, location.href).href;
	}
	classForm.hidden = false; createFeedback.textContent = ''; render();
}).catch(error => { createFeedback.textContent = error.message; });
