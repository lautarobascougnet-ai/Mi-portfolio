'use strict';
(() => {
  const $ = id => document.getElementById(id), id = Number(new URLSearchParams(location.search).get('id'));
  let booking, csrf = '', busy = false, after = 0, readThrough = 0, fetching = false, signature = '', autoPaymentOpened = false;
  const labels = { pendiente: 'Solicitud pendiente de aceptación del profesor', aceptada: 'El profesor aceptó la reserva. Ya podés pagar.', confirmada: 'Reserva aceptada. Ya podés pagar.', pagada: 'Clase paga · Pago simulado realizado', terminada: 'Clase terminada', cancelada: 'Reserva cancelada', rechazada: 'El profesor rechazó la solicitud', vencida: 'La reserva venció sin completar el pago' };
  const money = (value, currency = booking?.moneda || 'EUR') => new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(Number(value));
  const post = (action, body = {}) => apiRequest('/bookings/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: { id, ...body } });
  function action(label, handler) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = handler; $('reservation-actions').append(b); }
  async function mutate(actionName) {
    if (busy) return;
    if (actionName === 'cancel' && !confirm(booking.estado === 'pagada' ? `¿Cancelar la reserva? La devolución simulada será del ${booking.devolucion_porcentaje} % (${money(Number(booking.precio) * booking.devolucion_porcentaje / 100, booking.moneda)}).` : '¿Cancelar la reserva? No hay pagos que devolver.')) return;
    if (actionName === 'reject' && !confirm('¿Rechazar esta solicitud?')) return;
    busy = true;
    try { const result = await post(actionName); $('reservation-feedback').textContent = result.message; await load(); }
    catch (error) { $('reservation-feedback').textContent = error.message; }
    finally { busy = false; }
  }
  function render() {
    $('reservation-detail').hidden = false;
    $('reservation-title').textContent = booking.materia;
    $('reservation-info').textContent = `${booking.inicio.slice(0,16)} (Buenos Aires) · ${booking.modalidad} · ${money(booking.precio, booking.moneda)} · Profesor: ${booking.profesor} · Alumno: ${booking.alumno}`;
    $('reservation-status').textContent = labels[booking.estado_vista] || booking.estado_vista;
    $('reservation-policy').textContent = 'Cancelación antes del inicio: devolución simulada completa con 48 h o más de anticipación; con menos de 48 h, se devuelve el 50 % para proteger al profesor. Si cancela el profesor, se devuelve el 100 %.';
    $('reservation-actions').replaceChildren();
    if (booking.es_profesor && booking.estado_vista === 'pendiente') { action('Aceptar reserva', () => mutate('accept')); action('Rechazar solicitud', () => mutate('reject')); }
    if (booking.puede_cancelar) action('Cancelar reserva', () => mutate('cancel'));
    $('payment').hidden = booking.es_profesor || !['aceptada', 'confirmada'].includes(booking.estado_vista);
    $('reservation-chat').hidden = !booking.chat_activo;
    if (!booking.chat_activo) { $('messages').replaceChildren(); after = 0; }
    $('receipt').hidden = !booking.pago_referencia;
    if (booking.pago_referencia) $('receipt').textContent = `COMPROBANTE DE PAGO SIMULADO\nSin validez fiscal. No se realizó ningún cobro.\n${booking.pago_referencia}\nReserva #${booking.id} · ${booking.materia}\nAlumno: ${booking.alumno}\nProfesor: ${booking.profesor}\nImporte: ${money(booking.precio, booking.moneda)}\nMétodo: ${booking.pago_metodo}\nFecha: ${booking.pagado_en} (Buenos Aires)` + (booking.estado === 'cancelada' ? `\nCancelada · Devolución simulada: ${money(booking.reembolso, booking.moneda)}` : '');
  }
  async function load() {
    if (fetching) return;
    fetching = true;
    try {
      const data = await apiRequest('/bookings/detail?id=' + id + '&after=' + after); booking = data.booking; csrf = data.csrf;
      const next = JSON.stringify(booking); if (signature !== next) { signature = next; render(); }
      for (const message of data.messages) {
        const row = document.createElement('div'); row.className = 'message' + (Number(message.usuario_id) === Number(data.user_id) ? ' mine' : '');
        const author = document.createElement('small'); author.textContent = `${Number(message.usuario_id) === Number(data.user_id) ? 'Vos' : Number(message.usuario_id) === Number(booking.profesor_id) ? booking.profesor : booking.alumno} · ${message.creado_en}`;
        row.append(author, document.createTextNode(message.texto)); $('messages').append(row); after = Number(message.id);
      }
      if (data.messages.length) $('messages').scrollTop = $('messages').scrollHeight;
      if (booking.chat_activo && after > readThrough && !document.hidden) { await post('read', { last_id: after }); readThrough = after; }
      if (!autoPaymentOpened && new URLSearchParams(location.search).has('pago') && !$('payment').hidden) { autoPaymentOpened = true; openPayment(); }
    } finally { fetching = false; }
  }
  function instructions() {
    const method = $('payment-method').value; const container = $('payment-instructions'); container.replaceChildren();
    const p = document.createElement('p');
    p.textContent = method === 'qr' ? 'Abrí el QR para entrar a la pantalla de pago ficticia. También podés escanearlo desde un dispositivo con acceso a esta página y tu sesión.' : method === 'transferencia' ? 'Transferencia de prueba. No hay CBU ni alias real: usá el botón para simular la acreditación.' : 'Efectivo de prueba. El botón simula que entregaste el dinero y genera el comprobante ficticio.';
    container.append(p);
    if (method === 'qr') {
      const qrButton = document.createElement('button'); qrButton.type = 'button'; qrButton.id = 'demo-qr'; qrButton.setAttribute('aria-label', 'Abrir QR de pago simulado'); qrButton.onclick = openPayment; container.append(qrButton);
      const url = new URL(location.href); url.searchParams.set('pago', 'qr');
      if (window.AulifyQR) { const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); qrButton.append(canvas); window.AulifyQR.toCanvas(canvas, url.href, { width: 190, margin: 1 }).catch(() => { qrButton.textContent = 'Abrir pago QR simulado'; }); }
      else qrButton.textContent = 'Abrir pago QR simulado';
    }
    $('open-payment').textContent = method === 'qr' ? 'Abrir pantalla de pago QR' : 'Pagar (simulación)';
  }
  function openPayment() {
    $('payment-summary').textContent = `Reserva #${id} · ${money(booking.precio, booking.moneda)} · ${$('payment-method').value}`; $('payment-feedback').textContent = ''; $('payment-dialog').showModal();
  }
  $('payment-method').onchange = instructions; $('open-payment').onclick = openPayment; $('close-payment').onclick = () => { if (!busy) $('payment-dialog').close(); };
  $('payment-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('confirm-payment').onclick = async () => {
    if (busy) return; busy = true; $('confirm-payment').disabled = true;
    try { const result = await post('pay', { metodo: $('payment-method').value }); $('payment-dialog').close(); $('reservation-feedback').textContent = result.message; await load(); $('reservation-detail').scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', 'reserva.html?id=' + id); }
    catch (error) { $('payment-feedback').textContent = error.message; }
    finally { busy = false; $('confirm-payment').disabled = false; }
  };
  $('message-form').onsubmit = async event => {
    event.preventDefault(); const submit = event.submitter; submit.disabled = true; const text = $('message-input').value;
    try { await post('message', { texto: text }); if ($('message-input').value === text) $('message-input').value = ''; $('message-feedback').textContent = ''; await load(); }
    catch (error) { $('message-feedback').textContent = error.message; }
    finally { submit.disabled = false; }
  };
  requireAuthenticatedPage().then(async () => { if (!Number.isSafeInteger(id) || id < 1) throw new Error('Reserva inválida.'); await load(); instructions(); $('reservation-feedback').textContent = ''; setInterval(() => { if (!document.hidden && !busy) load().catch(error => { $('reservation-feedback').textContent = error.message; }); }, 5000); }).catch(error => { $('reservation-feedback').textContent = error.message; });
})();
