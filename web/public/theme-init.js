// Applies the saved light/dark theme before first paint. A separate file so the
// SPA Content-Security-Policy can keep script-src 'self' (no inline scripts).
try {
  var mode = localStorage.getItem("epure-theme-mode");
  var root = document.documentElement;
  root.setAttribute("data-style", "orbit");
  try {
    localStorage.setItem("epure-style-theme", "orbit");
  } catch (e) {}
  if (mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
} catch (e) {}
