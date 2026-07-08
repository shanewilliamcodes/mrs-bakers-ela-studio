import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {browserLocalPersistence,getAuth,getRedirectResult,OAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {addDoc,collection,doc,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Set MS_TENANT to the district's Entra tenant ID once known to lock sign-in
// to district accounts and make silent SSO more likely. Empty = any Microsoft org.
const MS_TENANT='';
const MS_DOMAIN_HINT='';
const config=window.BAKER_FIREBASE_CONFIG;
const button=document.querySelector('#account-button');
const dialog=document.querySelector('#account-dialog');
const feedback=document.querySelector('#account-feedback');
const signedOut=document.querySelector('#account-state');
const signedIn=document.querySelector('#signed-in-state');
const signinButton=document.querySelector('#ms-signin');
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
  const provider=new OAuthProvider('microsoft.com');
  provider.setCustomParameters({
    prompt:'select_account',
    ...(MS_TENANT?{tenant:MS_TENANT}:{}),
    ...(MS_DOMAIN_HINT?{domain_hint:MS_DOMAIN_HINT}:{})
  });
  setPersistence(auth,browserLocalPersistence).catch(()=>{});

  const authText=error=>`${error?.code||''} ${error?.message||''} ${JSON.stringify(error?.customData||{})}`;
  const authMessage=error=>{
    const text=authText(error);
    if(/AADSTS(65001|650052|900941)/.test(text))return "Your school district hasn't approved this website for student sign-in yet. Please tell Mrs. Baker — this is a district setting, not a mistake you made.";
    if(/AADSTS50020/.test(text))return "That Microsoft account isn't part of the school district. Use your school email account.";
    if(error?.code==='auth/popup-closed-by-user')return 'The Microsoft sign-in window closed before it finished. Click Sign in to try again, or tell Mrs. Baker if the window showed an error.';
    if(error?.code==='auth/account-exists-with-different-credential')return 'This email was already used with a different sign-in method. Tell Mrs. Baker so she can fix your account.';
    if(error?.code==='auth/admin-restricted-operation'||error?.code==='auth/user-disabled')return 'Your school may not allow this account to sign in to outside websites. Please ask Mrs. Baker — she can check with the district.';
    if(error?.code==='auth/unauthorized-domain')return 'This website address still needs to be approved in Firebase. Please tell Mrs. Baker the sign-in domain is not authorized.';
    if(error?.code==='auth/operation-not-allowed')return 'Microsoft sign-in has not been enabled for this class yet.';
    if(error?.code==='auth/network-request-failed')return 'The network blocked school account sign-in. Check the connection and try again.';
    return `School account sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}. Please try once more, or tell Mrs. Baker if it keeps happening.`;
  };

  getRedirectResult(auth).catch(error=>{feedback.textContent=authMessage(error)});
  signinButton.addEventListener('click',async()=>{
    feedback.textContent='Opening school account sign-in...';
    try{
      await setPersistence(auth,browserLocalPersistence);
      await signInWithPopup(auth,provider);
    }catch(error){
      if(['auth/popup-blocked','auth/cancelled-popup-request'].includes(error?.code)){
        feedback.textContent='The browser blocked the sign-in window. Switching to full-page sign-in...';
        try{await signInWithRedirect(auth,provider)}catch(redirectError){feedback.textContent=authMessage(redirectError)}
      }else feedback.textContent=authMessage(error);
    }
  });
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

    // Unlock the page as soon as Microsoft sign-in succeeds. Reading/creating
    // the Firestore profile is best-effort so a rules hiccup never blocks practice.
    let role='student',period=null;
    try{
      const profileSnap=await getDoc(doc(db,'users',user.uid));
      if(profileSnap.exists()){
        const profile=profileSnap.data();
        role=profile?.role||'student';
        period=profile?.period||null;
        if(profile?.displayName!==displayName)await setDoc(doc(db,'users',user.uid),{displayName,email:user.email||'',updatedAt:serverTimestamp()},{merge:true});
      }else{
        await setDoc(doc(db,'users',user.uid),{displayName,email:user.email||'',role:'student',updatedAt:serverTimestamp()});
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
