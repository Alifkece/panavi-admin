// ===== MUSIC PAGE (view over the global player engine) =====
// This page owns NO playback state and NO <audio> element — both live in
// js/services/playerEngine.js for the entire app session, so playback
// survives navigating away from and back to this page. This file only
// renders the playlist/mini-player UI and forwards user actions
// (play/pause/next/prev/shuffle/repeat/volume/seek/reorder) to the engine.
import * as player from "../services/playerEngine.js";
import { saveSong, deleteSong } from "../services/musicService.js";
import { listMedia } from "../services/mediaService.js";
import { openModal, closeModal } from "../components/modal.js";
import { confirmDialog } from "../components/confirmDialog.js";
import { toastSuccess, toastError, toastInfo } from "../components/toast.js";
import { skeletonList } from "../components/skeleton.js";
import { emptyState, errorState } from "../components/state.js";
import { escHtml, debounce } from "../utils/format.js";

let searchTerm = "";
let dragFromIndex = null;
let lastListSignature = null; // queue-id-sequence + loaded flag + search term
let lastMiniSongId = undefined; // song id last used to fully rebuild the mini player

export async function render(container) {
  container.innerHTML = `
    <div data-page-root="music">
      <div class="page-header flex-between">
        <div>
          <h1>Music</h1>
          <p>Playlist tersinkron realtime lewat Firestore — otomatis update di semua perangkat.</p>
        </div>
        <button type="button" class="btn btn-primary" id="btn-add-song" data-hotkey="new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Lagu
        </button>
      </div>

      <div class="music-layout">
        <section class="section-card">
          <div class="toolbar">
            <div class="field-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="song-search" placeholder="Cari judul / artis...">
            </div>
            <span class="field-hint" id="song-count"></span>
          </div>
          <div class="section-card-body">
            <div id="playlist-list">${skeletonList(4)}</div>
          </div>
        </section>

        <aside class="mini-player" id="mini-player"></aside>
      </div>
    </div>
  `;

  const pageRoot = container.querySelector('[data-page-root="music"]');

  lastListSignature = null;
  lastMiniSongId = undefined;

  container.querySelector("#btn-add-song").addEventListener("click", () => openSongForm(null));
  container.querySelector("#song-search").addEventListener(
    "input",
    debounce((e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderPlaylist(player.getState());
    }, 200)
  );

  // Subscribe to the global engine for as long as this page is mounted.
  const unsubState = player.subscribe((state) => {
    if (state.error) {
      const wrap = document.getElementById("playlist-list");
      if (wrap) wrap.innerHTML = errorState({ title: "Gagal memuat playlist", message: state.error.message || "Terjadi kesalahan." });
      return;
    }
    renderPlaylist(state);
    renderMiniPlayer(state);
  });
  const unsubProgress = player.subscribeProgress((progress) => {
    updateProgressUI(progress);
  });

  // Self-contained cleanup: no router lifecycle hook exists, so watch for
  // this page's own root being removed (another page's render() replaced
  // #page-content) and unsubscribe our two UI listeners then. The engine's
  // Firestore listener and <audio> element are NOT touched — they belong
  // to playerEngine and must keep running after we leave this page.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(pageRoot)) {
      unsubState();
      unsubProgress();
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });
}

// ---------- Playlist rendering ----------
function renderPlaylist(state) {
  const wrap = document.getElementById("playlist-list");
  const countEl = document.getElementById("song-count");
  if (!wrap) return;

  const { queue, currentIndex, isPlaying, loaded } = state;
  if (countEl) countEl.textContent = queue.length ? `${queue.length} lagu` : "";

  const signature = `${loaded}|${searchTerm}|${queue.map((s) => s.id).join(",")}`;
  if (signature === lastListSignature) {
    // Only playback state changed (play/pause/shuffle/repeat/volume/track) —
    // patch just the affected row(s) instead of rebuilding the whole list.
    patchPlaylistPlaybackUI(wrap, queue, currentIndex, isPlaying);
    return;
  }
  lastListSignature = signature;

  if (!loaded) {
    wrap.innerHTML = skeletonList(4);
    return;
  }

  let list = queue;
  if (searchTerm) list = list.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(searchTerm));

  if (!queue.length) {
    wrap.innerHTML = emptyState({ title: "Belum ada lagu", message: "Klik Tambah Lagu untuk mulai mengisi playlist Store." });
    return;
  }
  if (!list.length) {
    wrap.innerHTML = emptyState({ title: "Tidak ditemukan", message: "Coba kata kunci pencarian lain." });
    return;
  }

  wrap.innerHTML = list
    .map((s) => {
      const idx = queue.findIndex((x) => x.id === s.id);
      const playing = idx === currentIndex;
      return `
    <div class="playlist-row ${playing ? "is-playing" : ""}" draggable="true" data-index="${idx}" data-id="${s.id}">
      <svg class="drag-handle" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="6" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="16" cy="18" r="1.4"/></svg>
      ${s.coverUrl
        ? `<img class="pl-thumb" src="${escHtml(s.coverUrl)}" onerror="this.style.visibility='hidden'" alt="">`
        : `<div class="pl-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`}
      <div class="pl-body">
        <div class="pl-title">${escHtml(s.title || "-")}</div>
        <div class="pl-artist">${escHtml(s.artist || "-")}</div>
      </div>
      ${playing ? `<div class="equalizer ${isPlaying ? "is-playing" : ""}"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>` : ""}
      <div class="pl-actions">
        <button type="button" class="btn btn-ghost btn-icon btn-sm pl-play-btn" data-play="${idx}" aria-label="Play">
          ${playing && isPlaying
            ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
            : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>`}
        </button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" aria-label="Edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button type="button" class="btn btn-danger btn-icon btn-sm" data-delete="${s.id}" aria-label="Hapus">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
    })
    .join("");

  wrap.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", () => player.playAt(+b.dataset.play)));
  wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openSongForm(b.dataset.edit)));
  wrap.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => handleDelete(b.dataset.delete)));
  bindDragSort(wrap, queue);
}

/** Cosmetic-only update: swap which row shows "playing", without rebuilding the list. */
function patchPlaylistPlaybackUI(wrap, queue, currentIndex, isPlaying) {
  const currentId = queue[currentIndex]?.id ?? null;

  wrap.querySelectorAll(".playlist-row").forEach((row) => {
    const isCurrent = row.dataset.id === currentId;
    row.classList.toggle("is-playing", isCurrent);

    const eq = row.querySelector(".equalizer");
    if (isCurrent) {
      if (eq) {
        eq.classList.toggle("is-playing", isPlaying);
      } else {
        row.querySelector(".pl-body")?.insertAdjacentHTML(
          "afterend",
          `<div class="equalizer ${isPlaying ? "is-playing" : ""}"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>`
        );
      }
    } else if (eq) {
      eq.remove();
    }

    const playBtn = row.querySelector(".pl-play-btn");
    if (playBtn) {
      playBtn.innerHTML =
        isCurrent && isPlaying
          ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>`;
    }
  });
}

function bindDragSort(wrap, queue) {
  const rows = wrap.querySelectorAll(".playlist-row");
  rows.forEach((row) => {
    row.addEventListener("dragstart", () => {
      dragFromIndex = +row.dataset.index;
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (e) => e.preventDefault());
    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const toIndex = +row.dataset.index;
      if (dragFromIndex === null || dragFromIndex === toIndex) return;
      const reordered = [...queue];
      const moved = reordered.splice(dragFromIndex, 1)[0];
      reordered.splice(toIndex, 0, moved);
      dragFromIndex = null;
      try {
        await player.reorderQueue(reordered.map((s) => s.id));
      } catch (err) {
        toastError("Gagal menyimpan urutan lagu.");
      }
    });
  });
}

// ---------- Mini player (rendered from engine state, controls forward to engine) ----------
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateProgressUI({ currentTime, duration }) {
  const bar = document.getElementById("mp-progress");
  const cur = document.getElementById("mp-current-time");
  const dur = document.getElementById("mp-duration");
  if (!bar) return;
  bar.max = duration || 0;
  bar.value = currentTime || 0;
  if (cur) cur.textContent = fmtTime(currentTime);
  if (dur) dur.textContent = fmtTime(duration);
}

function miniPlayerHtml(state) {
  const { currentSong, isPlaying, shuffle, repeat, volume } = state;
  if (!currentSong) {
    return `
      <div class="mini-player-art" style="display:flex;align-items:center;justify-content:center;color:var(--text-3);">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="mini-player-title">Belum ada lagu diputar</div>
      <div class="mini-player-artist">Pilih lagu dari playlist</div>
      <div class="mini-player-progress"><span class="mini-player-time">0:00</span><input type="range" id="mp-progress" value="0" min="0" max="0" disabled><span class="mini-player-time" id="mp-duration">0:00</span></div>
      <div class="mini-player-controls">
        <button type="button" class="icon-btn" id="mp-shuffle" aria-label="Shuffle" disabled><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></button>
        <button type="button" class="icon-btn" id="mp-prev" aria-label="Previous" disabled><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4"/><rect x="5" y="4" width="2" height="16"/></svg></button>
        <button type="button" class="btn-play-main" id="mp-play-btn" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg></button>
        <button type="button" class="icon-btn" id="mp-next" aria-label="Next" disabled><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="17" y="4" width="2" height="16"/></svg></button>
        <button type="button" class="icon-btn" id="mp-repeat" aria-label="Repeat" disabled><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></button>
      </div>
      <div class="mini-player-volume">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>
        <input type="range" id="mp-volume" min="0" max="1" step="0.01" value="${volume}">
      </div>
    `;
  }
  return `
    ${currentSong.coverUrl
      ? `<img class="mini-player-art" src="${escHtml(currentSong.coverUrl)}" onerror="this.style.visibility='hidden'" alt="">`
      : `<div class="mini-player-art" style="display:flex;align-items:center;justify-content:center;color:var(--text-3);"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`}
    <div class="mini-player-title">${escHtml(currentSong.title || "-")}</div>
    <div class="mini-player-artist">${escHtml(currentSong.artist || "-")}</div>
    <div class="mini-player-progress">
      <span class="mini-player-time" id="mp-current-time">0:00</span>
      <input type="range" id="mp-progress" value="0" min="0" max="0">
      <span class="mini-player-time" id="mp-duration">0:00</span>
    </div>
    <div class="mini-player-controls">
      <button type="button" class="icon-btn ${shuffle ? "active" : ""}" id="mp-shuffle" aria-label="Shuffle"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></button>
      <button type="button" class="icon-btn" id="mp-prev" aria-label="Previous"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4"/><rect x="5" y="4" width="2" height="16"/></svg></button>
      <button type="button" class="btn-play-main" id="mp-play-btn">
        ${isPlaying
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>`}
      </button>
      <button type="button" class="icon-btn" id="mp-next" aria-label="Next"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><rect x="17" y="4" width="2" height="16"/></svg></button>
      <button type="button" class="icon-btn ${repeat !== "off" ? "active" : ""}" id="mp-repeat" aria-label="Repeat">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        ${repeat === "one" ? `<span style="position:absolute;font-size:8px;transform:translate(5px,5px);">1</span>` : ""}
      </button>
    </div>
    <div class="mini-player-volume">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>
      <input type="range" id="mp-volume" min="0" max="1" step="0.01" value="${volume}">
    </div>
  `;
}

function renderMiniPlayer(state) {
  const holder = document.getElementById("mini-player");
  if (!holder) return;

  const songId = state.currentSong?.id ?? null;
  if (songId !== lastMiniSongId) {
    lastMiniSongId = songId;
    holder.innerHTML = miniPlayerHtml(state);
    bindMiniPlayerControls(holder, state);
  } else {
    patchMiniPlayerCosmetic(holder, state);
  }
  updateProgressUI(player.getProgress());
}

/** Cosmetic-only update for an already-mounted mini player: play icon, shuffle/repeat state. */
function patchMiniPlayerCosmetic(holder, state) {
  const { isPlaying, shuffle, repeat } = state;

  const playBtn = holder.querySelector("#mp-play-btn");
  if (playBtn) {
    playBtn.innerHTML = isPlaying
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20"/></svg>`;
  }

  const shuffleBtn = holder.querySelector("#mp-shuffle");
  shuffleBtn?.classList.toggle("active", shuffle);

  const repeatBtn = holder.querySelector("#mp-repeat");
  if (repeatBtn) {
    repeatBtn.classList.toggle("active", repeat !== "off");
    const existingBadge = repeatBtn.querySelector("span");
    if (repeat === "one" && !existingBadge) {
      repeatBtn.insertAdjacentHTML("beforeend", `<span style="position:absolute;font-size:8px;transform:translate(5px,5px);">1</span>`);
    } else if (repeat !== "one" && existingBadge) {
      existingBadge.remove();
    }
  }
}

function bindMiniPlayerControls(root, state) {
  root.querySelector("#mp-play-btn")?.addEventListener("click", () => player.togglePlay());
  root.querySelector("#mp-prev")?.addEventListener("click", () => player.playPrev());
  root.querySelector("#mp-next")?.addEventListener("click", () => player.playNext());
  root.querySelector("#mp-shuffle")?.addEventListener("click", () => player.toggleShuffle());
  root.querySelector("#mp-repeat")?.addEventListener("click", () => player.cycleRepeat());
  root.querySelector("#mp-progress")?.addEventListener("input", (e) => player.seek(+e.target.value));
  root.querySelector("#mp-volume")?.addEventListener("input", (e) => player.setVolume(+e.target.value));
}

// ---------- CRUD ----------
async function handleDelete(id) {
  const ok = await confirmDialog({ title: "Hapus lagu?", message: "Lagu ini akan dihapus dari playlist Store secara permanen." });
  if (!ok) return;
  try {
    await deleteSong(id);
    toastSuccess("Lagu berhasil dihapus.");
  } catch (e) {
    toastError(e.message || "Gagal menghapus lagu.");
  }
}

// ---------- Add/Edit form + Media Library picker (single-modal, view-swap) ----------
let mediaCache = null; // cached per form session — avoids re-reading settings/mediaLibrary twice

async function getMediaCache() {
  if (mediaCache) return mediaCache;
  mediaCache = await listMedia();
  return mediaCache;
}

function openSongForm(id) {
  const s = id ? player.getState().queue.find((x) => x.id === id) : null;
  mediaCache = null; // fresh session — reflects any media uploaded since the page opened

  const state = {
    id: s?.id || null,
    title: s?.title || "",
    artist: s?.artist || "",
    audioUrl: s?.audioUrl || "",
    coverUrl: s?.coverUrl || "",
    duration: s?.duration ?? null,
  };

  const overlay = openModal({
    title: s ? "Edit Lagu" : "Tambah Lagu",
    wide: true,
    bodyHtml: formBodyHtml(state),
    footHtml: formFootHtml(),
  });

  wireFormView(overlay, state, !!s);
}

function formBodyHtml(state) {
  return `
    <div class="field-row">
      <div class="field">
        <label for="sf-title">Judul Lagu</label>
        <input type="text" id="sf-title" value="${escHtml(state.title)}" placeholder="Nama lagu" required>
      </div>
      <div class="field">
        <label for="sf-artist">Artis</label>
        <input type="text" id="sf-artist" value="${escHtml(state.artist)}" placeholder="Nama artis">
      </div>
    </div>
    <div class="field">
      <label for="sf-audio-url">Audio URL (mp3/wav/ogg)</label>
      <div class="media-url-row">
        <input type="url" id="sf-audio-url" value="${escHtml(state.audioUrl)}" placeholder="https://.../lagu.mp3" required>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-pick-audio">Pilih dari Media</button>
      </div>
      ${state.duration ? `<span class="field-hint">Durasi terdeteksi: ${fmtTime(state.duration)}</span>` : ""}
    </div>
    <div class="field">
      <label for="sf-cover-url">Cover URL (opsional)</label>
      <label class="upload-drop" id="sf-cover-preview-drop" style="cursor:default;">
        <img class="thumb" id="sf-cover-preview" src="${state.coverUrl ? escHtml(state.coverUrl) : ""}" style="${state.coverUrl ? "" : "display:none;"}">
        <div class="upload-text">
          <strong>Cover lagu</strong>
          <span>${state.coverUrl ? "Cover terpasang" : "Belum ada cover"}</span>
        </div>
      </label>
      <div class="media-url-row" style="margin-top:8px;">
        <input type="url" id="sf-cover-url" value="${escHtml(state.coverUrl)}" placeholder="https://.../cover.jpg">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-pick-cover">Pilih dari Media</button>
      </div>
    </div>
  `;
}

function formFootHtml() {
  return `
    <button type="button" class="btn btn-ghost btn-sm" data-modal-close>Batal</button>
    <button type="button" class="btn btn-primary btn-sm" id="btn-save-song" data-hotkey="save"><span id="save-song-label">Simpan</span></button>
  `;
}

function pickerBodyHtml(kind, items, term = "") {
  const filtered = term ? items.filter((m) => (m.name || "").toLowerCase().includes(term)) : items;
  const kindLabel = kind === "audio" ? "audio" : "gambar";
  return `
    <div class="field-search" style="margin-bottom:14px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="search" id="picker-search" placeholder="Cari nama file ${kindLabel}...">
    </div>
    <div class="picker-list" id="picker-list">
      ${
        filtered.length
          ? filtered
              .map(
                (m) => `
        <div class="picker-row" data-media-url="${escHtml(m.url)}">
          <div class="picker-row-preview">
            ${kind === "image"
              ? `<img src="${escHtml(m.url)}" alt="">`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`}
          </div>
          <div class="picker-row-body">
            <div class="picker-row-name">${escHtml(m.name)}</div>
            <div class="picker-row-meta">${escHtml(m.mimetype || "")}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-select-media="${escHtml(m.url)}">Pilih</button>
        </div>`
              )
              .join("")
          : emptyState({
              title: `Belum ada ${kindLabel} di Media`,
              message: `Upload file ${kindLabel} lewat halaman Media terlebih dahulu, atau isi URL secara manual.`,
            })
      }
    </div>
  `;
}

function pickerFootHtml() {
  return `<button type="button" class="btn btn-ghost btn-sm" id="btn-picker-back">← Kembali</button>`;
}

function wireFormView(overlay, state, isEdit) {
  const modalBody = overlay.querySelector(".modal-body");
  const modalFoot = overlay.querySelector(".modal-foot");

  overlay.querySelector("#btn-pick-audio").addEventListener("click", () => openPicker("audio"));
  overlay.querySelector("#btn-pick-cover").addEventListener("click", () => openPicker("image"));
  overlay.querySelector("#sf-cover-url").addEventListener("input", (e) => {
    const preview = overlay.querySelector("#sf-cover-preview");
    if (e.target.value.trim()) {
      preview.src = e.target.value.trim();
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  });

  overlay.querySelector("#btn-save-song").addEventListener("click", () => handleSaveSong(overlay, state, isEdit));

  async function openPicker(kind) {
    state.title = overlay.querySelector("#sf-title")?.value ?? state.title;
    state.artist = overlay.querySelector("#sf-artist")?.value ?? state.artist;
    state.audioUrl = overlay.querySelector("#sf-audio-url")?.value ?? state.audioUrl;
    state.coverUrl = overlay.querySelector("#sf-cover-url")?.value ?? state.coverUrl;

    modalBody.innerHTML = skeletonList(3);
    modalFoot.innerHTML = pickerFootHtml();
    overlay.querySelector("#btn-picker-back").addEventListener("click", () => backToForm(overlay, state, isEdit));

    let items;
    try {
      items = (await getMediaCache()).filter((m) => m.kind === kind);
    } catch (e) {
      toastError("Gagal memuat Media Library.");
      items = [];
    }

    modalBody.innerHTML = pickerBodyHtml(kind, items);
    wirePicker(overlay, kind, items, state, isEdit);
  }
}

function wirePicker(overlay, kind, items, state, isEdit) {
  const modalBody = overlay.querySelector(".modal-body");

  function bindRows() {
    modalBody.querySelectorAll("[data-select-media]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.selectMedia;
        if (kind === "audio") state.audioUrl = url;
        else state.coverUrl = url;
        toastInfo("URL dipilih dari Media Library.");
        backToForm(overlay, state, isEdit);
      });
    });
  }

  overlay.querySelector("#picker-search")?.addEventListener(
    "input",
    debounce((e) => {
      modalBody.innerHTML = pickerBodyHtml(kind, items, e.target.value.trim().toLowerCase());
      bindRows();
      overlay.querySelector("#picker-search")?.focus();
    }, 150)
  );

  bindRows();
}

function backToForm(overlay, state, isEdit) {
  const modalBody = overlay.querySelector(".modal-body");
  const modalFoot = overlay.querySelector(".modal-foot");
  modalBody.innerHTML = formBodyHtml(state);
  modalFoot.innerHTML = formFootHtml();
  wireFormView(overlay, state, isEdit);
}

async function handleSaveSong(overlay, state, isEdit) {
  const title = overlay.querySelector("#sf-title").value.trim();
  const artist = overlay.querySelector("#sf-artist").value.trim();
  const audioUrl = overlay.querySelector("#sf-audio-url").value.trim();
  const coverUrl = overlay.querySelector("#sf-cover-url").value.trim();

  if (!title || !audioUrl) {
    toastError("Judul dan Audio URL wajib diisi.");
    return;
  }

  const btn = overlay.querySelector("#btn-save-song");
  const label = overlay.querySelector("#save-song-label");
  btn.disabled = true;
  label.innerHTML = `<span class="spinner"></span>`;
  try {
    await saveSong(state.id, { title, artist, audioUrl, coverUrl, duration: state.duration });
    toastSuccess(isEdit ? "Lagu berhasil diperbarui." : "Lagu berhasil ditambahkan.");
    closeModal();
  } catch (e) {
    toastError(e.message || "Gagal menyimpan lagu.");
    btn.disabled = false;
    label.textContent = "Simpan";
  }
}
