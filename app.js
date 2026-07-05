const storageKey = "thai-card-studio-v1";

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

if ("serviceWorker" in navigator) {
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
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
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














