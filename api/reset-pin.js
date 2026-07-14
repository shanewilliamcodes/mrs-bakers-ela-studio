// Teacher-only PIN reset for class-code student accounts.
// Needs FIREBASE_SERVICE_ACCOUNT (the service-account JSON) in Vercel env vars;
// without it the endpoint returns 501 and the dashboard offers a fresh-start
// fallback instead.
const admin = require('firebase-admin');

const PIN_EMAIL_DOMAIN = 'mrs-bakers-classroom.vercel.app';
// MUST match PIN_SUFFIX in firebase-app.js.
const PIN_SUFFIX = '-mb';
let initialized = false;

function init() {
  if (initialized) return;
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  initialized = true;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(501).json({ error: 'not-configured' });
  try {
    init();
    const { idToken, entryId, newPin, action } = req.body || {};
    if (typeof idToken !== 'string' || !/^[a-z0-9]{4,24}$/i.test(String(entryId || ''))) {
      return res.status(400).json({ error: 'bad-request' });
    }
    if (action !== 'unclaim' && !/^\d{4}$/.test(String(newPin || ''))) {
      return res.status(400).json({ error: 'pin-must-be-4-digits' });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    const profile = await admin.firestore().doc(`users/${decoded.uid}`).get();
    if (profile.data()?.role !== 'teacher') return res.status(403).json({ error: 'teacher-only' });

    const email = `s-${String(entryId).toLowerCase()}@${PIN_EMAIL_DOMAIN}`;
    const user = await admin.auth().getUserByEmail(email);
    if (action === 'unclaim') {
      await admin.auth().deleteUser(user.uid);
      await admin.firestore().doc(`claims/${entryId}`).delete().catch(() => {});
      return res.status(200).json({ ok: true, unclaimed: true });
    }
    await admin.auth().updateUser(user.uid, { password: String(newPin) + PIN_SUFFIX });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return res.status(404).json({ error: 'student-account-not-found' });
    if (error?.code === 'auth/argument-error' || error?.code === 'auth/id-token-expired') return res.status(401).json({ error: 'sign-in-again' });
    console.error('reset-pin failed:', error?.code || error);
    return res.status(500).json({ error: 'internal' });
  }
};
