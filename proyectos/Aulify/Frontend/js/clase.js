// Disponibilidad actual y confirmación explícita, sin cobros automáticos.
const bookingId = new URLSearchParams(location.search).get('id');
const bookingFeedback = document.querySelector('#booking-feedback');
const dateInput = document.querySelector('#booking-date');
const confirmBooking = document.querySelector('#confirm-booking');
let selectedStart = '', bookingCsrf = '', requestVersion = 0, bookingPending = false;
let calendarMonth = null;
const bookingDay = value => new Date(value + 'T12:00:00Z');
const bookingIso = value => value.toISOString().slice(0, 10);
const tileBase = 'min-h-20 px-1 py-4 text-center text-[calc(0.6875rem+2px)] leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#06165e]';
const tileGreen = ' bg-[#d7eadf] text-[#245c42]';

// El calendario selecciona fechas; el servidor sigue siendo la autoridad de disponibilidad.
function renderBookingCalendar() {
	if (!calendarMonth) return;
	document.querySelector('#booking-month').textContent = calendarMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
	document.querySelector('#booking-prev').disabled = bookingPending || bookingIso(calendarMonth).slice(0, 7) <= dateInput.min.slice(0, 7);
	document.querySelector('#booking-next').disabled = bookingPending || bookingIso(calendarMonth).slice(0, 7) >= dateInput.max.slice(0, 7);
	const grid = document.querySelector('#booking-calendar'); grid.replaceChildren();
	for (let i = 0; i < (calendarMonth.getUTCDay() + 6) % 7; i++) grid.append(document.createElement('span'));
	const days = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + 1, 0)).getUTCDate();
	for (let i = 1; i <= days; i++) {
		const value = bookingIso(new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth(), i, 12)));
		const button = document.createElement('button'); button.type = 'button'; button.textContent = i;
		button.dataset.date = value; button.setAttribute('aria-label', value); button.setAttribute('aria-pressed', String(value === dateInput.value));
		button.className = 'min-h-9 rounded-lg text-[calc(.75rem+2px)] disabled:opacity-30 ' + (value === dateInput.value ? 'bg-[#06165e] text-white' : 'bg-white/60 hover:bg-[#c8dff3]');
		button.disabled = bookingPending || value < dateInput.min || value > dateInput.max;
		button.addEventListener('click', () => { if (!bookingPending) { dateInput.value = value; loadSlots(); } });
		grid.append(button);
	}
}
function renderBookingSlots(data) {
	const grid = document.querySelector('#booking-slots'); grid.replaceChildren();
	// Una celda por hora; conserva 09:30, por ejemplo, si ese es el inicio real publicado.
	for (let hour = 0; hour < 24; hour++) {
		const matches = data.slots.filter(slot => Number(slot.hora.slice(0, 2)) === hour);
		for (const slot of matches.length ? matches : [null]) {
			const available = !!slot?.available && !data.own_class;
			const occupied = !!slot && !slot.available && !data.own_class;
			const hora = slot?.hora || String(hour).padStart(2, '0') + ':00';
			const button = document.createElement('button'); button.type = 'button'; button.disabled = !available;
			button.dataset.time = hora; button.dataset.available = available ? '1' : '0';
			button.className = tileBase + (available ? tileGreen : occupied ? ' bg-[#f6edc9] text-[#705a24]' : ' bg-[#f2dede] text-[#804747]');
			button.setAttribute('aria-pressed', 'false');
			const state = document.createElement('span'); state.className = 'block'; state.textContent = available ? 'Disponible' : occupied ? 'Ocupado' : 'No disponible';
			const time = document.createElement('span'); time.className = 'mt-1 block font-semibold'; time.textContent = hora;
			button.append(state, time);
			button.addEventListener('click', () => {
				if (bookingPending || !available) return;
				selectedStart = slot.inicio;
				grid.querySelectorAll('[data-available="1"]').forEach(b => { b.className = tileBase + tileGreen; b.setAttribute('aria-pressed', 'false'); b.firstElementChild.textContent = 'Disponible'; });
				button.className = tileBase + ' bg-[#c8dff3] text-[#173b63] ring-2 ring-inset ring-[#06165e]';
				button.setAttribute('aria-pressed', 'true'); state.textContent = 'Seleccionado';
				document.querySelector('#booking-selection').textContent = `Vas a reservar el ${bookingDay(dateInput.value).toLocaleDateString('es-AR', { timeZone: 'UTC' })} a las ${slot.hora}.`;
				confirmBooking.disabled = false;
			});
			grid.append(button);
		}
	}
}
async function loadSlots() {
	const version = ++requestVersion;
	selectedStart = ''; confirmBooking.disabled = true;
	document.querySelector('#booking-selection').textContent = '';
	document.querySelector('#booking-slots').replaceChildren();
	document.querySelector('#slot-feedback').textContent = 'Consultando horarios…';
	renderBookingCalendar();
	try {
		if (!dateInput.value || !dateInput.validity.valid) throw new Error('Elegí una fecha válida desde hoy hasta un año adelante.');
		document.querySelector('#booking-day').textContent = bookingDay(dateInput.value).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
		const data = await apiRequest('/classes/availability?id=' + bookingId + '&date=' + encodeURIComponent(dateInput.value));
		if (version !== requestVersion) return;
		bookingCsrf = data.csrf;
		document.querySelector('#slot-feedback').textContent = data.own_class ? 'Esta es tu clase. No podés reservarla como alumno.' : data.slots.some(slot => slot.available) ? 'Seleccioná un horario y confirmá la reserva.' : data.slots.length ? 'Los turnos de esta fecha están ocupados o coinciden con otra de tus clases.' : 'No hay turnos de una hora disponibles en esta fecha. Probá otro día.';
		renderBookingSlots(data);
	} catch (error) { if (version === requestVersion) document.querySelector('#slot-feedback').textContent = error.message; }
}
dateInput.addEventListener('change', () => {
	if (dateInput.value && dateInput.validity.valid) { calendarMonth = bookingDay(dateInput.value); calendarMonth.setUTCDate(1); }
	loadSlots();
});
for (const [id, direction] of [['booking-prev', -1], ['booking-next', 1]]) {
	document.getElementById(id).addEventListener('click', () => {
		if (bookingPending) return;
		calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() + direction); renderBookingCalendar();
	});
}
confirmBooking.addEventListener('click', async () => {
	if (!selectedStart || bookingPending) return;
	bookingPending = true; confirmBooking.disabled = true; dateInput.disabled = true;
	renderBookingCalendar();
	try {
		const reservation = await apiRequest('/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': bookingCsrf }, body: { class_id: Number(bookingId), inicio: selectedStart, modalidad: document.querySelector('#booking-mode').value } });
		window.location.replace('reserva.html?id=' + reservation.id);
	} catch (error) { bookingFeedback.textContent = error.message; await loadSlots(); }
	finally { bookingPending = false; dateInput.disabled = false; renderBookingCalendar(); }
});
(async () => {
	try {
		if (!/^[1-9]\d*$/.test(bookingId || '')) throw new Error('Clase no encontrada.');
		await requireAuthenticatedPage('clase.html?id=' + bookingId);
		const { class: item } = await apiRequest('/classes/detail?id=' + bookingId);
		document.querySelector('#class-name').textContent = item.materia;
		const mode = document.querySelector('#booking-mode');
		for (const value of item.modalidad === 'ambas' ? ['virtual', 'presencial'] : [item.modalidad]) mode.add(new Option(value === 'virtual' ? 'Virtual' : 'Presencial', value));
		document.querySelector('#class-description').textContent = item.descripcion;
		document.querySelector('#class-price').textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.moneda || 'EUR' }).format(Number(item.precio)) + ' por clase de una hora · ' + item.modalidad;
		const rating = item.rating == null ? null : Math.max(0, Math.min(5, Number(item.rating)));
		document.querySelector('#class-rating').textContent = rating === null || !Number.isFinite(rating) ? '☆☆☆☆☆ · Sin calificación' : '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) + ' · ' + rating.toFixed(1) + ' / 5';
		const teacher = document.querySelector('#class-teacher'); teacher.textContent = item.profesor + ' · Ver perfil'; teacher.href = 'profesor.html?id=' + item.profesor_id;
		const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
		const today = `${parts.year}-${parts.month}-${parts.day}`, last = new Date(today + 'T12:00:00Z'); last.setUTCFullYear(last.getUTCFullYear() + 1);
		dateInput.min = today; dateInput.max = last.toISOString().slice(0, 10); dateInput.value = today;
		calendarMonth = bookingDay(today); calendarMonth.setUTCDate(1);
		document.querySelector('#class-detail').hidden = false;
		bookingFeedback.textContent = item.horarios ? '' : 'El profesor todavía no configuró horarios para esta clase.';
		await loadSlots();
	} catch (error) { bookingFeedback.textContent = error.message; }
})();
