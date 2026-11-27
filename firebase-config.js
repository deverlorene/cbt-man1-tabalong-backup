// =========================================================================
// KONFIGURASI FIREBASE GANDA - CBT ASAS MAN 1 TABALONG (SERVER UTAMA + CADANGAN)
// Utama: cbt-man1-tabalong-2 | Cadangan: cbt-man1-tabalong
// =========================================================================

const CBT_BUILD_VERSION = "sesi2_gabung_server_2026_11_27_v2";
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
          k.startsWith("CBT_DONE_") ||
          k.startsWith("CBT_") ||
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

// 1. Project Firebase UTAMA (cbt-man1-tabalong-2)
const firebaseConfigUtama = {
  apiKey: "AIzaSyBr358_xp8niT5hdaG_Y9uaLg_dZSCrgqo",
  authDomain: "cbt-man1-tabalong-2.firebaseapp.com",
  projectId: "cbt-man1-tabalong-2",
  storageBucket: "cbt-man1-tabalong-2.firebasestorage.app",
  messagingSenderId: "601426183735",
  appId: "1:601426183735:web:ea6840d95592b34125a1b2"
};

// 2. Project Firebase CADANGAN / BACKUP (cbt-man1-tabalong)
const firebaseConfigCadangan = {
  apiKey: "AIzaSyBiK7v2PLgFeSC_FSi-iN3EL7mTh3bOZHc",
  authDomain: "cbt-man1-tabalong.firebaseapp.com",
  projectId: "cbt-man1-tabalong",
  storageBucket: "cbt-man1-tabalong.firebasestorage.app",
  messagingSenderId: "150623087457",
  appId: "1:150623087457:web:69936beda7f09bdd1b7320"
};

let utamaApp = null;
if (!firebase.apps.length) {
  utamaApp = firebase.initializeApp(firebaseConfigUtama);
} else {
  utamaApp = firebase.app();
}
const db = utamaApp.firestore();

let dbBackup = null;
try {
  if (
    firebaseConfigCadangan.projectId &&
    firebaseConfigCadangan.projectId !== firebaseConfigUtama.projectId
  ) {
    const existingBackup = firebase.apps.find(function (app) {
      return app.name === "CBT_CADANGAN_APP";
    });
    const backupApp = existingBackup || firebase.initializeApp(firebaseConfigCadangan, "CBT_CADANGAN_APP");
    dbBackup = backupApp.firestore();
  }
} catch (errBackupInit) {
  console.warn("Firestore cadangan tidak aktif:", errBackupInit);
  dbBackup = null;
}

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
 * Menulis dokumen ke Firestore utama (`db`), dan jika gagal (kuota/jaringan),
 * otomatis mencoba menulis ke Firestore cadangan (`dbBackup`).
 */
async function setDocWithBackup(koleksi, docId, payload, options) {
  try {
    await db.collection(koleksi).doc(docId).set(payload, options || {});
    return { ok: true, target: "utama" };
  } catch (errUtama) {
    if (dbBackup) {
      try {
        await dbBackup.collection(koleksi).doc(docId).set(payload, options || {});
        return { ok: true, target: "cadangan" };
      } catch (errCadangan) {
        return { ok: false, target: "none", error: errCadangan };
      }
    }
    return { ok: false, target: "none", error: errUtama };
  }
}

/**
 * Mengambil dokumen dari Firestore utama (`db`), lalu fallback ke `dbBackup` jika tidak ada/error.
 */
async function getDocWithBackup(koleksi, docId) {
  try {
    const docUtama = await db.collection(koleksi).doc(docId).get();
    if (docUtama.exists) return docUtama;
  } catch (e) {}

  if (dbBackup) {
    try {
      const docCadangan = await dbBackup.collection(koleksi).doc(docId).get();
      if (docCadangan.exists) return docCadangan;
    } catch (e2) {}
  }
  return { exists: false, data: function () { return null; } };
}

/**
 * Menyalin data perubahan beberapa hari terakhir dari `dbBackup` (cbt-man1-tabalong)
 * ke `db` utama (cbt-man1-tabalong-2).
 */
async function sinkronDataCadanganKeUtama(onProgress) {
  if (!dbBackup) {
    throw new Error("Firestore cadangan belum aktif.");
  }

  const koleksiMaster = ["data_siswa", "data_guru", "data_pengawas", "data_admin", "master_ujian"];
  let totalTersalin = 0;

  for (let i = 0; i < koleksiMaster.length; i++) {
    const colName = koleksiMaster[i];
    if (typeof onProgress === "function") onProgress("Menyinkronkan " + colName + "...");
    const snap = await dbBackup.collection(colName).get();
    let batch = db.batch();
    let opCount = 0;

    for (const doc of snap.docs) {
      batch.set(db.collection(colName).doc(doc.id), doc.data(), { merge: true });
      opCount++;
      totalTersalin++;
      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }
  }

  // Salin bank_soal beserta subkoleksi chunks-nya
  if (typeof onProgress === "function") onProgress("Menyinkronkan bank_soal & chunks...");
  const bankSnap = await dbBackup.collection("bank_soal").get();
  for (const bankDoc of bankSnap.docs) {
    await db.collection("bank_soal").doc(bankDoc.id).set(bankDoc.data(), { merge: true });
    totalTersalin++;

    const chunksSnap = await dbBackup.collection("bank_soal").doc(bankDoc.id).collection("chunks").get();
    let cBatch = db.batch();
    let cCount = 0;
    for (const chDoc of chunksSnap.docs) {
      cBatch.set(db.collection("bank_soal").doc(bankDoc.id).collection("chunks").doc(chDoc.id), chDoc.data(), { merge: true });
      cCount++;
      totalTersalin++;
      if (cCount >= 400) {
        await cBatch.commit();
        cBatch = db.batch();
        cCount = 0;
      }
    }
    if (cCount > 0) {
      await cBatch.commit();
    }
  }

  // Salin rekap_nilai & log_absensi terbaru (maksimal 500 dokumen per koleksi agar hemat kuota)
  const koleksiTransaksi = ["rekap_nilai", "log_absensi"];
  for (let j = 0; j < koleksiTransaksi.length; j++) {
    const tCol = koleksiTransaksi[j];
    if (typeof onProgress === "function") onProgress("Menyinkronkan " + tCol + "...");
    const tSnap = await dbBackup.collection(tCol).limit(500).get();
    let tBatch = db.batch();
    let tCount = 0;
    for (const tDoc of tSnap.docs) {
      tBatch.set(db.collection(tCol).doc(tDoc.id), tDoc.data(), { merge: true });
      tCount++;
      totalTersalin++;
      if (tCount >= 400) {
        await tBatch.commit();
        tBatch = db.batch();
        tCount = 0;
      }
    }
    if (tCount > 0) {
      await tBatch.commit();
    }
  }

  return totalTersalin;
}

/**
 * Memproses & mengompres gambar secara lokal (< 0.1 detik, tanpa network hang).
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
      if (file.size <= 90 * 1024) {
        resolve({
          dataUrl: rawDataUrl,
          mimeType: file.type
        });
        return;
      }

      const img = new Image();
      img.onerror = function () {
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
