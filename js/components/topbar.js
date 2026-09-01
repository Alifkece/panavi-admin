// ===== TOPBAR BEHAVIOR =====
import { qs } from "../utils/dom.js";
import { initials } from "../utils/format.js";

export function renderTopbarUser(user) {
  const name = user?.displayName || "Admin";
  qs("#topbar-name").textContent = name;
  qs("#topbar-email").textContent = user?.email || "-";
  qs("#topbar-avatar").textContent = initials(name);
}

export function setPageTitle(title, subtitle) {
  qs("#topbar-title").textContent = title;
  if (subtitle) qs("#topbar-subtitle").textContent = subtitle;
}

export function onRefresh(handler) {
  const btn = qs("#btn-refresh");
  btn?.addEventListener("click", async () => {
    const svg = btn.querySelector("svg");
    svg.style.transition = "transform .6s ease";
    svg.style.transform = "rotate(360deg)";
    await handler?.();
    setTimeout(() => { svg.style.transform = "rotate(0deg)"; }, 50);
  });
}

export function onGlobalSearch(handler) {
  const input = qs("#global-search");
  input?.addEventListener("input", () => handler?.(input.value.trim()));
}
