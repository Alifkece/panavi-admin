// ===== STOCK SERVICE =====
// Collection: "stock". Store TIDAK LAGI membaca collection ini langsung
// dari browser (lihat audit stok) — Store sekarang memanggil endpoint
// backend /stock-availability, yang membaca collection ini lewat Admin SDK
// dan hanya mengirim balik agregat aman (jumlah tersedia/total per
// productId+packageName), tanpa field kredensial. Perubahan itu tidak
// menyentuh struktur dokumen "stock" sama sekali - hanya CARA Store
// membacanya.
//
// Firestore Security Rules (production, TIDAK diubah oleh Admin):
//   match /stock/{docId} {
//     allow read: if isAdmin();
//     allow write: if isAdmin();
//   }
// Artinya seluruh collection "stock" — termasuk field kredensial
// (email/password/note) — HANYA bisa dibaca oleh akun dengan
// request.auth.token.email == "panavi@my.id". Karena rules sudah
// menutup akses baca ke non-admin di level dokumen, TIDAK diperlukan
// subcollection privat terpisah untuk menyembunyikan kredensial dari
// user biasa — dokumen "stock" flat (satu level) sudah 100% aman selama
// yang mengaksesnya adalah Admin.
//
// Field tambahan (label, assignedOrderId, createdAt, updatedAt) hanya
// ditambahkan di atas field yang sudah dipakai Store (productId, sold),
// tidak ada field yang dihapus/di-rename, sehingga Store tetap
// kompatibel 100%.
//
// UPDATE STOK PER PAKET: field `packageName` ditambahkan supaya stok bisa
// dipisah per paket produk (mis. "1 Bulan" vs "1 Tahun"), bukan hanya per
// productId. Store sekarang menghitung stok tersedia dengan kombinasi
// productId + packageName (lihat getProductStock/getPackageStock di
// js/app.js milik Store). Item stok LAMA yang belum punya packageName
// perlu dibuka & disimpan ulang lewat form ini (pilih produk + paket)
// supaya ikut terhitung — ini bukan bug, melainkan konsekuensi wajar dari
// pemisahan stok per paket yang diminta.
import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { genId } from "../utils/format.js";

const COL = "stock";

export async function listStock() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Realtime subscription ke seluruh collection "stock" - dipakai halaman
 * Stock Admin (js/pages/stock.js) supaya perubahan AVAILABLE -> SOLD yang
 * terjadi lewat webhook payment (backend, saat buyer bayar) langsung
 * terlihat tanpa Admin perlu refresh manual. Hanya dipanggil dari
 * halaman Admin yang sudah login sebagai admin, jadi tunduk pada Firestore
 * Rules `allow read: if isAdmin()` di atas seperti listStock().
 *
 * Call yang dikembalikan untuk unsubscribe (dipanggil otomatis saat
 * halaman Stock di-unmount, lihat MutationObserver di stock.js).
 */
export function subscribeStock(onChange, onError) {
  return onSnapshot(
    collection(db, COL),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  );
}

export async function saveStockItem(id, data) {
  const payload = {
    productId: data.productId || "",
    // packageName WAJIB diisi (nama paket persis sama dengan packages[].name
    // di produk, atau nama produk itu sendiri untuk produk tanpa paket) —
    // dipakai Store untuk validasi stok per kombinasi productId+packageName,
    // bukan hanya productId seperti sebelumnya.
    packageName: data.packageName || "",
    label: data.label || "",
    email: data.email || "",
    password: data.password || "",
    note: data.note || "",
    sold: !!data.sold,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, COL, id), payload);
    return id;
  }
  const newId = genId("stk");
  await setDoc(doc(db, COL, newId), { ...payload, assignedOrderId: null, createdAt: serverTimestamp() });
  return newId;
}

export async function deleteStockItem(id) {
  await deleteDoc(doc(db, COL, id));
}

export async function markStockSold(id, orderId) {
  await updateDoc(doc(db, COL, id), { sold: true, assignedOrderId: orderId || null, soldAt: serverTimestamp() });
}

export async function releaseStock(id) {
  await updateDoc(doc(db, COL, id), { sold: false, assignedOrderId: null });
}
