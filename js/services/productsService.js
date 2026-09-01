// ===== PRODUCTS SERVICE =====
// Collection: "products" (SAMA PERSIS dengan yang dibaca Store: js/app.js
// -> loadProducts() melakukan getDocs(collection(db,"products")) tanpa
// filter, jadi field apa pun yang kita tulis di sini otomatis muncul di
// Store. Field yang benar-benar dipakai Store saat render:
//   name, category, price, desc, badge, img, link, packages[]
// Field lain (createdAt, updatedAt) aman ditambahkan karena Store hanya
// melakukan spread {id, ...d.data()} dan tidak peduli field tak dikenal.
import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { genId } from "../utils/format.js";

const COL = "products";

export async function listProducts() {
  const snap = await getDocs(query(collection(db, COL)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveProduct(id, data) {
  const payload = {
    name: data.name || "",
    category: data.category || "",
    price: Number(data.price) || 0,
    desc: data.desc || "",
    badge: data.badge || "",
    img: data.img || "",
    link: data.link || "https://wa.me/",
    packages: Array.isArray(data.packages) ? data.packages : [],
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, COL, id), payload);
    return id;
  }
  const newId = genId("prod");
  await setDoc(doc(db, COL, newId), { ...payload, createdAt: serverTimestamp() });
  return newId;
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, COL, id));
}
