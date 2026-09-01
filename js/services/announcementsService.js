// ===== ANNOUNCEMENTS SERVICE =====
// Collection: "announcements" (Store: loadAnnouncements() -> getDocs(...),
// field yang dipakai: title, msg, type, active, createdAt — persis field
// yang dikelola di bawah ini).
import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { genId } from "../utils/format.js";

const COL = "announcements";

export async function listAnnouncements() {
  const snap = await getDocs(collection(db, COL));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.createdAt?.toMillis?.() || b.createdAt || 0) - (a.createdAt?.toMillis?.() || a.createdAt || 0));
  return items;
}

export async function saveAnnouncement(id, data) {
  const payload = {
    title: data.title || "",
    msg: data.msg || "",
    type: data.type || "info", // info | warning | success | danger
    active: data.active !== false,
  };
  if (id) {
    await updateDoc(doc(db, COL, id), payload);
    return id;
  }
  const newId = genId("ann");
  // createdAt disimpan sebagai epoch ms karena Store mengurutkan dengan
  // `(b.createdAt||0) - (a.createdAt||0)` (bukan Firestore Timestamp).
  await setDoc(doc(db, COL, newId), { ...payload, createdAt: Date.now() });
  return newId;
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, COL, id));
}
