// ===== FIREBASE CONFIG & INIT (PanaviBunga Admin) =====
// PENTING: config ini SENGAJA identik dengan repository Store (PanaviBunga
// Store). Admin dan Store harus menunjuk ke Firebase project, Auth, dan
// Firestore yang SAMA ("panavibunga-store") agar semua perubahan dari Admin
// langsung terlihat di Store. Project ini terpisah TOTAL dari Firebase
// project Aliftzy Store lama.
//
// apiKey di bawah ini MEMANG publik by design (bukan secret) — ini normal
// untuk semua Firebase Web App. Keamanan data dijaga oleh Firestore Security
// Rules (lihat firestore.rules), bukan dengan menyembunyikan config ini.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWW7qGBLd8J19Fx6juROxt5DRKweaEBj8",
  authDomain: "panavibunga-store.firebaseapp.com",
  projectId: "panavibunga-store",
  storageBucket: "panavibunga-store.firebasestorage.app",
  messagingSenderId: "144096763144",
  appId: "1:144096763144:web:6808d3de4a36660e88a0bd",
  measurementId: "G-722GX6JQ28"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// BUG FIX (deployment): getFirestore(app) tanpa argumen kedua selalu
// menunjuk ke database bernama "(default)". Database Firestore project ini
// ternyata dibuat dengan ID "panavibunga-store" (bukan "(default)"),
// sehingga SEMUA query Firestore dari Admin (checkIsAdmin, dashboard,
// orders, stock, products) gagal dengan error "not-found" — yang di
// authService.js checkIsAdmin() secara tidak sengaja tertutupi dan tampil
// sebagai "Akun ini tidak memiliki akses Dashboard Admin.", padahal akar
// masalahnya bukan soal admin/bukan-admin sama sekali.
const db = getFirestore(app, "panavibunga-store");
const storage = getStorage(app);

export { app, auth, db, storage };
