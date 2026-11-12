const menuToggle = document.querySelector("#menuToggle");
const nav = document.querySelector("#nav");
const themeToggle = document.querySelector("#themeToggle");

menuToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.textContent = isOpen ? "✕" : "☰";
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    if (menuToggle) menuToggle.textContent = "☰";
  });
});

themeToggle?.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const lightMode = document.body.classList.contains("light");
  themeToggle.textContent = lightMode ? "☾" : "☼";
  themeToggle.setAttribute("aria-label", lightMode ? "Activar tema oscuro" : "Activar tema claro");
});

document.querySelector("#year").textContent = new Date().getFullYear();
