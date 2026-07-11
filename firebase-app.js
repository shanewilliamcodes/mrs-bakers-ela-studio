import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {browserLocalPersistence,createUserWithEmailAndPassword,getAuth,onAuthStateChanged,setPersistence,signInWithEmailAndPassword,signOut,updateProfile} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {addDoc,collection,doc,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Class-code sign-in: students enter the class code, tap their name from the
// roster, and use a 6-digit PIN. Behind the scenes each roster entry maps to a
// Firebase email/password account with a synthetic address on a domain we own
// (no MX records, so no one can ever receive mail for it).
const PIN_EMAIL_DOMAIN='mrs-bakers-classroom.vercel.app';
const TEACHER_EMAIL='bakert4@manateeschools.net';
const CODE_KEY='bakerClassCode';
const STUDENT_KEY='bakerStudent';
const config=window.BAKER_FIREBASE_CONFIG;
const dialog=document.querySelector('#account-dialog');
const button=document.querySelector('#account-button');
const feedback=document.querySelector('#account-feedback');
const signedOut=document.querySelector('#account-state');
const signedIn=document.querySelector('#signed-in-state');
const publish=detail=>window.dispatchEvent(new CustomEvent('baker-auth-change',{detail}));
function normalizeName(raw){
  let name=String(raw||'Student').replace(/\s*[\[(].*?[\])]\s*/g,' ').replace(/\s+/g,' ').trim()||'Student';
  const comma=name.match(/^([^,]+),\s*(.+)$/);
  if(comma)name=`${comma[2]} ${comma[1]}`.replace(/\s+/g,' ').trim();
  return name||'Student';
}
const api={addDoc,collection,doc,getDoc,getDocs,limit,orderBy,query,serverTimestamp,setDoc,where,normalizeName};
const cleanCode=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const entryEmail=id=>`s-${String(id).toLowerCase()}@${PIN_EMAIL_DOMAIN}`;
const studentLabel=e=>`${e.first} ${e.lastInitial}.`;
const readJson=key=>{try{return JSON.parse(localStorage.getItem(key))}catch(e){return null}};

if(!config?.projectId){
  button.textContent='Accounts coming soon';
  feedback.textContent='Secure account storage is being connected. Bell-work drafts still save privately on this device.';
  publish({ready:false,user:null,api});
}else{
  const app=initializeApp(config);
  const auth=getAuth(app);
  const db=getFirestore(app);
  setPersistence(auth,browserLocalPersistence).catch(()=>{});

  const steps={code:document.querySelector('#step-code'),name:document.querySelector('#step-name'),pin:document.querySelector('#step-pin')};
  const codeInput=document.querySelector('#class-code');
  const pinInput=document.querySelector('#pin-input');
  const pinConfirm=document.querySelector('#pin-confirm');
  const pinConfirmWrap=document.querySelector('#pin-confirm-wrap');
  let rosterCode=null,rosterStudents=[],chosen=null,chosenClaimed=false,pendingProfile=null;

  function showStep(name){Object.entries(steps).forEach(([key,el])=>{el.hidden=key!==name});feedback.textContent=''}
  function friendly(error){
    const code=error?.code||'';
    if(['auth/invalid-credential','auth/invalid-login-credentials','auth/wrong-password','auth/user-not-found'].includes(code))return 'That PIN does not match. Try again, or ask Mrs. Baker to reset it.';
    if(code==='auth/too-many-requests')return 'Too many tries. Wait a few minutes, or ask Mrs. Baker to reset your PIN.';
    if(code==='auth/network-request-failed')return 'The network hiccuped. Check the connection and try again.';
    if(code==='auth/operation-not-allowed')return 'PIN sign-in has not been switched on yet. Please tell Mrs. Baker.';
    return `Sign-in could not finish${code?` (${code.replace('auth/','')})`:''}. Try once more, or tell Mrs. Baker.`;
  }

  async function loadRoster(code){
    const snap=await getDoc(doc(db,'rosters',code));
    if(!snap.exists())return null;
    return (snap.data().students||[]).map(s=>({id:String(s.id),first:String(s.first||'Student'),lastInitial:String(s.lastInitial||''),period:Number(s.period)||0}));
  }
  async function submitCode(){
    const code=cleanCode(codeInput.value);
    if(code.length<4){feedback.textContent='The class code is the 6 letters and numbers on the board.';codeInput.focus();return}
    feedback.textContent='Checking the class code...';
    try{
      const students=await loadRoster(code);
      if(!students){feedback.textContent='That code did not match a class. Check the board and try again.';return}
      rosterCode=code;rosterStudents=students;
      localStorage.setItem(CODE_KEY,code);
      renderPeriods();showStep('name');
    }catch(e){feedback.textContent='Could not check the code — is the internet connected?'}
  }
  function renderPeriods(){
    const periods=[...new Set(rosterStudents.map(s=>s.period).filter(Boolean))].sort((a,b)=>a-b);
    document.querySelector('#period-choices').innerHTML=periods.map(p=>`<button type="button" data-period="${p}">Period ${p}</button>`).join('')||'<p class="privacy-note">No students on this roster yet — tell Mrs. Baker.</p>';
    document.querySelector('#name-grid').innerHTML='';
    document.querySelector('#name-label').hidden=true;
    document.querySelector('#name-note').hidden=true;
    document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>renderNames(Number(b.dataset.period),b)));
    if(periods.length===1)renderNames(periods[0],document.querySelector('[data-period]'));
  }
  function renderNames(period,activeButton){
    document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b===activeButton));
    const students=rosterStudents.filter(s=>s.period===period).sort((a,b)=>studentLabel(a).localeCompare(studentLabel(b)));
    document.querySelector('#name-grid').innerHTML=students.map(s=>`<button type="button" data-entry="${s.id}">${escapeText(studentLabel(s))}</button>`).join('');
    document.querySelector('#name-label').hidden=false;
    document.querySelector('#name-note').hidden=false;
    document.querySelectorAll('[data-entry]').forEach(b=>b.addEventListener('click',()=>pickStudent(students.find(s=>s.id===b.dataset.entry))));
  }
  function escapeText(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML}
  async function pickStudent(student){
    if(!student)return;
    chosen={...student,code:rosterCode};
    feedback.textContent='One second...';
    let claimed=false;
    try{claimed=(await getDoc(doc(db,'claims',student.id))).exists()}catch(e){}
    openPinStep(claimed);
  }
  function openPinStep(claimed){
    chosenClaimed=claimed;
    document.querySelector('#pin-who').textContent=`Hi, ${chosen.first}!`;
    document.querySelector('#pin-label').textContent=claimed?'Type your 6-digit PIN':'Make up a secret 6-digit PIN';
    pinConfirmWrap.hidden=claimed;
    document.querySelector('#pin-submit').textContent=claimed?'Sign in':'Create my PIN';
    document.querySelector('#pin-note').textContent=claimed?'Forgot your PIN? Ask Mrs. Baker — she can reset it in class.':'Pick 6 numbers you will remember. Do not use your birthday if friends know it!';
    pinInput.value='';pinConfirm.value='';
    showStep('pin');pinInput.focus();
  }
  async function submitPin(){
    const pin=pinInput.value.trim();
    if(!/^\d{6}$/.test(pin)){feedback.textContent='Your PIN is exactly 6 numbers.';pinInput.focus();return}
    if(!chosenClaimed&&pin!==pinConfirm.value.trim()){feedback.textContent='Those two PINs do not match — type the same 6 numbers in both boxes.';pinConfirm.focus();return}
    feedback.textContent=chosenClaimed?'Signing you in...':'Creating your account...';
    document.querySelector('#pin-submit').disabled=true;
    try{
      if(chosenClaimed){
        await signInWithEmailAndPassword(auth,entryEmail(chosen.id),pin);
      }else{
        pendingProfile={entryId:chosen.id,classCode:chosen.code||rosterCode,first:chosen.first,lastInitial:chosen.lastInitial,period:chosen.period};
        const cred=await createUserWithEmailAndPassword(auth,entryEmail(chosen.id),pin);
        await updateProfile(cred.user,{displayName:studentLabel(chosen)}).catch(()=>{});
        setDoc(doc(db,'claims',chosen.id),{uid:cred.user.uid,classCode:chosen.code||rosterCode,at:serverTimestamp()}).catch(()=>{});
      }
      localStorage.setItem(STUDENT_KEY,JSON.stringify({id:chosen.id,first:chosen.first,lastInitial:chosen.lastInitial,period:chosen.period,code:chosen.code||rosterCode}));
    }catch(error){
      pendingProfile=null;
      if(error?.code==='auth/email-already-in-use'){
        feedback.textContent='';
        openPinStep(true);
        feedback.textContent='This name already has a PIN. If it is you, type your PIN. If not, tell Mrs. Baker.';
      }else feedback.textContent=friendly(error);
    }
    document.querySelector('#pin-submit').disabled=false;
  }

  document.querySelector('#code-continue').addEventListener('click',submitCode);
  codeInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitCode()}});
  codeInput.addEventListener('input',()=>{codeInput.value=cleanCode(codeInput.value)});
  [pinInput,pinConfirm].forEach(el=>{
    el.addEventListener('input',()=>{el.value=el.value.replace(/\D/g,'').slice(0,6)});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitPin()}});
  });
  document.querySelector('#pin-submit').addEventListener('click',submitPin);
  document.querySelector('#back-to-code').addEventListener('click',()=>{showStep('code');codeInput.focus()});
  document.querySelector('#not-me').addEventListener('click',()=>{
    localStorage.removeItem(STUDENT_KEY);chosen=null;
    if(rosterStudents.length){renderPeriods();showStep('name')}else showStep('code');
  });

  async function openDialogFlow(){
    if(auth.currentUser)return;
    const remembered=readJson(STUDENT_KEY);
    if(remembered?.id){
      chosen=remembered;rosterCode=remembered.code||localStorage.getItem(CODE_KEY);
      openPinStep(true);
      return;
    }
    const savedCode=cleanCode(localStorage.getItem(CODE_KEY));
    if(savedCode){
      codeInput.value=savedCode;
      showStep('code');
      try{
        const students=await loadRoster(savedCode);
        if(students){rosterCode=savedCode;rosterStudents=students;renderPeriods();showStep('name');return}
      }catch(e){}
    }
    showStep('code');
  }
  button.addEventListener('click',()=>{dialog.showModal();openDialogFlow()});

  // Teacher-projected join links: /?code=ABC123 opens straight to the roster.
  const urlCode=cleanCode(new URLSearchParams(location.search).get('code'));
  if(urlCode){
    localStorage.setItem(CODE_KEY,urlCode);
    localStorage.removeItem(STUDENT_KEY);
    history.replaceState(null,'',location.pathname+location.hash);
    setTimeout(()=>{if(!auth.currentUser){dialog.showModal();openDialogFlow()}},400);
  }

  document.querySelector('#sign-out').addEventListener('click',()=>signOut(auth));
  const periodDisplay=document.querySelector('#period-display');

  onAuthStateChanged(auth,async user=>{
    signedOut.hidden=Boolean(user);
    signedIn.hidden=!user;
    if(!user){
      button.textContent='Student sign in';
      publish({ready:true,user:null,db,api});
      return;
    }
    const isTeacher=user.email?.toLowerCase()===TEACHER_EMAIL;
    const remembered=readJson(STUDENT_KEY);
    const entryId=user.email?.startsWith('s-')?user.email.split('@')[0].slice(2):null;
    let displayName=normalizeName(user.displayName||(pendingProfile?`${pendingProfile.first} ${pendingProfile.lastInitial}.`:remembered?.first)||'Student');
    let role=isTeacher?'teacher':'student',period=pendingProfile?.period||null;
    try{
      const ref=doc(db,'users',user.uid);
      const snap=await getDoc(ref);
      if(snap.exists()){
        const profile=snap.data();
        displayName=profile.displayName||displayName;
        role=isTeacher?'teacher':(profile.role||'student');
        period=profile.period||period;
        // Roster is the source of truth for period + name; refresh best-effort.
        const code=profile.classCode||pendingProfile?.classCode||localStorage.getItem(CODE_KEY);
        const id=profile.entryId||entryId;
        if(code&&id){
          try{
            const roster=await getDoc(doc(db,'rosters',cleanCode(code)));
            const entry=(roster.data()?.students||[]).find(s=>String(s.id)===String(id));
            if(entry){
              const fresh={displayName:`${entry.first} ${entry.lastInitial}.`,period:Number(entry.period)||null};
              if(fresh.displayName!==profile.displayName||fresh.period!==profile.period){
                await setDoc(ref,{...fresh,updatedAt:serverTimestamp()},{merge:true});
                displayName=fresh.displayName;period=fresh.period;
              }
            }
          }catch(e){}
        }
      }else{
        const seed=pendingProfile||{entryId,classCode:localStorage.getItem(CODE_KEY)||null,first:displayName.split(' ')[0],lastInitial:(displayName.split(' ')[1]||'').replace('.',''),period:remembered?.period||null};
        const profileDoc=isTeacher
          ?{displayName,email:user.email||'',role:'teacher',updatedAt:serverTimestamp()}
          :{displayName,first:seed.first,lastInitial:seed.lastInitial,period:seed.period,entryId:seed.entryId,classCode:seed.classCode,role:'student',updatedAt:serverTimestamp()};
        await setDoc(ref,profileDoc);
        period=seed.period||period;
      }
    }catch(error){
      console.warn('Profile sync deferred (sign-in still succeeded):',error?.code||error);
    }
    pendingProfile=null;
    button.textContent=displayName.split(/\s+/)[0]||'My account';
    document.querySelector('#profile-name').textContent=displayName;
    document.querySelector('#profile-email').textContent=isTeacher?(user.email||''):'Class account';
    document.querySelector('#profile-initial').textContent=(displayName[0]||'S').toUpperCase();
    periodDisplay.hidden=!period;
    periodDisplay.textContent=period?`Period ${period}`:'';
    document.querySelector('#teacher-link').hidden=role!=='teacher';
    publish({ready:true,user:{uid:user.uid,email:user.email||'',displayName},db,role,period,api});
    feedback.textContent='Signed in. You are all set!';
    if(dialog.open)setTimeout(()=>dialog.close(),700);
  });
}
