// ===== MEDIA UPLOAD SERVICE =====
// Wraps the externally-provided upload API. The API itself is NOT changed —
// same endpoint, same key, same multipart "file" field, same response shape
// ({status, path, mimetype, size}). This is just the browser-side transport
// (fetch + FormData) instead of the Node-only axios/fs/form-data snippet,
// since ES Modules running in the browser can't use Node's fs/form-data.
const UPLOAD_DOMAIN = "https://c.termai.cc";
const UPLOAD_KEY = "AIzaBj7z2z3xBjsk";

export const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];

export function mediaKindFromMime(mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

/**
 * Upload a single File to the media host and return the API's response.
 * @param {File} file
 * @param {(percent:number)=>void} [onProgress] 0-100, best-effort (XHR gives real progress)
 * @returns {Promise<{status:boolean, path:string, mimetype:string, size:number}>}
 */
export function uploadMediaFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${UPLOAD_DOMAIN}/api/upload?key=${UPLOAD_KEY}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload gagal (HTTP ${xhr.status}).`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (!data?.status || !data?.path) {
          reject(new Error("Upload gagal: respons server tidak valid."));
          return;
        }
        onProgress?.(100);
        resolve(data);
      } catch {
        reject(new Error("Upload gagal: gagal membaca respons server."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload gagal: koneksi bermasalah.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload dibatalkan.")));

    xhr.send(formData);
  });
}
