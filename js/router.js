// ===== ROUTER =====
import { qs } from "./utils/dom.js";
import { setActiveNav } from "./components/sidebar.js";
import { setPageTitle } from "./components/topbar.js";

const routes = {};
let currentRoute = null;

/** @param {string} name @param {{title:string, subtitle?:string, render:Function}} config */
export function registerRoute(name, config) {
  routes[name] = config;
}

export function navigate(route) {
  if (!routes[route]) route = "dashboard";
  window.location.hash = `/${route}`;
}

async function handleHashChange() {
  const hash = window.location.hash.replace(/^#\/?/, "") || "dashboard";
  const route = routes[hash] ? hash : "dashboard";
  if (route === currentRoute) return;
  currentRoute = route;

  setActiveNav(route);
  const config = routes[route];
  setPageTitle(config.title, config.subtitle);

  const container = qs("#page-content");
  container.classList.remove("page-transition-enter");
  void container.offsetWidth; // restart animation
  container.classList.add("page-transition-enter");

  try {
    await config.render(container);
  } catch (e) {
    console.error(`Gagal merender halaman "${route}":`, e);
    container.innerHTML = `<div class="section-card"><div class="section-card-body">
      <div class="state-block state-error">
        <div class="state-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <h3>Terjadi kesalahan</h3>
        <p>Halaman ini gagal dimuat. Coba muat ulang.</p>
      </div>
    </div></div>`;
  }
}

export function startRouter() {
  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

export function getCurrentRoute() {
  return currentRoute;
}
