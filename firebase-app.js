import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {browserLocalPersistence,getAuth,isSignInWithEmailLink,onAuthStateChanged,sendSignInLinkToEmail,setPersistence,signInWithEmailLink,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {addDoc,collection,doc,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const SCHOOL_DOMAIN='@manateeschools.net';
const TEACHER_EMAIL='bakert4@manateeschools.net';
const EMAIL_STORAGE_KEY='bakerSignInEmail';
const config=window.BAKER_FIREBASE_CONFIG;
const button=document.querySelector('#account-button');
const dialog=document.querySelector('#account-dialog');
const feedback=document.querySelector('#account-feedback');
const signedOut=document.querySelector('#account-state');
const signedIn=document.querySelector('#signed-in-state');
const signinButton=document.querySelector('#email-signin');
const emailInput=document.querySelector('#school-email');
const publish=detail=>window.dispatchEvent(new CustomEvent('baker-auth-change',{detail}));
function normalizeName(raw){
  let name=String(raw||'Student').replace(/\s*[\[(].*?[\])]\s*/g,' ').replace(/\s+/g,' ').trim()||'Student';
  const comma=name.match(/^([^,]+),\s*(.+)$/);
  if(comma)name=`${comma[2]} ${comma[1]}`.replace(/\s+/g,' ').trim();
  return name||'Student';
}
const api={addDoc,collection,doc,getDoc,getDocs,limit,orderBy,query,serverTimestamp,setDoc,where,normalizeName};

button.addEventListener('click',()=>dialog.showModal());

if(!config?.projectId){
  button.textContent='Accounts coming soon';
  signinButton.disabled=true;
  feedback.textContent='Secure account storage is being connected. Bell-work drafts still save privately on this device.';
  publish({ready:false,user:null,api});
}else{
  const app=initializeApp(config);
  const auth=getAuth(app);
  const db=getFirestore(app);
  setPersistence(auth,browserLocalPersistence).catch(()=>{});

  const authMessage=error=>{
    if(error?.code==='auth/invalid-action-code'||error?.code==='auth/expired-action-code')return 'That sign-in link has expired or was already used. Request a new one below.';
    if(error?.code==='auth/invalid-email')return 'Enter your full school email address.';
    if(error?.code==='auth/unauthorized-domain')return 'This website address still needs to be approved in Firebase. Please tell Mrs. Baker the sign-in domain is not authorized.';
    if(error?.code==='auth/operation-not-allowed')return 'Email sign-in has not been enabled for this class yet.';
    if(error?.code==='auth/network-request-failed')return 'The sign-in request could not reach the network. Check the connection and try again.';
    return `School account sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}. Please try once more, or tell Mrs. Baker if it keeps happening.`;
  };

  const validSchoolEmail=value=>String(value||'').trim().toLowerCase().endsWith(SCHOOL_DOMAIN);
  signinButton.addEventListener('click',async()=>{
    const email=emailInput.value.trim().toLowerCase();
    if(!validSchoolEmail(email)){feedback.textContent='Use your full @manateeschools.net school email.';emailInput.focus();return}
    feedback.textContent='Sending your private sign-in link...';
    try{
      await setPersistence(auth,browserLocalPersistence);
      await sendSignInLinkToEmail(auth,email,{url:`${location.origin}${location.pathname}${location.hash}`,handleCodeInApp:true});
      localStorage.setItem(EMAIL_STORAGE_KEY,email);
      feedback.textContent='Link sent! Open Outlook and click the email from Mrs. Baker’s Classroom.';
    }catch(error){
      feedback.textContent=authMessage(error);
    }
  });
  if(isSignInWithEmailLink(auth,location.href)){
    dialog.showModal();
    feedback.textContent='Finishing your school account sign-in...';
    const email=localStorage.getItem(EMAIL_STORAGE_KEY)||'';
    if(email){
      signInWithEmailLink(auth,email,location.href).then(()=>{
        localStorage.removeItem(EMAIL_STORAGE_KEY);
        history.replaceState(null,'',location.pathname+location.hash);
      }).catch(error=>{feedback.textContent=authMessage(error)});
    }else feedback.textContent='Enter the same school email you used, then request a fresh sign-in link.';
  }
  document.querySelector('#sign-out').addEventListener('click',()=>signOut(auth));
  let currentUser=null,currentRole='student',currentPeriod=null;
  const periodSetup=document.querySelector('#period-setup'),periodDisplay=document.querySelector('#period-display');
  const refreshPeriodUI=()=>{periodSetup.hidden=Boolean(currentPeriod);periodDisplay.hidden=!currentPeriod;periodDisplay.textContent=currentPeriod?`Period ${currentPeriod} · change`:''};
  document.querySelector('#save-period').addEventListener('click',async()=>{
    const v=document.querySelector('#period-select').value;
    if(!v||!currentUser){feedback.textContent='Choose your class period from the list first.';return}
    try{
      await setDoc(doc(db,'users',currentUser.uid),{period:Number(v),updatedAt:serverTimestamp()},{merge:true});
      currentPeriod=Number(v);refreshPeriodUI();
      publish({ready:true,user:currentUser,db,role:currentRole,period:currentPeriod,api});
      feedback.textContent='Period saved. You are all set!';
      if(dialog.open)setTimeout(()=>dialog.close(),700);
    }catch(e){feedback.textContent='Your period did not save. Please try again.'}
  });
  periodDisplay.addEventListener('click',()=>{periodSetup.hidden=false});
  onAuthStateChanged(auth,async user=>{
    signedOut.hidden=Boolean(user);
    signedIn.hidden=!user;
    currentUser=null;
    if(!user){
      button.textContent='Student sign in';
      currentPeriod=null;
      publish({ready:true,user:null,db,api});
      return;
    }
    const displayName=normalizeName(user.displayName||user.email?.split('@')[0]||'Student');
    const publicUser={uid:user.uid,email:user.email||'',displayName};
    button.textContent=displayName.split(/\s+/)[0]||'My account';
    currentUser=publicUser;
    document.querySelector('#profile-name').textContent=displayName;
    document.querySelector('#profile-email').textContent=user.email||'';
    document.querySelector('#profile-initial').textContent=displayName[0].toUpperCase();

    // Unlock the page as soon as email-link sign-in succeeds. Reading/creating
    // the Firestore profile is best-effort so a rules hiccup never blocks practice.
    let role=user.email?.toLowerCase()===TEACHER_EMAIL?'teacher':'student',period=null;
    try{
      const profileSnap=await getDoc(doc(db,'users',user.uid));
      if(profileSnap.exists()){
        const profile=profileSnap.data();
        role=profile?.role||role;
        period=profile?.period||null;
        const desiredRole=user.email?.toLowerCase()===TEACHER_EMAIL?'teacher':role;
        if(profile?.displayName!==displayName||profile?.role!==desiredRole)await setDoc(doc(db,'users',user.uid),{displayName,email:user.email||'',role:desiredRole,updatedAt:serverTimestamp()},{merge:true});
        role=desiredRole;
      }else{
        await setDoc(doc(db,'users',user.uid),{displayName,email:user.email||'',role,updatedAt:serverTimestamp()});
      }
    }catch(error){
      console.warn('Profile sync deferred (sign-in still succeeded):',error?.code||error);
    }
    currentRole=role;currentPeriod=period;refreshPeriodUI();
    document.querySelector('#teacher-link').hidden=role!=='teacher';
    publish({ready:true,user:publicUser,db,role,period,api});
    feedback.textContent=period?'Signed in. Your account is ready.':'One last step: choose your class period below.';
    if(dialog.open&&(period||role==='teacher'))setTimeout(()=>dialog.close(),600);
  });
}
