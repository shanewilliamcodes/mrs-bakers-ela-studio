import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,getRedirectResult,onAuthStateChanged,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
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

  const authMessage=error=>{
    if(error?.code==='auth/unauthorized-domain')return 'This website address still needs to be approved in Firebase. Please tell Mrs. Baker the sign-in domain is not authorized.';
    if(error?.code==='auth/operation-not-allowed')return 'Google sign-in has not been enabled for this class yet.';
    if(error?.code==='auth/network-request-failed')return 'The network blocked Google sign-in. Check the connection and try again.';
    return `Google sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}. Please try once more.`;
  };
  document.querySelector('#google-signin').addEventListener('click',async()=>{
    feedback.textContent='Taking you to Google sign-in...';
    try{await signInWithRedirect(auth,provider)}catch(error){feedback.textContent=authMessage(error)}
  });
  getRedirectResult(auth).catch(error=>{feedback.textContent=authMessage(error);dialog.showModal()});
  document.querySelector('#sign-out').addEventListener('click',()=>signOut(auth));
  document.querySelector('#join-class').addEventListener('click',async()=>{
    const user=auth.currentUser;
    const classCode=document.querySelector('#class-code').value.trim().toUpperCase();
    if(!user||classCode.length<4){feedback.textContent='Enter the class code Mrs. Baker gave you.';return}
    feedback.textContent='Finishing your account...';
    try{
      const current=await getDoc(doc(db,'users',user.uid));
      const role=current.data()?.role||'student';
      await setDoc(doc(db,'users',user.uid),{displayName:user.displayName||'Student',email:user.email||'',classCode,role,updatedAt:serverTimestamp()},{merge:true});
      feedback.textContent=`Ready! You joined class ${classCode}.`;
      publish({ready:true,user,db,classCode,role,api});
      setTimeout(()=>dialog.close(),700);
    }catch(error){
      feedback.textContent='Google sign-in worked, but the class could not be connected yet. Your account is safe; please try the class code again.';
    }
  });
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
    document.querySelector('#class-code').value=profile.classCode||'';
    document.querySelector('#teacher-link').hidden=profile.role!=='teacher';
    publish({ready:true,user,db,classCode:profile.classCode||'',role:profile.role||'student',api});
    if(!profile.classCode){
      feedback.textContent='Google sign-in worked. Enter Mrs. Baker’s class code to finish setup.';
      if(!dialog.open)dialog.showModal();
    }else if(dialog.open){
      feedback.textContent=`You are ready for class ${profile.classCode}.`;
    }
  });
}
