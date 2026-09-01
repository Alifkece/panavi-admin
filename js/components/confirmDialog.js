// ===== CONFIRM DIALOG =====
import { openModal, closeModal } from "./modal.js";

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {"danger"|"signal"} [opts.tone]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title = "Yakin?", message = "", confirmText = "Hapus", cancelText = "Batal", tone = "danger" } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const bodyHtml = `
      <div class="confirm-icon ${tone === "signal" ? "tone-signal" : ""}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <p style="font-size:13px;color:var(--text-2);line-height:1.6;">${message}</p>
    `;
    const footHtml = `
      <button type="button" class="btn btn-ghost btn-sm" data-confirm-cancel>${cancelText}</button>
      <button type="button" class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"} btn-sm" data-confirm-ok>${confirmText}</button>
    `;
    const overlay = openModal({
      title,
      bodyHtml,
      footHtml,
      onClose: () => {
        if (!settled) { settled = true; resolve(false); }
      },
    });
    overlay.querySelector("[data-confirm-cancel]").addEventListener("click", () => {
      settled = true;
      resolve(false);
      closeModal();
    });
    overlay.querySelector("[data-confirm-ok]").addEventListener("click", () => {
      settled = true;
      resolve(true);
      closeModal();
    });
  });
}
