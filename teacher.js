import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,isSignInWithEmailLink,onAuthStateChanged,sendSignInLinkToEmail,signInWithEmailLink,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {collection,deleteDoc,doc,getDoc,getDocs,getFirestore,limit,orderBy,query,serverTimestamp,setDoc,where} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const config=window.BAKER_FIREBASE_CONFIG;
const status=document.querySelector('#teacher-status');
const content=document.querySelector('#dashboard-content');
const teacherEmail='bakert4@manateeschools.net';
const emailStorageKey='bakerSignInEmail';
const todayKey=()=>new Date().toLocaleDateString('en-CA');
const state={demo:false,teacher:null,roster:[],rows:[],weekRows:[],leaderboard:[],selectedUid:null};
let db,auth;

const demoDate=todayKey();
const demoRoster=[
  {uid:'demo-a',displayName:'Ava Rivera',email:'ava@school.example',period:3,role:'student'},
  {uid:'demo-b',displayName:'Mason Chen',email:'mason@school.example',period:3,role:'student'},
  {uid:'demo-c',displayName:'Jordan Patel',email:'jordan@school.example',period:5,role:'student'},
  {uid:'demo-d',displayName:'Taylor Brooks',email:'taylor@school.example',period:5,role:'student'}
];
const demoRows=[
  {id:'demo-1',date:demoDate,studentName:'Ava Rivera',studentUid:'demo-a',period:3,standard:'ELA.6.R.2.4',label:'Argument',wordCount:72,confidence:3,prompt:'Should sixth-grade students have a short independent reading period every school day?',response:'Sixth-grade students should have independent reading time every day because it helps them discover books they enjoy and gives them regular practice. When students choose interesting books, they are more likely to keep reading. Daily practice can also help readers understand harder texts over time. A short reading period would make reading a normal part of the school day.',submittedAt:new Date()},
  {id:'demo-2',date:demoDate,studentName:'Mason Chen',studentUid:'demo-b',period:3,standard:'ELA.6.R.2.4',label:'Argument',wordCount:43,confidence:1,prompt:'Should sixth-grade students have a short independent reading period every school day?',response:'I think students should read every day because it can help them improve. It also gives people a quiet time to focus. Some students may find a book they really like. I still need help explaining my evidence more clearly.',editCount:1,editedAt:new Date(),submittedAt:new Date()},
  {id:'demo-3',date:schoolDaysEnding(demoDate,5)[2],studentName:'Jordan Patel',studentUid:'demo-c',period:5,standard:'ELA.6.V.1.2',label:'Vocabulary',wordCount:38,confidence:2,prompt:'What does reread mean?',response:'Reread means to read again. The prefix re- means again, so the word tells me the student reads the page another time.',submittedAt:new Date(Date.now()-864e5*3)}
];
const demoLeaderboard=[
  {uid:'demo-b',displayName:'Mason C.',period:3,bestStreak:7},
  {uid:'demo-a',displayName:'Ava R.',period:3,bestStreak:5}
];

document.querySelector('#date-filter').value=todayKey();

if(!config?.projectId){
  document.querySelector('#teacher-signin').disabled=true;
  status.textContent='The secure account database has not been connected yet.';
}else{
  const app=initializeApp(config);
  auth=getAuth(app);
  db=getFirestore(app);
  document.querySelector('#teacher-signin').addEventListener('click',async()=>{
    const email=document.querySelector('#teacher-email').value.trim().toLowerCase();
    if(email!==teacherEmail){status.textContent="Use Mrs. Baker's approved school email.";return}
    status.textContent='Sending a private sign-in link to Outlook...';
    try{
      await sendSignInLinkToEmail(auth,email,{url:`${location.origin}/teacher`,handleCodeInApp:true});
      localStorage.setItem(emailStorageKey,email);
      status.textContent='Link sent. Open the email in Outlook to finish signing in.';
    }catch(error){status.textContent=authMessage(error)}
  });
  if(isSignInWithEmailLink(auth,location.href)){
    const email=localStorage.getItem(emailStorageKey)||teacherEmail;
    status.textContent='Finishing teacher sign-in...';
    signInWithEmailLink(auth,email,location.href).then(()=>{
      localStorage.removeItem(emailStorageKey);
      history.replaceState(null,'','/teacher');
    }).catch(error=>{status.textContent=authMessage(error)});
  }
  document.querySelector('#teacher-signout').addEventListener('click',()=>signOut(auth));
  onAuthStateChanged(auth,async user=>{
    if(!user){content.hidden=true;document.querySelector('#auth-box').hidden=false;document.querySelector('#teacher-signout').hidden=true;return}
    state.demo=false;
    state.teacher={uid:user.uid,displayName:normalizeName(user.displayName||user.email||'Teacher')};
    try{
      let profile=await getDoc(doc(db,'users',user.uid));
      if(profile.data()?.role!=='teacher'&&user.email?.toLowerCase()===teacherEmail){
        await setDoc(doc(db,'users',user.uid),{displayName:state.teacher.displayName,email:user.email,role:'teacher',updatedAt:serverTimestamp()},{merge:true});
        profile=await getDoc(doc(db,'users',user.uid));
      }
      if(profile.data()?.role!=='teacher'){
        status.textContent='This account is not approved as the teacher account.';
        await signOut(auth);
        return;
      }
      document.querySelector('#auth-box').hidden=true;
      document.querySelector('#teacher-signout').hidden=false;
      content.hidden=false;
      status.textContent=`Signed in as ${state.teacher.displayName}.`;
      await loadToday();
      await loadData();
    }catch(error){
      status.textContent='Could not verify the teacher account. Check the network and Firestore rules.';
    }
  });
}

document.querySelector('#demo-dashboard').addEventListener('click',()=>{
  state.demo=true;
  state.teacher={uid:'demo-teacher',displayName:'Preview teacher'};
  state.roster=demoRoster.map(x=>({...x}));
  state.rows=demoRows.filter(x=>x.date===document.querySelector('#date-filter').value).map(x=>({...x}));
  state.weekRows=demoRows.map(x=>({...x}));
  state.leaderboard=demoLeaderboard.map(x=>({...x}));
  document.querySelector('#auth-box').hidden=true;
  content.hidden=false;
  populateFilters();
  renderAll();
  status.textContent='Preview mode: sample roster and submissions only. No student data is displayed.';
});

function authMessage(error){
  if(error?.code==='auth/invalid-action-code'||error?.code==='auth/expired-action-code')return 'That email link has expired or was already used. Request a new one.';
  if(error?.code==='auth/unauthorized-domain')return 'This Vercel domain still needs to be added to Firebase authorized domains.';
  if(error?.code==='auth/operation-not-allowed')return 'Email sign-in has not been enabled in Firebase yet.';
  return `Teacher sign-in could not finish${error?.code?` (${error.code.replace('auth/','')})`:''}.`;
}

async function loadData(){
  const date=document.querySelector('#date-filter').value||todayKey();
  if(state.demo){
    state.rows=demoRows.filter(x=>x.date===date).map(x=>({...x}));
    state.weekRows=demoRows.map(x=>({...x}));
    populateFilters();
    renderAll();
    status.textContent='Preview mode refreshed.';
    return;
  }
  if(!db)return;
  status.textContent='Loading roster and submissions...';
  try{
    const days=schoolDaysEnding(date,5);
    const rosterPromise=getDocs(query(collection(db,'users'),where('role','==','student')));
    const rowsPromise=getDocs(query(collection(db,'bellwork'),where('date','==',date)));
    const weekPromises=days.map(day=>getDocs(query(collection(db,'bellwork'),where('date','==',day))));
    const leaderboardPromise=getDocs(query(collection(db,'leaderboard'),orderBy('bestStreak','desc'),limit(10)));
    const [rosterSnap,rowsSnap,leaderboardSnap,...weekSnaps]=await Promise.all([rosterPromise,rowsPromise,leaderboardPromise,...weekPromises]);
    state.roster=rosterSnap.docs.map(x=>({uid:x.id,...x.data(),displayName:normalizeName(x.data().displayName||x.data().email||'Student')})).sort(byName);
    state.rows=rowsSnap.docs.map(x=>({id:x.id,...x.data()}));
    state.weekRows=weekSnaps.flatMap(snap=>snap.docs.map(x=>({id:x.id,...x.data()})));
    state.leaderboard=leaderboardSnap.docs.map(x=>({id:x.id,...x.data()}));
    populateFilters();
    renderAll();
    status.textContent=`Loaded ${state.rows.length} submission${state.rows.length===1?'':'s'} for ${date}.`;
  }catch(error){
    status.textContent='Could not load the dashboard. Check the network, sign-in, and Firestore rules.';
  }
}

async function loadToday(){
  if(!db)return;
  try{
    const snap=await getDoc(doc(db,'settings','today'));
    const s=snap.data()||{};
    if(s.date===todayKey()){
      document.querySelector('#announce-input').value=s.announcement||'';
      document.querySelector('#prompt-input').value=s.prompt||'';
      document.querySelector('#starter-input').value=s.starter||'';
    }
  }catch(e){}
}

function populateFilters(){
  const periodFilter=document.querySelector('#period-filter'),periodValue=periodFilter.value;
  const periods=[...new Set([...state.roster.map(x=>x.period),...state.rows.map(x=>x.period)].filter(Boolean))].sort((a,b)=>a-b);
  periodFilter.innerHTML='<option value="">All periods</option>'+periods.map(x=>`<option value="${escapeHtml(x)}">Period ${escapeHtml(x)}</option>`).join('');
  periodFilter.value=periods.map(String).includes(periodValue)?periodValue:'';

  const standardFilter=document.querySelector('#standard-filter'),standardValue=standardFilter.value;
  const standards=[...new Set(state.rows.map(x=>x.standard).filter(Boolean))].sort();
  standardFilter.innerHTML='<option value="">All standards</option>'+standards.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  standardFilter.value=standards.includes(standardValue)?standardValue:'';
}

function renderAll(){renderToday();renderWeek();renderLeaderboard();renderRosterAdmin()}

function renderToday(){
  const date=document.querySelector('#date-filter').value||todayKey();
  const note=document.querySelector('#school-day-note');
  note.hidden=!isWeekendKey(date);
  note.textContent=isWeekendKey(date)?'This selected date is a weekend. The board still shows roster status, but missing rows should not count against students.':'';
  const items=boardItems();
  const submitted=items.filter(x=>x.row),missing=items.filter(x=>!x.row),help=items.filter(x=>Number(x.row?.confidence)<=2),checked=items.filter(x=>x.row?.reviewedAt);
  document.querySelector('#submission-total').textContent=`${submitted.length}/${items.length}`;
  document.querySelector('#missing-total').textContent=missing.length;
  document.querySelector('#help-total').textContent=help.length;
  document.querySelector('#checked-total').textContent=checked.length;
  document.querySelector('#word-average').textContent=submitted.length?Math.round(submitted.reduce((n,x)=>n+(x.row.wordCount||0),0)/submitted.length):0;
  document.querySelector('#board-count').textContent=`${items.length} student${items.length===1?'':'s'} shown`;
  const groups=groupBy(items,x=>periodLabel(x.student.period||x.row?.period));
  document.querySelector('#completion-board').innerHTML=items.length?Object.entries(groups).map(([period,group])=>{
    const done=group.filter(x=>x.row).length;
    return `<section class="period-group"><h3>${escapeHtml(period)} <span>${done}/${group.length}</span></h3><div class="student-chips">${group.sort((a,b)=>byName(a.student,b.student)).map(renderChip).join('')}</div></section>`;
  }).join(''):'<p class="empty">No students match these filters.</p>';
  document.querySelectorAll('[data-student-chip]').forEach(button=>button.addEventListener('click',()=>showStudent(button.dataset.uid)));
}

function boardItems(){
  const period=document.querySelector('#period-filter').value;
  const standard=document.querySelector('#standard-filter').value;
  const needs=document.querySelector('#needs-filter').checked;
  const unreviewed=document.querySelector('#unreviewed-filter').checked;
  const edited=document.querySelector('#edited-filter').checked;
  const rows=rowMap(state.rows);
  return effectiveRoster().map(student=>({student,row:rows.get(student.uid)})).filter(({student,row})=>{
    const p=student.period||row?.period;
    if(period&&String(p)!==period)return false;
    if(standard&&row&&row.standard!==standard)return false;
    if(needs&&!(row&&Number(row.confidence)<=2))return false;
    if(unreviewed&&!(row&&!row.reviewedAt))return false;
    if(edited&&!(row&&row.editedAt))return false;
    return true;
  });
}

function renderChip({student,row}){
  const classes=['student-chip',row?'submitted':'missing'];
  if(row?.editedAt)classes.push('edited');
  if(Number(row?.confidence)<=2)classes.push('needs');
  if(row?.reviewedAt)classes.push('reviewed');
  const status=row?(row.reviewedAt?'✓✓':Number(row.confidence)<=2?'!':row.editedAt?'✎':'✓'):'□';
  const sub=row?`${row.wordCount||0} words · confidence ${row.confidence||'—'}/4`:'No submission yet';
  return `<button class="${classes.join(' ')}" data-student-chip data-uid="${escapeHtml(student.uid)}"><b>${status}</b><span>${escapeHtml(student.displayName||row?.studentName||'Student')}</span><small>${escapeHtml(sub)}</small></button>`;
}

async function showStudent(uid){
  state.selectedUid=uid;
  const student=effectiveRoster().find(x=>x.uid===uid)||{uid,displayName:'Student'};
  const row=rowMap(state.rows).get(uid);
  const detail=document.querySelector('#response-detail');
  detail.innerHTML='<p>Loading student history...</p>';
  const history=await loadStudentHistory(uid);
  const historyHtml=history.length?history.map(x=>`<li><b>${escapeHtml(x.date||'')}</b><span>${escapeHtml(x.label||x.standard||'Bell work')}</span><small>${x.wordCount||0} words · confidence ${x.confidence||'—'}/4</small></li>`).join(''):'<li><span>No previous submissions found.</span></li>';
  const responseHtml=row?`
    <p class="eyebrow">${escapeHtml(row.date||'')}</p>
    <h2>${escapeHtml(student.displayName||row.studentName||'Student')}</h2>
    <div class="response-meta">
      <span>${escapeHtml(periodLabel(student.period||row.period))}</span>
      <span>${escapeHtml(row.standard||'')}</span>
      <span>${row.wordCount||0} words</span>
      <span>Confidence ${row.confidence||'—'}/4</span>
      ${row.editedAt?`<span class="edited-tag">Edited ${escapeHtml(fmtTime(row.editedAt))}</span>`:''}
      ${row.reviewedAt?`<span class="reviewed-tag">Checked in ${escapeHtml(fmtTime(row.reviewedAt))}</span>`:''}
    </div>
    <h3>${escapeHtml(row.prompt||'')}</h3>
    <div class="response-copy">${escapeHtml(row.response||'')}</div>
    ${row.reviewedAt?'<p class="saved-note">This response has been checked in.</p>':'<button id="checkin-btn">Mark checked in</button>'}
  `:`
    <p class="eyebrow">${escapeHtml(document.querySelector('#date-filter').value||todayKey())}</p>
    <h2>${escapeHtml(student.displayName||'Student')}</h2>
    <div class="missing-detail">No submission yet for this date.</div>
  `;
  detail.innerHTML=responseHtml+`
    <section class="student-tools">
      <h3>Student quick fix</h3>
      <label>Display name<input id="fix-name" value="${escapeHtml(student.displayName||'')}"></label>
      <label>Period<select id="fix-period">${periodOptions(student.period||row?.period)}</select></label>
      <button id="save-student">Save student info</button>
      <span id="student-save-status"></span>
    </section>
    <section class="student-history">
      <h3>Recent history</h3>
      <ul>${historyHtml}</ul>
    </section>
  `;
  const check=document.querySelector('#checkin-btn');
  if(check)check.addEventListener('click',()=>checkIn(row));
  document.querySelector('#save-student').addEventListener('click',()=>saveStudentInfo(student.uid));
}

async function loadStudentHistory(uid){
  if(state.demo)return demoRows.filter(x=>x.studentUid===uid).sort(byDateDesc).slice(0,10);
  if(!db)return [];
  try{
    const snap=await getDocs(query(collection(db,'bellwork'),where('studentUid','==',uid)));
    return snap.docs.map(x=>({id:x.id,...x.data()})).sort(byDateDesc).slice(0,10);
  }catch(e){return []}
}

async function checkIn(row){
  if(!row)return;
  try{
    if(state.demo){
      row.reviewedAt=new Date();row.reviewedBy=state.teacher.uid;
    }else{
      await setDoc(doc(db,'bellwork',row.id),{reviewedAt:serverTimestamp(),reviewedBy:state.teacher?.uid||'teacher'},{merge:true});
      row.reviewedAt=new Date();row.reviewedBy=state.teacher?.uid||'teacher';
    }
    renderToday();
    showStudent(row.studentUid);
  }catch(e){status.textContent='Could not save the check-in. Try refreshing.'}
}

async function saveStudentInfo(uid){
  const name=normalizeName(document.querySelector('#fix-name').value);
  const period=Number(document.querySelector('#fix-period').value)||null;
  const statusEl=document.querySelector('#student-save-status');
  try{
    if(!state.demo)await setDoc(doc(db,'users',uid),{displayName:name,period,updatedAt:serverTimestamp()},{merge:true});
    state.roster=state.roster.map(x=>x.uid===uid?{...x,displayName:name,period}:x);
    state.rows=state.rows.map(x=>x.studentUid===uid?{...x,studentName:name,period}:x);
    state.weekRows=state.weekRows.map(x=>x.studentUid===uid?{...x,studentName:name,period}:x);
    statusEl.textContent='Saved.';
    populateFilters();
    renderAll();
    showStudent(uid);
  }catch(e){statusEl.textContent='Could not save.'}
}

function renderWeek(){
  const days=schoolDaysEnding(document.querySelector('#date-filter').value||todayKey(),5);
  document.querySelector('#week-range').textContent=`${days[0]} to ${days.at(-1)}`;
  const students=effectiveRoster().filter(s=>!document.querySelector('#period-filter').value||String(s.period||'')===document.querySelector('#period-filter').value).sort(byName);
  const rowsByUid=groupBy(state.weekRows,x=>x.studentUid);
  const head=`<div class="week-row week-head"><b>Student</b>${days.map(d=>`<b>${escapeHtml(shortDate(d))}</b>`).join('')}<b>Streak</b></div>`;
  const body=students.map(student=>{
    const studentRows=rowsByUid[student.uid]||[];
    const dates=new Set(studentRows.map(x=>x.date));
    return `<div class="week-row"><span>${escapeHtml(student.displayName||'Student')}</span>${days.map(day=>weekDot(studentRows.find(x=>x.date===day),dates.has(day))).join('')}<strong>${bellStreakFrom(studentRows,days.at(-1))}</strong></div>`;
  }).join('');
  document.querySelector('#week-matrix').innerHTML=students.length?head+body:'<p class="empty">No roster students match this period filter.</p>';
}

function weekDot(row,done){
  if(!done)return '<span class="week-dot missing" title="Missing">□</span>';
  if(row?.editedAt)return '<span class="week-dot edited" title="Edited">✎</span>';
  if(Number(row?.confidence)<=2)return '<span class="week-dot needs" title="Needs help">!</span>';
  return '<span class="week-dot done" title="Submitted">✓</span>';
}

function renderLeaderboard(){
  const list=document.querySelector('#leaderboard-admin-list');
  list.innerHTML=state.leaderboard.length?state.leaderboard.map((x,i)=>`<li><span><b>${i+1}. ${escapeHtml(x.displayName||'Student')}</b><small>${x.period?`Period ${escapeHtml(x.period)} · `:''}${x.bestStreak||0} in a row</small></span><button data-remove-leader="${escapeHtml(x.uid||x.id)}">Remove</button></li>`).join(''):'<li class="empty">No leaderboard rows yet.</li>';
  document.querySelectorAll('[data-remove-leader]').forEach(button=>button.addEventListener('click',()=>removeLeaderboard(button.dataset.removeLeader)));
}

async function removeLeaderboard(uid){
  if(!uid)return;
  try{
    if(!state.demo)await deleteDoc(doc(db,'leaderboard',uid));
    state.leaderboard=state.leaderboard.filter(x=>(x.uid||x.id)!==uid);
    renderLeaderboard();
    status.textContent='Leaderboard row removed.';
  }catch(e){status.textContent='Could not remove that leaderboard row.'}
}

function renderRosterAdmin(){
  const el=document.querySelector('#roster-list');
  const roster=effectiveRoster().sort(byName);
  el.innerHTML=roster.length?roster.map(student=>`<button data-roster-student="${escapeHtml(student.uid)}"><b>${escapeHtml(student.displayName||'Student')}</b><span>${escapeHtml(periodLabel(student.period))}</span></button>`).join(''):'<p class="empty">No student roster loaded yet.</p>';
  document.querySelectorAll('[data-roster-student]').forEach(button=>button.addEventListener('click',()=>{switchTab('today');showStudent(button.dataset.rosterStudent)}));
}

document.querySelector('#save-today').addEventListener('click',async()=>{
  const statusEl=document.querySelector('#today-status');
  if(state.demo||!db){statusEl.textContent='Preview mode — sign in to publish.';return}
  try{
    await setDoc(doc(db,'settings','today'),{date:todayKey(),announcement:document.querySelector('#announce-input').value.trim(),prompt:document.querySelector('#prompt-input').value.trim(),starter:document.querySelector('#starter-input').value.trim(),updatedAt:serverTimestamp()});
    statusEl.textContent='Published. Students will see it on their next page load.';
  }catch(e){statusEl.textContent='Publish failed — check that this account has the teacher role.'}
});

function exportCsv(){
  const date=document.querySelector('#date-filter').value||todayKey();
  const fields=['date','studentName','period','status','standard','label','submittedAt','editedAt','editCount','reviewedAt','wordCount','confidence','response'];
  const data=boardItems().map(({student,row})=>({
    date,studentName:student.displayName||row?.studentName||'Student',period:student.period||row?.period||'',status:row?'submitted':'missing',
    standard:row?.standard||'',label:row?.label||'',submittedAt:fmtTime(row?.submittedAt),editedAt:fmtTime(row?.editedAt),
    editCount:row?.editCount||'',reviewedAt:fmtTime(row?.reviewedAt),wordCount:row?.wordCount||'',confidence:row?.confidence||'',response:row?.response||''
  }));
  const csv=[fields.join(','),...data.map(row=>fields.map(field=>`"${String(row[field]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`bellwork-${date}.csv`;a.click();URL.revokeObjectURL(a.href);
}

document.querySelector('#refresh-data').addEventListener('click',loadData);
document.querySelector('#export-data').addEventListener('click',exportCsv);
document.querySelector('#date-filter').addEventListener('change',loadData);
['period-filter','standard-filter','needs-filter','unreviewed-filter','edited-filter'].forEach(id=>document.querySelector('#'+id).addEventListener('change',()=>{renderToday();renderWeek()}));
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));

function switchTab(name){
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
  document.querySelectorAll('.tab-panel').forEach(x=>{const active=x.id===`tab-${name}`;x.classList.toggle('active',active);x.hidden=!active});
}

function effectiveRoster(){
  const map=new Map(state.roster.map(x=>[x.uid,{...x,displayName:normalizeName(x.displayName||x.email||'Student')}]));
  state.rows.concat(state.weekRows).forEach(row=>{if(row.studentUid&&!map.has(row.studentUid))map.set(row.studentUid,{uid:row.studentUid,displayName:normalizeName(row.studentName||'Student'),period:row.period,role:'student'})});
  return [...map.values()];
}
function rowMap(rows){const map=new Map();rows.forEach(row=>{if(row.studentUid&&!map.has(row.studentUid))map.set(row.studentUid,row)});return map}
function periodLabel(period){return period?`Period ${period}`:'No period'}
function periodOptions(selected){return ['','1','2','3','4','5','6'].map(x=>`<option value="${x}" ${String(selected||'')===x?'selected':''}>${x?`Period ${x}`:'Choose period'}</option>`).join('')}
function normalizeName(raw){let name=String(raw||'Student').replace(/\s*[\[(].*?[\])]\s*/g,' ').replace(/\s+/g,' ').trim()||'Student';const comma=name.match(/^([^,]+),\s*(.+)$/);if(comma)name=`${comma[2]} ${comma[1]}`.replace(/\s+/g,' ').trim();return name}
function escapeHtml(value){const div=document.createElement('div');div.textContent=String(value??'');return div.innerHTML}
function byName(a,b){return normalizeName(a.displayName||a.studentName).localeCompare(normalizeName(b.displayName||b.studentName))}
function byDateDesc(a,b){return String(b.date||'').localeCompare(String(a.date||''))}
function groupBy(items,fn){return items.reduce((acc,item)=>{const key=fn(item);(acc[key]||(acc[key]=[])).push(item);return acc},{})}
function fmtTime(ts){try{const d=ts&&ts.toDate?ts.toDate():(ts?new Date(ts):null);return d?d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}catch(e){return ''}}
function parseKey(key){const [y,m,d]=String(key||todayKey()).split('-').map(Number);return new Date(y,m-1,d,12)}
function dateKeyFrom(d){return d.toLocaleDateString('en-CA')}
function prevSchool(d){const x=new Date(d);do{x.setDate(x.getDate()-1)}while([0,6].includes(x.getDay()));return x}
function isWeekendKey(key){return [0,6].includes(parseKey(key).getDay())}
function schoolDaysEnding(endKey,count){let d=parseKey(endKey);while([0,6].includes(d.getDay()))d=prevSchool(d);const days=[];while(days.length<count){days.push(dateKeyFrom(d));d=prevSchool(d)}return days.reverse()}
function shortDate(key){return parseKey(key).toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric'})}
function bellStreakFrom(items,endKey){const have=new Set(items.map(x=>x.date));let d=parseKey(endKey);if([0,6].includes(d.getDay())||!have.has(dateKeyFrom(d)))d=prevSchool(d);let n=0;while(have.has(dateKeyFrom(d))){n++;d=prevSchool(d)}return n}
