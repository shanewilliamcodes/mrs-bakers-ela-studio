# Mrs. Baker's ELA Studio

Public Grade 6 ELA classroom hub for Mrs. Tori Baker at Lake Manatee K-8
(School District of Manatee County, FL). Live at:

**https://shanewilliamcodes.github.io/mrs-bakers-ela-studio/**

Static site on GitHub Pages + Firebase (Google sign-in, Cloud Firestore).
No build step — edit, commit, push to `main`, and Pages redeploys.

## What's on the site

| Page | Purpose |
|---|---|
| `index.html` | Single-page app with four views: Launchpad, Bell Work, FAST Practice, Explore |
| `syllabus.html` | Printable draft syllabus |
| `teacher.html` | Private dashboard (requires Firestore `role: teacher`) |
| `404.html` | Branded not-found page |

Key features:

- **Bell work** — one prompt per school day. Each weekday keeps one skill
  (Mon claim, Tue inference, Wed vocabulary, Thu central idea, Fri reflect);
  the prompt rotates weekly through four variants (see `dayPlans` in `app.js`).
  One Firestore doc per student per day (`bellwork/{uid}_{YYYY-MM-DD}`).
  Students may edit **today's** entry only (rules enforce an 18-hour window and
  stamp `editedAt`/`editCount`); the teacher dashboard flags edited work.
  Weekends show a "no bell work" panel instead of a prompt.
- **FAST Challenge** — 52 original Grade 6 B.E.S.T.-aligned questions
  (`passages` in `app.js`), streak scoring, and a public top-10
  **Streak Spotlight** (first name + last initial only).
- **Analytics** (Explore → Public Data) — interactive 2025 FAST context.
  All figures live in the `fastData` object in `app.js`; edit that one object
  to update the charts when new results come out.
- **Teacher dashboard** — submissions by date/standard, confidence flags,
  edited markers, CSV export, and a no-login demo mode.

## Architecture notes

- `firebase-config.js` is intentionally public (Firebase web keys are not
  secrets); all security lives in `firestore.rules`.
- `firestore.rules` in this repo is the source of truth, but it is **not**
  auto-deployed: after changing it, paste it into Firebase Console →
  Firestore → Rules → Publish (project `mrs-baker-s-ela-studio`).
- `firebase-app.js` owns auth. It broadcasts a `baker-auth-change` event with
  `{user, db, role, api}`; `app.js` listens and gates the views. Sign-in must
  never be blocked by a failed Firestore read — profile sync is best-effort.
- CSS is split by feature, all sharing the `:root` tokens in `app.css`
  (`--deep`, `--pink`, `--blush`, …). `styles.css`/`enhancements.css` are the
  syllabus page only; `teacher.css` is the dashboard only and has its own
  palette. Bump the `?v=` query in the HTML when you change CSS/JS.

## Setup (already done, for reference)

1. Firebase project with Google auth + Cloud Firestore.
2. GitHub Pages domain added to Auth → Authorized domains.
3. Web config in `firebase-config.js` (copy `firebase-config.example.js`).
4. `firestore.rules` published via the console.
5. Teacher account: sign in once, then set `users/{uid}.role` to `teacher`
   in Firestore.

## Open items

- Verify a real Manatee County **student** Google account can sign in
  (districts sometimes block OAuth to outside sites). Fallback plan if
  blocked: class-code + name-picker accounts.
- Replace syllabus placeholders once school/district policies are confirmed.
- Replace 2025 district FAST context with Lake Manatee's own baseline after
  the 2026–27 results arrive.

Student information must not be collected beyond what Lake Manatee K-8 /
SDMC approves.
