// ===== TOAST NOTIFICATIONS =====
import { escHtml } from "../utils/format.js";

const ICONS = {
  success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

function ensureStack() {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

export function toast(message, { type = "success", title, duration = 3200 } = {}) {
  const stack = ensureStack();
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.innerHTML = `
    ${ICONS[type] || ICONS.info}
    <div>
      ${title ? `<strong>${escHtml(title)}</strong>` : ""}
      <p>${escHtml(message)}</p>
    </div>
  `;
  stack.appendChild(node);
  const remove = () => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 220);
  };
  setTimeout(remove, duration);
  node.addEventListener("click", remove);
  return remove;
}

export const toastSuccess = (msg, title = "Berhasil") => toast(msg, { type: "success", title });
export const toastError = (msg, title = "Gagal") => toast(msg, { type: "error", title });
export const toastInfo = (msg, title) => toast(msg, { type: "info", title });
