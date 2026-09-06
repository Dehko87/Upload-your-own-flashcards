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

Every card is a multiple-choice question: a topic, a question, 4–8 answer
options, and which one (or more) are correct — real exam questions vary in
option count, and some ask you to pick more than one ("Choose 2", "Choose
3"). Go to the **Manage Cards** tab. You can:

- Add cards one at a time with the form (Topic / Question / Options) — check
  one box to mark a single-answer question, or check several to make it a
  "choose N" question. It starts with 4 option fields and has a
  "+ Add Option" button to grow up to 8,
- Upload a spreadsheet (`.csv` or `.xlsx`) with `Topic`, `Question`,
  `Option A`–`Option H`, and `Correct Option` columns — fill in as few as 4
  or as many as 8 option columns per row, leaving the rest blank. For
  `Correct Option`, put one letter for a single-answer question, or several
  letters separated by commas (e.g. `A, C`) for a "choose N" question.
  Download `data/flashcard-template.xlsx` from that tab, fill it in, and
  upload it back to add every row as a card, or
- Paste a JSON array into the Import box, in this shape:

```json
[
  {
    "topic": "Security & Access",
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correctIndexes": [2]
  }
]
```

(`correctIndexes` lists the 0-based position(s) of the right option(s) in
the `options` array — more than one entry makes it a "choose N" question.)
Use **Export All Cards** to download your current deck as JSON (useful for
backing up or editing in bulk, then re-importing).

The app ships with a small starter deck (`data/starter-deck.json`, also
inlined in `js/app.js`) covering a few core exam topics so there's something
to try right away — delete or replace any of it freely. Delete cards one at
a time from the list below, or use **Clear All Cards** to wipe the whole
deck at once and start fresh — click it once to arm it (it turns red and
says "Click again to delete all N"), then click again within 4 seconds to
confirm; clicking away or waiting cancels it.

## Studying

In the **Study** tab, pick a topic (or "All Topics") and an order
(shuffled/sequential), then answer each question:

- **Single-answer questions** grade immediately when you click an option —
  the correct answer is highlighted green, and your choice is highlighted
  red if it was wrong.
- **"Choose N" questions** show a "Select N answers" hint; click to toggle
  options, then click "Submit Answer" once you've picked that many. It's
  graded all-or-nothing (you must select exactly the right set to count it
  correct), matching how the real exam grades these.

Click "Next Question" to continue. At the end of a session you'll see your
score and a per-topic breakdown.

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
