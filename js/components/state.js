// ===== EMPTY / ERROR STATE BLOCKS =====

export function emptyState({ icon = defaultIcon(), title = "Belum ada data", message = "", actionHtml = "" } = {}) {
  return `
    <div class="state-block">
      <div class="state-icon">${icon}</div>
      <h3>${title}</h3>
      ${message ? `<p>${message}</p>` : ""}
      ${actionHtml}
    </div>
  `;
}

export function errorState({ title = "Gagal memuat data", message = "Terjadi kesalahan saat mengambil data dari Firestore.", actionHtml = "" } = {}) {
  return `
    <div class="state-block state-error">
      <div class="state-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h3>${title}</h3>
      <p>${message}</p>
      ${actionHtml}
    </div>
  `;
}

function defaultIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`;
}
