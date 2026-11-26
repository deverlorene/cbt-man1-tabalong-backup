// =========================================================================
// KONFIGURASI FIREBASE - CBT ASAS MAN 1 TABALONG (SERVER 2)
// Upgraded v4: Instant Local Image Processing (Zero Storage Hang) & Anti-Cache
// =========================================================================

const CBT_BUILD_VERSION = "github_fb2_2026_11_26_v4";
const CBT_VERSION_KEY = "CBT_MAN1_ACTIVE_BUILD";

(function autoCleanStaleServerCache() {
  try {
    const savedVer = localStorage.getItem(CBT_VERSION_KEY);
    if (savedVer !== CBT_BUILD_VERSION) {
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

/**
 * Memproses & mengompres gambar secara lokal (< 0.1 detik, tanpa network hang ke Firebase Storage).
 * Gambar kecil <= 90 KB langsung dipakai instan; gambar besar otomatis dikompres ke max 800px WebP/JPEG.
 */
function compressImageFile(file, maxWidth, maxHeight, quality) {
  const wMax = maxWidth || 800;
  const hMax = maxHeight || 800;
  const q = typeof quality === "number" ? quality : 0.72;

  return new Promise(function (resolve, reject) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar (JPG, PNG, WEBP)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = function () {
      reject(new Error("Gagal membaca file gambar."));
    };
    reader.onload = function (ev) {
      const rawDataUrl = ev.target.result;
      // Jika file sudah sangat ringan (<= 90 KB), langsung kembalikan tanpa perlu decode Image
      if (file.size <= 90 * 1024) {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type
        });
        return;
      }

      const img = new Image();
      img.onerror = function () {
        // Fallback jika WebView gagal decode dimensi
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type
        });
      };
      img.onload = function () {
        let width = img.width;
        let height = img.height;

        if (width > wMax || height > hMax) {
          const ratio = Math.min(wMax / width, hMax / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, q);

        resolve({
          dataUrl: dataUrl,
          mimeType: mimeType
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Langsung memproses gambar secara instan di browser (0 network request saat pilih foto).
 * Data gambar disimpan bersama paket soal saat klik 'Simpan Semua Perubahan Soal'.
 */
async function uploadSoalImage(file) {
  const compressed = await compressImageFile(file, 800, 800, 0.72);
  return compressed.dataUrl;
}
