// ===== MUSIC SERVICE (Firestore) =====
// Collection: "songs" — the same collection PanaviBunga Store already reads via
// loadSongs(). Store's existing code expects a `url` field, so every write
// here mirrors `audioUrl` into `url` as well. This keeps the Store's
// document structure 100% unchanged while giving the Admin the richer
// schema this module needs — an additive alias, not a breaking rename.
//
// Document shape:
//   title      string
//   artist     string
//   audioUrl   string   (also mirrored to `url` for Store compatibility)
//   url        string   (= audioUrl, read by Store — do not remove)
//   coverUrl   string   ("" if none)
//   duration   number|null   (seconds, filled in once known)
//   order      number   (ascending sort key, kept dense by reorderSongs)
//   createdAt  Timestamp
//   updatedAt  Timestamp
import { db } from "../firebase-config.js";
import {
  collection, doc, onSnapshot, query, orderBy, setDoc, updateDoc, deleteDoc, writeBatch,
  serverTimestamp, getDocs, limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { genId } from "../utils/format.js";

const COL = "songs";

/**
 * Realtime playlist subscription, ordered by `order` ascending.
 * One listener for the whole Music page — call the returned function once
 * to unsubscribe (the page does this automatically when it unmounts).
 */
export function subscribeSongs(onChange, onError) {
  const q = query(collection(db, COL), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  );
}

async function getNextOrder() {
  // Only need the current max — a single small, limited read, not a full scan.
  const q = query(collection(db, COL), orderBy("order", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return (snap.docs[0].data().order ?? 0) + 1;
}

export async function saveSong(id, data) {
  const audioUrl = data.audioUrl || "";
  const payload = {
    title: data.title || "",
    artist: data.artist || "",
    audioUrl,
    url: audioUrl, // Store-compatible alias — PanaviBunga Store reads this field.
    coverUrl: data.coverUrl || "",
    duration: typeof data.duration === "number" ? data.duration : null,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, COL, id), payload);
    return id;
  }
  const newId = genId("song");
  const order = await getNextOrder();
  await setDoc(doc(db, COL, newId), { ...payload, order, createdAt: serverTimestamp() });
  return newId;
}

export async function deleteSong(id) {
  await deleteDoc(doc(db, COL, id));
}

/** Persist a new drag-sort order (array of song IDs, index = position) in one batched write. */
export async function reorderSongs(orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, COL, id), { order: index });
  });
  await batch.commit();
}

/** Best-effort duration backfill once the browser has actually read the audio's metadata. */
export async function updateSongDuration(id, duration) {
  if (!id || !Number.isFinite(duration)) return;
  await updateDoc(doc(db, COL, id), { duration });
}
