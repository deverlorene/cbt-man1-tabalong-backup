// =========================================================================
// KONFIGURASI FIREBASE - CBT ASAS MAN 1 TABALONG (SERVER 2)
// Upgraded: Anti-Cache ExamBro, Sinkronisasi Waktu & Fast Image Upload
// =========================================================================

const CBT_BUILD_VERSION = "github_fb2_2026_11_26_v3";
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

// Inisialisasi Firebase, Firestore & Storage (Compat v10)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = (typeof firebase.storage === "function") ? firebase.storage() : null;

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
 * Mengompres file gambar di browser sebelum disimpan.
 * Jika file sudah kecil (<= 120 KB) dan dimensi <= 960px, langsung baca tanpa re-encode berat.
 */
function compressImageFile(file, maxWidth, maxHeight, quality) {
  const wMax = maxWidth || 960;
  const hMax = maxHeight || 960;
  const q = typeof quality === "number" ? quality : 0.78;

  return new Promise(function (resolve, reject) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar (JPG, PNG, WEBP, dll.)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = function () {
      reject(new Error("Gagal membaca file gambar."));
    };
    reader.onload = function (ev) {
      const rawDataUrl = ev.target.result;
      const img = new Image();
      img.onerror = function () {
        reject(new Error("Format gambar tidak dapat diproses."));
      };
      img.onload = function () {
        let width = img.width;
        let height = img.height;

        // Jika ukuran file sudah sangat ringan (<= 120 KB) dan dimensi tidak melebihi batas, langsung gunakan
        if (file.size <= 120 * 1024 && width <= wMax && height <= hMax) {
          resolve({
            blob: file,
            dataUrl: rawDataUrl,
            mimeType: file.type
          });
          return;
        }

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

        canvas.toBlob(function (blob) {
          resolve({
            blob: blob || file,
            dataUrl: dataUrl,
            mimeType: mimeType
          });
        }, mimeType, q);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Mengunggah foto soal/opsi dengan batas tunggu cepat (timeout 3.5 detik untuk Firebase Storage).
 * Jika Firebase Storage belum diaktifkan/diblokir Rules (hang/retry), langsung otomatis fallback
 * ke dataUrl terkompresi dalam < 0.2 detik tanpa menunggu retry lama!
 */
async function uploadSoalImage(file, folderPath) {
  const compressed = await compressImageFile(file, 960, 960, 0.78);

  if (storage && compressed.blob) {
    try {
      const ext = compressed.mimeType === "image/png" ? "png" : "jpg";
      const fileName = `soal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const fullPath = `${sanitizeId(folderPath || "bank_soal")}/${fileName}`;
      const ref = storage.ref().child(fullPath);

      const uploadTask = ref.put(compressed.blob, { contentType: compressed.mimeType });
      const downloadUrl = await new Promise(function (resolve, reject) {
        let settled = false;
        const timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          try { uploadTask.cancel(); } catch (e) {}
          reject(new Error("Storage timeout (kemungkinan bucket belum diaktifkan)."));
        }, 3500);

        uploadTask.on(
          "state_changed",
          null,
          function (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
          },
          function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
          }
        );
      });

      return downloadUrl;
    } catch (errStorage) {
      console.warn("Storage dilewati, menggunakan penyimpanan langsung ke paket soal:", errStorage.message);
      return compressed.dataUrl;
    }
  }

  return compressed.dataUrl;
}
