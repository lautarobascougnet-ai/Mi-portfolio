// Catálogo compartido por la portada pública y el listado del home.
(() => {
	const list = document.querySelector('#teacher-list, #public-class-list');
	const filter = document.querySelector('#subject-filter, #public-class-filter');
	if (!list || !filter) return;
	const key = value => {
		const normalized = value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
		if (normalized === 'matematica') return 'matematicas';
		return normalized;
	};
	const hiddenFilterSubjects = new Set(['clash royale', 'hola']);
	const element = (tag, text, classes) => { const node = document.createElement(tag); node.textContent = text; node.className = classes || ''; return node; };
	const publicPage = list.id === 'public-class-list';
	const status = document.querySelector('#catalog-feedback');
	// Silueta de las cartas de demostración para perfiles sin foto o imágenes eliminadas.
	function placeholder() {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 160 120'); svg.setAttribute('class', 'h-36 w-48 text-[#d9d9d9]'); svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
		const circle = document.createElementNS(svg.namespaceURI, 'circle');
		circle.setAttribute('cx', '80'); circle.setAttribute('cy', '33'); circle.setAttribute('r', '25');
		const shape = document.createElementNS(svg.namespaceURI, 'path'); shape.setAttribute('d', 'M28 120V99c0-44 104-44 104 0v21z');
		svg.append(circle, shape); return svg;
	}
	function teacherPhoto(item) {
		const frame = element('div', '', 'mb-4 flex h-40 items-end justify-center overflow-hidden rounded-lg bg-[#f5f5f5]');
		// Solo fotos locales de perfil, sin URLs externas ni rutas arbitrarias.
		if (/^Backend\/conexiones\/uploads\/perfiles\/[a-zA-Z0-9_]+\.(jpg|png|webp)$/.test(item.foto_perfil || '')) {
			const image = document.createElement('img');
			image.alt = 'Foto de ' + item.profesor; image.loading = 'lazy'; image.className = 'h-full w-full object-cover';
			image.addEventListener('error', () => frame.replaceChildren(placeholder()), { once: true });
			image.src = new URL('../' + item.foto_perfil, location.href).href; frame.append(image);
		} else frame.append(placeholder());
		return frame;
	}
	function filterPublic() {
		for (const card of list.children) card.hidden = !!filter.value && card.dataset.subject !== filter.value;
	}
	if (publicPage) filter.addEventListener('change', filterPublic);
	fetch(new URL('../Backend/conexiones/api/classes', location.href), { cache: 'no-store' })
		.then(async response => { if (!response.ok) throw new Error('No se pudieron cargar las clases publicadas. Recargá para reintentar.'); return response.json(); })
		.then(data => {
			for (const subject of data.subjects || []) {
				const normalizedSubject = key(subject.nombre);
				if (!hiddenFilterSubjects.has(normalizedSubject) && ![...filter.options].some(option => option.value === normalizedSubject)) filter.add(new Option(subject.nombre, normalizedSubject));
			}
			for (const item of data.classes) {
				const subject = key(item.materia);
				if (!hiddenFilterSubjects.has(subject) && ![...filter.options].some(option => option.value === subject)) filter.add(new Option(item.materia, subject));
				const card = element('article', '', 'teacher-card grid grid-rows-[auto_auto_auto_auto_auto_1fr_auto] min-w-0 rounded-xl border border-[#bacbd8] bg-[#dce9f3] p-5 text-[#171c24] shadow-lg');
				Object.assign(card.dataset, { classId: item.id, subject, mode: item.modalidad, price: item.precio, currency: item.moneda || 'EUR', rating: item.rating || 0 });
				const ratingValue = item.rating === null || item.rating === undefined ? null : Number(item.rating);
				const rating = Number.isFinite(ratingValue) ? Math.max(0, Math.min(5, ratingValue)) : null;
				const stars = element('p', rating === null ? '☆☆☆☆☆ ' : '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) + ' ', 'text-[calc(.875rem+2px)] text-[#f28b27]');
				stars.append(element('span', rating === null ? 'Sin calificación' : rating.toFixed(1) + ' / 5', 'text-[calc(.75rem+2px)] text-[#52616b]'));
				const price = new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.moneda || 'EUR' }).format(Number(item.precio));
				card.append(teacherPhoto(item), stars, element('h3', item.materia, 'mt-2 font-semibold text-[#39844b]'), element('p', item.profesor, 'mt-1 text-[calc(.875rem+2px)]'), element('p', `${price}/hora`, 'mt-2 font-semibold'), element('p', item.descripcion, 'mt-3 whitespace-pre-wrap text-[calc(.875rem+2px)] leading-6 text-[#52616b]'));
				const actions = element('div', '', 'mt-5 grid grid-cols-2 gap-2');
				for (const [label, color, target] of [
					['Agendar clase', 'bg-[#202321] hover:bg-[#343a36]', 'clase.html?id=' + item.id],
					['Ver perfil', 'bg-[#06165e] hover:bg-[#142b7a]', 'profesor.html?id=' + item.profesor_id],
				]) {
					const button = element('button', label, 'rounded-full border border-transparent px-3 py-2 text-[calc(.75rem+2px)] text-white ' + color); button.type = 'button';
					button.addEventListener('click', () => { location.href = target; }); actions.append(button);
				}
				card.append(actions); list.append(card);
			}
			if (status) status.textContent = publicPage && !data.classes.length ? 'Todavía no hay clases publicadas.' : '';
			if (publicPage) filterPublic();
			else document.dispatchEvent(new Event('classes-loaded'));
		})
		.catch(error => { if (status) status.textContent = error.message; });
})();
