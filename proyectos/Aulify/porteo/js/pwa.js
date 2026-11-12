// Instalación móvil. Los navegadores sin aviso automático usan su propio menú.
(() => {
	const scriptUrl = document.currentScript.src;
	let installPrompt = null;
	const button = document.querySelector("#install-app");
	const help = document.querySelector("#install-help");
	const isPhone = /iPhone|iPod|Windows Phone|Android.*Mobile/i.test(navigator.userAgent);
	// El APK ya está instalado: no mostrarle instrucciones para instalar la PWA.
	const standalone = /AulifyApp\//i.test(navigator.userAgent)
		|| window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;

	if (isPhone && !standalone && help) {
		help.hidden = false;
		help.textContent = !window.isSecureContext
			? "Para instalar Aulify, abre la página con una conexión HTTPS."
			: /iPhone|iPod/i.test(navigator.userAgent)
				? "Para instalar: abre Compartir en Safari y elige Agregar a inicio."
				: "Para instalar: abre el menú del navegador y elige Instalar aplicación o Agregar a inicio.";
	}
	window.addEventListener("beforeinstallprompt", (event) => {
		if (!isPhone || standalone || !button) return;
		event.preventDefault();
		installPrompt = event;
		button.hidden = false;
	});
	button?.addEventListener("click", async () => {
		if (!installPrompt) return;
		const prompt = installPrompt;
		installPrompt = null;
		button.hidden = true;
		await prompt.prompt();
		await prompt.userChoice;
	});
	window.addEventListener("appinstalled", () => {
		if (button) button.hidden = true;
		if (help) help.hidden = true;
		installPrompt = null;
	});
	// El worker vive en js; Apache le permite cubrir el directorio Frontend.
	if ("serviceWorker" in navigator && window.isSecureContext) {
		navigator.serviceWorker.register(new URL("service-worker.js", scriptUrl), {
			scope: new URL("../../Frontend/", scriptUrl).href,
		})
			.catch((error) => console.warn("No se pudo preparar la app instalable:", error));
	}
})();
