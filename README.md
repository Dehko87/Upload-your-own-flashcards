# Salesforce Admin Exam Flashcards

A static, no-build multiple-choice flashcard app for studying toward the
Salesforce Administrator certification, with grade tracking (overall score
per session, plus mastery by topic). No backend or account required —
everything is saved in your browser's local storage.

## Running it

Just open `index.html` in a browser, or serve the folder with any static
server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Adding your own cards

Every card is a single-answer multiple-choice question: a topic, a question,
2–6 answer options, and which one is correct. Go to the **Manage Cards**
tab. You can:

- Add cards one at a time with the form (Topic / Question / four Options,
  with a radio button marking the correct one),
- Upload a spreadsheet (`.csv` or `.xlsx`) with `Topic`, `Question`,
  `Option A`–`Option D`, and `Correct Option` (the letter A/B/C/D)
  columns — download `data/flashcard-template.xlsx` from that tab, fill it
  in, and upload it back to add every row as a card, or
- Paste a JSON array into the Import box, in this shape:

```json
[
  {
    "topic": "Security & Access",
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correctIndex": 2
  }
]
```

(`correctIndex` is the 0-based position of the right option in the `options`
array.) Use **Export All Cards** to download your current deck as JSON
(useful for backing up or editing in bulk, then re-importing).

The app ships with a small starter deck (`data/starter-deck.json`, also
inlined in `js/app.js`) covering a few core exam topics so there's something
to try right away — delete or replace any of it freely.

## Studying

In the **Study** tab, pick a topic (or "All Topics") and an order
(shuffled/sequential), then answer each question by clicking one of the
options: it's graded immediately, with the correct answer highlighted green
and (if you picked wrong) your choice highlighted red. Click "Next Question"
to continue. At the end of a session you'll see your score and a per-topic
breakdown.

## Progress

The **Progress** tab shows:
- Overall sessions run, cards answered, and accuracy
- Mastery per topic (all-time correct / attempts)
- Session history (most recent 20 sessions)

## Data storage

Everything lives in `localStorage` under these keys:
- `sfdc_flashcards_cards` — your deck
- `sfdc_flashcards_card_stats` — per-card correct/wrong counts
- `sfdc_flashcards_sessions` — session history

Clearing your browser's site data for this page will reset all cards and
progress.
