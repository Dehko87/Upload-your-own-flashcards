const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MIN_OPTIONS = 4;
const MAX_OPTIONS = 8;
const THEME_KEY = "sfdc_flashcards_theme";

const STARTER_DECK = [
  { topic: "Security & Access", question: "Which single component must every Salesforce user be assigned exactly one of, to set their baseline object, field, and app permissions?", options: ["Permission Set", "Permission Set Group", "Profile", "Public Group"], correctIndexes: [2] },
  { topic: "Security & Access", question: "Which sharing model setting determines the widest access that all internal users have to records by default?", options: ["Sharing Rules", "Role Hierarchy", "Manual Sharing", "Organization-Wide Defaults"], correctIndexes: [3] },
  { topic: "Security & Access", question: "Which two of these can be used to grant a user additional object and field permissions beyond their Profile? (Choose 2)", options: ["Permission Set", "Sharing Rule", "Permission Set Group", "Queue"], correctIndexes: [0, 2] },
  { topic: "Data Management", question: "Which tool should an admin use to insert or update more than 50,000 records at once?", options: ["Data Import Wizard", "Data Loader", "Report Export", "Change Sets"], correctIndexes: [1] },
  { topic: "Automation", question: "Which Salesforce automation tool is now recommended for record-triggered logic, replacing Workflow Rules and Process Builder?", options: ["Approval Processes", "Apex Triggers", "Flow", "Validation Rules"], correctIndexes: [2] },
  { topic: "Automation", question: "Which of the following runs first during the record save order of execution?", options: ["After-save Flow", "Workflow Rule field update", "Validation Rule", "Apex trigger (after insert)"], correctIndexes: [2] },
  { topic: "Automation", question: "Which three of these are valid Flow trigger types? (Choose 3)", options: ["Record-Triggered", "Schedule-Triggered", "Platform Event-Triggered", "Report-Triggered"], correctIndexes: [0, 1, 2] },
  { topic: "Reports & Dashboards", question: "Which report format groups rows by more than one field and includes subtotals for each group plus a grand total?", options: ["Tabular", "Summary", "Matrix", "Joined"], correctIndexes: [1] },
  { topic: "Reports & Dashboards", question: "What is the maximum frequency at which a dashboard can be scheduled to refresh automatically?", options: ["Every 15 minutes", "Every 1 hour", "Every 24 hours", "Dashboards cannot be scheduled"], correctIndexes: [1] },
  { topic: "Sales & Service Cloud", question: "Which feature automatically assigns incoming Cases to the correct queue or agent based on predefined criteria?", options: ["Web-to-Case", "Case Assignment Rules", "Escalation Rules", "Entitlement Process"], correctIndexes: [1] },
];

function makeId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `card_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const state = {
  cards: [],
  session: null,
};

function migrateCard(raw) {
  if (Array.isArray(raw.correctIndexes) && Array.isArray(raw.options)) return raw;
  // Cards saved by an older version of this app used a single `correctIndex` instead
  // of `correctIndexes`. Older still, cards were free-text (no `options` at all) —
  // those can't be turned into multiple choice automatically, so they're dropped.
  if (Number.isInteger(raw.correctIndex) && Array.isArray(raw.options)) {
    const { correctIndex, ...rest } = raw;
    return { ...rest, correctIndexes: [correctIndex] };
  }
  return null;
}

function loadCards() {
  const stored = Storage.getCards();
  const migrated = stored.map(migrateCard).filter(Boolean);
  if (migrated.length !== stored.length) Storage.saveCards(migrated);
  state.cards = migrated;

  if (state.cards.length === 0 && !Storage.hasSeeded()) {
    state.cards = STARTER_DECK.map((c) => ({ id: makeId(), ...c }));
    Storage.saveCards(state.cards);
    Storage.markSeeded();
  }
}

function uniqueTopics() {
  return [...new Set(state.cards.map((c) => c.topic))].sort();
}

function isMultiAnswer(card) {
  return card.correctIndexes.length > 1;
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
  if (state.session) {
    resumeActiveSession();
    return;
  }

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

  renderResumeBanner();
}

function renderResumeBanner() {
  const banner = document.getElementById("resume-banner");
  const saved = Storage.getInProgressSession();

  if (!saved || !Array.isArray(saved.queue) || saved.index >= saved.queue.length) {
    banner.hidden = true;
    if (saved) Storage.clearInProgressSession();
    return;
  }

  banner.hidden = false;
  document.getElementById("resume-banner-detail").textContent =
    `${saved.topicLabel} — Question ${saved.index + 1} of ${saved.queue.length}`;
}

// Same-page session already in memory (e.g. switched to another tab and back) — jump
// straight back in instead of showing the setup screen.
function resumeActiveSession() {
  document.getElementById("study-setup").hidden = true;
  document.getElementById("study-results").hidden = true;
  document.getElementById("study-session").hidden = false;
  if (state.session.answered) {
    goToNextCard();
  } else {
    showCurrentCard();
  }
}

// A session saved to localStorage from an earlier visit (page reload, browser closed, etc.).
function resumeSavedSession() {
  const saved = Storage.getInProgressSession();
  if (!saved) return;

  state.session = {
    queue: saved.queue,
    index: saved.index,
    correctCount: saved.correctCount,
    graded: saved.graded,
    answered: false,
    selected: new Set(),
    topicLabel: saved.topicLabel,
  };

  document.getElementById("study-setup").hidden = true;
  document.getElementById("study-results").hidden = true;
  document.getElementById("study-session").hidden = false;
  showCurrentCard();
}

function discardSavedSession() {
  Storage.clearInProgressSession();
  renderStudySetup();
}

function persistSession() {
  const s = state.session;
  if (!s) return;
  Storage.saveInProgressSession({
    queue: s.queue,
    index: s.index,
    correctCount: s.correctCount,
    graded: s.graded,
    topicLabel: s.topicLabel,
  });
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
    answered: false,
    selected: new Set(),
    topicLabel: topic === "__all__" ? "All Topics" : topic,
  };
  persistSession();

  document.getElementById("study-setup").hidden = true;
  document.getElementById("study-results").hidden = true;
  document.getElementById("study-session").hidden = false;
  showCurrentCard();
}

// ---------- Study: session ----------

function showCurrentCard() {
  const s = state.session;
  const card = s.queue[s.index];
  s.answered = false;
  s.selected = new Set();

  document.getElementById("session-position").textContent = `Question ${s.index + 1} of ${s.queue.length}`;
  document.getElementById("session-topic-label").textContent = s.topicLabel;
  document.getElementById("card-question").textContent = card.question;
  document.getElementById("next-card-btn").hidden = true;

  const multi = isMultiAnswer(card);
  const selectHint = document.getElementById("select-hint");
  selectHint.hidden = !multi;
  selectHint.textContent = multi ? `Select ${card.correctIndexes.length} answers` : "";

  const submitBtn = document.getElementById("submit-answer-btn");
  submitBtn.hidden = !multi;
  submitBtn.disabled = true;

  const optionList = document.getElementById("option-list");
  optionList.className = multi ? "option-list multi" : "option-list";
  optionList.innerHTML = card.options
    .map(
      (option, i) => `
      <button class="option-btn" data-option-index="${i}">
        <span class="option-letter">${OPTION_LETTERS[i]}</span>
        <span>${escapeHtml(option)}</span>
      </button>`
    )
    .join("");

  optionList.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleOptionClick(Number(btn.dataset.optionIndex)));
  });
}

function handleOptionClick(index) {
  const s = state.session;
  if (s.answered) return;
  const card = s.queue[s.index];

  if (!isMultiAnswer(card)) {
    gradeAnswer(new Set([index]));
    return;
  }

  const btn = document.querySelector(`#option-list .option-btn[data-option-index="${index}"]`);
  if (s.selected.has(index)) {
    s.selected.delete(index);
    btn.classList.remove("selected");
  } else {
    s.selected.add(index);
    btn.classList.add("selected");
  }
  document.getElementById("submit-answer-btn").disabled = s.selected.size === 0;
}

function gradeAnswer(chosenIndexes) {
  const s = state.session;
  if (s.answered) return;
  s.answered = true;

  const card = s.queue[s.index];
  const correctSet = new Set(card.correctIndexes);
  const correct = chosenIndexes.size === correctSet.size && [...chosenIndexes].every((i) => correctSet.has(i));

  document.querySelectorAll("#option-list .option-btn").forEach((btn) => {
    const i = Number(btn.dataset.optionIndex);
    btn.disabled = true;
    btn.classList.remove("selected");
    if (correctSet.has(i)) btn.classList.add("correct");
    else if (chosenIndexes.has(i)) btn.classList.add("incorrect");
  });

  document.getElementById("submit-answer-btn").hidden = true;

  Storage.recordAnswer(card.id, correct);
  s.graded.push({ card, correct });
  if (correct) s.correctCount++;

  document.getElementById("next-card-btn").hidden = false;
}

function submitMultiAnswer() {
  gradeAnswer(new Set(state.session.selected));
}

function goToNextCard() {
  const s = state.session;
  if (s.index + 1 < s.queue.length) {
    s.index++;
    persistSession();
    showCurrentCard();
  } else {
    finishSession();
  }
}

function endSessionEarly() {
  if (state.session && state.session.graded.length > 0) {
    finishSession();
  } else {
    state.session = null;
    Storage.clearInProgressSession();
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
  Storage.clearInProgressSession();
}

// ---------- Manage cards ----------

function addCard(topic, question, options, correctIndexes) {
  const card = { id: makeId(), topic: topic.trim(), question: question.trim(), options, correctIndexes };
  state.cards.push(card);
  Storage.saveCards(state.cards);
  renderManageView();
}

function deleteCard(id) {
  state.cards = state.cards.filter((c) => c.id !== id);
  Storage.saveCards(state.cards);
  renderManageView();
}

let clearAllConfirmTimeout = null;

function resetClearAllButton() {
  clearTimeout(clearAllConfirmTimeout);
  const btn = document.getElementById("clear-all-btn");
  btn.textContent = "Clear All Cards";
  btn.classList.remove("confirming");
}

function clearAllCards() {
  const btn = document.getElementById("clear-all-btn");
  if (state.cards.length === 0) return;

  if (btn.classList.contains("confirming")) {
    resetClearAllButton();
    state.cards = [];
    Storage.saveCards(state.cards);
    renderManageView();
    return;
  }

  btn.classList.add("confirming");
  btn.textContent = `Click again to delete all ${state.cards.length}`;
  clearAllConfirmTimeout = setTimeout(resetClearAllButton, 4000);
}

function renderManageView() {
  resetClearAllButton();
  document.getElementById("card-count").textContent = state.cards.length;
  const list = document.getElementById("card-list");

  if (state.cards.length === 0) {
    list.innerHTML = `<p class="empty-msg">No cards yet. Add one above or import a spreadsheet/JSON deck.</p>`;
    return;
  }

  list.innerHTML = [...state.cards]
    .sort((a, b) => a.topic.localeCompare(b.topic))
    .map((c) => {
      const correctSet = new Set(c.correctIndexes);
      return `
      <div class="card-item">
        <span class="card-topic-tag">${escapeHtml(c.topic)}</span>
        ${c.correctIndexes.length > 1 ? `<span class="card-topic-tag multi-tag">Choose ${c.correctIndexes.length}</span>` : ""}
        <p class="card-q">${escapeHtml(c.question)}</p>
        <ol class="card-options" type="A">
          ${c.options.map((opt, i) => `<li class="${correctSet.has(i) ? "correct-option" : ""}">${escapeHtml(opt)}</li>`).join("")}
        </ol>
        <div class="card-actions">
          <button data-delete-id="${c.id}">Delete</button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCard(btn.dataset.deleteId));
  });
}

function isValidCardRecord(item) {
  return (
    item &&
    typeof item.question === "string" &&
    item.question.trim() &&
    Array.isArray(item.options) &&
    item.options.length <= MAX_OPTIONS &&
    item.options.filter((o) => typeof o === "string" && o.trim()).length >= 2 &&
    Array.isArray(item.correctIndexes) &&
    item.correctIndexes.length >= 1 &&
    item.correctIndexes.length < item.options.length &&
    item.correctIndexes.every((i) => Number.isInteger(i) && i >= 0 && i < item.options.length) &&
    new Set(item.correctIndexes).size === item.correctIndexes.length
  );
}

function cardSignature(topic, question, options) {
  return [
    topic.trim().toLowerCase(),
    question.trim().toLowerCase(),
    options.map((o) => o.trim().toLowerCase()).join("|"),
  ].join("::");
}

function addCardsFromRecords(records) {
  const seenSignatures = new Set(state.cards.map((c) => cardSignature(c.topic, c.question, c.options)));
  let added = 0;
  let duplicates = 0;

  records.forEach((item) => {
    if (!isValidCardRecord(item)) return;

    const topic = (item.topic || "General").trim();
    const question = item.question.trim();
    const options = item.options.map((o) => String(o).trim());
    const signature = cardSignature(topic, question, options);

    if (seenSignatures.has(signature)) {
      duplicates++;
      return;
    }
    seenSignatures.add(signature);

    state.cards.push({
      id: makeId(),
      topic,
      question,
      options,
      correctIndexes: [...item.correctIndexes].sort((a, b) => a - b),
    });
    added++;
  });

  if (added > 0) {
    Storage.saveCards(state.cards);
    Storage.markSeeded();
    renderManageView();
  }
  return { added, duplicates };
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

  const { added, duplicates } = addCardsFromRecords(parsed);
  const duplicateNote = duplicates > 0 ? ` (${duplicates} duplicate(s) skipped)` : "";
  msg.style.color = "var(--success)";
  msg.textContent = `Imported ${added} card(s).${duplicateNote}`;
  document.getElementById("import-textarea").value = "";
}

function normalizeSpreadsheetRow(row) {
  const normalized = {};
  const options = [];
  Object.entries(row).forEach(([rawKey, rawValue]) => {
    const key = rawKey.trim().toLowerCase();
    const value = rawValue == null ? "" : String(rawValue).trim();

    if (key === "topic") normalized.topic = value;
    else if (key === "question") normalized.question = value;
    else if (key === "correct option" || key === "correct" || key === "correctoption") normalized.correctLetters = value;
    else {
      const optionMatch = key.match(/^option\s*([a-h])$/);
      if (optionMatch) options[OPTION_LETTERS.indexOf(optionMatch[1].toUpperCase())] = value;
    }
  });

  normalized.options = options.filter((o) => o !== undefined && o !== "");
  normalized.correctIndexes = (normalized.correctLetters || "")
    .split(/[,\s/]+/)
    .map((letter) => OPTION_LETTERS.indexOf(letter.trim().toUpperCase()))
    .filter((i) => i !== -1);
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
    let stage = "reading the workbook";
    try {
      const workbook = XLSX.read(e.target.result, { type: "array" });

      stage = "finding a worksheet";
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("the file has no worksheet/table data");
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      stage = "reading rows from the worksheet";
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      stage = "matching columns to Topic/Question/Options/Correct Option";
      const records = [];
      let skipped = 0;
      rows.forEach((row, i) => {
        try {
          records.push(normalizeSpreadsheetRow(row));
        } catch (rowErr) {
          skipped++;
          console.error(`Skipping row ${i + 2} (could not read it):`, rowErr);
        }
      });

      stage = "adding the cards";
      const { added, duplicates } = addCardsFromRecords(records);
      const notes = [];
      if (duplicates > 0) notes.push(`${duplicates} duplicate(s) already in your deck skipped`);
      if (skipped > 0) notes.push(`${skipped} unreadable row(s) skipped — see console for details`);
      const noteText = notes.length > 0 ? ` (${notes.join("; ")})` : "";
      msg.style.color = added > 0 ? "var(--success)" : "var(--danger)";
      msg.textContent =
        added > 0
          ? `Imported ${added} card(s) from "${file.name}".${noteText}`
          : `No new cards found in "${file.name}".${noteText} Make sure it has Topic/Question/Option A-H/Correct Option columns.`;
    } catch (err) {
      console.error(`Spreadsheet import failed while ${stage}:`, err);
      msg.style.color = "var(--danger)";
      msg.textContent = `Could not parse that file while ${stage}: ${err.message || err}`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportCards() {
  const exportable = state.cards.map(({ topic, question, options, correctIndexes }) => ({ topic, question, options, correctIndexes }));
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

// ---------- Manage cards: dynamic option rows ----------

function relabelOptionRows() {
  const rows = document.querySelectorAll("#option-inputs .option-input-row");
  rows.forEach((row, i) => {
    row.querySelector(".option-text-input").placeholder = `Option ${OPTION_LETTERS[i]}`;
  });
  document.getElementById("add-option-btn").disabled = rows.length >= MAX_OPTIONS;
}

function addOptionRow() {
  const container = document.getElementById("option-inputs");
  if (container.querySelectorAll(".option-input-row").length >= MAX_OPTIONS) return;

  const row = document.createElement("div");
  row.className = "option-input-row";
  row.innerHTML = `
    <input type="checkbox" name="correct-option">
    <input type="text" class="option-text-input" required>
    <button type="button" class="remove-option-btn" title="Remove option">&times;</button>
  `;
  row.querySelector(".remove-option-btn").addEventListener("click", () => {
    row.remove();
    relabelOptionRows();
  });
  container.appendChild(row);
  relabelOptionRows();
}

function resetOptionRows() {
  const container = document.getElementById("option-inputs");
  const rows = [...container.querySelectorAll(".option-input-row")];
  rows.slice(MIN_OPTIONS).forEach((row) => row.remove());
  relabelOptionRows();
}

// ---------- Utilities ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Theme ----------

function getEffectiveTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeToggleButton() {
  const btn = document.getElementById("theme-toggle-btn");
  btn.textContent = getEffectiveTheme() === "dark" ? "☀️ Light" : "🌙 Dark";
}

function toggleTheme() {
  const next = getEffectiveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  document.documentElement.setAttribute("data-theme", next);
  updateThemeToggleButton();
}

function initTheme() {
  updateThemeToggleButton();
}

// ---------- Init ----------

function init() {
  loadCards();
  initTheme();
  document.getElementById("theme-toggle-btn").addEventListener("click", toggleTheme);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("start-session-btn").addEventListener("click", startSession);
  document.getElementById("resume-session-btn").addEventListener("click", resumeSavedSession);
  document.getElementById("discard-session-btn").addEventListener("click", discardSavedSession);
  document.getElementById("submit-answer-btn").addEventListener("click", submitMultiAnswer);
  document.getElementById("next-card-btn").addEventListener("click", goToNextCard);
  document.getElementById("end-session-btn").addEventListener("click", endSessionEarly);
  document.getElementById("new-session-btn").addEventListener("click", () => switchView("study"));

  document.getElementById("add-option-btn").addEventListener("click", addOptionRow);

  document.getElementById("card-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = document.getElementById("card-topic").value;
    const question = document.getElementById("card-question-input").value;
    const optionInputs = [...document.querySelectorAll(".option-text-input")];
    const checkboxes = [...document.querySelectorAll('input[name="correct-option"]')];
    const options = optionInputs.map((input) => input.value.trim());
    const correctIndexes = checkboxes.map((cb, i) => (cb.checked ? i : -1)).filter((i) => i !== -1);

    if (!topic.trim() || !question.trim() || options.some((o) => !o) || correctIndexes.length === 0) return;
    addCard(topic, question, options, correctIndexes);
    e.target.reset();
    resetOptionRows();
  });

  document.getElementById("import-btn").addEventListener("click", () => {
    const text = document.getElementById("import-textarea").value.trim();
    if (text) importCards(text);
  });
  document.getElementById("export-btn").addEventListener("click", exportCards);
  document.getElementById("clear-all-btn").addEventListener("click", clearAllCards);

  document.getElementById("spreadsheet-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importSpreadsheetFile(file);
    e.target.value = "";
  });

  relabelOptionRows();
  renderStudySetup();
}

document.addEventListener("DOMContentLoaded", init);
