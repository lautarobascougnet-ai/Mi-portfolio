// Perfil público limitado a información profesional; nunca muestra email, DNI ni adjuntos privados.
(async () => {
	const feedback = document.querySelector('#profile-feedback');
	try {
		const id = new URLSearchParams(location.search).get('id');
		if (!/^[1-9]\d*$/.test(id || '')) throw new Error('Profesor no encontrado.');
		const response = await fetch(new URL('../Backend/conexiones/api/teachers/profile?id=' + id, location.href), { cache: 'no-store' });
		const data = await response.json(); if (!response.ok) throw new Error(data.error);
		const teacher = data.teacher;
		document.querySelector('#teacher-name').textContent = `${teacher.nombre} ${teacher.apellido}`;
		document.querySelector('#teacher-rating').textContent = teacher.rating === null ? 'Sin calificación' : `${Number(teacher.rating).toFixed(1)} / 5`;
		document.querySelector('#teacher-experience').textContent = teacher.experiencia || 'Sin experiencia publicada.';
		document.querySelector('#teacher-titles').textContent = teacher.titulos || '';
		document.querySelector('#teacher-description').textContent = teacher.descripcion || 'Sin descripción publicada.';
		if (/^Backend\/conexiones\/uploads\/perfiles\/[a-zA-Z0-9_]+\.(jpg|png|webp)$/.test(teacher.foto_perfil || '')) {
			const image = document.querySelector('#teacher-photo'); image.src = new URL('../' + teacher.foto_perfil, location.href).href;
			image.addEventListener('error', () => { image.src = 'aulify-icon.svg'; }, { once: true });
		}
		const list = document.querySelector('#teacher-classes');
		if (!data.classes.length) list.textContent = 'Este profesor todavía no publicó clases.';
		for (const item of data.classes) {
			const card = document.createElement('article'); card.className = 'rounded-xl bg-[#dce9f3] p-5';
			const title = document.createElement('h3'); title.textContent = item.materia; title.className = 'font-semibold';
			const description = document.createElement('p'); description.textContent = item.descripcion; description.className = 'mt-3 whitespace-pre-wrap text-[calc(.875rem+2px)]';
			const link = document.createElement('a'); link.href = 'clase.html?id=' + item.id; link.textContent = 'Ver horarios y agendar'; link.className = 'mt-5 inline-block rounded-full bg-[#06165e] px-5 py-3 text-[calc(.875rem+2px)] text-white';
			card.append(title, description, link); list.append(card);
		}
		document.querySelector('#public-profile').hidden = false; feedback.textContent = '';
	} catch (error) { feedback.textContent = error.message || 'No se pudo cargar el perfil.'; }
})();
