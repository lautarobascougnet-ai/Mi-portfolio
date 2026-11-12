// Las rutas de abajo ya empiezan con "/"; la base no debe terminar en barra
// para evitar solicitudes inválidas como "api//auth/me".
const API_BASE_URL = new URL("../Backend/conexiones/api", window.location.href).href;

async function apiRequest(path, options = {}) {
	let response;
	try {
		response = await fetch(`${API_BASE_URL}${path}`, {
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(options.headers || {}),
			},
			...options,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
	} catch (error) {
		throw new Error(
			"No se pudo conectar con el servidor. Verifica que Apache y MySQL estén iniciados en XAMPP.",
		);
	}

	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(
			data.error || `El servidor respondió con el estado ${response.status}.`,
		);
		error.status = response.status;
		throw error;
	}
	return data;
}

async function loginUser(email, password) {
	return apiRequest("/auth/login", {
		method: "POST",
		body: { email, password },
	});
}

async function registerUser(user) {
	return apiRequest("/auth/register", { method: "POST", body: user });
}

async function getCurrentUser() {
	return apiRequest("/auth/me");
}

// Verifica la sesión antes de mostrar una página privada y al volver desde el historial.
async function requireAuthenticatedPage(returnTo = "") {
	const redirectToLogin = () => {
		if (/^clase\.html\?id=[1-9]\d*$/.test(returnTo)) { window.location.replace('login.html?next=' + encodeURIComponent(returnTo)); return; }
		window.location.replace(returnTo === "serprofe.html" ? "login.html?next=serprofe" : "login.html");
	};

	try {
		const { user } = await getCurrentUser();
		if (!user || !user.id) throw new Error('No se pudo validar la sesión.');
		if (document.body.hasAttribute('data-private-page')) document.body.hidden = false;
		return user;
	} catch (error) {
		// No mostrar una página privada si la sesión no pudo comprobarse.
		if (document.body.hasAttribute('data-private-page')) document.body.hidden = true;
		redirectToLogin();
		throw error;
	}
}

window.addEventListener("pageshow", (event) => {
	if (!event.persisted || !document.body.hasAttribute('data-private-page')) return;

	requireAuthenticatedPage().catch(() => {});
});

window.addEventListener('pagehide', () => {
	if (document.body.hasAttribute('data-private-page')) document.body.hidden = true;
});

function renderCurrentUser(user) {
	const displayName = user.username || user.nombre;
	document.querySelectorAll("[data-user-name]").forEach((element) => {
		element.textContent = displayName;
	});
	document.querySelectorAll("[data-user-greeting]").forEach((element) => {
		element.textContent = `Hola, ${displayName}`;
	});
	if (user.foto_perfil) {
		document.querySelectorAll("[data-user-avatar]").forEach((element) => {
			element.src = `../${user.foto_perfil}`;
			element.alt = `Foto de perfil de ${displayName}`;
		});
	}
}

async function logoutUser() {
	return apiRequest("/auth/logout", { method: "POST" });
}

// Actualiza todos los datos editables del perfil mediante la API REST.
async function updateProfile(fields) {
	return apiRequest('/user/profile', { method: 'POST', body: fields });
}

async function changePassword(currentPassword, newPassword, confirmPassword) {
	return apiRequest("/user/password", {
		method: "POST",
		body: {
			current_password: currentPassword,
			new_password: newPassword,
			confirm_password: confirmPassword,
		},
	});
}

async function deleteAccount(password) {
	return apiRequest("/user/delete", { method: "POST", body: { password } });
}
