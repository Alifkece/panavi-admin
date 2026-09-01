// ===== SETTINGS SERVICE =====
// Collection: "settings", doc "store" (Store: loadStoreProfile() ->
// getDoc(doc(db,"settings","store")), lalu applyStoreProfile() HANYA
// membaca field `avatarUrl` untuk menentukan gambar/video profil toko).
//
// Field lain di bawah (storeName, whatsapp, description) DISIMPAN di
// dokumen yang sama untuk kebutuhan Admin/masa depan, tapi Store versi
// yang dikirim saat ini tidak membacanya — jadi menambahkannya tidak
// mengubah perilaku Store sama sekali (aman & forward-compatible).
import { db, storage } from "../firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const COL = "settings";
const STORE_DOC = "store";

export async function getStoreSettings() {
  const snap = await getDoc(doc(db, COL, STORE_DOC));
  return snap.exists() ? snap.data() : { avatarUrl: "" };
}

export async function saveStoreSettings(data) {
  await setDoc(
    doc(db, COL, STORE_DOC),
    {
      avatarUrl: data.avatarUrl || "",
      storeName: data.storeName || "",
      whatsapp: data.whatsapp || "",
      description: data.description || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadStoreAvatar(dataUrl) {
  const storageRef = ref(storage, `settings/store-avatar-${Date.now()}.jpg`);
  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
}
