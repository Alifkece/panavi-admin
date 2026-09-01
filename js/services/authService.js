// ===== AUTH SERVICE =====
// Menggunakan Firebase Authentication project yang SAMA dengan Store.
//
// PENTING — cara Admin ditentukan MENGIKUTI Firestore Rules Anda yang
// sesungguhnya (bukan collection "admins" terpisah):
//
//   function isAdmin() {
//     return request.auth != null &&
//            request.auth.token.email == "panavi@my.id";
//   }
//
// Karena logika admin ada di rules (berbasis EMAIL, hardcoded), Admin
// TIDAK menduplikasi hardcode email ini di frontend (kalau email admin
// berubah/nambah di rules, frontend harus ikut update manual dan gampang
// lupa sinkron). Sebagai gantinya, status admin diverifikasi dengan
// mencoba membaca dokumen yang rules-nya SUDAH mensyaratkan isAdmin():
// `settings/adminConfig`. Jika request diizinkan (tidak dilempar
// permission-denied), berarti Firestore sendiri sudah mengonfirmasi user
// ini admin — sumber kebenarannya tetap satu, yaitu Security Rules.
import { auth, db } from "../firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback({ user: null, isAdmin: false });
    const isAdmin = await checkIsAdmin();
    callback({ user, isAdmin });
  });
}

/** Probe: settings/adminConfig hanya bisa dibaca jika rules.isAdmin() true. */
export async function checkIsAdmin() {
  try {
    await getDoc(doc(db, "settings", "adminConfig"));
    return true; // tidak dilempar permission-denied -> lolos isAdmin() di rules
  } catch (e) {
    if (e.code === "permission-denied") return false;
    console.error("Gagal memeriksa status admin:", e);
    return false;
  }
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    await signOut(auth);
    const err = new Error("Akun ini tidak memiliki akses Dashboard Admin.");
    err.code = "not-admin";
    throw err;
  }
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Sesi tidak valid.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function getAuthErrorMessage(code) {
  const map = {
    "auth/user-not-found": "Email tidak terdaftar.",
    "auth/wrong-password": "Kata sandi salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/network-request-failed": "Koneksi gagal. Cek internet.",
    "not-admin": "Akun ini tidak memiliki akses Dashboard Admin.",
  };
  return map[code] || "Terjadi kesalahan. Coba lagi.";
}
