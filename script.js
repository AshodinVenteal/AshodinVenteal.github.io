document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("project-form");
form.addEventListener("submit", () => {
  const button = form.querySelector('button[type="submit"]');
  button.textContent = "Sending…";
  button.setAttribute("aria-busy", "true");
});
