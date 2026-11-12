// Avisos privados, actualizados mientras el alumno permanece en el inicio.
(() => {
  const panel = document.querySelector('#booking-notifications');
  if (!panel) return;
  let pending = false;
  async function refresh() {
    if (pending || document.hidden) return; pending = true;
    try {
      const data = await apiRequest('/classes/mine');
      const accepted = data.scheduled.filter(item => !item.es_profesor && ['aceptada', 'confirmada'].includes(item.estado_vista));
      const unread = data.scheduled.filter(item => Number(item.mensajes_sin_leer) > 0);
      panel.replaceChildren(); panel.hidden = !accepted.length && !unread.length;
      if (unread.length) {
        const title = document.createElement('h2'); title.className = 'text-[calc(1.25rem+2px)] font-semibold';
        title.textContent = unread.length === 1 ? `Tenés mensajes de ${unread[0].es_profesor ? unread[0].alumno : unread[0].profesor}` : `Tenés varios mensajes de ${unread.length} reservas`;
        const link = document.createElement('a'); link.href = unread.length === 1 ? 'reserva.html?id=' + unread[0].id : 'misclases.html';
        link.textContent = unread.length === 1 ? `Leer mensajes · ${unread[0].materia}` : 'Ver mis reservas y mensajes';
        panel.append(title, link);
      }
      if (accepted.length) { const title = document.createElement('h2'); title.textContent = '¡Aceptaron tu reserva!'; title.className = 'text-[calc(1.25rem+2px)] font-semibold'; panel.append(title); }
      for (const item of accepted) { const link = document.createElement('a'); link.href = 'reserva.html?id=' + item.id; link.textContent = `${item.profesor} aceptó ${item.materia} · ${item.inicio.slice(0,16)} · Ir a pagar (simulación)`; panel.append(link); }
    } catch (error) { if (error.status === 401) { panel.replaceChildren(); panel.hidden = true; } }
    finally { pending = false; }
  }
  refresh(); setInterval(refresh, 10000); window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
