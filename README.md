# Mrs. Baker's Classroom · Grade 6 ELA

Public Grade 6 ELA classroom hub for Mrs. Tori Baker at Lake Manatee K-8
(School District of Manatee County, FL). Target live URL:

**https://mrs-bakers-classroom.vercel.app/**

Static site on Vercel + Firebase (school email-link sign-in, Cloud
Firestore). No build step — edit, commit, push to `main`, and Vercel deploys.

## What's on the site

| Page | Purpose |
|---|---|
| `/` | Single-page app with four views: Launchpad, Bell Work, FAST Practice, Explore |
| `/syllabus` | Printable draft syllabus |
| `/teacher` | Private dashboard (requires Firestore `role: teacher`) |
| `404.html` | Branded not-found page |

Key features:

- **Bell work** — one prompt per school day. Each weekday keeps one skill
  (Mon claim, Tue inference, Wed vocabulary, Thu central idea, Fri reflect);
  the prompt rotates weekly through four variants (see `dayPlans` in `app.js`).
  One Firestore doc per student per day (`bellwork/{uid}_{YYYY-MM-DD}`).
  Students may edit **today's** entry only; the teacher dashboard flags edited
  work and check-ins.
- **FAST Challenge** — original Grade 6 B.E.S.T.-aligned passage sets, streak
  scoring, skill tracking, and a public top-10 **Streak Spotlight** using first
  name + last initial only.
- **Analytics** (Explore → Public Data) — interactive 2025 FAST context. All
  figures live in the `fastData` object in `app.js`.
- **Teacher dashboard** — roster-aware completion board, missing-student view,
  need-help filters, week matrix, CSV export, today's-message controls, roster
  fixes, and leaderboard moderation.

## Architecture notes

- `firebase-config.js` is intentionally public (Firebase web keys are not
  secrets); all security lives in `firestore.rules`.
- `authDomain` is the Vercel domain. Students receive passwordless Firebase
  sign-in links at their `@manateeschools.net` Outlook address.
- `firestore.rules` in this repo is the source of truth, but it is **not**
  auto-deployed: after changing it, paste it into Firebase Console →
  Firestore → Rules → Publish (project `mrs-baker-s-ela-studio`) or run
  `firebase deploy --only firestore:rules`.
- `firebase-app.js` owns student auth. It broadcasts a `baker-auth-change`
  event with `{user, db, role, period, api}`; `app.js` listens and gates views.
  Sign-in must never be blocked by a failed Firestore read — profile sync is
  best-effort.
- CSS is split by feature, all sharing the `:root` tokens in `app.css`
  (`--deep`, `--pink`, `--blush`, …). `styles.css`/`enhancements.css` are the
  syllabus page only; `teacher.css` is the dashboard only. Bump the `?v=`
  query in HTML when changing CSS/JS.

## Setup checklist

1. Vercel project `mrs-bakers-classroom`, framework preset Other, no build
   command, output directory = repo root.
2. Firebase Auth authorized domain: `mrs-bakers-classroom.vercel.app`.
3. Email/Password provider enabled in Firebase Auth with Email link sign-in
   turned on. Password sign-in is not exposed by the website.
4. `firestore.rules` published via Firebase Console or Firebase CLI.
5. Mrs. Baker's approved school email is allowlisted in `firestore.rules`; its
   user profile is promoted to `role: teacher` automatically at first sign-in.

## Open items

- Verify that Manatee County student mailboxes receive Firebase sign-in emails.
- Replace syllabus placeholders once school/district policies are confirmed.
- Replace 2025 district FAST context with Lake Manatee's own baseline after
  the 2026-27 results arrive.

Student information must not be collected beyond what Lake Manatee K-8 /
SDMC approves.
