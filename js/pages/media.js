// ===== MEDIA MANAGER PAGE =====
import { listMedia, addMediaEntry, deleteMediaEntry } from "../services/mediaService.js";
import { uploadMediaFile, ACCEPTED_MEDIA_TYPES, mediaKindFromMime } from "../services/uploadService.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError, toastInfo } from "../components/toast.js";
import { skeletonList } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { escHtml, debounce, genId, formatBytes } from "../utils/format.js";

let allMedia = [];
let searchTerm = "";
let activeKind = "all";
const uploadingJobs = new Map(); // jobId -> {file, percent, status, error}

export async function render(container) {
  container.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h1>Media</h1>
        <p>Upload gambar, video, atau audio dan dapatkan URL untuk dipakai di Produk / Music.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-upload-media" data-hotkey="new">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload Media
      </button>
    </div>

    <label class="media-dropzone" id="media-dropzone">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <div>
        <strong>Tarik &amp; lepas file di sini</strong>
        <span>atau klik untuk memilih — JPG, PNG, WEBP, GIF, MP4, MP3, WAV, OGG</span>
      </div>
      <input type="file" id="media-file-input" class="hidden" multiple accept="${ACCEPTED_MEDIA_TYPES.join(",")}">
    </label>

    <div id="upload-tray"></div>

    <section class="section-card">
      <div class="toolbar">
        <div class="field-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="media-search" placeholder="Cari nama file...">
        </div>
        <div class="chip-filter" id="media-kind-filter">
          ${["all", "image", "video", "audio"].map((k) => `<button type="button" class="chip ${k === "all" ? "active" : ""}" data-kind="${k}">${k === "all" ? "Semua" : k[0].toUpperCase() + k.slice(1)}</button>`).join("")}
        </div>
      </div>
      <div class="section-card-body">
        <div class="media-grid" id="media-grid">${skeletonList(4)}</div>
      </div>
    </section>
  `;

  const dropzone = container.querySelector("#media-dropzone");
  const fileInput = container.querySelector("#media-file-input");
  container.querySelector("#btn-upload-media").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  container.querySelector("#media-search").addEventListener(
    "input",
    debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderGrid();
    }, 200)
  );
  container.querySelectorAll("#media-kind-filter .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeKind = chip.dataset.kind;
      container.querySelectorAll("#media-kind-filter .chip").forEach((c) => c.classList.toggle("active", c === chip));
      renderGrid();
    });
  });

  renderTray();
  await loadAndRender();
}

async function loadAndRender() {
  try {
    allMedia = await listMedia();
    renderGrid();
  } catch (e) {
    console.error(e);
    const grid = document.getElementById("media-grid");
    if (grid) grid.innerHTML = errorState({});
  }
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const rejected = files.filter((f) => !ACCEPTED_MEDIA_TYPES.includes(f.type));
  const accepted = files.filter((f) => ACCEPTED_MEDIA_TYPES.includes(f.type));
  if (rejected.length) toastError(`${rejected.length} file dilewati (format tidak didukung).`);
  accepted.forEach(startUpload);
}

function startUpload(file) {
  const jobId = genId("job");
  uploadingJobs.set(jobId, { file, percent: 0, status: "uploading", error: null });
  renderTray();

  uploadMediaFile(file, (percent) => {
    const job = uploadingJobs.get(jobId);
    if (!job) return;
    job.percent = percent;
    renderTray();
  })
    .then(async (res) => {
      await addMediaEntry({
        name: file.name,
        url: res.path,
        mimetype: res.mimetype || file.type,
        size: res.size || file.size,
        kind: mediaKindFromMime(res.mimetype || file.type),
      });
      uploadingJobs.delete(jobId);
      renderTray();
      toastSuccess(`${file.name} berhasil diupload.`);
      await loadAndRender();
    })
    .catch((e) => {
      const job = uploadingJobs.get(jobId);
      if (job) {
        job.status = "error";
        job.error = e.message || "Upload gagal.";
        renderTray();
      }
      toastError(e.message || `Gagal mengupload ${file.name}.`);
    });
}

function renderTray() {
  const tray = document.getElementById("upload-tray");
  if (!tray) return;
  if (!uploadingJobs.size) {
    tray.innerHTML = "";
    return;
  }
  tray.innerHTML = `<div class="upload-tray">${[...uploadingJobs.entries()]
    .map(
      ([jobId, job]) => `
    <div class="upload-tray-item ${job.status === "error" ? "is-error" : ""}" data-job="${jobId}">
      <div class="upload-tray-info">
        <span class="upload-tray-name">${escHtml(job.file.name)}</span>
        <span class="upload-tray-status">${job.status === "error" ? escHtml(job.error) : `${job.percent}%`}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${job.status === "error" ? 100 : job.percent}%;${job.status === "error" ? "background:var(--rose);" : ""}"></div></div>
      ${job.status === "error" ? `<button type="button" class="btn btn-ghost btn-sm" data-dismiss-job="${jobId}">Tutup</button>` : ""}
    </div>`
    )
    .join("")}</div>`;

  tray.querySelectorAll("[data-dismiss-job]").forEach((btn) =>
    btn.addEventListener("click", () => {
      uploadingJobs.delete(btn.dataset.dismissJob);
      renderTray();
    })
  );
}

function renderGrid() {
  const grid = document.getElementById("media-grid");
  if (!grid) return;
  let list = allMedia;
  if (activeKind !== "all") list = list.filter((m) => m.kind === activeKind);
  if (searchTerm) list = list.filter((m) => (m.name || "").toLowerCase().includes(searchTerm));

  if (!list.length) {
    grid.innerHTML = emptyState({ title: "Belum ada media", message: "Upload gambar, video, atau audio untuk mendapatkan URL." });
    return;
  }

  grid.innerHTML = list
    .map(
      (m, i) => `
    <div class="media-card stagger-item" style="animation-delay:${Math.min(i, 8) * 0.03}s" data-media-id="${m.id}">
      <div class="media-card-preview">
        ${mediaPreviewHtml(m)}
      </div>
      <div class="media-card-body">
        <div class="media-card-name" title="${escHtml(m.name)}">${escHtml(m.name)}</div>
        <div class="media-card-meta">${escHtml(m.mimetype || "-")} · ${formatBytes(m.size)}</div>
        <div class="media-url-row">
          <input type="text" class="media-url-input" readonly value="${escHtml(m.url)}">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy="${escHtml(m.url)}" title="Copy URL" aria-label="Copy URL">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </div>
      <button type="button" class="btn btn-danger btn-icon btn-sm media-card-delete" data-delete="${m.id}" aria-label="Hapus">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`
    )
    .join("");

  grid.querySelectorAll("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", () => copyUrl(btn.dataset.copy))
  );
  grid.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => handleDelete(btn.dataset.delete))
  );
}

function mediaPreviewHtml(m) {
  if (m.kind === "image") return `<img src="${escHtml(m.url)}" loading="lazy" alt="">`;
  if (m.kind === "video") return `<video src="${escHtml(m.url)}" muted preload="metadata"></video>`;
  if (m.kind === "audio")
    return `<div class="media-audio-preview"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><audio src="${escHtml(m.url)}" controls></audio></div>`;
  return `<div class="media-audio-preview"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
}

async function copyUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    toastInfo("URL disalin ke clipboard.");
  } catch {
    toastError("Gagal menyalin URL.");
  }
}

async function handleDelete(id) {
  const m = allMedia.find((x) => x.id === id);
  const ok = await confirmDialog({
    title: "Hapus media?",
    message: `<strong>${escHtml(m?.name || "")}</strong> akan dihapus dari daftar Media. File yang sudah dipakai di Produk/Music tidak otomatis ikut hilang.`,
  });
  if (!ok) return;
  try {
    await deleteMediaEntry(id);
    toastSuccess("Media dihapus dari daftar.");
    await loadAndRender();
  } catch (e) {
    toastError(e.message || "Gagal menghapus media.");
  }
}
