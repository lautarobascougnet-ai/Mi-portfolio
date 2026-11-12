// Lógica de la página login; se carga después de sus elementos HTML.
const form = document.querySelector("#login-form");
const feedback = document.querySelector("#feedback");
const button = document.querySelector("#submit-button");
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	feedback.className = "hidden";
	button.disabled = true;
	try {
		const values = Object.fromEntries(new FormData(form));
		await loginUser(values.email, values.password);
		// Destino permitido explícitamente: nunca redirige a una URL externa.
		const next = new URLSearchParams(location.search).get('next') || '';
		window.location.href = next === 'serprofe' ? 'serprofe.html' : /^clase\.html\?id=[1-9]\d*$/.test(next) ? next : 'home.html';
	} catch (error) {
		feedback.textContent = error.message;
		feedback.className =
			"mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[calc(.875rem+2px)] text-red-700";
		button.disabled = false;
	}
});
