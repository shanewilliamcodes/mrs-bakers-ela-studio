# Mrs. Baker's ELA Studio

A public Grade 6 English Language Arts classroom hub for Mrs. Tori Baker at Lake Manatee K-8.

Includes interactive bell work, daily/weekly/monthly plans, StudySync and Schoology access, a Grade 6 B.E.S.T. learning map, FAST practice, public assessment context, ELA tools, 7 Habits connections, family resources, and a draft syllabus.

Bell work includes daily B.E.S.T.-aligned prompts, private draft autosave, response goals, revision checks, confidence reflection, student submission history, and a private teacher review dashboard with filters and CSV export.

## Student accounts

Accounts use Firebase Authentication with school Google accounts and Cloud Firestore. Until a Firebase project is configured, the public site remains in private-device draft mode and does not claim submissions are stored.

Setup steps:

1. Create a Firebase project and web app.
2. Enable Google Authentication and Cloud Firestore.
3. Add the GitHub Pages domain to Firebase Authentication's authorized domains.
4. Copy the web app configuration into `firebase-config.js`.
5. Deploy `firestore.rules` with the Firebase CLI.
6. Sign in once, then set Mrs. Baker's `users/{uid}.role` field to `teacher` in Firestore.

Student information must not be collected until Lake Manatee K-8 or the School District of Manatee County approves the account workflow and data handling.

## Live site

https://shanewilliamcodes.github.io/mrs-bakers-ela-studio/
