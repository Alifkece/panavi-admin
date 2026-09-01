// ===== STATS SERVICE =====
// Semua angka dihitung dari collection yang SUDAH ada (products, orders,
// stock) — tidak ada collection baru yang dibuat khusus untuk statistik.
// "Total User" didekati dari jumlah userId unik pada collection "orders"
// karena Store tidak memiliki collection "users" tersendiri (Auth-only).
import { listProducts } from "./productsService.js";
import { listOrders } from "./ordersService.js";
import { listStock } from "./stockService.js";
import { normalizeStatus } from "./ordersService.js";

export async function loadDashboardStats() {
  const [products, orders, stock] = await Promise.all([listProducts(), listOrders(), listStock()]);

  const pending = orders.filter((o) => normalizeStatus(o) === "PENDING").length;
  const paid = orders.filter((o) => ["PAID", "DELIVERED"].includes(normalizeStatus(o))).length;
  const delivered = orders.filter((o) => normalizeStatus(o) === "DELIVERED").length;
  const revenue = orders
    .filter((o) => ["PAID", "DELIVERED"].includes(normalizeStatus(o)))
    .reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  const uniqueUsers = new Set(orders.map((o) => o.userId).filter(Boolean)).size;
  const totalStock = stock.length;
  const availableStock = stock.filter((s) => !s.sold).length;

  return {
    products,
    orders,
    stock,
    totals: {
      totalProducts: products.length,
      totalOrders: orders.length,
      pendingOrders: pending,
      paidOrders: paid,
      deliveredOrders: delivered,
      totalUsers: uniqueUsers,
      totalStock,
      availableStock,
      revenue,
    },
  };
}
