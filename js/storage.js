const Storage = (() => {
  const CARDS_KEY = "sfdc_flashcards_cards";
  const STATS_KEY = "sfdc_flashcards_card_stats";
  const SESSIONS_KEY = "sfdc_flashcards_sessions";
  const SEEDED_KEY = "sfdc_flashcards_seeded";
  const IN_PROGRESS_KEY = "sfdc_flashcards_inprogress";

  function getCards() {
    return JSON.parse(localStorage.getItem(CARDS_KEY) || "[]");
  }

  function saveCards(cards) {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  }

  function getCardStats() {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
  }

  function saveCardStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function recordAnswer(cardId, correct) {
    const stats = getCardStats();
    if (!stats[cardId]) stats[cardId] = { correct: 0, wrong: 0 };
    stats[cardId][correct ? "correct" : "wrong"]++;
    saveCardStats(stats);
  }

  function getSessions() {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  }

  function addSession(session) {
    const sessions = getSessions();
    sessions.unshift(session);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  function hasSeeded() {
    return localStorage.getItem(SEEDED_KEY) === "true";
  }

  function markSeeded() {
    localStorage.setItem(SEEDED_KEY, "true");
  }

  function getInProgressSession() {
    const raw = localStorage.getItem(IN_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function saveInProgressSession(session) {
    localStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(session));
  }

  function clearInProgressSession() {
    localStorage.removeItem(IN_PROGRESS_KEY);
  }

  return {
    getCards, saveCards,
    getCardStats, saveCardStats, recordAnswer,
    getSessions, addSession,
    hasSeeded, markSeeded,
    getInProgressSession, saveInProgressSession, clearInProgressSession,
  };
})();
