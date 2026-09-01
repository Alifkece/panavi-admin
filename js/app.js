// ===== PANAVIBUNGA ADMIN — APP ENTRY =====
import { watchAuth, login, getAuthErrorMessage } from "./services/authService.js";
import { qs } from "./utils/dom.js";
import { toastError } from "./components/toast.js";
import { initSidebar } from "./components/sidebar.js";
import { renderTopbarUser, onRefresh, onGlobalSearch } from "./components/topbar.js";
import { registerRoute, startRouter, navigate, getCurrentRoute } from "./router.js";
import { initPlayerEngine, getAudioElement } from "./services/playerEngine.js";

import * as dashboardPage from "./pages/dashboard.js";
import * as productsPage from "./pages/products.js";
import * as stockPage from "./pages/stock.js";
import * as ordersPage from "./pages/orders.js";
import * as songsPage from "./pages/songs.js";
import * as mediaPage from "./pages/media.js";
import * as announcementsPage from "./pages/announcements.js";
import * as settingsPage from "./pages/settings.js";
import * as profilePage from "./pages/profile.js";

registerRoute("dashboard", { title: "Dashboard", subtitle: "panavibunga-store · Firestore live", render: dashboardPage.render });
registerRoute("products", { title: "Produk", subtitle: "Collection: products", render: productsPage.render });
registerRoute("stock", { title: "Stock", subtitle: "Collection: stock", render: stockPage.render });
registerRoute("orders", { title: "Orders", subtitle: "Collection: orders", render: ordersPage.render });
registerRoute("songs", { title: "Music", subtitle: "Collection: songs", render: songsPage.render });
registerRoute("media", { title: "Media", subtitle: "Doc: settings/mediaLibrary", render: mediaPage.render });
registerRoute("announcements", { title: "Announcements", subtitle: "Collection: announcements", render: announcementsPage.render });
registerRoute("settings", { title: "Settings", subtitle: "Collection: settings/store", render: settingsPage.render });
registerRoute("profile", { title: "Profile", subtitle: "Akun Admin", render: profilePage.render });

let appStarted = false;

watchAuth(({ user, isAdmin }) => {
  const loader = qs("#page-loader");
  const authScreen = qs("#auth-screen");
  const shell = qs("#app-shell");

  if (user && isAdmin) {
    authScreen.classList.add("hidden");
    shell.classList.remove("hidden");
    renderTopbarUser(user);
    if (!appStarted) {
      appStarted = true;
      initSidebar();
      initPlayerEngine();
      startRouter();
      onRefresh(async () => {
        const route = getCurrentRoute();
        window.location.hash = "";
        navigate(route);
      });
      onGlobalSearch(() => {}); // live filtering happens per-page; kept for UX affordance
      qs("#global-search").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.value.trim()) {
          sessionStorage.setItem("admin-global-search", e.target.value.trim());
          navigate("products");
        }
      });
      initKeyboardShortcuts();
    }
  } else {
    shell.classList.add("hidden");
    authScreen.classList.remove("hidden");
    appStarted = false;
    getAudioElement()?.pause();
  }
  loader.classList.add("hidden");
});

// ===== KEYBOARD SHORTCUTS =====
// Ctrl/Cmd+S = save (active modal), Ctrl/Cmd+F = focus search, Ctrl/Cmd+N = new
// item on the current page. ESC-to-close-modal is already handled by modal.js.
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.key.toLowerCase() === "s") {
      const saveBtn = document.querySelector('.modal-overlay.open [data-hotkey="save"]');
      if (saveBtn) {
        e.preventDefault();
        saveBtn.click();
      }
      return;
    }
    if (e.key.toLowerCase() === "f") {
      const search = qs("#global-search");
      if (search) {
        e.preventDefault();
        search.focus();
        search.select();
      }
      return;
    }
    if (e.key.toLowerCase() === "n") {
      const newBtn = document.querySelector('#page-content [data-hotkey="new"]');
      if (newBtn) {
        e.preventDefault();
        newBtn.click();
      }
    }
  });
}
const loginForm = qs("#login-form");
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = qs("#login-email").value.trim();
  const password = qs("#login-password").value;
  const errEl = qs("#login-error");
  const btn = qs("#btn-login");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>`;
  try {
    await login(email, password);
  } catch (err) {
    const msg = getAuthErrorMessage(err.code);
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
    toastError(msg, "Gagal masuk");
  }
  btn.disabled = false;
  btn.innerHTML = `<span>Masuk ke Dashboard</span>`;
});
