// ===== MEDIA LIBRARY SERVICE =====
// IMPORTANT: does NOT create a new Firestore collection. Security rules only
// allow known collections plus a catch-all deny, so a fresh top-level
// "media" collection would be silently blocked. Instead this stores the
// media library as an array inside a single document at settings/mediaLibrary
// — which is already covered by the existing rule:
//   match /settings/{docId} { allow read: if isLoggedIn(); allow write: if isAdmin(); }
// This keeps 100% compatibility with the deployed rules, unmodified.
import { db } from "../firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { genId } from "../utils/format.js";

const DOC_REF = () => doc(db, "settings", "mediaLibrary");

export async function listMedia() {
  const snap = await getDoc(DOC_REF());
  if (!snap.exists()) return [];
  const items = snap.data()?.items || [];
  return [...items].sort((a, b) => (b.uploadedAtMs || 0) - (a.uploadedAtMs || 0));
}

/**
 * @param {{name:string, url:string, mimetype:string, size:number, kind:string}} entry
 */
export async function addMediaEntry(entry) {
  const ref = DOC_REF();
  const snap = await getDoc(ref);
  const items = snap.exists() ? snap.data()?.items || [] : [];
  const item = {
    id: genId("media"),
    name: entry.name,
    url: entry.url,
    mimetype: entry.mimetype || "",
    size: entry.size || 0,
    kind: entry.kind || "file",
    uploadedAtMs: Date.now(),
  };
  items.push(item);
  await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
  return item;
}

export async function deleteMediaEntry(id) {
  const ref = DOC_REF();
  const snap = await getDoc(ref);
  const items = snap.exists() ? snap.data()?.items || [] : [];
  const next = items.filter((i) => i.id !== id);
  await setDoc(ref, { items: next, updatedAt: serverTimestamp() }, { merge: true });
}
