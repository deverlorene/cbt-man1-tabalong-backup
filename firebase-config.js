// =========================================================================
// KONFIGURASI FIREBASE - CBT ASAS MAN 1 TABALONG
// =========================================================================

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ASLI",
  authDomain: "cbt-man1-tabalong.firebaseapp.com",
  projectId: "cbt-man1-tabalong",
  storageBucket: "cbt-man1-tabalong.firebasestorage.app",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID_ASLI",
  appId: "GANTI_DENGAN_APP_ID_ASLI"
};

// Inisialisasi Firebase & Firestore
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeId(str) {
  return String(str || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}