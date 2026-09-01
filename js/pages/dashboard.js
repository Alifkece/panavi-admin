// ===== DASHBOARD PAGE =====
import { loadDashboardStats } from "../services/statsService.js";
import { normalizeStatus, STATUS_TONE } from "../services/ordersService.js";
import { rupiah, timeAgo } from "../utils/format.js";
import { skeletonStatCards, skeletonList } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { escHtml } from "../utils/format.js";
import { navigate } from "../router.js";

function statIcon(paths, tone) {
  return `<div class="stat-icon icon-tone-${tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${paths}</svg></div>`;
}

const ICON_PRODUCT = '<path d="M20.5 7.3 12 3 3.5 7.3 12 11.6z"/><path d="M3.5 7.3v9.4L12 21l8.5-4.3V7.3"/>';
const ICON_ORDER = '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>';
const ICON_CLOCK = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
const ICON_CHECK = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
const ICON_BOX = '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>';
const ICON_USERS = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
const ICON_WALLET = '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="18" cy="14" r="1.5"/>';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Ringkasan Dashboard</h1>
      <p>Statistik langsung dari Firestore — sama persis dengan data yang ditampilkan Store.</p>
    </div>
    <div class="stat-grid" id="stat-grid">${skeletonStatCards(8)}</div>

    <div class="dash-grid">
      <section class="section-card">
        <div class="section-card-head">
          <div>
            <h2>Order Terbaru</h2>
            <p>10 order paling baru masuk</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-view-orders">Lihat semua</button>
        </div>
        <div class="mini-list" id="recent-orders">${skeletonList(5)}</div>
      </section>

      <section class="section-card">
        <div class="section-card-head">
          <div>
            <h2>Status Order</h2>
            <p>Distribusi seluruh order</p>
          </div>
        </div>
        <div class="section-card-body" id="status-chart">
          <div class="skel-block" style="height:120px;"></div>
        </div>
      </section>
    </div>
  `;

  container.querySelector("#btn-view-orders").addEventListener("click", () => navigate("orders"));

  try {
    const { totals, orders } = await loadDashboardStats();
    renderStats(totals);
    renderRecentOrders(orders.slice(0, 10));
    renderStatusChart(orders);
  } catch (e) {
    console.error(e);
    container.querySelector("#stat-grid").innerHTML = "";
    container.querySelector("#recent-orders").innerHTML = errorState({});
    container.querySelector("#status-chart").innerHTML = errorState({ title: "Gagal memuat grafik" });
  }
}

function renderStats(t) {
  const cards = [
    { label: "Total Produk", value: t.totalProducts, icon: statIcon(ICON_PRODUCT, "signal") },
    { label: "Total Order", value: t.totalOrders, icon: statIcon(ICON_ORDER, "cyan") },
    { label: "Pending Order", value: t.pendingOrders, icon: statIcon(ICON_CLOCK, "amber") },
    { label: "Paid Order", value: t.paidOrders, icon: statIcon(ICON_CHECK, "emerald") },
    { label: "Total Stok", value: t.totalStock, icon: statIcon(ICON_BOX, "signal") },
    { label: "Stok Tersedia", value: t.availableStock, icon: statIcon(ICON_BOX, "cyan") },
    { label: "Total User", value: t.totalUsers, icon: statIcon(ICON_USERS, "amber") },
    { label: "Penghasilan", value: rupiah(t.revenue), icon: statIcon(ICON_WALLET, "emerald") },
  ];
  document.getElementById("stat-grid").innerHTML = cards
    .map(
      (c, i) => `
      <div class="stat-card stagger-item" style="animation-delay:${i * 0.04}s">
        ${c.icon}
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>`
    )
    .join("");
}

function renderRecentOrders(orders) {
  const el = document.getElementById("recent-orders");
  if (!orders.length) {
    el.innerHTML = emptyState({ title: "Belum ada order", message: "Order akan muncul di sini setelah pelanggan melakukan pembayaran." });
    return;
  }
  el.innerHTML = orders
    .map((o) => {
      const status = normalizeStatus(o);
      const tone = STATUS_TONE[status] || "neutral";
      return `
      <div class="mini-list-item">
        <div class="mli-icon icon-tone-${tone === "neutral" ? "signal" : tone}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/></svg>
        </div>
        <div class="mli-body">
          <div class="mli-title">${escHtml(o.productName || "Produk")}</div>
          <div class="mli-sub">${escHtml(o.id)} · ${timeAgo(o.createdAt)}</div>
        </div>
        <div class="mli-right">
          <div class="mli-amount">${rupiah(o.price)}</div>
          <span class="badge badge-${tone}" style="margin-top:4px;">${status}</span>
        </div>
      </div>`;
    })
    .join("");
}

function renderStatusChart(orders) {
  const el = document.getElementById("status-chart");
  const buckets = { PENDING: 0, PAID: 0, DELIVERED: 0, EXPIRED: 0, FAILED: 0 };
  orders.forEach((o) => {
    const s = normalizeStatus(o);
    buckets[s] = (buckets[s] || 0) + 1;
  });
  const max = Math.max(1, ...Object.values(buckets));
  el.innerHTML = `
    <div class="bar-chart">
      ${Object.entries(buckets)
        .map(
          ([label, val]) => `
        <div class="bar-col">
          <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-2);">${val}</div>
          <div class="bar" style="height:${(val / max) * 84}px;"></div>
          <div class="bar-label">${label.slice(0, 4)}</div>
        </div>`
        )
        .join("")}
    </div>
  `;
}
