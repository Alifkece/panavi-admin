// ===== GENERIC MODAL =====
// Renders a modal into #modal-root. Only one "form" modal is kept mounted
// at a time; confirm dialogs (confirmDialog.js) stack independently.

let overlayEl = null;

function getRoot() {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} opts.bodyHtml
 * @param {string} [opts.footHtml]
 * @param {boolean} [opts.wide]
 * @param {Function} [opts.onMount] - called with the modal box element after render
 * @param {Function} [opts.onClose]
 */
export function openModal({ title, subtitle = "", bodyHtml, footHtml = "", wide = false, onMount, onClose }) {
  closeModal();
  const root = getRoot();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <h3>${title}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
        <button type="button" class="modal-close" data-modal-close aria-label="Tutup">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ""}
    </div>
  `;
  root.appendChild(overlay);
  overlayEl = overlay;
  requestAnimationFrame(() => overlay.classList.add("open"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-modal-close]")) closeModal();
  });
  document.addEventListener("keydown", escHandler);

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
  }
  overlay._escHandler = escHandler;
  overlay._onClose = onClose;

  if (onMount) onMount(overlay.querySelector(".modal-box"));
  return overlay;
}

export function closeModal() {
  if (!overlayEl) return;
  const overlay = overlayEl;
  overlay.classList.remove("open");
  document.removeEventListener("keydown", overlay._escHandler);
  if (typeof overlay._onClose === "function") overlay._onClose();
  setTimeout(() => overlay.remove(), 260);
  overlayEl = null;
}
