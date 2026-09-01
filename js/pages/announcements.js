// ===== ANNOUNCEMENTS PAGE =====
import { listAnnouncements, saveAnnouncement, deleteAnnouncement } from "../services/announcementsService.js";
import { openModal, closeModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError } from "../components/toast.js";
import { skeletonList } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { escHtml, formatDate } from "../utils/format.js";

let allAnn = [];

const TYPE_TONE = { info: "cyan", warning: "amber", success: "emerald", danger: "rose" };

export async function render(container) {
  container.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h1>Announcements</h1>
        <p>Pengumuman muncul sebagai popup notifikasi di Store setelah pelanggan login.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-add-ann">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Buat Pengumuman
      </button>
    </div>
    <section class="section-card">
      <div class="section-card-body" style="padding-top:18px;">
        <div class="mini-list" id="ann-list">${skeletonList(4)}</div>
      </div>
    </section>
  `;

  container.querySelector("#btn-add-ann").addEventListener("click", () => openAnnForm(null));
  await loadAndRender();
}

async function loadAndRender() {
  try {
    allAnn = await listAnnouncements();
    renderList();
  } catch (e) {
    console.error(e);
    document.getElementById("ann-list").innerHTML = errorState({});
  }
}

function renderList() {
  const el = document.getElementById("ann-list");
  if (!allAnn.length) {
    el.innerHTML = emptyState({ title: "Belum ada pengumuman", message: "Buat pengumuman baru untuk menginformasikan pelanggan." });
    return;
  }
  el.innerHTML = allAnn
    .map((a) => {
      const tone = TYPE_TONE[a.type] || "cyan";
      return `
      <div class="mini-list-item">
        <div class="mli-icon icon-tone-${tone}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/></svg>
        </div>
        <div class="mli-body">
          <div class="mli-title">${escHtml(a.title || "-")} ${a.active === false ? '<span class="badge badge-neutral" style="margin-left:6px;">Nonaktif</span>' : ""}</div>
          <div class="mli-sub">${escHtml((a.msg || "").slice(0, 60))}${(a.msg || "").length > 60 ? "…" : ""} · ${formatDate(a.createdAt)}</div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit="${a.id}" aria-label="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button type="button" class="btn btn-danger btn-icon btn-sm" data-delete="${a.id}" aria-label="Hapus">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    })
    .join("");

  el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openAnnForm(b.dataset.edit)));
  el.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => handleDelete(b.dataset.delete)));
}

async function handleDelete(id) {
  const ok = await confirmDialog({ title: "Hapus pengumuman?", message: "Pengumuman ini akan langsung hilang dari popup Store." });
  if (!ok) return;
  try {
    await deleteAnnouncement(id);
    toastSuccess("Pengumuman berhasil dihapus.");
    await loadAndRender();
  } catch (e) {
    toastError(e.message || "Gagal menghapus pengumuman.");
  }
}

function openAnnForm(id) {
  const a = id ? allAnn.find((x) => x.id === id) : null;
  const bodyHtml = `
    <div class="field">
      <label for="af-title">Judul</label>
      <input type="text" id="af-title" value="${escHtml(a?.title || "")}" placeholder="Pemeliharaan Server" required>
    </div>
    <div class="field">
      <label for="af-msg">Pesan</label>
      <textarea id="af-msg" placeholder="Isi pengumuman untuk pelanggan...">${escHtml(a?.msg || "")}</textarea>
    </div>
    <div class="field">
      <label for="af-type">Tipe</label>
      <select id="af-type">
        <option value="info" ${(!a || a.type === "info") ? "selected" : ""}>Info</option>
        <option value="warning" ${a?.type === "warning" ? "selected" : ""}>Peringatan</option>
        <option value="success" ${a?.type === "success" ? "selected" : ""}>Update</option>
        <option value="danger" ${a?.type === "danger" ? "selected" : ""}>Penting</option>
      </select>
    </div>
    <label class="switch">
      <input type="checkbox" id="af-active" ${a?.active !== false ? "checked" : ""}>
      <span class="switch-track"></span>
      <span style="font-size:12.5px;">Aktifkan pengumuman ini</span>
    </label>
  `;
  const footHtml = `
    <button type="button" class="btn btn-ghost btn-sm" data-modal-close>Batal</button>
    <button type="button" class="btn btn-primary btn-sm" id="btn-save-ann"><span id="save-ann-label">${a ? "Simpan" : "Buat"}</span></button>
  `;
  const overlay = openModal({ title: a ? "Edit Pengumuman" : "Buat Pengumuman", bodyHtml, footHtml });

  overlay.querySelector("#btn-save-ann").addEventListener("click", async () => {
    const title = overlay.querySelector("#af-title").value.trim();
    if (!title) { toastError("Judul wajib diisi."); return; }
    const btn = overlay.querySelector("#btn-save-ann");
    const label = overlay.querySelector("#save-ann-label");
    btn.disabled = true;
    label.innerHTML = `<span class="spinner"></span>`;
    try {
      await saveAnnouncement(a?.id || null, {
        title,
        msg: overlay.querySelector("#af-msg").value.trim(),
        type: overlay.querySelector("#af-type").value,
        active: overlay.querySelector("#af-active").checked,
      });
      toastSuccess(a ? "Pengumuman berhasil diperbarui." : "Pengumuman berhasil dibuat.");
      closeModal();
      await loadAndRender();
    } catch (e) {
      toastError(e.message || "Gagal menyimpan pengumuman.");
      btn.disabled = false;
      label.textContent = a ? "Simpan" : "Buat";
    }
  });
}
