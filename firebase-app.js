import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {browserLocalPersistence,getAuth,GoogleAuthProvider,onAuthStateChanged,setPersistence,signInWithPopup,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
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
    if(error?.code==='auth/popup-closed-by-user')return 'The Google sign-in window was closed before it finished. Click Continue with Google to try again.';
    if(error?.code==='auth/unauthorized-domain')return 'This website address still needs to be approved in Firebase. Please tell Mrs. Baker the sign-in domain is not authorized.';
    if(error?.code==='auth/operation-not-allowed')return 'Google sign-in has not been enabled for this class yet.';
    if(error?.code==='auth/network-request-failed')return 'The network blocked Google sign-in. Check the connection and try again.';
    return `Google sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}. Please try once more.`;
  };
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
  onAuthStateChanged(auth,async user=>{
    signedOut.hidden=Boolean(user);
    signedIn.hidden=!user;
    button.textContent=user?(user.displayName?.split(' ')[0]||'My account'):'Student sign in';
    if(!user){publish({ready:true,user:null,db,api});return}
    document.querySelector('#profile-name').textContent=user.displayName||'Student';
    document.querySelector('#profile-email').textContent=user.email||'';
    document.querySelector('#profile-initial').textContent=(user.displayName||'S')[0].toUpperCase();
    const profileSnap=await getDoc(doc(db,'users',user.uid)).catch(()=>null);
    const profile=profileSnap?.data()||{};
    if(!profileSnap?.exists()){
      await setDoc(doc(db,'users',user.uid),{displayName:user.displayName||'Student',email:user.email||'',role:'student',updatedAt:serverTimestamp()});
    }
    document.querySelector('#teacher-link').hidden=profile.role!=='teacher';
    publish({ready:true,user,db,role:profile.role||'student',api});
    feedback.textContent='Signed in. Your account is ready.';
    if(dialog.open)setTimeout(()=>dialog.close(),600);
  });
}
