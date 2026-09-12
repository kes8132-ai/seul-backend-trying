// Firebase SDK 모듈 불러오기 (CDN ES Module 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAMR9mu6GzkZy89NuFohZGwqB1vpoU3Mxk",
  authDomain: "leeseul-8b226.firebaseapp.com",
  projectId: "leeseul-8b226",
  storageBucket: "leeseul-8b226.firebasestorage.app",
  messagingSenderId: "471869993478",
  appId: "1:471869993478:web:55c237cad3c46b8dcc0987"
};

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ===================================================
// 데이터를 다루는 함수 세 개
// 백엔드 1: Firestore를 사용하는 코드로 변경되었습니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 "memos" 컬렉션에서 올린 순서대로(createdAt) 정렬하여 가져옵니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const result = [];
  snapshot.forEach(function (docSnap) {
    result.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return result;
}

// 메모를 새로 씁니다.
// Firestore의 "memos" 컬렉션에 새 문서를 추가합니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
  });
}

// 메모를 지웁니다.
// Firestore의 "memos" 컬렉션에서 해당 ID의 문서를 삭제합니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memoList = await loadMemos();
  memoList.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    input.value = "";
    await addMemo(text);
    render();
  }
});


// 실시간 동기화: Firestore에 메모가 추가되거나 삭제되면 자동으로 담벼락을 다시 그립니다.
const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
onSnapshot(q, function () {
  render();
});

// 입력창에 포커스 주기
input.focus();
