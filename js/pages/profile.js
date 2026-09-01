// ===== PROFILE PAGE (admin's own account) =====
import { auth } from "../firebase-config.js";
import { changePassword, logout, getAuthErrorMessage } from "../services/authService.js";
import { toastSuccess, toastError } from "../components/toast.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { initials, escHtml } from "../utils/format.js";

export async function render(container) {
  const user = auth.currentUser;
  container.innerHTML = `
    <div class="page-header">
      <h1>Profile</h1>
      <p>Pengaturan akun Admin yang sedang login.</p>
    </div>
    <div class="profile-grid">
      <section class="section-card profile-card">
        <div class="profile-avatar">${initials(user?.displayName || user?.email)}</div>
        <h3 style="font-size:15px;">${escHtml(user?.displayName || "Admin")}</h3>
        <p class="cell-muted" style="margin-top:4px;">${escHtml(user?.email || "-")}</p>
        <div class="divider"></div>
        <button type="button" class="btn btn-danger btn-block" id="btn-logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Keluar
        </button>
      </section>

      <section class="section-card">
        <div class="section-card-head"><div><h2>Ubah Kata Sandi</h2><p>Perbarui kata sandi untuk akun Admin ini</p></div></div>
        <div class="section-card-body">
          <div class="field">
            <label for="p-current">Kata Sandi Saat Ini</label>
            <input type="password" id="p-current" placeholder="••••••••">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="p-new">Kata Sandi Baru</label>
              <input type="password" id="p-new" placeholder="Minimal 6 karakter">
            </div>
            <div class="field">
              <label for="p-confirm">Konfirmasi</label>
              <input type="password" id="p-confirm" placeholder="Ulangi kata sandi baru">
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btn-change-pass">
            <span id="change-pass-label">Simpan Kata Sandi</span>
          </button>
        </div>
      </section>
    </div>
  `;

  container.querySelector("#btn-logout").addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Keluar dari Dashboard?", message: "Anda perlu login kembali untuk mengakses Dashboard Admin.", confirmText: "Keluar", tone: "danger" });
    if (ok) await logout();
  });

  container.querySelector("#btn-change-pass").addEventListener("click", async () => {
    const current = container.querySelector("#p-current").value;
    const next = container.querySelector("#p-new").value;
    const confirm = container.querySelector("#p-confirm").value;
    if (!current || !next) { toastError("Isi kata sandi saat ini dan kata sandi baru."); return; }
    if (next.length < 6) { toastError("Kata sandi baru minimal 6 karakter."); return; }
    if (next !== confirm) { toastError("Konfirmasi kata sandi tidak cocok."); return; }

    const btn = container.querySelector("#btn-change-pass");
    const label = container.querySelector("#change-pass-label");
    btn.disabled = true;
    label.innerHTML = `<span class="spinner"></span>`;
    try {
      await changePassword(current, next);
      toastSuccess("Kata sandi berhasil diperbarui.");
      container.querySelector("#p-current").value = "";
      container.querySelector("#p-new").value = "";
      container.querySelector("#p-confirm").value = "";
    } catch (e) {
      toastError(getAuthErrorMessage(e.code) || e.message);
    }
    btn.disabled = false;
    label.textContent = "Simpan Kata Sandi";
  });
}
