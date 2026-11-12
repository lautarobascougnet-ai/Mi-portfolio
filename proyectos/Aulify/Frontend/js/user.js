// Referencias a los elementos de la interfaz.
const feedback = document.querySelector("#feedback");
const avatar = document.querySelector("#avatar");
const firstNameInput = document.querySelector("#first-name");
const lastNameInput = document.querySelector("#last-name");
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const emailInput = document.querySelector("#email");
let isProfessor = false;
const experienceInput = document.querySelector("#experience");
const titlesInput = document.querySelector("#titles");
const descriptionInput = document.querySelector("#description");
const experiencePhotosInput = document.querySelector("#experience-photos");
const profileRating = document.querySelector("#profile-rating");
const profileExperience = document.querySelector("#profile-experience");
const profileTitles = document.querySelector("#profile-titles");
const titlesHeading = document.querySelector("#titles-heading");
const profileDescription = document.querySelector("#profile-description");
const experienceGallery = document.querySelector("#experience-gallery");
const editor = document.querySelector("#profile-editor");
const saveProfileButton = document.querySelector("#save-profile-button");
let selectedPhoto = "";

// Muestra los mensajes producidos al guardar o validar archivos.
function showFeedback(message, error = false) {
	feedback.textContent = message;
	feedback.className = `mb-5 rounded-lg border px-4 py-3 text-[calc(.875rem+2px)] ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`;
}

// Usa el icono delineado como avatar predeterminado y conserva la foto guardada.
function showAvatar(user) {
	avatar.innerHTML = '<svg viewBox="0 0 80 80" class="h-full w-full" fill="none" stroke="currentColor" stroke-width="0.8" role="img" aria-label="Perfil de usuario"><circle cx="40" cy="29" r="13" /><path d="M14 70c3-24 49-24 52 0" /></svg>';

	if (user.foto_perfil) {
		avatar.innerHTML = `<img src="../${user.foto_perfil}" alt="Foto de perfil" class="h-full w-full object-cover">`;
	}
}

// Renderiza los campos opcionales en la vista publica.
function renderOptionalProfile(user) {
	profileEmail.textContent = user.email || "";
	profileExperience.textContent = user.experiencia || "";
	profileTitles.textContent = user.titulos || "";
	profileDescription.textContent = user.descripcion || "";
	titlesHeading.classList.toggle("hidden", !user.titulos);
	profileTitles.classList.toggle("hidden", !user.titulos);

	const rating = Number(user.rating);
	profileRating.innerHTML =
		user.rating === null || user.rating === undefined || user.rating === ""
			? '<span class="text-[calc(.875rem+2px)] text-[#52616b]">Sin calificación</span>'
			: `<span class="text-[calc(1.5rem+2px)] tracking-widest text-[#f28b27]">${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}</span><span class="text-[calc(.75rem+2px)] text-[#52616b]">${rating.toFixed(1)} / 5</span>`;

	experienceGallery.innerHTML = "";
	experienceGallery.classList.add("hidden");

	if (user.fotos_experiencia) {
		try {
			const photos = JSON.parse(user.fotos_experiencia);
			experienceGallery.innerHTML = photos
				.map(
					(photo) =>
						`<img src="../${photo}" alt="Foto de experiencia" class="h-32 w-full rounded-lg object-cover">`,
				)
				.join("");
			experienceGallery.classList.toggle("hidden", photos.length === 0);
		} catch (error) {
			experienceGallery.classList.add("hidden");
		}
	}
}

// Carga los datos recibidos desde la API en el formulario y la vista.
function hydrateProfile(user) {
	if (!user) return;

	const fullName =
		[user.nombre, user.apellido].filter(Boolean).join(" ") ||
		user.username ||
		"";
	profileName.textContent = fullName;
	isProfessor = user.is_professor === true;
	document.querySelector('#profile-role').textContent = isProfessor ? 'Profesor' : 'Alumno';
	document.querySelectorAll('[data-teacher-only]').forEach(element => {
		element.hidden = !isProfessor;
		if (element.tagName === 'FIELDSET') element.disabled = !isProfessor;
	});
	firstNameInput.value = user.nombre || '';
	lastNameInput.value = user.apellido || '';
	emailInput.value = user.email || "";
	experienceInput.value = user.experiencia || "";
	titlesInput.value = user.titulos || "";
	descriptionInput.value = user.descripcion || "";
	showAvatar(user);
	renderOptionalProfile(user);
}

// Carga inicial del perfil y control de sesion.
requireAuthenticatedPage()
	.then((user) => hydrateProfile(user))
	.catch((error) => {
		if (error.status === 401) {
			window.location.href = "login.html";
			return;
		}

		console.error("No se pudo cargar el perfil:", error);
		showFeedback(error.message, true);
		feedback.scrollIntoView({ behavior: "smooth", block: "center" });
	});

// Abre y cierra el editor.
document
	.querySelector("#edit-profile-button")
	.addEventListener("click", (event) => {
		const isOpen = !editor.classList.contains("hidden");
		editor.classList.toggle("hidden", isOpen);
		event.currentTarget.setAttribute("aria-expanded", String(!isOpen));
	});

document.querySelector("#close-editor").addEventListener("click", () => {
	editor.classList.add("hidden");
	document
		.querySelector("#edit-profile-button")
		.setAttribute("aria-expanded", "false");
});

// Lee la foto principal y muestra una vista previa.
document.querySelector("#photo").addEventListener("change", (event) => {
	const file = event.target.files[0];
	if (!file) return;

	if (file.size > 2 * 1024 * 1024) {
		event.target.value = "";
		showFeedback("La foto no puede superar los 2 MB.", true);
		return;
	}

	const reader = new FileReader();
	reader.onload = () => {
		selectedPhoto = reader.result;
		avatar.innerHTML = `<img src="${selectedPhoto}" alt="Vista previa de foto" class="h-full w-full object-cover">`;
	};
	reader.readAsDataURL(file);
});

// Convierte las fotos adicionales a datos que puede recibir la API.
function readFiles(files) {
	return Promise.all(
		[...files].map(
			(file) =>
				new Promise((resolve, reject) => {
					if (file.size > 2 * 1024 * 1024) {
						reject(new Error("Cada foto no puede superar los 2 MB."));
						return;
					}

					const reader = new FileReader();
					reader.onload = () => resolve(reader.result);
					reader.onerror = () => reject(new Error("No se pudo leer una foto."));
					reader.readAsDataURL(file);
				}),
		),
	);
}

// Guarda todos los campos del perfil y refresca la vista.
document
	.querySelector("#profile-form")
	.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (saveProfileButton) {
			saveProfileButton.disabled = true;
			saveProfileButton.textContent = "Guardando...";
		}

		try {
			const fields = {
				nombre: firstNameInput.value.trim(),
				apellido: lastNameInput.value.trim(),
				email: emailInput.value.trim(),
				photo: selectedPhoto,
			};
			if (isProfessor) Object.assign(fields, {
				experiencia: experienceInput.value.trim(),
				titulos: titlesInput.value.trim(),
				descripcion: descriptionInput.value.trim(),
				experience_photos: await readFiles(experiencePhotosInput.files),
			});
			const result = await apiRequest('/user/profile', { method: 'POST', body: fields });

			selectedPhoto = "";
			document.querySelector("#photo").value = "";
			experiencePhotosInput.value = "";
			hydrateProfile(result.user);
			showFeedback('Perfil actualizado.');
		} catch (error) {
			showFeedback(error.message, true);
			feedback.scrollIntoView({ behavior: "smooth", block: "center" });
		} finally {
			if (saveProfileButton) {
				saveProfileButton.disabled = false;
				saveProfileButton.textContent = "Guardar";
			}
		}
	});
