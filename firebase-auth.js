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

export function captureAnswers(sections, state) {
  const read=(source,key)=>source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]:undefined;
  const has=value=>value!==undefined&&value!==null;
  const display=(field,value)=>{
    if(!has(value))return '未回答';
    if(Array.isArray(value))return value.map(v=>display(field,v)).join(' → ');
    if(field?.type==='tf'&&typeof value==='number')return ['〇','×'][value]??String(value);
    if(typeof value==='number'&&Array.isArray(field?.options))return field.options[value]??String(value);
    if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}: ${display(null,v)}`).join(' / ');
    return String(value);
  };
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return sections.map((section,si)=>{
    const st=state?.[si]||{},fields=section.fields||section.items||[];
    const answers=fields.map((field,fi)=>{
      const question=field.q||field.question||field.prompt||`設問 ${fi+1}`;
      const paired=Array.isArray(field.parts)?field.parts:(['pair','triple'].includes(field.type)?(field.labels||field.answer||[]).map((label,pi)=>({label:field.labels?.[pi]||`(${pi+1})`,options:field.options,answer:Array.isArray(field.answer)?field.answer[pi]:undefined})):null);
      let answer,correctAnswer,correct=null,selfCheck=false;
      if(Array.isArray(paired)){
        const userParts=[],keyParts=[];let allKnown=true,allCorrect=true,hasManualPart=false,allManualPartsChecked=true;
        paired.forEach((part,pi)=>{
          const key=`${fi}_${pi}`,userRaw=read(st.answers,key)??read(st.choices,key),keyRaw=part.answer;
          userParts.push(`${part.label||`(${pi+1})`}: ${display(part,userRaw)}`);
          keyParts.push(`${part.label||`(${pi+1})`}: ${display(part,keyRaw)}`);
          if(part.type==='self'||part.type==='manual'){
            hasManualPart=true;
            const checked=read(st.checks,key)??read(st.manual,key);
            if(checked!==true&&checked!=='true')allManualPartsChecked=false;
          }else if(!has(userRaw)||!has(keyRaw))allKnown=false;
          else if(!same(userRaw,keyRaw))allCorrect=false;
        });
        answer=userParts.join(' / ');correctAnswer=keyParts.join(' / ');
        selfCheck=hasManualPart&&allManualPartsChecked;
        if(!hasManualPart&&allKnown)correct=allCorrect;
      }else{
        let raw=read(st.answers,fi);
        if(!has(raw))raw=read(st.choices,fi);
        if(!has(raw))raw=read(st.manual,fi);
        const keyRaw=field.answer;
        answer=display(field,raw);correctAnswer=display(field,keyRaw);
        const manual=field.type==='self'||field.type==='manual'||field.manual===true;
        if(manual){
          const check=read(st.checks,fi)??read(st.manual,fi);
          selfCheck=check===true||check==='true';
        }else if(has(raw)&&has(keyRaw)){
          if(Array.isArray(raw)&&Array.isArray(keyRaw)){
            const a=field.type==='multi'?[...raw].sort():raw,b=field.type==='multi'?[...keyRaw].sort():keyRaw;
            correct=same(a,b);
          }else if(typeof raw===typeof keyRaw)correct=same(raw,keyRaw);
          else if(field.type==='tf')correct=answer===correctAnswer;
        }
      }
      const points=Number.isFinite(field.pts)?field.pts:Number.isFinite(field.points)?field.points:null;
      return {question,answer,correctAnswer,correct,selfCheck,...(points!==null?{maxPoints:points,earned:selfCheck?points:correct===true?points:0}:{})};
    });
    const score=Number.isFinite(st.weighted)?st.weighted:Number.isFinite(st.score)?st.score:null;
    return {section:section.title||section.name||`大問 ${si+1}`,...(score!==null?{score}:{}),answers};
  });
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
  captureAnswers,
  listScores,
  getQuizMetadata,
  quizCatalog: QUIZ_CATALOG
});
