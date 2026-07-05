const storageKey = "thai-card-studio-v1";
const firebaseConfigKey = "thai-card-studio-firebase-config";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyBY8lqssRhB739ZqXJJG47ZbW37oaVYZPk",
  authDomain: "thailanguage-b0146.firebaseapp.com",
  projectId: "thailanguage-b0146",
  storageBucket: "thailanguage-b0146.firebasestorage.app",
  messagingSenderId: "742019685815",
  appId: "1:742019685815:web:ee1199a85a7fb121ac1c32",
  measurementId: "G-M4K79W5JR7",
};

const sampleCards = [
  {
    id: newId(),
    thai: "มะม่วง",
    reading: "マムアン",
    meaning: "マンゴー",
    category: "食べ物",
    memo: "黄色い果物。画像は後から追加。",
    image: "",
    reviewCount: 0,
    learned: false,
    learnedAt: "",
    createdAt: new Date().toISOString(),
  },
];

let cards = loadCards();
let activeIndex = 0;
let answerVisible = false;
let lastSyncedAuthUid = "";
let redirectResultChecked = false;
let firebaseState = {
  app: null,
  auth: null,
  db: null,
  user: null,
  modules: null,
  syncing: false,
  config: loadFirebaseConfig() || defaultFirebaseConfig,
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  cardCount: document.querySelector("#cardCount"),
  studyCard: document.querySelector("#studyCard"),
  revealButton: document.querySelector("#revealButton"),
  knownButton: document.querySelector("#knownButton"),
  nextButton: document.querySelector("#nextButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  cardForm: document.querySelector("#cardForm"),
  imageInput: document.querySelector("#imageInput"),
  thaiInput: document.querySelector("#thaiInput"),
  readingInput: document.querySelector("#readingInput"),
  meaningInput: document.querySelector("#meaningInput"),
  categoryInput: document.querySelector("#categoryInput"),
  memoInput: document.querySelector("#memoInput"),
  cardList: document.querySelector("#cardList"),
  csvInput: document.querySelector("#csvInput"),
  csvPreview: document.querySelector("#csvPreview"),
  pasteImportButton: document.querySelector("#pasteImportButton"),
  sampleButton: document.querySelector("#sampleButton"),
  exportButton: document.querySelector("#exportButton"),
  importMessage: document.querySelector("#importMessage"),
  firebaseConfigInput: document.querySelector("#firebaseConfigInput"),
  saveFirebaseConfigButton: document.querySelector("#saveFirebaseConfigButton"),
  signInButton: document.querySelector("#signInButton"),
  syncNowButton: document.querySelector("#syncNowButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncStatus: document.querySelector("#syncStatus"),
};

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

elements.revealButton.addEventListener("click", () => {
  answerVisible = !answerVisible;
  render();
});

elements.knownButton.addEventListener("click", () => {
  const card = cards[activeIndex];
  if (!card) return;
  card.learned = !card.learned;
  card.learnedAt = card.learned ? new Date().toISOString() : "";
  saveCards();
  render();
});

elements.nextButton.addEventListener("click", nextCard);
elements.shuffleButton.addEventListener("click", nextCard);

elements.cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const image = await readImageInput(elements.imageInput);
  const card = {
    id: newId(),
    thai: elements.thaiInput.value.trim(),
    reading: elements.readingInput.value.trim(),
    meaning: elements.meaningInput.value.trim(),
    category: elements.categoryInput.value.trim(),
    memo: elements.memoInput.value.trim(),
    image,
    reviewCount: 0,
    learned: false,
    learnedAt: "",
    createdAt: new Date().toISOString(),
  };
  cards.unshift(card);
  activeIndex = 0;
  answerVisible = false;
  if (!saveCards()) {
    cards.shift();
    render();
    return;
  }
  elements.cardForm.reset();
  render();
});

elements.csvInput.addEventListener("change", async () => {
  const file = elements.csvInput.files?.[0];
  if (!file) return;
  elements.csvPreview.value = await file.text();
});

elements.pasteImportButton.addEventListener("click", () => {
  const imported = parseCsv(elements.csvPreview.value)
    .filter((row) => row.thai && row.meaning)
    .map((row) => ({
      id: newId(),
      thai: row.thai.trim(),
      reading: (row.reading || "").trim(),
      meaning: row.meaning.trim(),
      category: (row.category || "").trim(),
      memo: (row.memo || "").trim(),
      image: "",
      reviewCount: 0,
      learned: row.learned === "true" || row.learned === "1" || row.learned === "覚えた",
      learnedAt: "",
      createdAt: new Date().toISOString(),
    }));

  if (!imported.length) {
    elements.importMessage.className = "message is-error";
    elements.importMessage.textContent = "取り込める行がありません。thai と meaning は必須です。";
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;
  imported.forEach((incoming) => {
    const existing = cards.find((card) => card.thai === incoming.thai && card.meaning === incoming.meaning);
    if (existing) {
      existing.reading = incoming.reading;
      existing.category = incoming.category;
      existing.memo = incoming.memo;
      existing.learned = incoming.learned;
      updatedCount += 1;
    } else {
      cards.unshift(incoming);
      addedCount += 1;
    }
  });
  activeIndex = 0;
  answerVisible = false;
  saveCards();
  elements.importMessage.className = "message is-success";
  elements.importMessage.textContent = `${addedCount}件追加、${updatedCount}件更新しました。既存カードの画像は保持されます。`;
  elements.pasteImportButton.textContent = "取り込み完了";
  setTimeout(() => {
    elements.pasteImportButton.textContent = "この内容を取り込む";
  }, 1800);
  render();
});

elements.sampleButton.addEventListener("click", () => {
  downloadText("thai-card-template.csv", elements.csvPreview.value);
});

elements.exportButton.addEventListener("click", () => {
  downloadText("thai-cards-export.csv", toCsv(cards));
});

elements.firebaseConfigInput.value = firebaseState.config ? JSON.stringify(firebaseState.config, null, 2) : "";
elements.saveFirebaseConfigButton.addEventListener("click", () => {
  const config = parseFirebaseConfig(elements.firebaseConfigInput.value);
  if (!config) {
    setSyncStatus("Firebase config を読み取れませんでした。", "error");
    return;
  }
  firebaseState.config = config;
  localStorage.setItem(firebaseConfigKey, JSON.stringify(config));
  setSyncStatus("Firebase設定を保存しました。ログインできます。", "success");
});
elements.signInButton.addEventListener("click", signInToFirebase);
elements.signOutButton.addEventListener("click", signOutFromFirebase);
elements.syncNowButton.addEventListener("click", syncWithFirebase);

if ("serviceWorker" in navigator) {
  let refreshingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    window.location.reload();
  });
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("sw.js");
      await registration.update();
    } catch {}
  });
}

render();

function newId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return "card-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function loadCards() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return sampleCards;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? normalizeCards(parsed) : sampleCards;
  } catch {
    return sampleCards;
  }
}

function normalizeCards(items) {
  const merged = [];
  items.forEach((item) => {
    const card = {
      id: item.id || newId(),
      thai: item.thai || "",
      reading: item.reading || "",
      meaning: item.meaning || "",
      category: item.category || "",
      memo: item.memo || "",
      image: item.image || "",
      reviewCount: Number(item.reviewCount || 0),
      learned: Boolean(item.learned),
      learnedAt: item.learnedAt || "",
      createdAt: item.createdAt || new Date().toISOString(),
    };
    const existing = merged.find((candidate) => candidate.thai === card.thai && candidate.meaning === card.meaning);
    if (!existing) {
      merged.push(card);
      return;
    }
    existing.reading ||= card.reading;
    existing.category ||= card.category;
    existing.memo ||= card.memo;
    existing.image ||= card.image;
    existing.reviewCount = Math.max(existing.reviewCount || 0, card.reviewCount || 0);
    existing.learned = existing.learned || card.learned;
    existing.learnedAt ||= card.learnedAt;
  });
  return merged.length ? merged : sampleCards;
}
function saveCards() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cards));
    queueFirebaseSync();
    return true;
  } catch (error) {
    alert("画像データが大きすぎて保存できませんでした。別の画像を選ぶか、画像サイズを小さくしてください。");
    return false;
  }
}

function switchView(viewId) {
  elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  elements.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
}

function nextCard() {
  if (!cards.length) return;
  activeIndex = (activeIndex + 1) % cards.length;
  answerVisible = false;
  render();
}

function render() {
  elements.cardCount.textContent = cards.length.toString();
  elements.revealButton.textContent = answerVisible ? "答えを隠す" : "答えを見る";
  const activeCard = cards[activeIndex];
  elements.knownButton.textContent = activeCard?.learned ? "覚えた解除" : "覚えた";
  elements.knownButton.classList.toggle("is-learned", Boolean(activeCard?.learned));
  renderStudyCard();
  renderCardList();
}

function renderStudyCard() {
  const card = cards[activeIndex];
  if (!card) {
    elements.studyCard.className = "study-card";
    elements.studyCard.innerHTML = `
      <div class="empty-state">
        <strong>CSVから単語を入れて始めよう</strong>
        <span>画像は後からカードごとに追加できます。</span>
      </div>
    `;
    return;
  }

  elements.studyCard.className = `study-card ${answerVisible ? "" : "hidden-answer"} ${card.learned ? "is-learned-card" : ""}`;
  elements.studyCard.innerHTML = `
    <div class="image-stage">
      ${card.image ? `<img src="${card.image}" alt="">` : `<div class="image-placeholder">${escapeHtml(card.thai.slice(0, 1))}</div>`}
      ${card.learned ? `<div class="learned-badge">覚えた</div>` : ""}
    </div>
    <div class="answer-panel" aria-live="polite">
      <p class="thai-answer">${escapeHtml(card.thai)}</p>
      <p class="reading">${escapeHtml(card.reading || "読み方未登録")}</p>
      <p class="meaning">${escapeHtml(card.meaning)}</p>
      <p class="meta">${escapeHtml([card.category, card.memo].filter(Boolean).join(" / "))}</p>
    </div>
  `;
}

function renderCardList() {
  if (!cards.length) {
    elements.cardList.innerHTML = "";
    return;
  }

  elements.cardList.innerHTML = cards
    .map(
      (card, index) => `
        <article class="card-item">
          <div class="thumb">${card.image ? `<img src="${card.image}" alt="">` : escapeHtml(card.thai.slice(0, 1))}</div>
          <div>
            <h3>${card.learned ? `<span class="learned-dot" title="覚えた">✓</span>` : ""}${escapeHtml(card.thai)}</h3>
            <p>${escapeHtml([card.reading, card.meaning, card.category].filter(Boolean).join(" / "))}</p>
          </div>
          <div class="card-actions">
            <label class="image-button">
              <span>${card.image ? "画像変更" : "画像追加"}</span>
              <input type="file" accept="image/*" data-image="${index}">
            </label>
            <button class="delete-button" type="button" data-delete="${index}" aria-label="削除">×</button>
          </div>
        </article>
      `,
    )
    .join("");

  elements.cardList.querySelectorAll("[data-image]").forEach((input) => {
    input.addEventListener("change", async () => {
      const index = Number(input.dataset.image);
      const image = await readImageInput(input);
      if (!image) return;
      const previousImage = cards[index].image;
      cards[index].image = image;
      activeIndex = index;
      answerVisible = true;
      if (!saveCards()) {
        cards[index].image = previousImage;
      }
      render();
    });
  });

  elements.cardList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.delete);
      cards.splice(index, 1);
      activeIndex = Math.min(activeIndex, Math.max(cards.length - 1, 0));
      saveCards();
      render();
    });
  });
}

async function readImageInput(input) {
  const file = input.files?.[0];
  if (!file) return "";
  return resizeImageFile(file);
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("画像を読み込めませんでした"));
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function toCsv(items) {
  const headers = ["thai", "reading", "meaning", "category", "memo", "learned"];
  const rows = items.map((card) => headers.map((header) => csvCell(card[header] || "")).join(","));
  return `${headers.join(",")}\n${rows.join("\n")}`;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadText(filename, text) {
  const blob = new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
















function loadFirebaseConfig() {
  const stored = localStorage.getItem(firebaseConfigKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function parseFirebaseConfig(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!match) return null;
  try {
    return Function(`"use strict"; return (${match[1]});`)();
  } catch {
    return null;
  }
}

async function loadFirebaseModules() {
  if (firebaseState.modules) return firebaseState.modules;
  const app = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const auth = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  firebaseState.modules = { app, auth, firestore };
  return firebaseState.modules;
}

async function ensureFirebase() {
  if (!firebaseState.config) {
    setSyncStatus("Firebase設定を保存してください。", "error");
    return false;
  }
  if (firebaseState.app && firebaseState.auth && firebaseState.db) return true;
  const modules = await loadFirebaseModules();
  firebaseState.app = modules.app.initializeApp(firebaseState.config);
  firebaseState.auth = modules.auth.getAuth(firebaseState.app);
  firebaseState.db = modules.firestore.getFirestore(firebaseState.app);
  modules.auth.onAuthStateChanged(firebaseState.auth, (user) => {
    firebaseState.user = user;
    setSyncStatus(user ? `${user.displayName || user.email || "ログイン中"} と同期できます。` : "未ログイン", user ? "success" : "");
    render();
    if (user && user.uid !== lastSyncedAuthUid) {
      lastSyncedAuthUid = user.uid;
      setTimeout(() => syncWithFirebase(), 300);
    }
  });
  checkFirebaseRedirectResult();
  return true;
}

async function checkFirebaseRedirectResult() {
  if (redirectResultChecked) return;
  redirectResultChecked = true;
  try {
    const result = await firebaseState.modules.auth.getRedirectResult(firebaseState.auth);
    if (result?.user) {
      firebaseState.user = result.user;
      setSyncStatus("ログインしました。同期しています...", "success");
      await syncWithFirebase();
    }
  } catch (error) {
    setSyncStatus(`ログインできませんでした: ${formatFirebaseError(error)}`, "error");
  }
}

async function signInToFirebase() {
  if (!(await ensureFirebase())) return;
  const { auth } = firebaseState.modules;
  const provider = new auth.GoogleAuthProvider();
  setSyncStatus("Googleログインを開始しています...", "");
  try {
    const result = await auth.signInWithPopup(firebaseState.auth, provider);
    firebaseState.user = result.user;
    setSyncStatus("ログインしました。同期しています...", "success");
    await syncWithFirebase();
  } catch (error) {
    const shouldUseRedirect = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment",
    ].includes(error.code);
    if (shouldUseRedirect) {
      setSyncStatus("別画面でGoogleログインを開きます...", "");
      await auth.signInWithRedirect(firebaseState.auth, provider);
      return;
    }
    setSyncStatus(`ログインできませんでした: ${formatFirebaseError(error)}`, "error");
  }
}

async function signOutFromFirebase() {
  if (!(await ensureFirebase())) return;
  await firebaseState.modules.auth.signOut(firebaseState.auth);
  firebaseState.user = null;
  setSyncStatus("ログアウトしました。", "");
}

let pendingSyncTimer = null;
function queueFirebaseSync() {
  if (!firebaseState.user || !firebaseState.db || firebaseState.syncing) return;
  clearTimeout(pendingSyncTimer);
  pendingSyncTimer = setTimeout(() => syncWithFirebase(), 800);
}

async function syncWithFirebase() {
  if (!(await ensureFirebase())) return;
  if (!firebaseState.user) {
    setSyncStatus("Googleログインしてください。", "error");
    return;
  }
  firebaseState.syncing = true;
  setSyncStatus("同期中...", "");
  try {
    const { firestore } = firebaseState.modules;
    const collectionRef = firestore.collection(firebaseState.db, "users", firebaseState.user.uid, "cards");
    const snapshot = await firestore.getDocs(collectionRef);
    const remoteCards = snapshot.docs.map((doc) => normalizeRemoteCard(doc.id, doc.data()));
    const merged = mergeCardSets(cards, remoteCards);
    cards = merged;
    localStorage.setItem(storageKey, JSON.stringify(cards));

    await Promise.all(
      cards.map((card) =>
        firestore.setDoc(firestore.doc(collectionRef, card.id), {
          thai: card.thai || "",
          reading: card.reading || "",
          meaning: card.meaning || "",
          category: card.category || "",
          memo: card.memo || "",
          image: card.image || "",
          reviewCount: Number(card.reviewCount || 0),
          learned: Boolean(card.learned),
          learnedAt: card.learnedAt || "",
          createdAt: card.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    );
    activeIndex = Math.min(activeIndex, Math.max(cards.length - 1, 0));
    render();
    setSyncStatus(`${cards.length}件を同期しました。`, "success");
  } catch (error) {
    setSyncStatus(`同期できませんでした: ${formatFirebaseError(error)}`, "error");
  } finally {
    firebaseState.syncing = false;
  }
}

function normalizeRemoteCard(id, data) {
  return {
    id,
    thai: data.thai || "",
    reading: data.reading || "",
    meaning: data.meaning || "",
    category: data.category || "",
    memo: data.memo || "",
    image: data.image || "",
    reviewCount: Number(data.reviewCount || 0),
    learned: Boolean(data.learned),
    learnedAt: data.learnedAt || "",
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

function mergeCardSets(localCards, remoteCards) {
  const merged = [];
  [...remoteCards, ...localCards].forEach((card) => {
    const keyMatch = merged.find((candidate) => candidate.id === card.id || (candidate.thai === card.thai && candidate.meaning === card.meaning));
    if (!keyMatch) {
      merged.push({ ...card, id: card.id || newId() });
      return;
    }
    keyMatch.reading = card.reading || keyMatch.reading;
    keyMatch.category = card.category || keyMatch.category;
    keyMatch.memo = card.memo || keyMatch.memo;
    keyMatch.image = card.image || keyMatch.image;
    keyMatch.reviewCount = Math.max(Number(keyMatch.reviewCount || 0), Number(card.reviewCount || 0));
    keyMatch.learned = Boolean(keyMatch.learned || card.learned);
    keyMatch.learnedAt = keyMatch.learnedAt || card.learnedAt || "";
    keyMatch.createdAt = keyMatch.createdAt || card.createdAt || new Date().toISOString();
  });
  return merged;
}

function formatFirebaseError(error) {
  if (error?.code === "auth/unauthorized-domain") {
    return "承認済みドメインに hasekei.github.io を追加してください。";
  }
  if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
    return "Firestoreルールでログインユーザーの読み書きを許可してください。";
  }
  return error?.message || "原因不明のエラー";
}

function setSyncStatus(message, type) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.className = `sync-status ${type ? `is-${type}` : ""}`;
}

if (firebaseState.config) {
  setSyncStatus("Firebase設定済み。Googleログインできます。", "success");
  ensureFirebase();
} else {
  setSyncStatus("Firebase設定を貼り付けてください。", "");
}

