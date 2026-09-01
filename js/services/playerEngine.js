// ===== GLOBAL PLAYER ENGINE (singleton) =====
// The single source of truth for playback across the entire Admin app.
//
// Why this exists: #page-content's innerHTML is fully replaced on every
// route change (see router.js). Anything rendered *inside* it — including
// a plain <audio> tag — is destroyed and recreated on every navigation,
// which is exactly what stopped playback when leaving the Music page.
//
// The fix: create ONE <audio> element here, append it directly to
// document.body (a location the router never touches), and never
// recreate it. This module is imported once and initialized once from
// app.js at startup; songs.js (the Music page) and sidebar.js (the
// playback indicator) both just *observe* this engine — neither owns
// the audio element or the Firestore listener.
import { subscribeSongs, reorderSongs, updateSongDuration } from "./musicService.js";

let initialized = false;
let audioEl = null;
let unsubscribeFirestore = null;

const state = {
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  shuffle: false,
  repeat: "off", // off | all | one
  volume: 1,
  loaded: false, // true once the first Firestore snapshot has arrived
};

const listeners = new Set(); // low-frequency: play/pause/track/queue/shuffle/repeat/volume
const progressListeners = new Set(); // high-frequency: timeupdate/loadedmetadata (Music page only)

/** Idempotent — safe to call more than once; only the first call does anything. */
export function initPlayerEngine() {
  if (initialized) return;
  initialized = true;

  audioEl = document.createElement("audio");
  audioEl.id = "global-player-audio";
  audioEl.preload = "metadata";
  audioEl.volume = state.volume;
  document.body.appendChild(audioEl);

  audioEl.addEventListener("play", () => {
    state.isPlaying = true;
    notify();
  });
  audioEl.addEventListener("pause", () => {
    state.isPlaying = false;
    notify();
  });
  audioEl.addEventListener("ended", () => {
    if (state.repeat === "one") {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
      return;
    }
    playNext();
  });
  audioEl.addEventListener("loadedmetadata", () => {
    const song = state.queue[state.currentIndex];
    if (song && Number.isFinite(audioEl.duration) && song.duration !== Math.round(audioEl.duration)) {
      updateSongDuration(song.id, Math.round(audioEl.duration)).catch(() => {});
    }
    notifyProgress();
  });
  audioEl.addEventListener("timeupdate", notifyProgress);
  audioEl.addEventListener("error", () => {
    if (state.currentIndex >= 0) {
      state.isPlaying = false;
      notify();
    }
  });

  // ONE Firestore listener for the whole app session — not tied to any page.
  unsubscribeFirestore = subscribeSongs(handleSongsChange, handleSongsError);
}

function handleSongsChange(songs) {
  const currentId = state.queue[state.currentIndex]?.id ?? null;
  state.queue = songs;
  state.loaded = true;

  if (currentId) {
    const newIndex = songs.findIndex((s) => s.id === currentId);
    state.currentIndex = newIndex;
    if (newIndex === -1 && state.isPlaying) {
      // The song that was playing got deleted elsewhere — stop cleanly
      // instead of silently pointing at the wrong track.
      audioEl.pause();
    }
  }
  notify();
}

function handleSongsError(err) {
  console.error("[playerEngine] songs subscription failed:", err);
  state.loaded = true;
  notify({ error: err });
}

// ---------- Pub/sub ----------
export function subscribe(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

/** High-frequency progress updates (currentTime/duration) — Music page only. */
export function subscribeProgress(fn) {
  progressListeners.add(fn);
  fn(getProgress());
  return () => progressListeners.delete(fn);
}

function notify(extra = {}) {
  const snapshot = { ...getState(), ...extra };
  listeners.forEach((fn) => fn(snapshot));
}

function notifyProgress() {
  const snapshot = getProgress();
  progressListeners.forEach((fn) => fn(snapshot));
}

export function getState() {
  return {
    queue: state.queue,
    currentIndex: state.currentIndex,
    currentSong: state.queue[state.currentIndex] || null,
    isPlaying: state.isPlaying,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    loaded: state.loaded,
  };
}

export function getProgress() {
  return {
    currentTime: audioEl?.currentTime || 0,
    duration: audioEl?.duration || 0,
  };
}

export function getAudioElement() {
  return audioEl;
}

// ---------- Actions ----------
export function playAt(index) {
  const song = state.queue[index];
  if (!song || !audioEl) return;
  if (index === state.currentIndex) {
    togglePlay();
    return;
  }
  state.currentIndex = index;
  audioEl.src = song.audioUrl;
  audioEl.play().catch(() => {
    state.isPlaying = false;
    notify();
  });
  notify();
}

export function togglePlay() {
  if (!audioEl || state.currentIndex < 0) return;
  if (state.isPlaying) audioEl.pause();
  else audioEl.play().catch(() => {});
}

export function playNext() {
  if (!state.queue.length || !audioEl) return;
  let next;
  if (state.shuffle) {
    next = Math.floor(Math.random() * state.queue.length);
  } else {
    next = state.currentIndex + 1;
    if (next >= state.queue.length) {
      if (state.repeat !== "all") return;
      next = 0;
    }
  }
  state.currentIndex = next;
  audioEl.src = state.queue[next].audioUrl;
  audioEl.play().catch(() => {});
  notify();
}

export function playPrev() {
  if (!state.queue.length || !audioEl) return;
  let prev = state.currentIndex - 1;
  if (prev < 0) prev = state.shuffle ? Math.floor(Math.random() * state.queue.length) : state.queue.length - 1;
  state.currentIndex = prev;
  audioEl.src = state.queue[prev].audioUrl;
  audioEl.play().catch(() => {});
  notify();
}

export function toggleShuffle() {
  state.shuffle = !state.shuffle;
  notify();
}

export function cycleRepeat() {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  notify();
}

export function setVolume(v) {
  state.volume = v;
  if (audioEl) audioEl.volume = v;
  notify();
}

export function seek(time) {
  if (audioEl) audioEl.currentTime = time;
}

/** Optimistic local reorder + persist to Firestore (onSnapshot reconciles for every device). */
export async function reorderQueue(orderedIds) {
  const byId = new Map(state.queue.map((s) => [s.id, s]));
  const currentId = state.queue[state.currentIndex]?.id ?? null;
  state.queue = orderedIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
  state.currentIndex = currentId ? state.queue.findIndex((s) => s.id === currentId) : -1;
  notify();
  await reorderSongs(orderedIds);
}
