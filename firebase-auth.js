// Shared Firebase module. Import this file from the index and each quiz page.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7lVLCe_GA6spNGvChCf25Fl7GI809Xbg",
  authDomain: "doraemon-kentei.firebaseapp.com",
  projectId: "doraemon-kentei",
  storageBucket: "doraemon-kentei.firebasestorage.app",
  messagingSenderId: "363044826095",
  appId: "1:363044826095:web:683b88f5542a5dfb33a41a",
  measurementId: "G-JCLL9TYZR3"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

export { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged };

// Keep this catalog aligned with the year and grade links in index.html.
// It also lets new score records carry stable year/grade/color metadata.
export const QUIZ_CATALOG = Object.freeze({
  "2025": { color: "#EADCC9", levels: { beginner: "初級", shochukyu: "初中級", intermediate: "中級", advanced: "上級" } },
  "2024": { color: "#C4B5FD", levels: { beginner: "初級", intermediate: "中級", advanced: "上級" } },
  "2023": { color: "#86C1B2", levels: { beginner: "初級", intermediate: "中級", advanced: "上級" } },
  "2022": { color: "#D8B4FE", levels: { beginner: "初級", intermediate: "中級", advanced: "上級" } },
  "2021": { color: "#CBD5E1", levels: { beginner: "初級", intermediate: "中級", advanced: "上級" } },
  "2020": { color: "#A7F3D0", levels: { beginner: "初級", intermediate: "中級", advanced: "上級" } },
  "2019": { color: "#BFDBFE", levels: { intermediate: "中級", advanced: "上級", "super-advanced": "超上級" } },
  "2018": { color: "#FCA5A5", levels: { intermediate: "中級", advanced: "上級", "super-advanced": "超上級" } },
  "2017": { color: "#CFFAFE", levels: { intermediate: "中級", advanced: "上級" } },
  "2016": { color: "#FED7AA", levels: { intermediate: "中級", advanced: "上級" } },
  "2015": { color: "#C9BCE8", levels: { intermediate: "中級", advanced: "上級" } },
  "2014": { color: "#D2DAB4", levels: { intermediate: "中級", advanced: "上級" } },
  "2013": { color: "#E8D9A6", levels: { intermediate: "中級", advanced: "上級" } }
});

export function getQuizMetadata(quizId) {
  const id = String(quizId || "").toLowerCase();
  const year = id.match(/20\d{2}/)?.[0];
  const levelKey = year ? Object.keys(QUIZ_CATALOG[year]?.levels || {})
    .sort((a, b) => b.length - a.length)
    .find((key) => id.endsWith(`-${key}`)) : null;
  if (!year || !levelKey) return null;
  return Object.freeze({ year, level: levelKey, levelLabel: QUIZ_CATALOG[year].levels[levelKey], color: QUIZ_CATALOG[year].color });
}

export async function saveScore({ quizId, quizTitle, score, total, passThreshold = null, answers = null }) {
  const user = auth.currentUser;
  if (!user) throw new Error("点数を保存するにはログインしてください。");
  if (!quizId || !Number.isFinite(score) || !Number.isFinite(total)) {
    throw new TypeError("quizId、score、totalを指定してください。");
  }
  const metadata = getQuizMetadata(quizId);
  const defaultTitle = metadata ? `ドラえもん検定 ${metadata.year} ${metadata.levelLabel}` : "";
  const ref = await addDoc(collection(db, "users", user.uid, "scores"), {
    quizId: String(quizId), quizTitle: quizTitle ? String(quizTitle) : defaultTitle,
    ...(metadata ? { quizYear: metadata.year, quizLevel: metadata.level, themeColor: metadata.color } : {}),
    score, total, ...(Number.isFinite(passThreshold) ? { passThreshold } : {}), answers, createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function listScores({ maxResults = 100 } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("得点履歴を見るにはログインしてください。");
  const scoresRef = collection(db, "users", user.uid, "scores");
  const snapshot = await getDocs(query(scoresRef, orderBy("createdAt", "desc"), limit(maxResults)));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Convenient for quiz pages that want to call window.DoraemonAuth.
window.DoraemonAuth = Object.freeze({
  getCurrentUser: () => auth.currentUser,
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
  register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  saveScore,
  listScores,
  getQuizMetadata,
  quizCatalog: QUIZ_CATALOG
});
