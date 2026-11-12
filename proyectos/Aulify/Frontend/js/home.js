// Lógica de la página home; se carga después de sus elementos HTML.
let cards = [...document.querySelectorAll(".teacher-card")];
const list = document.querySelector("#teacher-list");
const count = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const subjectFilter = document.querySelector("#subject-filter");
// Las nueve materias populares siguen disponibles aunque aún no tengan publicaciones.
document.querySelectorAll('#published-subjects .subject-card').forEach(link => {
	if (![...subjectFilter.options].some(option => option.value === link.dataset.subject)) {
		subjectFilter.add(new Option(link.querySelector('h2').textContent, link.dataset.subject));
	}
});
const sortFilter = document.querySelector("#sort-filter");
const searchFilter = document.querySelector("#search-filter");
const ratingOptions = [...document.querySelectorAll(".rating-option")];
const ratingLabel = document.querySelector("#rating-label");
const profileButton = document.querySelector("#profile-button");
const profileMenu = document.querySelector("#profile-menu");
const userGreeting = document.querySelector("#user-greeting");
const logoutButton = document.querySelector("#logout-button");
let selectedRating = 0;
const normalizeText = (text) =>
	text
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

requireAuthenticatedPage()
	.then((user) => {
		renderCurrentUser(user);
	})
	.catch((error) => {
		if (error.status === 401) {
			return;
		}
		console.error("No se pudo cargar la sesión del usuario:", error);
	});
logoutButton.addEventListener("click", async () => {
	try {
		await logoutUser();
		// Reemplaza la página privada actual: Atrás no vuelve al home.
		window.location.replace("Index.html");
	} catch (error) {
		console.error("No se pudo cerrar la sesión:", error);
	}
});

// Filtra y ordena las tarjetas según los controles activos.
function applyFilters() {
	const mode = document.querySelector('input[name="mode"]:checked').value;
	const rating = selectedRating;
	const subject = subjectFilter.value;
	const search = normalizeText(searchFilter.value.trim());
	const visibleCards = cards.filter((card) => {
		const matchesMode = !mode || card.dataset.mode === mode || card.dataset.mode === 'ambas';
		const matchesSubject = !subject || card.dataset.subject === subject;
		const matchesRating = Number(card.dataset.rating) >= rating;
		const matchesSearch =
			!search || normalizeText(card.textContent).includes(search);
		return (
			matchesMode && matchesSubject && matchesRating && matchesSearch && (card.dataset.currency || "EUR") === document.querySelector("#currency-filter").value && Number(card.dataset.price) <= Number(document.querySelector("#price-filter").value)
		);
	});

	cards.forEach((card) => {
		card.hidden = !visibleCards.includes(card);
	});
	[...visibleCards]
		.sort((first, second) => {
			if (sortFilter.value === "price") {
				return Number(first.dataset.price) - Number(second.dataset.price);
			}
			return Number(second.dataset.rating) - Number(first.dataset.rating);
		})
		.forEach((card) => list.appendChild(card));
	count.textContent = visibleCards.length;
	emptyState.classList.toggle("hidden", visibleCards.length !== 0);
}

document
	.querySelectorAll(".filter")
	.forEach((filter) => filter.addEventListener("change", applyFilters));
searchFilter.addEventListener("input", applyFilters);
ratingOptions.forEach((option) =>
	option.addEventListener("click", () => {
		// Pulsar otra vez la estrella elegida quita el mínimo de calificación.
		selectedRating = selectedRating === Number(option.dataset.value) ? 0 : Number(option.dataset.value);
		ratingOptions.forEach((star) => {
			const filled = Number(star.dataset.value) <= selectedRating;
			star.textContent = filled ? "★" : "☆";
			star.classList.toggle("text-[#d38b26]", filled);
			star.classList.toggle("text-[#c9c5bc]", !filled);
			star.setAttribute('aria-pressed', String(Number(star.dataset.value) === selectedRating));
		});
		ratingLabel.textContent = selectedRating ? `${selectedRating}+ estrellas` : 'Todas';
		applyFilters();
	}),
);
// Restablece los controles antes de elegir una materia desde su tarjeta.
function resetFilters() {
	document.querySelector('input[name="mode"][value=""]').checked = true;
	subjectFilter.value = "";
	sortFilter.value = "rating";
	searchFilter.value = "";
	selectedRating = 0;
	document.querySelector("#price-filter").value = document.querySelector("#price-filter").max;
	document.querySelector("#price-label").textContent = document.querySelector("#price-filter").max + " " + document.querySelector("#currency-filter").value + "/hora";
	ratingOptions.forEach((star) => {
		star.textContent = "☆";
		star.classList.remove("text-[#d38b26]");
		star.classList.add("text-[#c9c5bc]");
		star.setAttribute('aria-pressed', 'false');
	});
	ratingLabel.textContent = "Todas";
	document.querySelector("#teacher-feedback").classList.add("hidden");
}

// La URL conserva la materia para recargar, compartir y usar Atrás/Adelante.
function updateSubjectUrl(push = false) {
	const url = new URL(window.location.href);
	if (subjectFilter.value) url.searchParams.set("materia", subjectFilter.value);
	else url.searchParams.delete("materia");
	url.hash = "profesores";
	window.history[push ? "pushState" : "replaceState"](null, "", url);
}

function readSubjectUrl() {
	const subject = new URL(window.location.href).searchParams.get("materia") || "";
	resetFilters();
	if ([...subjectFilter.options].some((option) => option.value === subject)) {
		subjectFilter.value = subject;
	}
	applyFilters();
}

document.querySelector('#published-subjects').addEventListener('click', event => {
		const link = event.target.closest('.subject-card[data-subject]');
		if (!link) return;
		// Conserva abrir en otra pestaña con Ctrl/Cmd o clic central.
		if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
		event.preventDefault();
		resetFilters();
		subjectFilter.value = link.dataset.subject;
		applyFilters();
		updateSubjectUrl(true);
		document.querySelector("#profesores").scrollIntoView({ block: "start" });
});
subjectFilter.addEventListener("change", () => updateSubjectUrl());
window.addEventListener("popstate", readSubjectUrl);

document.querySelector("#clear-filters").addEventListener("click", () => {
	resetFilters();
	applyFilters();
	updateSubjectUrl();
});

// Precio y acciones de las tarjetas de demostración.
document.querySelector("#price-filter").addEventListener("input", (event) => {
	document.querySelector("#price-label").textContent = event.target.value + " " + document.querySelector("#currency-filter").value + "/hora";
	applyFilters();
});
document.querySelector("#currency-filter").addEventListener("change", () => {
	const price = document.querySelector("#price-filter");
	const currency = document.querySelector("#currency-filter").value;
	const matchingPrices = cards.filter(card => (card.dataset.currency || "EUR") === currency).map(card => Number(card.dataset.price));
	price.max = Math.ceil(Math.max(50, ...matchingPrices));
	price.value = price.max;
	document.querySelector("#price-label").textContent = price.max + " " + currency + "/hora";
	applyFilters();
});
readSubjectUrl();

// Las clases nuevas participan en los mismos filtros que las tarjetas existentes.
document.addEventListener('classes-loaded', () => {
	cards = [...document.querySelectorAll('.teacher-card')];
	const price = document.querySelector('#price-filter');
	const wasMax = price.value === price.max;
	price.max = Math.ceil(Math.max(50, ...cards.filter(card => (card.dataset.currency || 'EUR') === document.querySelector('#currency-filter').value).map(card => Number(card.dataset.price))));
	if (wasMax) { price.value = price.max; document.querySelector('#price-label').textContent = price.max + ' ' + document.querySelector('#currency-filter').value + '/hora'; }
	const subject = new URL(location.href).searchParams.get('materia');
	if (subject && [...subjectFilter.options].some(option => option.value === subject)) subjectFilter.value = subject;
	applyFilters();
});

// Abre y cierra el menú desplegable del perfil.
function toggleProfileMenu() {
	const isOpen = profileMenu.classList.contains("visible");
	profileMenu.classList.toggle("visible", !isOpen);
	profileMenu.classList.toggle("invisible", isOpen);
	profileMenu.classList.toggle("opacity-100", !isOpen);
	profileMenu.classList.toggle("opacity-0", isOpen);
	profileMenu.classList.toggle("scale-100", !isOpen);
	profileMenu.classList.toggle("scale-95", isOpen);
	profileButton.setAttribute("aria-expanded", String(!isOpen));
}

profileButton.addEventListener("click", toggleProfileMenu);
document.addEventListener("click", (event) => {
	if (
		!profileButton.contains(event.target) &&
		!profileMenu.contains(event.target) &&
		profileMenu.classList.contains("visible")
	) {
		toggleProfileMenu();
	}
});
document.addEventListener("keydown", (event) => {
	if (
		event.key === "Escape" &&
		profileMenu.classList.contains("visible")
	) {
		toggleProfileMenu();
	}
});
