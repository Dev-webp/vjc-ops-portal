document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMsg');
  errorEl.textContent = '';
  try {
    await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    window.location.href = '/dashboard.html';
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
  }
});

// If already logged in, skip straight to dashboard
loadCurrentUser().then((user) => {
  if (user) window.location.href = '/dashboard.html';
});
// Password show / hide
const passwordInput = document.getElementById("password");
const passwordEye = document.getElementById("passwordEye");

if (passwordEye && passwordInput) {
  passwordEye.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      passwordEye.innerHTML = "&#128064;";
    } else {
      passwordInput.type = "password";
      passwordEye.innerHTML = "&#128065;";
    }
  });
}