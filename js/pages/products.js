// ===== PRODUCTS PAGE =====
import { listProducts, saveProduct, deleteProduct } from "../services/productsService.js";
import { uploadMediaFile, ACCEPTED_MEDIA_TYPES, mediaKindFromMime } from "../services/uploadService.js";
import { addMediaEntry } from "../services/mediaService.js";
import { openModal, closeModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError, toastInfo } from "../components/toast.js";
import { skeletonTableRows } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { rupiah, escHtml, debounce } from "../utils/format.js";

let allProducts = [];
let searchTerm = "";
let activeCategory = "all";

export async function render(container) {
  container.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h1>Produk</h1>
        <p>Kelola katalog produk yang tampil di Store secara realtime.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-add-product" data-hotkey="new">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tambah Produk
      </button>
    </div>

    <section class="section-card">
      <div class="toolbar">
        <div class="field-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="product-search" placeholder="Cari nama produk...">
        </div>
        <div class="chip-filter" id="category-filter"></div>
      </div>
      <div class="section-card-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Badge</th><th></th></tr>
            </thead>
            <tbody id="product-tbody">${skeletonTableRows(5, 6)}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container.querySelector("#btn-add-product").addEventListener("click", () => openProductForm(null));

  const searchInput = container.querySelector("#product-search");
  const prefill = sessionStorage.getItem("admin-global-search");
  if (prefill) {
    searchInput.value = prefill;
    searchTerm = prefill.trim().toLowerCase();
    sessionStorage.removeItem("admin-global-search");
  }
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderTable();
    }, 200)
  );

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allProducts = await listProducts();
    renderCategoryChips();
    renderTable();
  } catch (e) {
    console.error(e);
    document.getElementById("product-tbody").innerHTML = `<tr><td colspan="5">${errorState({})}</td></tr>`;
  }
}

function renderCategoryChips() {
  const cats = ["all", ...new Set(allProducts.map((p) => p.category).filter(Boolean))];
  const wrap = document.getElementById("category-filter");
  wrap.innerHTML = cats
    .map((c) => `<button type="button" class="chip ${c === activeCategory ? "active" : ""}" data-cat="${escHtml(c)}">${c === "all" ? "Semua" : escHtml(c)}</button>`)
    .join("");
  wrap.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.cat;
      renderCategoryChips();
      renderTable();
    });
  });
}

function renderTable() {
  const tbody = document.getElementById("product-tbody");
  let list = allProducts;
  if (activeCategory !== "all") list = list.filter((p) => p.category === activeCategory);
  if (searchTerm) list = list.filter((p) => (p.name || "").toLowerCase().includes(searchTerm));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">${emptyState({
      title: "Produk tidak ditemukan",
      message: "Coba kata kunci lain atau tambahkan produk baru.",
    })}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (p, i) => `
    <tr class="stagger-item" style="animation-delay:${Math.min(i, 8) * 0.03}s">
      <td>
        <div class="cell-media">
          ${p.img ? `<img src="${escHtml(p.img)}" class="cell-thumb" alt="">` : `<div class="cell-thumb"></div>`}
          <div>
            <div style="font-weight:600;">${escHtml(p.name || "-")}</div>
            <div class="cell-muted">${escHtml((p.desc || "").slice(0, 40))}${(p.desc || "").length > 40 ? "…" : ""}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-neutral">${escHtml(p.category || "-")}</span></td>
      <td class="cell-mono">${rupiah(p.price)}</td>
      <td>${p.badge ? `<span class="badge badge-amber">${escHtml(p.badge)}</span>` : `<span class="cell-muted">-</span>`}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit="${p.id}" aria-label="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button type="button" class="btn btn-danger btn-icon btn-sm" data-delete="${p.id}" aria-label="Hapus">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openProductForm(b.dataset.edit)));
  tbody.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => handleDelete(b.dataset.delete)));
}

async function handleDelete(id) {
  const p = allProducts.find((x) => x.id === id);
  const ok = await confirmDialog({
    title: "Hapus produk?",
    message: `<strong>${escHtml(p?.name || "")}</strong> akan dihapus permanen dan langsung hilang dari Store. Tindakan ini tidak dapat dibatalkan.`,
  });
  if (!ok) return;
  try {
    await deleteProduct(id);
    toastSuccess("Produk berhasil dihapus.");
    await loadAndRender();
  } catch (e) {
    toastError(e.message || "Gagal menghapus produk.");
  }
}

let editingPackages = [];

function openProductForm(id) {
  const p = id ? allProducts.find((x) => x.id === id) : null;
  editingPackages = Array.isArray(p?.packages) ? JSON.parse(JSON.stringify(p.packages)) : [];

  const bodyHtml = `
    <div class="field">
      <label>Gambar Produk</label>
      <label class="upload-drop" id="upload-drop">
        <img class="thumb" id="upload-preview" src="${p?.img ? escHtml(p.img) : ""}" style="${p?.img ? "" : "display:none;"}">
        <div class="upload-text">
          <strong id="upload-label">${p?.img ? "Ganti gambar" : "Klik untuk unggah gambar"}</strong>
          <span>PNG/JPG/WEBP/GIF, disarankan rasio 1:1</span>
        </div>
        <input type="file" accept="image/*" id="upload-input" class="hidden">
      </label>
      <div class="media-url-row" style="margin-top:8px;">
        <input type="text" id="f-img" value="${escHtml(p?.img || "")}" placeholder="URL gambar akan terisi otomatis setelah upload...">
        <button type="button" class="btn btn-ghost btn-icon btn-sm" id="btn-copy-img-url" title="Copy URL" aria-label="Copy URL">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <span class="field-hint">Gambar diupload otomatis ke media host dan URL-nya bisa disalin atau diedit manual.</span>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="f-name">Nama Produk</label>
        <input type="text" id="f-name" value="${escHtml(p?.name || "")}" placeholder="Netflix Premium" required>
      </div>
      <div class="field">
        <label for="f-category">Kategori</label>
        <input type="text" id="f-category" value="${escHtml(p?.category || "")}" placeholder="streaming" required>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="f-price">Harga (Rp)</label>
        <input type="number" id="f-price" value="${p?.price ?? ""}" placeholder="15000" min="0" required>
      </div>
      <div class="field">
        <label for="f-badge">Badge (opsional)</label>
        <input type="text" id="f-badge" value="${escHtml(p?.badge || "")}" placeholder="POPULER">
      </div>
    </div>
    <div class="field">
      <label for="f-desc">Deskripsi</label>
      <textarea id="f-desc" placeholder="Deskripsi singkat produk...">${escHtml(p?.desc || "")}</textarea>
    </div>
    <div class="field">
      <label for="f-link">Link Order Fallback</label>
      <input type="text" id="f-link" value="${escHtml(p?.link || "https://wa.me/")}" placeholder="https://wa.me/62...">
      <span class="field-hint">Dipakai jika sistem QRIS gagal / sebagai kontak alternatif.</span>
    </div>
    <div class="field">
      <div class="flex-between" style="margin-bottom:8px;">
        <label style="margin:0;">Paket Harga (opsional)</label>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-add-package">+ Tambah Paket</button>
      </div>
      <div id="packages-list"></div>
      <span class="field-hint">Jika diisi, pelanggan akan memilih salah satu paket saat memesan.</span>
    </div>
    <div class="field">
      <label>Preview</label>
      <div id="product-preview-card"></div>
    </div>
  `;

  const footHtml = `
    <button type="button" class="btn btn-ghost btn-sm" data-modal-close>Batal</button>
    <button type="button" class="btn btn-primary btn-sm" id="btn-save-product" data-hotkey="save">
      <span id="save-product-label">${p ? "Simpan Perubahan" : "Tambah Produk"}</span>
    </button>
  `;

  const overlay = openModal({
    title: p ? "Edit Produk" : "Tambah Produk",
    subtitle: "Perubahan langsung tersinkron ke Store.",
    bodyHtml,
    footHtml,
    wide: true,
  });

  renderPackagesList(overlay);
  overlay.querySelector("#btn-add-package").addEventListener("click", () => {
    editingPackages.push({ name: "", price: 0 });
    renderPackagesList(overlay);
  });

  const dropzone = overlay.querySelector("#upload-drop");
  const fileInput = overlay.querySelector("#upload-input");
  const imgUrlInput = overlay.querySelector("#f-img");
  dropzone.addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!ACCEPTED_MEDIA_TYPES.filter((t) => t.startsWith("image/")).includes(file.type)) {
      toastError("Format gambar tidak didukung.");
      return;
    }
    const label = overlay.querySelector("#upload-label");
    label.innerHTML = `<span class="spinner"></span> Mengunggah...`;
    try {
      const res = await uploadMediaFile(file);
      imgUrlInput.value = res.path;
      const preview = overlay.querySelector("#upload-preview");
      preview.src = res.path;
      preview.style.display = "block";
      label.textContent = "Ganti gambar";
      toastSuccess("Gambar berhasil diupload.");
      addMediaEntry({ name: file.name, url: res.path, mimetype: res.mimetype || file.type, size: res.size || file.size, kind: mediaKindFromMime(res.mimetype || file.type) }).catch(() => {});
    } catch (e) {
      label.textContent = p?.img ? "Ganti gambar" : "Klik untuk unggah gambar";
      toastError(e.message || "Gagal mengunggah gambar.");
    }
  });
  overlay.querySelector("#btn-copy-img-url").addEventListener("click", async () => {
    if (!imgUrlInput.value.trim()) return;
    try {
      await navigator.clipboard.writeText(imgUrlInput.value.trim());
      toastInfo("URL disalin ke clipboard.");
    } catch {
      toastError("Gagal menyalin URL.");
    }
  });
  imgUrlInput.addEventListener("input", () => {
    const preview = overlay.querySelector("#upload-preview");
    if (imgUrlInput.value.trim()) {
      preview.src = imgUrlInput.value.trim();
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  });

  overlay.querySelector("#btn-save-product").addEventListener("click", () => handleSaveProduct(overlay, p));

  const renderLivePreview = () => renderProductPreview(overlay);
  ["f-name", "f-category", "f-price", "f-badge", "f-img"].forEach((id) => {
    overlay.querySelector(`#${id}`)?.addEventListener("input", renderLivePreview);
  });
  renderLivePreview();
}

function renderPackagesList(overlay) {
  const wrap = overlay.querySelector("#packages-list");
  if (!editingPackages.length) {
    wrap.innerHTML = `<div class="field-hint" style="padding:8px 0;">Belum ada paket. Produk akan memakai harga utama.</div>`;
    return;
  }
  wrap.innerHTML = editingPackages
    .map(
      (pkg, i) => `
    <div class="field-row" style="margin-bottom:8px;align-items:end;" data-pkg-row="${i}">
      <div class="field" style="margin-bottom:0;">
        <input type="text" data-pkg-name="${i}" placeholder="Nama paket (1 bulan)" value="${escHtml(pkg.name)}">
      </div>
      <div class="field" style="margin-bottom:0;display:flex;gap:8px;">
        <input type="number" data-pkg-price="${i}" placeholder="Harga" value="${pkg.price}" min="0">
        <button type="button" class="btn btn-danger btn-icon btn-sm" data-pkg-remove="${i}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-pkg-name]").forEach((inp) => inp.addEventListener("input", (e) => (editingPackages[+inp.dataset.pkgName].name = e.target.value)));
  wrap.querySelectorAll("[data-pkg-price]").forEach((inp) => inp.addEventListener("input", (e) => (editingPackages[+inp.dataset.pkgPrice].price = Number(e.target.value) || 0)));
  wrap.querySelectorAll("[data-pkg-remove]").forEach((btn) =>
    btn.addEventListener("click", () => {
      editingPackages.splice(+btn.dataset.pkgRemove, 1);
      renderPackagesList(overlay);
    })
  );
}

function renderProductPreview(overlay) {
  const holder = overlay.querySelector("#product-preview-card");
  if (!holder) return;
  const name = overlay.querySelector("#f-name")?.value.trim() || "Nama Produk";
  const category = overlay.querySelector("#f-category")?.value.trim() || "-";
  const price = overlay.querySelector("#f-price")?.value || 0;
  const badge = overlay.querySelector("#f-badge")?.value.trim();
  const img = overlay.querySelector("#f-img")?.value.trim();

  holder.innerHTML = `
    <div class="product-tile" style="max-width:220px;">
      ${img ? `<img src="${escHtml(img)}" alt="">` : `<div class="product-tile-noimg"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`}
      <div style="padding:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <strong style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(name)}</strong>
          ${badge ? `<span class="badge badge-amber">${escHtml(badge)}</span>` : ""}
        </div>
        <div class="cell-muted" style="font-size:11px;margin-top:2px;">${escHtml(category)}</div>
        <div class="cell-mono" style="margin-top:8px;font-weight:600;">${rupiah(price)}</div>
      </div>
    </div>
  `;
}

async function handleSaveProduct(overlay, existing) {
  const btn = overlay.querySelector("#btn-save-product");
  const label = overlay.querySelector("#save-product-label");
  const name = overlay.querySelector("#f-name").value.trim();
  const category = overlay.querySelector("#f-category").value.trim();
  const price = overlay.querySelector("#f-price").value;

  if (!name || !category || price === "") {
    toastError("Nama, kategori, dan harga wajib diisi.");
    return;
  }

  btn.disabled = true;
  label.innerHTML = `<span class="spinner"></span>`;

  try {
    const id = existing?.id || null;
    const data = {
      name,
      category,
      price,
      desc: overlay.querySelector("#f-desc").value.trim(),
      badge: overlay.querySelector("#f-badge").value.trim(),
      link: overlay.querySelector("#f-link").value.trim() || "https://wa.me/",
      img: overlay.querySelector("#f-img").value.trim(),
      packages: editingPackages.filter((pk) => pk.name.trim()),
    };
    await saveProduct(id, data);
    toastSuccess(existing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
    closeModal();
    await loadAndRender();
  } catch (e) {
    console.error(e);
    toastError(e.message || "Gagal menyimpan produk.");
    btn.disabled = false;
    label.textContent = existing ? "Simpan Perubahan" : "Tambah Produk";
  }
}
