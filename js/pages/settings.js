// ===== SETTINGS PAGE =====
import { getStoreSettings, saveStoreSettings, uploadStoreAvatar } from "../services/settingsService.js";
import { toastSuccess, toastError } from "../components/toast.js";
import { escHtml } from "../utils/format.js";
import { readFileAsDataUrl } from "../utils/dom.js";

let pendingAvatarDataUrl = null;

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Mengelola dokumen <span class="mono">settings/store</span> yang dibaca langsung oleh Store.</p>
    </div>
    <div class="dash-grid">
      <section class="section-card">
        <div class="section-card-head">
          <div><h2>Profil Toko</h2><p>Avatar ini tampil di header Store (mendukung gambar & video).</p></div>
        </div>
        <div class="section-card-body" id="settings-body">
          <div class="skel-block" style="height:220px;"></div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-card-head"><div><h2>Kompatibilitas Data</h2><p>Field yang benar-benar dibaca Store saat ini</p></div></div>
        <div class="section-card-body">
          <div class="detail-item" style="margin-bottom:10px;">
            <label>Collection</label>
            <div class="val cell-mono">settings/store</div>
          </div>
          <div class="detail-item">
            <label>Field aktif dipakai Store</label>
            <div class="val cell-mono">avatarUrl</div>
          </div>
          <p class="field-hint" style="margin-top:14px;line-height:1.6;">
            Field lain (Nama Toko, WhatsApp, Deskripsi) disimpan untuk kebutuhan Admin
            dan pembaruan Store berikutnya. Store versi saat ini akan mengabaikannya
            secara aman tanpa memengaruhi tampilan.
          </p>
        </div>
      </section>
    </div>
  `;

  await loadForm();
}

async function loadForm() {
  const body = document.getElementById("settings-body");
  try {
    const data = await getStoreSettings();
    pendingAvatarDataUrl = null;
    body.innerHTML = `
      <div class="field">
        <label>Avatar / Video Toko</label>
        <label class="upload-drop" id="avatar-drop">
          <img class="thumb" id="avatar-preview" src="${data.avatarUrl ? escHtml(data.avatarUrl) : ""}" style="${data.avatarUrl ? "" : "display:none;"}">
          <div class="upload-text">
            <strong>Klik untuk unggah avatar</strong>
            <span>Gambar (jpg/png/gif/webp) atau video (mp4/webm)</span>
          </div>
          <input type="file" accept="image/*,video/*" id="avatar-input" class="hidden">
        </label>
      </div>
      <div class="field">
        <label for="s-avatar-url">atau tempel URL langsung</label>
        <input type="text" id="s-avatar-url" value="${escHtml(data.avatarUrl || "")}" placeholder="https://.../avatar.jpg">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="s-name">Nama Toko</label>
          <input type="text" id="s-name" value="${escHtml(data.storeName || "")}" placeholder="PANAVIBUNGA STORE">
        </div>
        <div class="field">
          <label for="s-wa">Nomor WhatsApp</label>
          <input type="text" id="s-wa" value="${escHtml(data.whatsapp || "")}" placeholder="6285122108079">
        </div>
      </div>
      <div class="field">
        <label for="s-desc">Deskripsi Toko</label>
        <textarea id="s-desc" placeholder="Deskripsi singkat toko...">${escHtml(data.description || "")}</textarea>
      </div>
      <button type="button" class="btn btn-primary" id="btn-save-settings">
        <span id="save-settings-label">Simpan Pengaturan</span>
      </button>
    `;

    const dropzone = body.querySelector("#avatar-drop");
    const fileInput = body.querySelector("#avatar-input");
    dropzone.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      pendingAvatarDataUrl = await readFileAsDataUrl(file);
      const preview = body.querySelector("#avatar-preview");
      if (file.type.startsWith("image/")) {
        preview.src = pendingAvatarDataUrl;
        preview.style.display = "block";
      }
      body.querySelector("#s-avatar-url").value = "(akan diunggah saat disimpan)";
    });

    body.querySelector("#btn-save-settings").addEventListener("click", () => handleSave(body, data));
  } catch (e) {
    console.error(e);
    body.innerHTML = `<p class="text-muted">Gagal memuat pengaturan.</p>`;
  }
}

async function handleSave(body, existing) {
  const btn = body.querySelector("#btn-save-settings");
  const label = body.querySelector("#save-settings-label");
  btn.disabled = true;
  label.innerHTML = `<span class="spinner"></span>`;
  try {
    let avatarUrl = body.querySelector("#s-avatar-url").value.trim();
    if (pendingAvatarDataUrl) {
      avatarUrl = await uploadStoreAvatar(pendingAvatarDataUrl);
    }
    await saveStoreSettings({
      avatarUrl,
      storeName: body.querySelector("#s-name").value.trim(),
      whatsapp: body.querySelector("#s-wa").value.trim(),
      description: body.querySelector("#s-desc").value.trim(),
    });
    toastSuccess("Pengaturan berhasil disimpan.");
    await loadForm();
  } catch (e) {
    console.error(e);
    toastError(e.message || "Gagal menyimpan pengaturan.");
    btn.disabled = false;
    label.textContent = "Simpan Pengaturan";
  }
}
