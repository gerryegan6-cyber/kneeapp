# Knee Rehab

A phone-friendly, offline-capable 10-week knee strengthening programme (4 stages, no deep bends, no kneeling).

## What is in it
- **Guided session timer**: warm-up, main exercises and cool-down run automatically with set/rep counting,
  holds, rests and "switch sides" prompts. Beeps, optional voice cues, vibration (Android), screen kept awake.
- **Animated diagrams** for every exercise, with start/finish poses and the working muscle highlighted.
- **Step-by-step instructions**, common mistakes, easier/harder options and a YouTube link per exercise.
- **Quick timer**: countdown, stopwatch and a custom hold/relax/reps/sets/rest interval timer.
- **Tracker**: sessions ticked off per stage, pain after each session, next-morning check, and a
  "ready to move up?" test (controlled sessions, knee pain 0 to 2, normal next morning, 3 in a row).
- **Pain rule**, red flags, equipment checklist per stage, walking targets for rest days.
- **Reminders** (.ics calendar file, Mon/Wed/Fri), **backup / restore** (JSON) and a copyable summary for a physio.

All data stays in the browser on your phone (`localStorage`).

## Put it on your phone
It is a static site (no build step). Host the folder anywhere that serves HTTPS, for example GitHub Pages:
repo **Settings → Pages → Deploy from a branch →** pick the branch and `/ (root)`.
Then open the page on your phone:
- iPhone (Safari): Share → Add to Home Screen
- Android (Chrome): ⋮ → Install app

After the first load it works offline.

## Editing the programme
- `js/data.js`: exercises, stages, sets/reps/holds/rests. Add `video: 'https://youtu.be/...'` to an exercise
  to link a specific video instead of the YouTube search.
- `js/figures.js`: the diagrams (pose-based stick figures).
- Bump `CACHE` in `sw.js` after changing files so installed copies update.

General exercise information, not medical advice.
