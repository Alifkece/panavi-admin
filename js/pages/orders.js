// ===== ORDERS PAGE =====
import { listOrders, updateOrderStatus, deliverOrder, normalizeStatus, STATUS_TONE } from "../services/ordersService.js";
import { openModal, closeModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError } from "../components/toast.js";
import { skeletonTableRows } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { rupiah, formatDate, escHtml, debounce } from "../utils/format.js";
import { setOrdersBadge } from "../components/sidebar.js";

let allOrders = [];
let searchTerm = "";
let statusFilter = "all";

const STATUSES = ["PENDING", "PAID", "DELIVERED", "EXPIRED", "FAILED", "CANCELLED"];

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Orders</h1>
      <p>Semua order pelanggan. Perubahan status langsung terlihat oleh pelanggan di Store.</p>
    </div>

    <section class="section-card">
      <div class="toolbar">
        <div class="field-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="order-search" placeholder="Cari produk / ID transaksi...">
        </div>
        <div class="chip-filter" id="status-chips">
          <button type="button" class="chip active" data-status="all">Semua</button>
          ${STATUSES.map((s) => `<button type="button" class="chip" data-status="${s}">${s}</button>`).join("")}
        </div>
      </div>
      <div class="section-card-body">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Order</th><th>Pelanggan</th><th>WhatsApp</th><th>Harga</th><th>Status</th><th>Tanggal</th><th></th></tr></thead>
            <tbody id="order-tbody">${skeletonTableRows(5, 7)}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container.querySelector("#order-search").addEventListener(
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

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allOrders = await listOrders();
    setOrdersBadge(allOrders.filter((o) => normalizeStatus(o) === "PENDING").length);
    renderTable();
  } catch (e) {
    console.error(e);
    document.getElementById("order-tbody").innerHTML = `<tr><td colspan="7">${errorState({})}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById("order-tbody");
  let list = allOrders;
  if (statusFilter !== "all") list = list.filter((o) => normalizeStatus(o) === statusFilter);
  if (searchTerm) {
    list = list.filter((o) => `${o.productName || ""} ${o.id} ${o.userId || ""} ${o.whatsapp || ""}`.toLowerCase().includes(searchTerm));
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7">${emptyState({ title: "Tidak ada order", message: "Belum ada order yang cocok dengan filter ini." })}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((o, i) => {
      const status = normalizeStatus(o);
      const tone = STATUS_TONE[status] || "neutral";
      return `
      <tr class="stagger-item" style="animation-delay:${Math.min(i, 8) * 0.03}s">
        <td>
          <div style="font-weight:600;">${escHtml(o.productName || "Produk")}${o.packageName ? ` <span class="cell-muted" style="font-weight:400;">(${escHtml(o.packageName)})</span>` : ""}</div>
          <div class="cell-mono cell-muted">${escHtml(o.id)}</div>
        </td>
        <td class="cell-muted">${escHtml(o.userId ? o.userId.slice(0, 10) + "…" : "-")}</td>
        <td class="cell-mono">${escHtml(o.whatsapp || "-")}</td>
        <td class="cell-mono">${rupiah(o.price)}</td>
        <td><span class="badge badge-${tone}">${status}</span></td>
        <td class="cell-muted">${formatDate(o.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-detail="${o.id}">Detail</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => openOrderDetail(b.dataset.detail)));
}

function openOrderDetail(id) {
  const o = allOrders.find((x) => x.id === id);
  if (!o) return;
  const status = normalizeStatus(o);
  const tone = STATUS_TONE[status] || "neutral";

  const bodyHtml = `
    <div class="flex-between" style="margin-bottom:16px;">
      <span class="badge badge-${tone}" style="font-size:12px;padding:6px 12px;">${status}</span>
      <span class="cell-mono cell-muted">${escHtml(o.id)}</span>
    </div>
    <div class="detail-grid" style="margin-bottom:18px;">
      <div class="detail-item"><label>Produk</label><div class="val">${escHtml(o.productName || "-")}${o.packageName ? ` <span class="cell-muted">(${escHtml(o.packageName)})</span>` : ""}</div></div>
      <div class="detail-item"><label>Harga</label><div class="val">${rupiah(o.price)}</div></div>
      <div class="detail-item"><label>User ID</label><div class="val cell-mono">${escHtml(o.userId || "-")}</div></div>
      <div class="detail-item"><label>WhatsApp</label><div class="val">${escHtml(o.whatsapp || "-")}</div></div>
      <div class="detail-item"><label>Metode Bayar</label><div class="val">${escHtml(o.payment || "-")}</div></div>
      <div class="detail-item"><label>Dibuat</label><div class="val">${formatDate(o.createdAt)}</div></div>
      <div class="detail-item"><label>Dibayar</label><div class="val">${o.paidAt ? formatDate(o.paidAt) : "-"}</div></div>
    </div>

    <div class="field">
      <label for="d-status">Ubah Status</label>
      <select id="d-status">
        ${STATUSES.map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </div>

    <div class="divider"></div>
    <h3 style="font-size:13.5px;margin-bottom:10px;">Proses Pengiriman Akun</h3>

    <div class="field-row">
      <div class="field">
        <label for="d-email">Email Terkirim</label>
        <input type="text" id="d-email" value="${escHtml(o.deliveredEmail || "")}" placeholder="akun@email.com">
      </div>
      <div class="field">
        <label for="d-password">Password Terkirim</label>
        <input type="text" id="d-password" value="${escHtml(o.deliveredPassword || "")}" placeholder="••••••••">
      </div>
    </div>
    <div class="field">
      <label for="d-loginurl">Login URL</label>
      <input type="text" id="d-loginurl" value="${escHtml(o.deliveredLoginUrl || "")}" placeholder="https://...">
    </div>
    <div class="field">
      <label for="d-note">Catatan Pengiriman</label>
      <textarea id="d-note" placeholder="Info tambahan untuk pelanggan...">${escHtml(o.deliveredNote || "")}</textarea>
    </div>
  `;

  const footHtml = `
    <button type="button" class="btn btn-ghost btn-sm" data-modal-close>Tutup</button>
    <button type="button" class="btn btn-ghost btn-sm" id="btn-save-status">Simpan Status</button>
    <button type="button" class="btn btn-primary btn-sm" id="btn-deliver">Kirim Akun ke Pelanggan</button>
  `;

  const overlay = openModal({ title: "Detail Order", subtitle: escHtml(o.productName || ""), bodyHtml, footHtml, wide: true });

  overlay.querySelector("#btn-save-status").addEventListener("click", async () => {
    const newStatus = overlay.querySelector("#d-status").value;
    try {
      await updateOrderStatus(o.id, newStatus);
      toastSuccess("Status order diperbarui.");
      closeModal();
      await loadAndRender();
    } catch (e) {
      toastError(e.message || "Gagal memperbarui status.");
    }
  });

  overlay.querySelector("#btn-deliver").addEventListener("click", async () => {
    const email = overlay.querySelector("#d-email").value.trim();
    const password = overlay.querySelector("#d-password").value.trim();
    if (!email && !password) {
      toastError("Isi minimal email atau password sebelum mengirim.");
      return;
    }
    const ok = await confirmDialog({
      title: "Kirim akun ke pelanggan?",
      message: "Order akan ditandai <strong>DELIVERED</strong> dan detail akun langsung tampil di halaman pesanan pelanggan.",
      confirmText: "Kirim",
      tone: "signal",
    });
    if (!ok) return;
    try {
      await deliverOrder(o.id, {
        deliveredEmail: email,
        deliveredPassword: password,
        deliveredLoginUrl: overlay.querySelector("#d-loginurl").value.trim(),
        deliveredNote: overlay.querySelector("#d-note").value.trim(),
      });
      toastSuccess("Akun berhasil dikirim ke pelanggan.");
      closeModal();
      await loadAndRender();
    } catch (e) {
      toastError(e.message || "Gagal mengirim akun.");
    }
  });
}
