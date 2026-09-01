// ===== STOCK PAGE =====
// Semua field (termasuk email/password) berada langsung di dokumen
// stock/{id} — collection ini hanya bisa dibaca/ditulis oleh Admin sesuai
// Firestore Security Rules (allow read/write: if isAdmin()), jadi tidak
// perlu struktur tambahan untuk menyembunyikan kredensial.
import { listStock, subscribeStock, saveStockItem, deleteStockItem } from "../services/stockService.js";
import { listProducts } from "../services/productsService.js";
import { openModal, closeModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError } from "../components/toast.js";
import { skeletonTableRows } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { escHtml, debounce } from "../utils/format.js";

let allStock = [];
let products = [];
let searchTerm = "";
let statusFilter = "all"; // all | available | sold
let productFilter = "all";
// Unsubscribe function untuk realtime listener stok (lihat subscribeStock
// di services/stockService.js) - dipanggil saat halaman Stock ditinggalkan
// supaya listener tidak menumpuk setiap kali halaman ini dibuka lagi.
let stockUnsub = null;

export async function render(container) {
  container.innerHTML = `
    <div data-page-root="stock">
      <div class="page-header flex-between">
        <div>
          <h1>Stock</h1>
          <p>Kelola akun tersedia untuk setiap produk. Store menampilkan jumlah stok secara realtime.</p>
        </div>
        <button type="button" class="btn btn-primary" id="btn-add-stock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Akun
        </button>
      </div>

      <section class="section-card">
        <div class="toolbar">
          <div class="field-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="stock-search" placeholder="Cari email / label...">
          </div>
          <select id="product-filter" style="max-width:220px;"><option value="all">Semua Produk</option></select>
          <div class="chip-filter">
            <button type="button" class="chip active" data-status="all">Semua</button>
            <button type="button" class="chip" data-status="available">Tersedia</button>
            <button type="button" class="chip" data-status="sold">Terjual</button>
          </div>
        </div>
        <div class="section-card-body">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Akun</th><th>Produk</th><th>Status</th><th>Catatan</th><th></th></tr></thead>
              <tbody id="stock-tbody">${skeletonTableRows(4, 6)}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;

  const pageRoot = container.querySelector('[data-page-root="stock"]');

  container.querySelector("#btn-add-stock").addEventListener("click", () => openStockForm(null));
  container.querySelector("#stock-search").addEventListener(
    "input",
    debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderTable();
    }, 200)
  );
  container.querySelectorAll("[data-status]").forEach((chip) => {
    chip.addEventListener("click", () => {
      statusFilter = chip.dataset.status;
      container.querySelectorAll("[data-status]").forEach((c) => c.classList.toggle("active", c === chip));
      renderTable();
    });
  });

  await loadAndRender(container);

  // Self-contained cleanup: tidak ada router lifecycle hook, jadi pantau
  // pageRoot ini dilepas dari DOM (halaman lain me-render ulang
  // #page-content) lalu hentikan listener realtime stok - pola yang sama
  // dipakai halaman Music (lihat js/pages/songs.js).
  const observer = new MutationObserver(() => {
    if (!document.body.contains(pageRoot)) {
      if (stockUnsub) { stockUnsub(); stockUnsub = null; }
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });
}

async function loadAndRender(container) {
  if (stockUnsub) { stockUnsub(); stockUnsub = null; }

  try {
    products = await listProducts();
    const sel = container.querySelector("#product-filter");
    sel.innerHTML =
      `<option value="all">Semua Produk</option>` +
      products.map((p) => `<option value="${p.id}">${escHtml(p.name)}</option>`).join("");
    sel.addEventListener("change", () => {
      productFilter = sel.value;
      renderTable();
    });

    // REALTIME: webhook payment (backend) bisa mengubah dokumen stok dari
    // AVAILABLE -> SOLD kapan saja saat buyer bayar. Pakai listener
    // realtime (bukan sekali-jalan) supaya Admin yang sedang membuka
    // halaman ini melihat perubahan tanpa refresh manual.
    stockUnsub = subscribeStock(
      (items) => {
        allStock = items;
        renderTable();
      },
      (err) => {
        console.error(err);
        document.getElementById("stock-tbody").innerHTML = `<tr><td colspan="5">${errorState({})}</td></tr>`;
      }
    );
  } catch (e) {
    console.error(e);
    document.getElementById("stock-tbody").innerHTML = `<tr><td colspan="5">${errorState({})}</td></tr>`;
  }
}

function productName(id) {
  return products.find((p) => p.id === id)?.name || "(produk tidak ditemukan)";
}

// Daftar nama paket yang valid untuk sebuah produk. Kalau produk tidak
// punya packages[] (atau kosong), Store memperlakukan produk itu sebagai
// 1 paket implisit bernama sama dengan nama produknya sendiri (lihat
// orderProduct() di js/app.js Store) — jadi di sini kita samakan supaya
// stok yang ditambahkan Admin selalu bisa match dengan yang dicari Store.
function packageOptionsFor(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p) return [];
  if (Array.isArray(p.packages) && p.packages.length > 0) {
    return p.packages.map((pk) => pk.name).filter((n) => n && n.trim());
  }
  return p.name ? [p.name] : [];
}

function renderTable() {
  const tbody = document.getElementById("stock-tbody");
  let list = allStock;
  if (statusFilter === "available") list = list.filter((s) => !s.sold);
  if (statusFilter === "sold") list = list.filter((s) => s.sold);
  if (productFilter !== "all") list = list.filter((s) => s.productId === productFilter);
  if (searchTerm) list = list.filter((s) => `${s.label || ""} ${s.email || ""}`.toLowerCase().includes(searchTerm));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">${emptyState({ title: "Tidak ada akun", message: "Tambahkan akun baru atau ubah filter pencarian." })}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map(
      (s, i) => `
    <tr class="stagger-item" style="animation-delay:${Math.min(i, 8) * 0.03}s">
      <td>
        <div style="font-weight:600;">${escHtml(s.label || s.email || "Akun")}</div>
        <div class="cell-mono cell-muted">${escHtml(s.email || "-")}</div>
      </td>
      <td>${escHtml(productName(s.productId))}${s.packageName ? `<div class="cell-mono cell-muted">${escHtml(s.packageName)}</div>` : `<div class="cell-mono cell-muted" style="color:var(--danger, #e15b5b);">Paket belum diatur</div>`}</td>
      <td>${s.sold ? `<span class="badge badge-rose">Terjual</span>` : `<span class="badge badge-emerald">Tersedia</span>`}</td>
      <td class="cell-muted">${escHtml((s.note || "-").slice(0, 34))}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" aria-label="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button type="button" class="btn btn-danger btn-icon btn-sm" data-delete="${s.id}" aria-label="Hapus">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openStockForm(b.dataset.edit)));
  tbody.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => handleDelete(b.dataset.delete)));
}

async function handleDelete(id) {
  const ok = await confirmDialog({ title: "Hapus akun stok?", message: "Akun ini akan dihapus permanen dari sistem." });
  if (!ok) return;
  try {
    await deleteStockItem(id);
    toastSuccess("Akun stok berhasil dihapus.");
    allStock = await listStock();
    renderTable();
  } catch (e) {
    toastError(e.message || "Gagal menghapus akun.");
  }
}

function openStockForm(id) {
  const s = id ? allStock.find((x) => x.id === id) : null;
  const bodyHtml = `
    <div class="field">
      <label for="sf-product">Produk</label>
      <select id="sf-product" required>
        <option value="">Pilih produk...</option>
        ${products.map((p) => `<option value="${p.id}" ${s?.productId === p.id ? "selected" : ""}>${escHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="sf-package">Paket</label>
      <select id="sf-package" required>
        <option value="">Pilih produk dahulu...</option>
      </select>
      <span class="field-hint">Stok hanya akan dihitung Store untuk paket yang dipilih di sini.</span>
    </div>
    <div class="field">
      <label for="sf-label">Label Akun</label>
      <input type="text" id="sf-label" value="${escHtml(s?.label || "")}" placeholder="Akun #1">
    </div>
    <div class="field-row">
      <div class="field">
        <label for="sf-email">Email</label>
        <input type="text" id="sf-email" value="${escHtml(s?.email || "")}" placeholder="akun@email.com">
      </div>
      <div class="field">
        <label for="sf-password">Password</label>
        <input type="text" id="sf-password" value="${escHtml(s?.password || "")}" placeholder="••••••••">
      </div>
    </div>
    <div class="field">
      <label for="sf-note">Catatan</label>
      <textarea id="sf-note" placeholder="Profil ke-2, PIN 1234, dll.">${escHtml(s?.note || "")}</textarea>
    </div>
    <label class="switch">
      <input type="checkbox" id="sf-sold" ${s?.sold ? "checked" : ""}>
      <span class="switch-track"></span>
      <span style="font-size:12.5px;">Tandai sebagai sudah terjual</span>
    </label>
  `;
  const footHtml = `
    <button type="button" class="btn btn-ghost btn-sm" data-modal-close>Batal</button>
    <button type="button" class="btn btn-primary btn-sm" id="btn-save-stock"><span id="save-stock-label">${s ? "Simpan" : "Tambah"}</span></button>
  `;
  const overlay = openModal({ title: s ? "Edit Akun Stok" : "Tambah Akun Stok", subtitle: "Kredensial ini akan dipakai untuk memproses order.", bodyHtml, footHtml });

  const productSel = overlay.querySelector("#sf-product");
  const packageSel = overlay.querySelector("#sf-package");

  function refreshPackageOptions(preselect) {
    const opts = packageOptionsFor(productSel.value);
    if (!productSel.value) {
      packageSel.innerHTML = `<option value="">Pilih produk dahulu...</option>`;
      packageSel.disabled = true;
      return;
    }
    if (!opts.length) {
      packageSel.innerHTML = `<option value="">(produk ini belum punya nama, tidak bisa dipilih)</option>`;
      packageSel.disabled = true;
      return;
    }
    packageSel.disabled = false;
    packageSel.innerHTML =
      `<option value="">Pilih paket...</option>` +
      opts.map((name) => `<option value="${escHtml(name)}" ${preselect === name ? "selected" : ""}>${escHtml(name)}</option>`).join("");
  }

  refreshPackageOptions(s?.packageName || "");
  productSel.addEventListener("change", () => refreshPackageOptions(s && productSel.value === s.productId ? s.packageName : ""));

  overlay.querySelector("#btn-save-stock").addEventListener("click", async () => {
    const productId = productSel.value;
    if (!productId) { toastError("Pilih produk terlebih dahulu."); return; }
    const packageName = packageSel.value;
    if (!packageName) { toastError("Pilih paket terlebih dahulu."); return; }
    const btn = overlay.querySelector("#btn-save-stock");
    const label = overlay.querySelector("#save-stock-label");
    btn.disabled = true;
    label.innerHTML = `<span class="spinner"></span>`;
    try {
      await saveStockItem(s?.id || null, {
        productId,
        packageName,
        label: overlay.querySelector("#sf-label").value.trim(),
        email: overlay.querySelector("#sf-email").value.trim(),
        password: overlay.querySelector("#sf-password").value.trim(),
        note: overlay.querySelector("#sf-note").value.trim(),
        sold: overlay.querySelector("#sf-sold").checked,
      });
      toastSuccess(s ? "Akun berhasil diperbarui." : "Akun berhasil ditambahkan.");
      closeModal();
      allStock = await listStock();
      renderTable();
    } catch (e) {
      toastError(e.message || "Gagal menyimpan akun.");
      btn.disabled = false;
      label.textContent = s ? "Simpan" : "Tambah";
    }
  });
}
