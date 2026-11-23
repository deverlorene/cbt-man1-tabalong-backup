// =========================================================================
// KONFIGURASI FIREBASE - CBT ASAS MAN 1 TABALONG
// =========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBiK7v2PLgFeSC_FSi-iN3EL7mTh3bOZHc",
  authDomain: "cbt-man1-tabalong.firebaseapp.com",
  projectId: "cbt-man1-tabalong",
  storageBucket: "cbt-man1-tabalong.firebasestorage.app",
  messagingSenderId: "150623087457",
  appId: "1:150623087457:web:69936beda7f09bdd1b7320"
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
