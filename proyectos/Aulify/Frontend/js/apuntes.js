'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let folder = null, page = 1, csrf = '', note = null, dirty = false, busy = false, folderEdit = null, deletion = null, loadVersion = 0;
  const feedback = message => { $('feedback').textContent = message; };
  const post = (action, body) => apiRequest('/notes/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body });
  function button(label, action, className = '') {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.className = className;
    element.addEventListener('click', () => Promise.resolve(action()).catch(error => feedback(error.message))); return element;
  }
  async function load() {
    const requestVersion = ++loadVersion;
    $('library').hidden = false; $('editor').hidden = true;
    $('items').replaceChildren(); $('pagination').replaceChildren(); $('empty').hidden = true;
    feedback('Cargando…');
    const data = await apiRequest('/notes?page=' + page + (folder === null ? '' : '&folder=' + folder));
    if (requestVersion !== loadVersion) return;
    csrf = data.csrf; page = data.page;
    $('create-folder').hidden = folder !== null; $('create-note').hidden = folder === null;
    $('folders-tab').toggleAttribute('aria-current', folder === null); $('loose-tab').toggleAttribute('aria-current', folder === 0);
    for (const id of ['folders-tab', 'loose-tab']) if ($(id).hasAttribute('aria-current')) $(id).setAttribute('aria-current', 'page');
    $('folder-heading').hidden = folder === null;
    $('folder-name').textContent = data.folder?.nombre || 'Apuntes sin carpeta';
    $('folder-description').textContent = data.folder?.descripcion || '';
    for (const item of data.items) {
      const card = document.createElement('article'); card.className = 'card';
      const copy = document.createElement('div'); copy.className = 'card-copy';
      const title = document.createElement('h2'); title.textContent = item.nombre;
      const description = document.createElement('p'); description.textContent = item.descripcion || (folder === null ? 'Carpeta de apuntes' : 'Sin descripción');
      copy.append(title, description);
      if (folder === null) { const count = document.createElement('small'); count.textContent = `${item.cantidad} apuntes`; copy.append(count); }
      const actions = document.createElement('div'); actions.className = 'card-actions';
      actions.append(button(folder === null ? 'Ver →' : 'Abrir →', async () => {
        if (folder === null) { folder = Number(item.id); page = 1; await load(); }
        else { const data = await apiRequest('/notes?id=' + item.id); openEditor(data.note); }
      }, 'open'));
      if (folder === null) actions.append(button('Editar', () => openFolder(item), 'edit'));
      actions.append(button('Eliminar', () => {
        deletion = { id: item.id, isFolder: folder === null };
        $('delete-title').textContent = deletion.isFolder ? 'Eliminar carpeta' : 'Eliminar apunte';
        $('delete-description').textContent = `¿Querés eliminar “${item.nombre}”? ` + (deletion.isFolder ? 'También se eliminarán todos los apuntes que contiene. Esta acción no se puede deshacer.' : 'Esta acción no se puede deshacer.');
        $('delete-error').textContent = ''; $('delete-dialog').showModal(); $('cancel-delete').focus();
      }, 'delete'));
      card.append(copy, actions); $('items').append(card);
    }
    $('empty').hidden = data.items.length > 0;
    $('empty-title').textContent = folder === null ? 'Tu próxima clase empieza acá' : 'Todavía no hay apuntes';
    $('empty-description').textContent = folder === null ? 'Creá tu primera carpeta para organizar tus materias, o entrá en “Sin carpeta” para escribir un apunte.' : 'Elegí “Nuevo apunte” para guardar lo que aprendiste.';
    if (data.pages > 1) {
      const navigate = next => async () => { page = next; await load(); };
      const previous = button('‹', navigate(page - 1)); previous.setAttribute('aria-label', 'Página anterior'); previous.disabled = page === 1; $('pagination').append(previous);
      const pages = [...new Set([1, page - 1, page, page + 1, data.pages])].filter(n => n >= 1 && n <= data.pages).sort((a,b) => a-b);
      let last = 0;
      for (const n of pages) { if (last && n - last > 1) { const gap = document.createElement('span'); gap.textContent = '…'; $('pagination').append(gap); } const link = button(String(n), navigate(n)); link.setAttribute('aria-label', 'Página ' + n); if (n === page) link.setAttribute('aria-current', 'page'); $('pagination').append(link); last = n; }
      const next = button('›', navigate(page + 1)); next.setAttribute('aria-label', 'Página siguiente'); next.disabled = page === data.pages; $('pagination').append(next);
    }
    feedback(`${data.total} ${folder === null ? 'carpetas · 4 por página' : 'apuntes'}${data.pages > 1 ? ` · Página ${page} de ${data.pages}` : ''}`);
  }
  function openFolder(item = null) {
    folderEdit = item; $('folder-dialog-title').textContent = item ? 'Editar carpeta' : 'Nueva carpeta';
    $('folder-input').value = item?.nombre || ''; $('folder-detail').value = item?.descripcion || ''; $('folder-error').textContent = ''; $('folder-dialog').showModal(); $('folder-input').focus();
  }
  function openEditor(item = null) {
    note = item; dirty = false; $('library').hidden = true; $('editor').hidden = false;
    $('editor-heading').textContent = item ? 'Editar apunte' : 'Nuevo apunte';
    $('note-name').value = item?.nombre || ''; $('note-description').value = item?.descripcion || ''; $('note-content').value = item?.contenido || '';
    $('save-status').textContent = item ? 'Todos los cambios están guardados.' : 'Escribí tu apunte y guardalo para retomarlo después.'; feedback(''); $('note-name').focus();
  }
  $('note-form').addEventListener('input', () => { dirty = true; $('save-status').textContent = 'Tenés cambios sin guardar.'; });
  $('note-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; $('save-note').disabled = true;
    const body = { id: note?.id || 0, version: note?.version || 0, carpeta_id: folder || 0, nombre: $('note-name').value, descripcion: $('note-description').value, contenido: $('note-content').value };
    $('save-status').textContent = 'Guardando…';
    try {
      const result = await post('save', body); note = { ...body, id: result.id, version: result.version };
      dirty = body.nombre !== $('note-name').value || body.descripcion !== $('note-description').value || body.contenido !== $('note-content').value;
      $('save-status').textContent = dirty ? 'Se guardó la versión anterior. Guardá los últimos cambios.' : 'Todos los cambios están guardados.'; $('editor-heading').textContent = 'Editar apunte';
    } catch (error) { $('save-status').textContent = error.message + ' Tu texto sigue en el editor.'; }
    finally { busy = false; $('save-note').disabled = false; }
  });
  $('close-editor').addEventListener('click', () => { if (!busy && (!dirty || confirm('Tenés cambios sin guardar. ¿Querés descartarlos?'))) { dirty = false; load().catch(error => feedback(error.message)); } });
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
  $('folder-form').addEventListener('submit', async event => {
    event.preventDefault(); const submit = event.submitter; submit.disabled = true;
    try { await post('folder-save', { id: folderEdit?.id || 0, nombre: $('folder-input').value, descripcion: $('folder-detail').value }); $('folder-dialog').close(); if (!folderEdit) page = 1; await load(); }
    catch (error) { if ($('folder-dialog').open) $('folder-error').textContent = error.message; else feedback(error.message); }
    finally { submit.disabled = false; }
  });
  $('delete-form').addEventListener('submit', async event => {
    event.preventDefault(); const submit = event.submitter; submit.disabled = true;
    try { await post(deletion.isFolder ? 'folder-delete' : 'delete', { id: deletion.id }); $('delete-dialog').close(); await load(); }
    catch (error) { if ($('delete-dialog').open) $('delete-error').textContent = error.message; else feedback(error.message); }
    finally { submit.disabled = false; }
  });
  $('cancel-folder').onclick = () => $('folder-dialog').close(); $('cancel-delete').onclick = () => $('delete-dialog').close();
  $('create-folder').onclick = () => openFolder(); $('create-note').onclick = () => openEditor();
  function navigate(value) { folder = value; page = 1; load().catch(error => feedback(error.message)); }
  $('folders-tab').onclick = $('back-folders').onclick = () => navigate(null); $('loose-tab').onclick = () => navigate(0);
  requireAuthenticatedPage().then(() => load()).catch(error => feedback(error.message));
})();
