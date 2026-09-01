# PanaviBunga Admin — Setup

Project baru, terpisah total dari Aliftzy Admin. Menunjuk ke Firebase project
yang SAMA dengan PanaviBunga Store (`panavibunga-store`).

## 1. Firestore Rules

Admin ini tidak men-deploy rules secara otomatis. File `firestore.rules` di
root repo ini hanyalah REFERENSI — deploy manual ke Firebase Console/CLI pada
project `panavibunga-store`. Admin sudah diisi sebagai `panavi@my.id`.
Status "admin" ditentukan sepenuhnya oleh rules ini (lewat `isAdmin()`),
bukan oleh kode di repo Admin.

**Penting:** akun `panavi@my.id` harus benar-benar TERDAFTAR sebagai user
di Firebase Authentication project `panavibunga-store` sebelum bisa dipakai
login ke Admin (bisa daftar lewat halaman Register di Store, atau tambah
manual lewat Firebase Console → Authentication → Add user). Rules hanya
mengecek email dari akun yang sudah ada — tidak membuatkan akunnya.

## 2. Deploy

Situs statis, tanpa build step — bisa langsung di-deploy sebagai project
Vercel baru (nama disarankan: `panavibunga-admin`) atau dijalankan lokal:

```
npm run dev
```

JANGAN deploy ke project Vercel Aliftzy Admin yang lama.

## 3. Fitur yang tersedia

Admin dapat: login, dashboard, kelola produk (tambah/edit/hapus), kelola
stok, lihat & ubah status order (PENDING/PAID/DELIVERED/EXPIRED/FAILED/
CANCELLED), kirim akun ke pelanggan (isi email/password/login URL/catatan),
kelola pengumuman, kelola pengaturan toko, dan kelola profil admin.

Fitur Songs/Music (pemutar musik di Store) dipertahankan apa adanya karena
sudah terintegrasi di UI Store — tidak dihapus maupun ditambah fitur baru
untuknya, sesuai instruksi.

## Verifikasi pembayaran manual (WAJIB dipahami)

PanaviBunga Store TIDAK memiliki payment gateway. Order yang baru dibuat
customer selalu berstatus **PENDING**. Alur kerja Anda sebagai admin:

1. Customer membayar ke QRIS statis Anda, lalu mengirim bukti pembayaran
   lewat WhatsApp (tombol "Kirim Bukti Transaksi" di Store membuka WA dengan
   detail Order ID/Produk/Paket/Total sudah terisi).
2. Buka menu **Orders** di Admin, cari order dengan Order ID yang sama.
3. Setelah memverifikasi bukti pembayaran secara manual, ubah status order
   (mis. ke `PAID`) lewat dropdown "Ubah Status", atau langsung gunakan
   "Kirim Akun ke Pelanggan" untuk mengisi detail akun dan otomatis menandai
   order sebagai `DELIVERED`.

Tidak ada bagian sistem yang mengubah status order secara otomatis — itu
memang sesuai permintaan Anda (tidak ada verifikasi pembayaran otomatis).
