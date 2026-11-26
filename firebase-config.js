// =========================================================================
// KONFIGURASI FIREBASE - CBT ASAS MAN 1 TABALONG (SERVER 2)
// Upgraded: Anti-Cache ExamBro & Sinkronisasi Waktu Jadwal
// =========================================================================

const CBT_BUILD_VERSION = "github_fb2_2026_11_26_v1";
const CBT_VERSION_KEY = "CBT_MAN1_ACTIVE_BUILD";

(function autoCleanStaleServerCache() {
  try {
    const savedVer = localStorage.getItem(CBT_VERSION_KEY);
    if (savedVer !== CBT_BUILD_VERSION) {
      // Hapus cache master/jadwal lama & absensi lama agar tidak nyangkut di server/jam lama
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith("CBT_STAFF_CACHE_") ||
          k.startsWith("CBT_ABSEN_OK_") ||
          k === "cbt_siswa_session" ||
          k === "cbt_admin_session"
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function (k) {
        localStorage.removeItem(k);
      });

      // Bersihkan Cache Storage API pada WebView ExamBro jika tersedia
      if (typeof caches !== "undefined" && caches.keys) {
        caches.keys().then(function (names) {
          names.forEach(function (name) {
            caches.delete(name);
          });
        }).catch(function () {});
      }

      localStorage.setItem(CBT_VERSION_KEY, CBT_BUILD_VERSION);
    }
  } catch (e) {
    console.warn("Cache guard warning:", e);
  }
})();

const firebaseConfig = {
  apiKey: "AIzaSyBr358_xp8niT5hdaG_Y9uaLg_dZSCrgqo",
  authDomain: "cbt-man1-tabalong-2.firebaseapp.com",
  projectId: "cbt-man1-tabalong-2",
  storageBucket: "cbt-man1-tabalong-2.firebasestorage.app",
  messagingSenderId: "601426183735",
  appId: "1:601426183735:web:ea6840d95592b34125a1b2"
};

// Inisialisasi Firebase & Firestore (Compat v10)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeId(str) {
  return String(str || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeTimeHHMM(timeStr) {
  const raw = String(timeStr || "").trim();
  if (!raw) return "";
  const parts = raw.split(":");
  const hh = String(parseInt(parts[0] || "0", 10)).padStart(2, "0");
  const mm = String(parseInt(parts[1] || "0", 10)).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseJadwalDateTime(tanggalStr, jamStr, isEnd) {
  const pTgl = String(tanggalStr || "").trim().split("-");
  if (pTgl.length !== 3) return null;
  const yyyy = parseInt(pTgl[0], 10);
  const mm = parseInt(pTgl[1], 10) - 1;
  const dd = parseInt(pTgl[2], 10);
  const norm = normalizeTimeHHMM(jamStr);
  if (!norm) return null;
  const pJam = norm.split(":");
  const hh = parseInt(pJam[0], 10);
  const min = parseInt(pJam[1], 10);
  const sec = isEnd ? 59 : 0;
  const dt = new Date(yyyy, mm, dd, hh, min, sec);
  return isNaN(dt.getTime()) ? null : dt;
}
