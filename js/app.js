const STARTER_DECK = [
  { topic: "Security & Access", question: "What is the difference between a Profile and a Permission Set?", answer: "A Profile is a single, required baseline of permissions assigned to a user; a Permission Set grants additional permissions on top of a profile and a user can have multiple." },
  { topic: "Security & Access", question: "What are the four levels of the Salesforce sharing/security model, from broadest to most specific?", answer: "Org-Wide Defaults, Role Hierarchy, Sharing Rules, and Manual Sharing (with Permission Sets/Profiles controlling object/field-level access)." },
  { topic: "Data Management", question: "What tool would you use to import/update more than 50,000 records?", answer: "Data Loader (supports bulk operations via the Bulk API, unlike Data Import Wizard which caps around 50,000 records)." },
  { topic: "Automation", question: "What has replaced Workflow Rules and Process Builder as Salesforce's recommended automation tool?", answer: "Flow (specifically Record-Triggered Flow for most workflow/process builder use cases)." },
  { topic: "Automation", question: "What is the order of execution when a record is saved, in relation to validation rules and before-save flows?", answer: "System validation rules and before-save flows run before the record is committed, then after-save automation (after-save flows, workflow rules, processes, triggers) runs after." },
  { topic: "Reports & Dashboards", question: "What are the four report format types in Salesforce?", answer: "Tabular, Summary, Matrix, and Joined." },
  { topic: "Reports & Dashboards", question: "How often can a dashboard refresh automatically at most?", answer: "Every 1 hour (via a scheduled refresh), though it can also be refreshed manually at any time." },
  { topic: "Sales & Service Cloud", question: "What feature routes cases to the right agent or queue automatically based on defined criteria?", answer: "Case Assignment Rules (or Omni-Channel routing for more advanced skill/capacity-based routing)." },
];

function makeId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `card_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const state = {
  cards: [],
  session: null,
};

function loadCards() {
  state.cards = Storage.getCards();
  if (state.cards.length === 0 && !Storage.hasSeeded()) {
    state.cards = STARTER_DECK.map((c) => ({ id: makeId(), ...c }));
    Storage.saveCards(state.cards);
    Storage.markSeeded();
  }
}

function uniqueTopics() {
  return [...new Set(state.cards.map((c) => c.topic))].sort();
}

// ---------- Navigation ----------

function switchView(viewName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${viewName}`);
  });
  if (viewName === "manage") renderManageView();
  if (viewName === "progress") renderProgressView();
  if (viewName === "study") renderStudySetup();
}

// ---------- Study: setup ----------

function renderStudySetup() {
  document.getElementById("study-setup").hidden = false;
  document.getElementById("study-session").hidden = true;
  document.getElementById("study-results").hidden = true;

  const topicSelect = document.getElementById("topic-filter");
  const topics = uniqueTopics();
  topicSelect.innerHTML =
    `<option value="__all__">All Topics</option>` +
    topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  const noCards = state.cards.length === 0;
  document.getElementById("no-cards-msg").hidden = !noCards;
  document.getElementById("start-session-btn").disabled = noCards;
}

function startSession() {
  const topic = document.getElementById("topic-filter").value;
  const order = document.getElementById("order-select").value;

  let queue = topic === "__all__" ? [...state.cards] : state.cards.filter((c) => c.topic === topic);
  if (order === "shuffle") {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }

  state.session = {
    queue,
    index: 0,
    correctCount: 0,
    graded: [],
    topicLabel: topic === "__all__" ? "All Topics" : topic,
  };

  document.getElementById("study-setup").hidden = true;
  document.getElementById("study-results").hidden = true;
  document.getElementById("study-session").hidden = false;
  showCurrentCard();
}

// ---------- Study: session ----------

function showCurrentCard() {
  const s = state.session;
  const card = s.queue[s.index];
  document.getElementById("session-position").textContent = `Card ${s.index + 1} of ${s.queue.length}`;
  document.getElementById("session-topic-label").textContent = s.topicLabel;
  document.getElementById("card-question").textContent = card.question;
  document.getElementById("card-answer").textContent = card.answer;
  document.getElementById("flashcard").classList.remove("flipped");
  document.getElementById("grade-controls").hidden = true;
}

function flipCard() {
  const flashcard = document.getElementById("flashcard");
  flashcard.classList.toggle("flipped");
  document.getElementById("grade-controls").hidden = !flashcard.classList.contains("flipped");
}

function gradeCard(correct) {
  const s = state.session;
  const card = s.queue[s.index];
  Storage.recordAnswer(card.id, correct);
  s.graded.push({ card, correct });
  if (correct) s.correctCount++;

  if (s.index + 1 < s.queue.length) {
    s.index++;
    showCurrentCard();
  } else {
    finishSession();
  }
}

function endSessionEarly() {
  if (state.session && state.session.graded.length > 0) {
    finishSession();
  } else {
    switchView("study");
  }
}

function finishSession() {
  const s = state.session;
  const total = s.graded.length;
  const correct = s.correctCount;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  Storage.addSession({
    id: makeId(),
    date: new Date().toISOString(),
    topic: s.topicLabel,
    total,
    correct,
    percent,
  });

  document.getElementById("study-session").hidden = true;
  document.getElementById("study-results").hidden = false;
  document.getElementById("results-score").textContent = `${correct} / ${total} correct (${percent}%)`;

  const byTopic = {};
  s.graded.forEach(({ card, correct }) => {
    if (!byTopic[card.topic]) byTopic[card.topic] = { correct: 0, total: 0 };
    byTopic[card.topic].total++;
    if (correct) byTopic[card.topic].correct++;
  });
  const breakdown = document.getElementById("results-breakdown");
  breakdown.innerHTML = Object.entries(byTopic)
    .map(([topic, v]) => `<div class="session-history-item"><span>${escapeHtml(topic)}</span><span>${v.correct}/${v.total}</span></div>`)
    .join("");

  state.session = null;
}

// ---------- Manage cards ----------

function addCard(topic, question, answer) {
  const card = { id: makeId(), topic: topic.trim(), question: question.trim(), answer: answer.trim() };
  state.cards.push(card);
  Storage.saveCards(state.cards);
  renderManageView();
}

function deleteCard(id) {
  state.cards = state.cards.filter((c) => c.id !== id);
  Storage.saveCards(state.cards);
  renderManageView();
}

function renderManageView() {
  document.getElementById("card-count").textContent = state.cards.length;
  const list = document.getElementById("card-list");

  if (state.cards.length === 0) {
    list.innerHTML = `<p class="empty-msg">No cards yet. Add one above or import a JSON deck.</p>`;
    return;
  }

  list.innerHTML = [...state.cards]
    .sort((a, b) => a.topic.localeCompare(b.topic))
    .map(
      (c) => `
      <div class="card-item">
        <span class="card-topic-tag">${escapeHtml(c.topic)}</span>
        <p class="card-q">${escapeHtml(c.question)}</p>
        <p class="card-a">${escapeHtml(c.answer)}</p>
        <div class="card-actions">
          <button data-delete-id="${c.id}">Delete</button>
        </div>
      </div>`
    )
    .join("");

  list.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCard(btn.dataset.deleteId));
  });
}

function addCardsFromRecords(records) {
  let added = 0;
  records.forEach((item) => {
    if (item && typeof item.question === "string" && typeof item.answer === "string" && item.question.trim() && item.answer.trim()) {
      state.cards.push({
        id: makeId(),
        topic: (item.topic || "General").trim(),
        question: item.question.trim(),
        answer: item.answer.trim(),
      });
      added++;
    }
  });

  if (added > 0) {
    Storage.saveCards(state.cards);
    Storage.markSeeded();
    renderManageView();
  }
  return added;
}

function importCards(jsonText) {
  const msg = document.getElementById("import-msg");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    msg.textContent = "Invalid JSON.";
    msg.style.color = "var(--danger)";
    return;
  }
  if (!Array.isArray(parsed)) {
    msg.textContent = "JSON must be an array of cards.";
    msg.style.color = "var(--danger)";
    return;
  }

  const added = addCardsFromRecords(parsed);
  msg.style.color = "var(--success)";
  msg.textContent = `Imported ${added} card(s).`;
  document.getElementById("import-textarea").value = "";
}

const SPREADSHEET_FIELD_ALIASES = {
  topic: "topic",
  question: "question",
  answer: "answer",
};

function normalizeSpreadsheetRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const field = SPREADSHEET_FIELD_ALIASES[key.trim().toLowerCase()];
    if (field && typeof value === "string") normalized[field] = value;
    else if (field && value != null) normalized[field] = String(value);
  });
  return normalized;
}

function importSpreadsheetFile(file) {
  const msg = document.getElementById("spreadsheet-msg");
  msg.style.color = "var(--muted)";
  msg.textContent = "Reading file...";

  const reader = new FileReader();
  reader.onerror = () => {
    msg.style.color = "var(--danger)";
    msg.textContent = "Could not read that file.";
  };
  reader.onload = (e) => {
    try {
      const workbook = XLSX.read(e.target.result, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });
      const records = rows.map(normalizeSpreadsheetRow);
      const added = addCardsFromRecords(records);
      msg.style.color = added > 0 ? "var(--success)" : "var(--danger)";
      msg.textContent =
        added > 0
          ? `Imported ${added} card(s) from "${file.name}".`
          : `No valid rows found in "${file.name}". Make sure it has Topic/Question/Answer columns.`;
    } catch (err) {
      msg.style.color = "var(--danger)";
      msg.textContent = "Could not parse that file. Make sure it's a valid .csv or .xlsx.";
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportCards() {
  const exportable = state.cards.map(({ topic, question, answer }) => ({ topic, question, answer }));
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sfdc-flashcards-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Progress ----------

function renderProgressView() {
  const stats = Storage.getCardStats();
  const sessions = Storage.getSessions();

  let totalCorrect = 0;
  let totalAttempts = 0;
  Object.values(stats).forEach((s) => {
    totalCorrect += s.correct;
    totalAttempts += s.correct + s.wrong;
  });
  const overallPercent = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  document.getElementById("overall-stats").innerHTML = `
    <div class="stat-box"><div class="stat-value">${sessions.length}</div><div class="stat-label">Sessions</div></div>
    <div class="stat-box"><div class="stat-value">${totalAttempts}</div><div class="stat-label">Cards Answered</div></div>
    <div class="stat-box"><div class="stat-value">${overallPercent}%</div><div class="stat-label">Overall Accuracy</div></div>
  `;

  const topicMastery = {};
  state.cards.forEach((card) => {
    const s = stats[card.id];
    if (!topicMastery[card.topic]) topicMastery[card.topic] = { correct: 0, total: 0 };
    if (s) {
      topicMastery[card.topic].correct += s.correct;
      topicMastery[card.topic].total += s.correct + s.wrong;
    }
  });

  const masteryEl = document.getElementById("topic-mastery");
  const topics = Object.keys(topicMastery).sort();
  if (topics.length === 0) {
    masteryEl.innerHTML = `<p class="empty-msg">Study a session to see topic mastery.</p>`;
  } else {
    masteryEl.innerHTML = topics
      .map((topic) => {
        const { correct, total } = topicMastery[topic];
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        return `
        <div class="mastery-row">
          <div class="mastery-label"><span>${escapeHtml(topic)}</span><span>${total > 0 ? `${pct}% (${correct}/${total})` : "Not studied yet"}</span></div>
          <div class="mastery-bar-track"><div class="mastery-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("");
  }

  const historyEl = document.getElementById("session-history");
  if (sessions.length === 0) {
    historyEl.innerHTML = `<p class="empty-msg">No sessions recorded yet.</p>`;
  } else {
    historyEl.innerHTML = sessions
      .slice(0, 20)
      .map((s) => {
        const date = new Date(s.date).toLocaleString();
        return `<div class="session-history-item"><span>${date} · ${escapeHtml(s.topic)}</span><span>${s.correct}/${s.total} (${s.percent}%)</span></div>`;
      })
      .join("");
  }
}

// ---------- Utilities ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------

function init() {
  loadCards();

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("start-session-btn").addEventListener("click", startSession);
  document.getElementById("flashcard").addEventListener("click", flipCard);
  document.getElementById("grade-wrong-btn").addEventListener("click", () => gradeCard(false));
  document.getElementById("grade-right-btn").addEventListener("click", () => gradeCard(true));
  document.getElementById("end-session-btn").addEventListener("click", endSessionEarly);
  document.getElementById("new-session-btn").addEventListener("click", () => switchView("study"));

  document.getElementById("card-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = document.getElementById("card-topic").value;
    const question = document.getElementById("card-question-input").value;
    const answer = document.getElementById("card-answer-input").value;
    if (!topic.trim() || !question.trim() || !answer.trim()) return;
    addCard(topic, question, answer);
    e.target.reset();
  });

  document.getElementById("import-btn").addEventListener("click", () => {
    const text = document.getElementById("import-textarea").value.trim();
    if (text) importCards(text);
  });
  document.getElementById("export-btn").addEventListener("click", exportCards);

  document.getElementById("spreadsheet-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importSpreadsheetFile(file);
    e.target.value = "";
  });

  renderStudySetup();
}

document.addEventListener("DOMContentLoaded", init);
