// ===== ORDERS SERVICE =====
// Collection: "orders". Dokumen dibuat oleh backend pembayaran (Railway,
// via api/webhook.js pada repository Store) dengan doc id = transaction_id,
// dan field: userId, productName, price, status, payment, createdAt, paidAt.
// Store membaca order milik user sendiri (query where userId == uid) dan
// menampilkan field: deliveredEmail, deliveredPassword, deliveredLoginUrl,
// deliveredNote apabila sudah diisi Admin — itulah mekanisme "Admin
// memproses order -> Store langsung menampilkan status baru".
//
// Admin TIDAK membuat order baru (order berasal dari proses pembayaran),
// Admin hanya melihat, mencari, memfilter, dan MEMPERBARUI status/detail
// pengiriman akun pada order yang sudah ada.
import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, updateDoc, serverTimestamp, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const COL = "orders";

export async function listOrders() {
  try {
    const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // Fallback tanpa orderBy jika sebagian dokumen lama tidak punya createdAt
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function updateOrderStatus(id, status) {
  await updateDoc(doc(db, COL, id), { status, statusUpdatedAt: serverTimestamp() });
}

export async function deliverOrder(id, delivery) {
  await updateDoc(doc(db, COL, id), {
    deliveredEmail: delivery.deliveredEmail || "",
    deliveredPassword: delivery.deliveredPassword || "",
    deliveredLoginUrl: delivery.deliveredLoginUrl || "",
    deliveredNote: delivery.deliveredNote || "",
    status: "DELIVERED",
    deliveredAt: serverTimestamp(),
  });
}

export function normalizeStatus(o) {
  const s = (o.status || "PENDING").toUpperCase();
  if (o.deliveredEmail || o.deliveredPassword) return "DELIVERED";
  return s;
}

export const STATUS_TONE = {
  PENDING: "amber",
  PAID: "cyan",
  DELIVERED: "emerald",
  EXPIRED: "neutral",
  FAILED: "rose",
  CANCELLED: "rose",
};
