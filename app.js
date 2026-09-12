// Firebase SDK 모듈 불러오기 (CDN ES Module 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAMR9mu6GzkZy89NuFohZGwqB1vpoU3Mxk",
  authDomain: "leeseul-8b226.firebaseapp.com",
  projectId: "leeseul-8b226",
  storageBucket: "leeseul-8b226.firebasestorage.app",
  messagingSenderId: "471869993478",
  appId: "1:471869993478:web:55c237cad3c46b8dcc0987"
};

// Firebase, Firestore, Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 (로그아웃 상태면 null)
let currentUser = null;

// ===================================================
// 교사 / 학생 역할 구분 설정 (UID 기반)
// ===================================================
// 교사 권한을 부여할 계정의 UID를 아래 배열에 추가하세요.
// (Firebase 콘솔 -> Authentication -> Users 탭에서 본인 계정의 UID 확인 가능)
const TEACHER_UIDS = [
  // 예: "1234567890abcdef" 형식의 UID
];

// 교사 여부 확인 함수
function isTeacher(user) {
  if (!user) return false;
  return TEACHER_UIDS.includes(user.uid);
}

// 현재 로그인한 사용자의 역할 ("teacher" 또는 "student")
function getCurrentRole() {
  if (!currentUser) return null;
  return isTeacher(currentUser) ? "teacher" : "student";
}


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
// 교사는 모든 권한을 가지며, 학생은 본인 메모만 생성할 수 있습니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid)와 역할(role)을 함께 저장합니다.
async function addMemo(text) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다. 먼저 Google 계정으로 로그인해 주세요.");
  }
  if (text.length < 5) {
    throw new Error("메모는 5글자 이상이어야 합니다.");
  }

  const role = getCurrentRole(); // "teacher" 또는 "student"

  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,
    author: currentUser.displayName || "익명 사용자",
    role: role
  });
}

// 메모를 지웁니다.
// Firestore의 "memos" 컬렉션에서 해당 ID의 문서를 삭제합니다.
// 교사는 모든 메모를 지울 수 있고, 학생은 본인 메모만 지울 수 있습니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// AI 코멘트 기능 (Gemini API)
// ===================================================

// 서버리스 함수(/api/gemini)를 통해 Gemini AI 코멘트 생성 요청
async function requestAiComment(text) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: text })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "AI 코멘트 생성 요청에 실패했습니다.");
  }
  return data.comment;
}

// 특정 메모에 AI 코멘트 저장 (Firestore update)
async function addAiCommentToMemo(memoId, text) {
  const comment = await requestAiComment(text);
  await updateDoc(doc(db, "memos", memoId), {
    aiComment: comment
  });
}


// ===================================================
// 구글 로그인 및 로그아웃
// ===================================================

// Google 팝업 로그인
async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("로그인 실패:", error);
    alert("로그인에 실패했습니다: " + error.message);
  }
}

// 로그아웃
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// 로그인 영역(상단 userArea) 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (currentUser) {
    const role = getCurrentRole();
    const roleBadge = role === "teacher" ? "👑 [교사]" : "🎓 [학생]";

    const userSpan = document.createElement("span");
    userSpan.textContent = `${roleBadge} ${currentUser.displayName || "사용자"}님 환영합니다!`;

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);

    userArea.appendChild(userSpan);
    userArea.appendChild(logoutBtn);

    // 교사 전용: 전체 게시물 AI 코멘트 일괄 달기 버튼
    if (isTeacher(currentUser)) {
      const batchAiBtn = document.createElement("button");
      batchAiBtn.className = "btn-batch-ai";
      batchAiBtn.textContent = "🤖 전체 AI 피드백";
      batchAiBtn.title = "아직 코멘트가 없는 모든 메모에 AI 코멘트를 일괄 생성합니다";
      batchAiBtn.addEventListener("click", async function () {
        batchAiBtn.disabled = true;
        batchAiBtn.textContent = "⏳ 피드백 생성 중...";
        try {
          const memos = await loadMemos();
          let count = 0;
          for (const memo of memos) {
            if (!memo.aiComment) {
              await addAiCommentToMemo(memo.id, memo.text);
              count++;
            }
          }
          alert(`완료되었습니다! (${count}개의 게시물에 AI 코멘트가 생성되었습니다)`);
        } catch (err) {
          alert("AI 코멘트 생성 중 오류: " + err.message);
        } finally {
          batchAiBtn.disabled = false;
          batchAiBtn.textContent = "🤖 전체 AI 피드백";
        }
      });
      userArea.appendChild(batchAiBtn);
    }
  } else {
    const noticeSpan = document.createElement("span");
    noticeSpan.textContent = "로그인하면 메모를 작성할 수 있습니다.";

    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google 로그인";
    loginBtn.addEventListener("click", loginWithGoogle);

    userArea.appendChild(noticeSpan);
    userArea.appendChild(loginBtn);
  }
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

  // 권한 제어:
  // 1. 교사는 모든 메모를 삭제할 수 있습니다.
  // 2. 학생은 오직 자신이 작성한 메모만 삭제할 수 있습니다. (타인의 것은 건들지 못함)
  const isTeacherUser = isTeacher(currentUser);
  const isMyMemo = currentUser && (memo.uid === currentUser.uid || !memo.uid);
  const canDelete = currentUser && (isTeacherUser || isMyMemo);

  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = isTeacherUser && !isMyMemo ? "교사 권한으로 삭제" : "메모 삭제";
    del.addEventListener("click", async function () {
      const msg = isTeacherUser && !isMyMemo 
        ? "교사 권한으로 이 메모를 삭제하시겠습니까?" 
        : "이 메모를 삭제하시겠습니까?";
      if (confirm(msg)) {
        await deleteMemo(memo.id);
        render();
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 및 역할 표시
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.className = "author";
    const authorBadge = memo.role === "teacher" ? "👑 " : "🎓 ";
    authorDiv.textContent = `${authorBadge}${memo.author}`;
    div.appendChild(authorDiv);
  }

  // AI 코멘트가 있는 경우 표시
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-comment";

    const header = document.createElement("div");
    header.className = "ai-comment-header";
    header.textContent = "🤖 AI 선생님 코멘트";

    const body = document.createElement("div");
    body.textContent = memo.aiComment;

    aiBox.appendChild(header);
    aiBox.appendChild(body);
    div.appendChild(aiBox);
  }

  // 교사 전용: 개별 게시물에 AI 코멘트 달기 버튼
  if (isTeacherUser) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "btn-ai";
    aiBtn.textContent = memo.aiComment ? "🤖 AI 코멘트 다시 달기" : "🤖 AI 코멘트 달기";
    aiBtn.addEventListener("click", async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "⏳ AI 생각 중...";
      try {
        await addAiCommentToMemo(memo.id, memo.text);
      } catch (err) {
        console.error("AI 코멘트 오류:", err);
        alert("AI 코멘트 생성 실패: " + err.message);
      } finally {
        aiBtn.disabled = false;
        aiBtn.textContent = memo.aiComment ? "🤖 AI 코멘트 다시 달기" : "🤖 AI 코멘트 달기";
      }
    });
    div.appendChild(aiBtn);
  }

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

    if (!currentUser) {
      alert("로그인이 필요합니다. 먼저 Google 로그인을 해 주세요.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    if (text.length < 5) {
      alert("메모는 5글자 이상 입력해 주세요.");
      return;
    }

    try {
      input.value = "";
      await addMemo(text);
      render();
    } catch (error) {
      console.error("메모 저장 실패:", error);
      alert(error.message || "메모 저장에 실패했습니다.");
    }
  }
});


// 실시간 동기화: Firestore에 메모가 추가되거나 삭제되면 자동으로 담벼락을 다시 그립니다.
const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
onSnapshot(q, function () {
  render();
});

// 로그인 상태 감지: 로그인/로그아웃 시 화면 및 사용자 영역 갱신
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render();
});

// 입력창에 포커스 주기
input.focus();
