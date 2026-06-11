import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {browserLocalPersistence,getAuth,getRedirectResult,GoogleAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {addDoc,collection,doc,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const config=window.BAKER_FIREBASE_CONFIG;
const button=document.querySelector('#account-button');
const dialog=document.querySelector('#account-dialog');
const feedback=document.querySelector('#account-feedback');
const signedOut=document.querySelector('#account-state');
const signedIn=document.querySelector('#signed-in-state');
const publish=detail=>window.dispatchEvent(new CustomEvent('baker-auth-change',{detail}));
const api={addDoc,collection,doc,getDoc,getDocs,limit,orderBy,query,serverTimestamp,setDoc,where};

button.addEventListener('click',()=>dialog.showModal());

if(!config?.projectId){
  button.textContent='Accounts coming soon';
  document.querySelector('#google-signin').disabled=true;
  feedback.textContent='Secure account storage is being connected. Bell-work drafts still save privately on this device.';
  publish({ready:false,user:null});
}else{
  const app=initializeApp(config);
  const auth=getAuth(app);
  const db=getFirestore(app);
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  setPersistence(auth,browserLocalPersistence).catch(()=>{});

  const authMessage=error=>{
    if(error?.code==='auth/popup-closed-by-user')return 'The Google sign-in window closed before it finished. If Google showed an "Access blocked" message, your school account may not be allowed to sign in to outside sites — please tell Mrs. Baker. Otherwise click Continue with Google to try again.';
    if(error?.code==='auth/admin-restricted-operation'||error?.code==='auth/user-disabled')return 'Your school may not allow this account to sign in to outside websites. Please ask Mrs. Baker — she can check with the district.';
    if(error?.code==='auth/unauthorized-domain')return 'This website address still needs to be approved in Firebase. Please tell Mrs. Baker the sign-in domain is not authorized.';
    if(error?.code==='auth/operation-not-allowed')return 'Google sign-in has not been enabled for this class yet.';
    if(error?.code==='auth/network-request-failed')return 'The network blocked Google sign-in. Check the connection and try again.';
    return `Google sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}. Please try once more, or tell Mrs. Baker if it keeps happening.`;
  };
  // The redirect fallback (used when popups are blocked) returns here after the page reloads.
  // Surface any error so a blocked-by-district account isn't a silent failure.
  getRedirectResult(auth).catch(error=>{feedback.textContent=authMessage(error)});
  document.querySelector('#google-signin').addEventListener('click',async()=>{
    feedback.textContent='Opening Google sign-in...';
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
      await setDoc(doc(db,'users',currentUser.uid),{period:Number(v)},{merge:true});
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
    button.textContent=user?(user.displayName?.split(' ')[0]||'My account'):'Student sign in';
    currentUser=user;
    if(!user){currentPeriod=null;publish({ready:true,user:null,db,api});return}
    document.querySelector('#profile-name').textContent=user.displayName||'Student';
    document.querySelector('#profile-email').textContent=user.email||'';
    document.querySelector('#profile-initial').textContent=(user.displayName||'S')[0].toUpperCase();
    // Unlock the page as soon as Google sign-in succeeds. Reading/creating the Firestore
    // profile is best-effort: if it fails (e.g. rules not yet deployed) it must NOT lock the
    // student out of viewing bell work / the FAST challenge.
    let role='student',period=null;
    try{
      const profileSnap=await getDoc(doc(db,'users',user.uid));
      if(profileSnap.exists()){
        role=profileSnap.data()?.role||'student';
        period=profileSnap.data()?.period||null;
      }else{
        await setDoc(doc(db,'users',user.uid),{displayName:user.displayName||'Student',email:user.email||'',role:'student',updatedAt:serverTimestamp()});
      }
    }catch(error){
      console.warn('Profile sync deferred (sign-in still succeeded):',error?.code||error);
    }
    currentRole=role;currentPeriod=period;refreshPeriodUI();
    document.querySelector('#teacher-link').hidden=role!=='teacher';
    publish({ready:true,user,db,role,period,api});
    feedback.textContent=period?'Signed in. Your account is ready.':'One last step: choose your class period below.';
    if(dialog.open&&(period||role==='teacher'))setTimeout(()=>dialog.close(),600);
  });
}
