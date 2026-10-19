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

export async function saveScore({ quizId, quizTitle, score, total, answers = null }) {
  const user = auth.currentUser;
  if (!user) throw new Error("点数を保存するにはログインしてください。");
  if (!quizId || !Number.isFinite(score) || !Number.isFinite(total)) {
    throw new TypeError("quizId、score、totalを指定してください。");
  }
  const ref = await addDoc(collection(db, "users", user.uid, "scores"), {
    quizId: String(quizId), quizTitle: quizTitle ? String(quizTitle) : "",
    score, total, answers, createdAt: serverTimestamp()
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
  listScores
});
