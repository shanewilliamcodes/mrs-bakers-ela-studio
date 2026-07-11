# Codex Build Packet — Mrs. Baker's Classroom · Grade 6 ELA

**Audience for this document:** Codex (implementation agent) + Shane (manual console steps).
**Repo:** `mrs-bakers-ela-studio` — static site, no build step, vanilla JS + Firebase (Auth + Firestore).
**Current live:** GitHub Pages. **Target:** Vercel.

---

## 0. Architecture decision (read first, do not deviate)

**Keep the current architecture: static HTML/CSS/JS + Firebase Auth + Firestore.**
Do **not** rewrite in Next.js/React. Rationale:

- Everything that works today (bell work flow, FAST challenge, rules, prompts) carries over untouched.
- Vercel serves static sites natively — migration is a config file, not a rewrite.
- The "complete overhaul" items (auth provider, teacher dashboard) are module-local: `firebase-app.js` and `teacher.js`/`teacher.html`. Rewriting the framework would risk regressions in the parts that are fine.
- No secrets are needed client-side (Firebase web config is public by design; all security lives in `firestore.rules`), so no server runtime is required.

The three real changes: **(A)** Google → Microsoft (Outlook/Entra ID) sign-in, **(B)** GitHub Pages → Vercel, **(C)** teacher dashboard v2. Plus a rename and a bug-fix/polish pass.

**Ordering matters.** Do phases in the order below. Phase 3 (auth) depends on the final Vercel domain from Phase 2. Commit at each phase boundary with a clear message.

**Cache-busting rule (repo-wide):** any time you touch a CSS or JS file, bump its `?v=` query in every HTML file that references it.

---

## Phase 0 — Manual console setup (SHANE does this, not Codex)

Codex: skip this section; it's listed so the code you write in Phases 2–3 matches. Shane: do 0.1–0.2 before Codex runs Phase 2, and 0.3–0.5 before/alongside Phase 3.

**0.1 Vercel project.** `vercel` CLI is installed (`~/.local`). From the repo root: `vercel link` → create new project named **`mrs-bakers-classroom`** (gives `mrs-bakers-classroom.vercel.app`; if taken, pick the closest available and tell Codex the final domain). Framework preset: **Other**, no build command, output dir = repo root. Connect the GitHub repo in the Vercel dashboard so pushes to `main` auto-deploy.

**0.2 Firebase authorized domain.** Firebase Console → project `mrs-baker-s-ela-studio` → Authentication → Settings → Authorized domains → add `mrs-bakers-classroom.vercel.app`.

**0.3 Microsoft Entra app registration** (free, personal Microsoft account works):
1. portal.azure.com → Microsoft Entra ID → App registrations → **New registration**.
2. Name: `Mrs Baker's Classroom`. Supported account types: **"Accounts in any organizational directory (Any Microsoft Entra ID tenant — Multitenant)"**. (Students sign in with district M365 org accounts; personal-account support not needed.)
3. Redirect URI (type **Web**): `https://mrs-bakers-classroom.vercel.app/__/auth/handler`
   Also add: `https://mrs-baker-s-ela-studio.firebaseapp.com/__/auth/handler` (fallback while testing).
4. Certificates & secrets → New client secret (24-month expiry) → copy the **Value** immediately.
5. Overview page → copy the **Application (client) ID**.

**0.4 Enable Microsoft provider in Firebase.** Firebase Console → Authentication → Sign-in method → Add new provider → **Microsoft** → paste client ID + secret from 0.3. Leave Google enabled for now (teacher fallback).

**0.5 Teacher role re-bootstrap.** After Phase 3 deploys: Mrs. Baker signs in once on `teacher.html` with her district Microsoft account → Firestore Console → `users/{newUid}` → set `role: "teacher"`. (New provider = new UID; her old Google-based role doc doesn't transfer.)

**0.6 Firestore rules deploys.** Rules are NOT auto-deployed. After any rules change in this packet: paste `firestore.rules` into Firebase Console → Firestore → Rules → Publish, or run `firebase deploy --only firestore:rules`.

**Known risk (accepted for now):** the district tenant may block user consent to third-party apps. If students hit an `AADSTS` error like 900941/650052/65001 ("admin approval required"), the fallback plan is class-code + name-picker accounts (out of scope for this packet — Phase 3 just needs to surface that error legibly).

---

## Phase 1 — Rename: legacy brand → "Mrs. Baker's Classroom · Grade 6 ELA"

Global copy sweep. The brand becomes **"Mrs. Baker's Classroom"** with the qualifier **"Grade 6 ELA"**. Grep for the old studio wording and generic studio wording to catch everything. Specific targets:

- `index.html`: `<title>` → `Mrs. Baker's Classroom · Grade 6 ELA`; `og:title`, `og:description`; topbar brand qualifier → `<b>Mrs. Baker's</b><small>Classroom · Grade 6 ELA</small>`; hero → `Mrs. Baker's<br><em>Classroom</em>` with the existing eyebrow line carrying "Grade 6 ELA · Lake Manatee K-8 · 2026–27"; Explore heading → "Explore Mrs. Baker's Classroom"; account dialog eyebrow.
- `manifest.json`: `name` → `Mrs. Baker's Classroom · Grade 6 ELA`, `short_name` → `Mrs. Baker`, description update.
- `404.html` `<title>`; `teacher.html` header (keep "Bell Work Dashboard" as the page name); `syllabus.html` any legacy brand mention; `README.md` title + prose.
- Do NOT rename the Firebase project, Firestore collections, `BAKER_FIREBASE_CONFIG`, or CSS class names — cosmetic copy only.
- The GitHub repo name stays `mrs-bakers-ela-studio` (renaming breaks nothing but gains nothing; skip).

**Acceptance:** the legacy brand phrase no longer appears in user-facing `.html`, `.json`, or `.md` content.

---

## Phase 2 — Vercel migration

**2.1 `vercel.json`** (new file, repo root):

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/__/auth/:path*", "destination": "https://mrs-baker-s-ela-studio.firebaseapp.com/__/auth/:path*" },
    { "source": "/__/firebase/:path*", "destination": "https://mrs-baker-s-ela-studio.firebaseapp.com/__/firebase/:path*" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]}
  ]
}
```

The `/__/auth` proxy makes the Firebase sign-in handler **same-origin**, which is what makes popup/redirect sign-in survive third-party-cookie blocking on school Chromebooks/Edge. It requires `authDomain` to be the Vercel domain (2.2).

**2.2 `firebase-config.js` + `firebase-config.example.js`:** change `authDomain` to `"mrs-bakers-classroom.vercel.app"`. (Works only after Shane's 0.2 and, for Microsoft, after the redirect URI in 0.3 step 3 matches this domain.)

**2.3 Path fixes for root-domain hosting** (the site currently lives under `/mrs-bakers-ela-studio/`):
- `manifest.json`: `start_url` and `scope` → `"/"`.
- `404.html`: the three `href="/mrs-bakers-ela-studio/..."` links → `/`, `/#bellwork`, `/syllabus`.
- `app.js` `showView()`: `history.replaceState(null,'',name==='home'?'index.html':`#${name}`)` — with `cleanUrls` the canonical path is `/`, so use `'./'` instead of `'index.html'`.
- With `cleanUrls: true`, internal links to `syllabus.html` / `teacher.html` should become `/syllabus` and `/teacher` (Vercel redirects `.html` → clean URL; update the links so there's no redirect hop). Check: `index.html` launch card + resource shelf + account dialog teacher link, `teacher.html` back-link, `404.html`.
- `index.html` + `syllabus.html`: `og:url` / `og:image` → `https://mrs-bakers-classroom.vercel.app/...`.

**2.4 GitHub Pages sunset.** Keep the Pages deployment but turn it into a redirect: this is done by a tiny standalone branch or, simpler, leave Pages serving `main` and add a `<script>` at the top of `index.html`... **No.** Simplest reliable approach that doesn't pollute the main site: in `index.html`, `syllabus.html`, `teacher.html`, and `404.html` add a small inline script in `<head>`:

```html
<script>if(location.hostname.endsWith('github.io'))location.replace('https://mrs-bakers-classroom.vercel.app'+location.pathname.replace('/mrs-bakers-ela-studio','')+location.hash);</script>
```

This forwards old bookmarks (including `#bellwork` deep links) and is inert on Vercel. Update `README.md` live-URL.

**Acceptance:** site loads at the Vercel domain with working nav/deep links (`/#bellwork`), `/syllabus` and `/teacher` resolve, GitHub Pages URL bounces to Vercel preserving the hash, manifest installs from root.

---

## Phase 3 — Auth overhaul: Microsoft/Outlook SSO

> **SUPERSEDED (2026-07-10).** The email-link student sign-in shipped on 07-08 is rejected — too much friction for 11-year-olds, and the delivery test landed in Junk. Build **Phase 3R** below instead. This section stays only as background for the SSO *upgrade* track.

Goal: a student on a school computer (already signed into their district Microsoft 365 account in the browser) clicks **Sign in** → Microsoft account picker shows their account already listed (or silently signs in on domain-joined Edge) → one click → done. No passwords typed on our site, ever.

**3.1 `firebase-app.js` — provider swap.**
- Import `OAuthProvider` and remove the previous provider import.
- `const provider = new OAuthProvider('microsoft.com');`
- Custom parameters: `provider.setCustomParameters({ prompt: 'select_account', ...(MS_TENANT ? { tenant: MS_TENANT } : {}) })`. Add a `const MS_TENANT = ''` at the top with a comment: *set to the district's Entra tenant ID once known to lock sign-in to district accounts and enable silent SSO; empty = any Microsoft account.* Similarly `const MS_DOMAIN_HINT = ''` → if set, pass `domain_hint` to skip the account picker on district machines.
- Keep the existing popup-first / redirect-fallback structure exactly as is — it's good. With the Phase 2 proxy + same-origin authDomain, `signInWithRedirect` is now reliable on locked-down browsers, so keep that fallback path.
- Keep `browserLocalPersistence`.

**3.2 Microsoft-aware error messages.** Replace the Google-specific `authMessage()` cases. Microsoft/Entra failures surface as `auth/...` codes with an `AADSTS#####` string inside `error.message` (and sometimes `error.customData`). Map:
- message contains `AADSTS65001`, `AADSTS650052`, or `AADSTS900941` → "Your school district hasn't approved this website for student sign-in yet. Please tell Mrs. Baker — this is a district setting, not a mistake you made."
- `AADSTS50020` / wrong tenant → "That Microsoft account isn't part of the school district. Use your school email account."
- `auth/popup-closed-by-user` → "The Microsoft sign-in window closed before it finished. Click Sign in to try again, or tell Mrs. Baker if the window showed an error."
- `auth/account-exists-with-different-credential` → "This email was already used with a different sign-in method. Tell Mrs. Baker so she can fix your account."
- Keep the network / unauthorized-domain / operation-not-allowed cases, reworded for Microsoft.

**3.3 School display names ("Last, First").** District M365 accounts frequently have `displayName` of the form `Baker, Tori` (and sometimes trailing student-ID junk). Add one normalizer in `firebase-app.js` and export it via the published `api` (or duplicate the 3-liner in `app.js`):
`normalizeName(raw)` → if the string matches `/^([^,]+),\s*(.+)$/`, return `"$2 $1"`; strip anything in parentheses/brackets; collapse whitespace. Use it everywhere `displayName` is consumed: profile card (`#profile-name`, `#profile-initial`, first-name button label), the `users/{uid}` doc's `displayName` field on first-create, bell work `studentName`, and `leaderboardName()` in `app.js`. This matters: the leaderboard's "first name + last initial" privacy format is wrong for comma-style names ("Baker, Tori" would render "Baker T." — full last name leaked).

**3.4 Copy sweep.** All sign-in UI says "school account", never the previous provider name: account dialog copy → "One click with your school Microsoft account — no password to remember."; old sign-in button id → `ms-signin`, label **"Sign in with your school account"**; `updateGate()` in `app.js` uses `'Sign in with your school account'`; both auth gates' `<small>` hints; `teacher.html` auth box copy.

**3.5 Teacher sign-in.** `teacher.js`: swap to the same Microsoft provider. Keep it to **one** provider on the teacher page too (Mrs. Baker has a district account); Google stays enabled in the Firebase console purely as a temporary escape hatch and gets disabled by Shane once her Microsoft role doc is set (0.5). No dual-button UI.

**3.6 Data note.** Existing Google-based `users/`, `bellwork/`, `leaderboard/` docs become orphans (new UIDs). School year hasn't started; test data only. Shane deletes stale docs in the console; no migration code.

**Acceptance:** on a browser signed into any M365 org account: click Sign in → Microsoft picker with the account pre-listed → one click → dialog shows normalized name, prompts for class period, bell work unlocks. Popup-blocked browsers fall back to full-page redirect and return successfully. Blocked-by-admin path shows the friendly district message.

---

## Phase 4 — Teacher Dashboard v2 (`teacher.html` + `teacher.js` + `teacher.css`)

The concept stays (list → detail review flow, today's-message editor, CSV). Rebuild the internals around the question the teacher actually asks each morning: **"Who did it, who didn't, and who needs me?"** Keep it vanilla JS, one page, no framework.

**4.1 Completion board (the headline feature — currently missing entirely).**
Today the dashboard only shows students who *submitted*; missing students are invisible. Fix:
- Load the roster: `getDocs(query(collection(db,'users'), where('role','==','student')))` (rules already permit teacher list-reads of `users`).
- For the selected date, join roster × submissions → per-period groups, each student rendered as a chip: ✅ submitted / ⬜ missing / ✏️ edited / 🔴 confidence ≤2 / ✓ checked-in. Clicking a submitted chip opens the detail pane; clicking a missing chip shows "No submission yet" + that student's recent history.
- Metrics row becomes: Submitted X/Y (roster-aware), Missing, Need help, Checked-in, Avg words.
- Weekend/no-school dates: show the board but with a "not a school day" note.

**4.2 Week view.** A second tab: last 5 school days × roster matrix (dots: done/missing/edited), per-student current streak (reuse the `bellStreakFrom` logic from `app.js` — extract it to a small shared module `streak.js` loaded by both pages, or duplicate with a comment). This is how the teacher spots slipping students.

**4.3 Student drill-in.** Detail pane gains: the student's last 10 submissions (query `bellwork` where `studentUid==`), confidence trend, and two teacher edit tools — **fix display name** and **fix period** (write to `users/{uid}`; rules already allow teacher updates). Wrong-period picks are currently only fixable by the student.

**4.4 Review workflow.** Keep "Mark checked in". Add filter toggles above the list/board: *Needs help only*, *Unreviewed only*, *Edited only*. After check-in, don't rebuild the whole list (current code re-renders and the clicked row's index can drift) — update the one chip in place.

**4.5 Leaderboard moderation.** Small panel: current top-10 with a remove button per row (`deleteDoc` on `leaderboard/{uid}` — rules already allow teacher delete). Kids will find a way to make a name inappropriate; the teacher needs a one-click fix.

**4.6 Bug fixes in current `teacher.js`:**
- **Demo-mode crash:** in demo mode `db` is undefined, but the date-filter `change` listener and Refresh button call `loadData()` → uncaught error. Guard every Firestore call with `if(!db)`, and in demo mode make filters operate on `demoRows`.
- `checkIn` hardcodes `reviewedBy:'teacher'` → use the signed-in user's uid.
- CSV export: add `submittedAt` time, `editCount`, `reviewedAt` columns; include missing students as rows with empty response (roster-aware export is what actually gets pasted into a gradebook).
- Wrap `loadData` in try/catch with a visible error message (currently an offline load silently leaves "Loading submissions…").

**4.7 Layout.** Reorganize into three tabs — **Today** (completion board + detail), **Week** (matrix), **Class setup** (today's-message editor, leaderboard moderation, roster fixes). Today's-message editor currently sits above the submissions and pushes the review flow below the fold; the review flow is the daily job, it goes first. Mobile: the teacher will open this on a phone during class — the board must collapse to a single column and the detail pane become a slide-over.

**4.8 Rules addition** (only one needed): none of the above requires rule changes — verify with the emulator or manual testing that teacher list-queries on `users` and `deleteDoc` on `leaderboard` pass. While in `firestore.rules`, tighten one thing: leaderboard `update` should also require `request.resource.data.bestStreak >= resource.data.bestStreak` (streaks only go up; blocks console-vandalism that lowers others is already impossible, this blocks self-reset noise). Remind Shane rules must be manually published (0.6).

**Acceptance:** with 2 test students (one submitted low-confidence, one never signed in... roster shows both), the Today board shows ✅ and ⬜ correctly per period; check-in persists across reload; demo mode works with filters and never throws; CSV includes missing students; leaderboard row can be removed.

---

## Phase 5 — Bug fixes & polish (student app)

Ordered by impact:

1. **Biased shuffle** — `app.js` `shuffle()` uses `sort(()=>Math.random()-.5)`. Replace with Fisher–Yates.
2. **Passage clumping in FAST** — all 4 questions of a passage are independent cards; after a real shuffle, back-to-back questions can still repeat the same passage. Better game feel: shuffle passages, then serve that passage's questions consecutively (kids read once, answer 4) — this is also closer to the real FAST format. Keep score/streak logic unchanged.
3. **Stale-date bug** — `plan`, `todayKey`, `isWeekend`, and `weekIndex` are computed once at load. A Chromebook tab left open overnight submits under yesterday's date/prompt. Recompute on `visibilitychange` (when the tab becomes visible and the date changed, refresh the plan/prompt UI and re-run `openBellwork()`).
4. **Draft migration on sign-in** — a draft typed while signed out is stored under `bakerBellwork:signed-out:<date>` and vanishes after sign-in. In the auth-change handler, if the signed-out draft exists for today and the uid-keyed draft doesn't, move it over.
5. **`#fast-count` label** — shows `fastIndex` which lags one behind answered questions; increment on answer, not on Next, and label it "Answered".
6. **Skill tracker is device-local** — fine for now, but add a one-line note in the UI ("saved on this device") — already present; instead persist best-effort to `users/{uid}.skills` (merge) so it follows the student. Optional; skip if time-boxed.
7. **Accessibility pass** — add a skip-to-content link; `:focus-visible` styles on nav/cards (verify in `app.css`); `prefers-reduced-motion` guard around bar animations in `analytics.css`; confirm the pink-on-white text tokens meet AA (the `--pink` #d94f82-ish on white for small text likely fails — bump to the darker `--deep` for body-size text).
8. **Dead code** — the old FAST best-skill counter duplicated the persisted skill tracker; consolidate to one source.
9. **README refresh** — new name, Vercel deploy flow (push to `main` → auto-deploy), Microsoft auth setup summary, updated open-items list.

---

## Phase 6 — Backlog (do NOT build now; listed so they aren't re-litigated)

- District-blocked fallback: class-code + name-picker accounts (build only if SSO fails in the wild).
- Custom domain (e.g. `mrsbakersclassroom.com`) — Vercel free tier supports it whenever Shane wants to buy one.
- Bell work prompt calendar (teacher schedules prompts ahead, replacing the fixed weekly rotation).
- Teacher feedback per submission (short comment students see next visit) — needs a rules change to let students read a `feedback` field.
- FAST question bank expansion + per-standard filtering; import from a spreadsheet.
- School-calendar awareness (holidays ≠ missing bell work) — needs a no-school-days list in `settings/`.
- Cloud Function to validate leaderboard writes server-side (only if cheating becomes a real problem).
- PWA offline support / service worker.

---

## Test script (run after Phases 2–4, on the Vercel URL)

1. Incognito: load `/` → rename visible everywhere, no console errors, FAST playable after sign-in gate only.
2. Sign in with a Microsoft test account (Shane's) → popup flow, name normalized, period prompt, period saves.
3. Submit bell work → done panel, streak line, edit → resubmit → ✏️ appears in teacher view.
4. `/#bellwork` deep link, `/syllabus`, `/teacher`, `/nonexistent` (404 page), old github.io URL redirect.
5. Teacher page: sign in (after role set) → Today board shows submitted + missing; check-in; CSV; publish an announcement → appears on student homepage; clear it → disappears.
6. Block popups in the browser → sign-in falls back to redirect and returns signed-in.
7. Phone-width viewport: student flow and teacher board both usable.

---

*Prepared by Fable (planning). Implementation: Codex. Manual console steps: Shane (Phase 0).*

---

# REVISION 2026-07-10 — Student sign-in v3 (Phase 3R) — THIS OVERRIDES PHASE 3

## What happened & the correction

- The email-link flow (commit `37078c2`) is **rejected**: type email → wait for delivery → find it in Junk → click link is far too much friction for Grade 6, and Outlook junked the very first message. District mail filters may block student-facing external mail entirely. **Remove the student email-link UI.**
- Codex's conclusion "true Outlook SSO is impossible without district IT" was **premature**. The blocker it hit was trying to register the app *inside the district's Entra directory*. The plan never required that: a **multitenant** app registered in **our own free tenant** works for sign-in by accounts from *any* org, including the district. The only district-controlled gate is whether its users may **consent** to third-party apps — unknown until tested, and fixable by one admin-consent request to district IT.
- So we run two tracks: **Track 1 (build now, Codex)** — class-code + name-picker + PIN sign-in: zero district dependency, lowest real-world friction. **Track 2 (parallel, Shane)** — own-tenant Entra app + consent test; if it passes, the SSO button from old Phase 3 gets added *on top* later and becomes the primary path.

## Track 1 — Class-code sign-in (Codex builds this now)

### Student experience (the whole point — keep it this simple)

- **First time (once per student, ~30s):** open site → Sign in → enter the class code Mrs. Baker projects on the board (or arrive via QR/link `/?code=XXXXXX`, which skips typing) → tap your class period → tap your own name → make up a 6-digit PIN (enter it twice) → done.
- **Every time after:** the account stays signed in on their device (`browserLocalPersistence`), so normally **zero clicks**. If signed out: Sign in → your name is remembered on the device (or tap it) → type PIN → in.
- **Forgot PIN:** "Ask Mrs. Baker" — she resets it from the dashboard in one click.
- No email. No inbox. No passwords beyond a 6-digit PIN. Works on any device, any browser, no district approval.

### Mechanics

**Auth backend:** Firebase **Email/Password** provider (Shane enables it in Firebase Console → Authentication → Sign-in method; disable the Email-link option at the same time — password-only variant). Each roster entry maps to a synthetic address the student never sees:
`s-{entryId}@mrs-bakers-classroom.vercel.app` — a domain we control with no MX, so nobody else can ever receive mail for it (do NOT use a real-looking domain someone could register). Password = the 6-digit PIN (meets Firebase's 6-char minimum).

**Roster data model:** one doc per class code: `rosters/{classCode}` →
`{ teacherUid, updatedAt, students: [{ id, first, lastInitial, period }] }`
- `classCode`: 6 chars, unambiguous alphabet (no 0/O/1/I), generated in the dashboard.
- The code is a *capability*: Firestore rules allow `get` (never `list`) on `rosters`, so knowing the code is what unlocks the name picker. First name + last initial only — same exposure level as the existing public leaderboard.
- Students never write the roster. "Claimed" needs no roster field: a second claim of the same name fails `createUserWithEmailAndPassword` with `auth/email-already-in-use` → UI says "This name already has a PIN. If it's you, enter your PIN" and falls through to sign-in. Elegant and race-proof.

**Client flow (`firebase-app.js` rewrite of the student dialog):**
1. Dialog state 1 — class code input (prefilled from `?code=` param or `localStorage.bakerClassCode`; on success cache it and strip the param).
2. State 2 — period buttons → name chips for that period (from the roster doc).
3. State 3 — PIN pad (big touch-friendly digit buttons AND a plain `<input inputmode="numeric" maxlength="6">`; new students confirm twice). New → `createUserWithEmailAndPassword`; returning → `signInWithEmailAndPassword`.
4. On first sign-in, create `users/{uid}` with `{displayName: "First L.", first, lastInitial, period, rosterId, classCode, role:'student'}` — **period comes from the roster now**, so DELETE the old self-serve period picker UI from the dialog (roster is the source of truth; teacher fixes mistakes in the dashboard).
5. Remember `{entryId, first}` in localStorage so a returning signed-out student goes straight to the PIN step with a "Not you?" escape link.
6. Error copy for kids: wrong PIN → "That PIN doesn't match. Try again, or ask Mrs. Baker to reset it." `auth/too-many-requests` → "Too many tries. Wait a few minutes or ask Mrs. Baker."
7. Keep publishing the same `baker-auth-change` event shape — `app.js` consumers stay untouched except: `authState.period` now always comes from the profile, and `studentName` on submissions uses the roster name (kids can't set a custom display name → no moderation surface; the existing `normalizeName` stays for the teacher account only).

**Teacher sign-in stays email-link** (already built, already verified reaching her inbox; she's one adult who does this once per device). Keep the `TEACHER_EMAIL` recognition and the teacher email-link path in `teacher.html`/`firebase-app.js` — just remove it from the *student* dialog. Move any `isSignInWithEmailLink` completion handling so it still works on both pages.

**PIN reset (the one serverless function this project now needs):**
- `api/reset-pin.js` (Vercel Node function — the repo stays otherwise static; Vercel serves `api/` alongside it).
- Request: `POST {idToken, entryId, newPin}`. Verify `idToken` with Firebase Admin SDK → look up caller's `users/{uid}.role === 'teacher'` → `admin.auth().updateUser(uidByEmail('s-{entryId}@…'), {password: newPin})`. Return 403 otherwise.
- Also support `{action:'unclaim'}` → delete the auth user (student re-registers fresh) for name-claimed-by-wrong-kid cases.
- Secrets: `FIREBASE_SERVICE_ACCOUNT` env var in Vercel (Shane pastes the service-account JSON from Firebase Console → Project settings → Service accounts). Add `firebase-admin` via a minimal `package.json` — Vercel installs it for functions only; the static site is unaffected.

**Dashboard additions (Class setup tab):**
- Roster editor: paste names ("First Last", one per line, per period) → stored as first + last initial; add/remove single students; drag/move between periods not needed (edit period inline).
- Show class code big + printable QR (generate QR client-side, e.g. tiny embedded qr library or canvas impl — no external CDN at runtime beyond what's already used).
- Per-student row: claimed ✓ / not-yet ▫, **Reset PIN** button (prompts for new 6-digit, calls `api/reset-pin`), **Unclaim** button.
- "Regenerate class code" button (writes a new roster doc id, deletes old) for if the code leaks beyond the class.

**Firestore rules changes:**
```
match /rosters/{code} {
  allow get: if true;        // capability = knowing the code; never allow list
  allow list: if false;
  allow write: if isTeacher();
}
```
`users/{uid}` create rule: student self-create stays, but now validate `request.resource.data.role == 'student'` (unchanged) — plus keep the existing teacher-email carve-out. Everything else stands. **Remind Shane: publish rules after merge (console paste or `firebase deploy --only firestore:rules`).**

**Cleanup in the same pass:** remove the student email-input UI, `SCHOOL_DOMAIN` student validation, "link sent" copy, and any "check Outlook" strings; update both auth gates (`updateGate()` text → "Sign in with your class code"); bump `?v=` on all touched JS/CSS.

**Acceptance test (run on the live Vercel URL):**
1. Teacher: build a 3-name roster in two periods, get the code.
2. Fresh incognito: enter code → pick period → pick name → set PIN → submit bell work. Close browser, reopen → still signed in.
3. Second incognito claims the same name → gets the "already has a PIN" path; correct PIN signs in, wrong PIN shows kid-friendly error.
4. Teacher resets that PIN from dashboard → old PIN fails, new PIN works. Unclaim → name is claimable fresh.
5. `/?code=XXXXXX` link skips the code screen. Leaderboard + teacher board show roster names ("First L.").

## Track 2 — Real Outlook SSO (Shane, parallel; NOT Codex)

1. Create a free Azure account at azure.microsoft.com/free with the personal Microsoft account (card required for identity verification only — nothing is billed; this is what creates your own Entra tenant, which is the step that was missing on 07-08).
2. Register the multitenant app per original Phase 0.3 (redirect URI `https://mrs-bakers-classroom.vercel.app/__/auth/handler`), enable the Microsoft provider in Firebase per 0.4.
3. **The 5-minute truth test:** on the live site (a temporary hidden `/sso-test.html` page Codex can add with one Microsoft-sign-in button), sign in with Mrs. Baker's district account.
   - Signs in → district allows user consent → SSO is viable; schedule old-Phase-3 as the primary student path and demote class codes to fallback.
   - "Need admin approval" (AADSTS65001/900941/650052) → send district IT this ask: *"Please grant tenant-wide admin consent for app `<client ID>` ('Mrs Baker's Classroom'), a teacher classroom website. It requests only sign-in scopes (openid, profile, email, User.Read) — no mailbox, files, or directory access. Alternatively we're happy to onboard via ClassLink if that's preferred."* Districts approve teacher tools like this routinely; timeline is the only unknown.
4. Note: teacher consent working does NOT guarantee student consent (districts often have stricter minor policies) — before flipping SSO to primary, test with a real student account.

### Track 2 — TEST RESULT (2026-07-10, verified live)

Entra app registered in Shane's own tenant: **Mrs Baker's Classroom**, client ID `b11a9fb1-93c7-4787-9917-20b17ba322e5`, multitenant (all tenants), Web redirect URIs = vercel + firebaseapp `/__/auth/handler`, secret expires 7/9/2028. Microsoft provider **enabled in Firebase** with these credentials. `/sso-test` page (redirect flow) with Mrs. Baker's district account produced:

> **"Approval required — Mrs Baker's Classroom (unverified). This app requires your admin's approval to: Sign in and read user profile."** — with a working **"Request approval"** justification box.

Meaning: the district blocks user consent (as suspected), but the **admin-consent request workflow is ENABLED** — Mrs. Baker can submit the request directly from that screen (no cold email needed). If district IT approves, SSO works with zero further code/config; retest at `/sso-test`. Until then, Phase 3R (class code + PIN) remains the launch plan. Justification text to paste when requesting: *"Free classroom website for Mrs. Baker's Grade 6 ELA classes at Lake Manatee K-8 — students sign in to submit daily bell work and practice reading skills. Sign-in only (openid, profile, email, User.Read); no mailbox, files, or directory access."*
