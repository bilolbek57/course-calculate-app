const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { user:null, page:'dashboard', groupId:null, groupTab:'students', attendanceDate:new Date().toISOString().slice(0,10), selectedMonth:new Date().toISOString().slice(0,7), groups:[], students:[], teachers:[] };
const money = n => new Intl.NumberFormat('uz-UZ').format(Number(n||0))+' so‘m';
const dateUz = d => {try{return new Date(d+'T12:00:00').toLocaleDateString('uz-UZ',{day:'2-digit',month:'short',year:'numeric'})}catch{return d||'—'}};
const initials = name => String(name||'?').split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const statusLabel = s => ({paid:'To‘langan',partial:'Qisman',unpaid:'To‘lanmagan',overdue:'Muddati o‘tgan',present:'Keldi',absent:'Kelmadi',late:'Kechikdi',excused:'Sababli',active:'Faol',paused:'To‘xtatilgan',left:'Ketgan'}[s]||s||'—');
const badge = s => `<span class="badge badge-${esc(s)}">${esc(statusLabel(s))}</span>`;
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api = async (url, options={}) => {
  const res=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) { if(res.status===401 && !url.includes('/auth/login')) showLogin(); throw new Error(data.error||'So‘rov bajarilmadi.'); }
  return data;
};
function toast(message,type='success'){const el=document.createElement('div');el.className='toast '+type;el.textContent=message;$('#toastRoot').append(el);setTimeout(()=>el.remove(),3500)}
function showLogin(){state.user=null;$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden')}
function showApp(user){state.user=user;$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#userName').textContent=user.display_name;$('#userRole').textContent=user.role==='admin'?'Administrator':'O‘qituvchi';$('#userAvatar').textContent=initials(user.display_name);$('#todayLabel').textContent=new Date().toLocaleDateString('uz-UZ',{weekday:'short',day:'numeric',month:'short'});$$('.admin-only').forEach(e=>e.classList.toggle('hidden',user.role!=='admin'));if(user.role==='teacher'){$$('.nav-item[data-page="dashboard"]').forEach(e=>e.textContent='▦  Mening kabinetim');$$('.nav-item[data-page="groups"]').forEach(e=>e.textContent='▤  Mening guruhlarim');$$('.nav-item[data-page="students"], .nav-item[data-page="debtors"]').forEach(e=>e.classList.add('hidden'));}else{$$('.nav-item[data-page="dashboard"]').forEach(e=>e.innerHTML='<span class="nav-icon">▦</span> Dashboard');$$('.nav-item[data-page="groups"]').forEach(e=>e.innerHTML='<span class="nav-icon">▤</span> Guruhlar');$$('.nav-item[data-page="students"], .nav-item[data-page="debtors"]').forEach(e=>e.classList.remove('hidden'));}navigate('dashboard')}
async function boot(){try{const d=await api('/api/auth/me');showApp(d.user)}catch{showLogin()}}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:$('#loginUsername').value,password:$('#loginPassword').value})});showApp(d.user)}catch(err){$('#loginError').textContent=err.message}});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'})}finally{showLogin()}});
$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#navMenu').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){navigate(b.dataset.page);$('#sidebar').classList.remove('open')}});
function navigate(page){state.page=page;state.groupId=null;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const names={dashboard:state.user?.role==='teacher'?'Mening kabinetim':'Dashboard',groups:state.user?.role==='teacher'?'Mening guruhlarim':'Guruhlar',students:'O‘quvchilar',debtors:'Qarzdorlar',attendance:'Davomat',payments:'To‘lovlar',finance:'Kirim-chiqim',teachers:'O‘qituvchilar',reports:'Hisobotlar'};$('#pageCrumb').textContent=names[page]||page;renderPage(page).catch(e=>toast(e.message,'error'))}
async function renderPage(page){const root=$('#pageContent');root.innerHTML='<div class="empty-state">Yuklanmoqda...</div>';if(page==='dashboard')return state.user.role==='teacher'?renderTeacherDashboard():renderDashboard();if(page==='groups')return renderGroups();if(page==='students')return renderStudents();if(page==='debtors')return renderDebtors();if(page==='attendance')return renderAttendance();if(page==='payments')return renderPayments();if(page==='finance')return renderFinance();if(page==='teachers')return renderTeachers();if(page==='reports')return renderReports()}
function heading(title,sub,actions=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div><div class="heading-actions">${actions}</div></div>`}
function stat(label,value,icon,kind='',foot=''){return `<div class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${kind}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`}
function panel(title,sub,body,link=''){return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3>${sub?`<p>${sub}</p>`:''}</div>${link}</div>${body}</section>`}
function person(name,sub=''){return `<div class="person-cell"><span class="mini-avatar">${esc(initials(name))}</span><span><strong>${esc(name)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</span></div>`}
function empty(text='Hozircha ma’lumot yo‘q'){return `<div class="empty-state"><div class="empty-icon">◌</div><strong>${text}</strong><p>Ma’lumot qo‘shilgach shu yerda ko‘rinadi.</p></div>`}
async function renderDashboard(){
 const d=await api('/api/dashboard/stats');
 const max=Math.max(1,d.income,d.expenses);
 const bars=Array.from({length:6},(_,i)=>{const m=new Date();m.setMonth(m.getMonth()-(5-i));const key=m.toISOString().slice(0,7);return {label:m.toLocaleDateString('uz-UZ',{month:'short'}),income:key===new Date().toISOString().slice(0,7)?d.income:0,expenses:key===new Date().toISOString().slice(0,7)?d.expenses:0}});
 $('#pageContent').innerHTML=heading('Xush kelibsiz, '+esc(state.user.display_name.split(' ')[0])+' 👋','O‘quv markazingizning bugungi holati.',`<button class="btn btn-primary" onclick="openStudentModal()">＋ O‘quvchi qo‘shish</button>`)
 +`<div class="stats-grid">${stat('Faol o‘quvchilar',d.students,'♙','','Markaz bo‘yicha jami')}${stat('Faol guruhlar',d.groups,'▤','','Barcha guruhlar')}${stat('Shu oy tushum',money(d.income),'↗','green','Haqiqiy qabul qilingan to‘lov')}${stat('Shu oy xarajat',money(d.expenses),'↘','orange','Kiritilgan xarajatlar')}${stat('Bugun kelganlar',d.present,'✓','green','Keldi yoki kechikdi')}${stat('Bugun kelmaganlar',d.absent,'×','red','Davomat belgilangan darslar')}${stat('Jami qarzdorlik',money(d.debt),'!','red','O‘quvchilar to‘lashi kerak')}${stat('Sof pul oqimi',money(d.net),'◈','', 'Shu oy tushum − xarajat')}</div>`
 +`<div class="content-grid">${panel('Moliyaviy ko‘rinish','Joriy oy bo‘yicha haqiqiy kirim va chiqim',`<div class="chart-bars">${bars.map(b=>`<div class="bar-group"><div class="bar-pair"><div class="bar" style="height:${Math.max(3,b.income/max*130)}px" title="Kirim ${money(b.income)}"></div><div class="bar expense" style="height:${Math.max(3,b.expenses/max*130)}px" title="Chiqim ${money(b.expenses)}"></div></div><span class="bar-label">${b.label}</span></div>`).join('')}</div><div class="legend"><span><i></i>Kirim</span><span><i class="pale"></i>Chiqim</span></div>`)}${panel('So‘nggi to‘lovlar','Oxirgi qayd qilingan to‘lovlar',`<div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Summa</th></tr></thead><tbody>${d.recentPayments.map(p=>`<tr><td>${person(p.full_name,dateUz(p.payment_date))}</td><td>${esc(p.group_name||'—')}</td><td class="money">${money(p.amount)}</td></tr>`).join('')||'<tr><td colspan="3">Hali to‘lov yo‘q</td></tr>'}</tbody></table></div>`,`<button class="panel-link" onclick="navigate('payments')">Barchasi →</button>`)}</div>`
 +panel('Qarzdorlar','Eng katta qarzdorlikka ega o‘quvchilar',`<div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Qarzdorlik</th></tr></thead><tbody>${d.debtors.map(s=>`<tr><td>${person(s.full_name)}</td><td>${esc(s.group_name||'—')}</td><td class="debt-money">${money(s.debt)}</td></tr>`).join('')||'<tr><td colspan="3">Qarzdorlar yo‘q</td></tr>'}</tbody></table></div>`,`<button class="panel-link" onclick="navigate('debtors')">Barchasi →</button>`);
}
async function renderTeacherDashboard(){
 const d=await api('/api/teacher/dashboard');
 $('#pageContent').innerHTML=heading('Mening kabinetim, '+esc(state.user.display_name.split(' ')[0])+' 👋','Bugungi darslaringiz va guruhlaringiz.')
 +`<div class="stats-grid">${stat('Mening guruhlarim',d.group_count,'▤')}${stat('Faol o‘quvchilar',d.students,'♙')}${stat('Bugun kelganlar',d.present,'✓','green')}${stat('Bugun kelmaganlar',d.absent,'×','red')}</div>`
 +panel('Mening guruhlarim','Guruhni tanlab o‘quvchilar va davomatni ko‘ring.',`<div class="teacher-group-list">${d.groups.map(g=>`<div class="teacher-group-item"><div class="group-code">${esc(g.name)}</div><div style="flex:1"><strong>${esc(g.course_name||g.name)}</strong><small>${g.student_count} ta faol o‘quvchi · ${esc(g.schedule_days||'Jadval kiritilmagan')}</small></div><button class="btn btn-secondary btn-sm" onclick="openTeacherGroup(${g.id})">Ochish →</button></div>`).join('')||empty('Sizga guruh biriktirilmagan')}</div>`);
}
async function renderGroups(){
 const groups=await api('/api/groups');state.groups=groups;
 const teacher=state.user.role==='teacher';
 $('#pageContent').innerHTML=heading(teacher?'Mening guruhlarim':'Guruhlar',teacher?'Sizga biriktirilgan guruhlar.':'Har bir guruh alohida o‘quvchilar, davomat va to‘lovlar bilan boshqariladi.',teacher?'':`<button class="btn btn-primary" onclick="openGroupModal()">＋ Guruh qo‘shish</button>`)
 +`<div class="toolbar"><input id="groupSearch" placeholder="Guruh nomidan qidirish..."><select id="groupStatus"><option value="">Barcha holatlar</option><option value="active">Faol</option><option value="inactive">Faol emas</option></select><span class="spacer"></span><span class="muted">${groups.length} ta guruh</span></div><div class="group-grid" id="groupGrid">${groups.map(groupCard).join('')||empty('Hali guruhlar yaratilmagan')}</div>`;
 $('#groupSearch').addEventListener('input',filterGroupCards);$('#groupStatus').addEventListener('change',filterGroupCards);
}
function groupCard(g){return `<article class="group-card" data-name="${esc((g.name+' '+g.course_name).toLowerCase())}" data-status="${esc(g.status)}" onclick="openGroup(${g.id})"><div class="group-card-top"><div class="group-code">${esc(g.name)}</div>${badge(g.status)}</div><h3>${esc(g.course_name||g.name)}</h3><p>${esc(g.teacher_name||'O‘qituvchi biriktirilmagan')}</p><div class="group-metrics"><div><span>Faol o‘quvchilar</span><strong>${g.student_count||0} ta</strong></div><div><span>Oylik to‘lov</span><strong>${money(g.monthly_fee)}</strong></div></div><div class="group-card-foot"><span>${esc(g.schedule_days||'Jadval kiritilmagan')}</span><strong>Guruhni ochish ↗</strong></div></article>`}
function filterGroupCards(){const q=$('#groupSearch').value.toLowerCase(),s=$('#groupStatus').value;$$('#groupGrid .group-card').forEach(c=>c.classList.toggle('hidden',!(c.dataset.name.includes(q)&&(!s||c.dataset.status===s))))}
async function openGroup(id){state.groupId=id;state.groupTab='students';const g=state.groups.find(x=>x.id===id)||await api('/api/groups/'+id);renderGroupDetail(g)}
async function openTeacherGroup(id){state.groupId=id;state.groupTab='students';const g=(await api('/api/groups')).find(x=>x.id===id);renderGroupDetail(g)}
async function renderGroupDetail(g){
 const teacher=state.user.role==='teacher';
 $('#pageCrumb').textContent=g.name;
 $('#pageContent').innerHTML=heading(`<button class="panel-link" onclick="navigate('groups')">← Guruhlarga qaytish</button><br>${esc(g.name)} · ${esc(g.course_name||'')}`,`${esc(g.schedule_days||'Jadval kiritilmagan')} ${g.start_time?'· '+esc(g.start_time):''} ${g.room?'· '+esc(g.room):''}`,teacher?'':`<button class="btn btn-secondary" onclick="openGroupModal(${g.id})">✎ Tahrirlash</button><button class="btn btn-primary" onclick="openStudentModal(${g.id})">＋ O‘quvchi qo‘shish</button>`)
 +`<div class="tabs"><button class="tab-btn active" data-tab="students">O‘quvchilar</button><button class="tab-btn" data-tab="attendance">Davomat</button><button class="tab-btn" data-tab="fees">To‘lovlar</button><button class="tab-btn" data-tab="debtors">Qarzdorlar</button></div><div id="groupTabContent"></div>`;
 $$('.tab-btn').forEach(b=>b.addEventListener('click',()=>{state.groupTab=b.dataset.tab;$$('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));renderGroupTab(g)}));
 await renderGroupTab(g);
}
async function renderGroupTab(g){
 const root=$('#groupTabContent'),teacher=state.user.role==='teacher',tab=state.groupTab;
 if(tab==='students'){
   const students=teacher?await api(`/api/teacher/groups/${g.id}/students`):await api(`/api/students?group_id=${g.id}`);
   root.innerHTML=`<div class="toolbar"><input id="insideSearch" placeholder="O‘quvchini qidirish..."><span class="spacer"></span><span class="muted">${students.length} ta o‘quvchi</span></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Telefon</th>${teacher?'':'<th>Oylik</th><th>Qarz</th>'}<th>Holat</th>${teacher?'':'<th>Amallar</th>'}</tr></thead><tbody>${students.map(s=>`<tr><td>${person(s.full_name,'ID: '+s.id)}</td><td>${esc(s.phone||'—')}</td>${teacher?'':`<td>${money(s.monthly_fee)}</td><td class="${s.total_debt?'debt-money':'money'}">${money(s.total_debt)}</td>`}<td>${badge(s.status)}</td>${teacher?'':`<td><button class="btn btn-ghost btn-sm" onclick="openStudentModal(null,${s.id})">Tahrirlash</button></td>`}</tr>`).join('')||'<tr><td colspan="6">O‘quvchilar yo‘q</td></tr>'}</tbody></table></div></div>`;
   $('#insideSearch').addEventListener('input',e=>$$('#groupTabContent tbody tr').forEach(r=>r.classList.toggle('hidden',!r.textContent.toLowerCase().includes(e.target.value.toLowerCase()))));
 }else if(tab==='attendance'){
   root.innerHTML=`<div class="toolbar"><label class="muted">Dars sanasi <input type="date" id="attDate" value="${state.attendanceDate}"></label><button class="btn btn-secondary" onclick="loadGroupAttendance(${g.id})">Ko‘rsatish</button><span class="spacer"></span><button class="btn btn-primary" onclick="saveAttendance(${g.id})">Davomatni saqlash</button></div><div id="groupAttendance">${empty('Sanani tanlang')}</div>`;
   $('#attDate').addEventListener('change',e=>state.attendanceDate=e.target.value);await loadGroupAttendance(g.id);
 }else if(tab==='fees'||tab==='debtors'){
   const month=state.selectedMonth;
   const rows=await api(`/api/${tab==='fees'?'monthly-fees':'debtors'}?group_id=${g.id}${tab==='fees'?'&month='+month:''}`);
   root.innerHTML=`<div class="toolbar">${tab==='fees'?`<label class="muted">Oy <input type="month" id="groupFeeMonth" value="${month}"></label><button class="btn btn-secondary" onclick="loadGroupFees(${g.id})">Ko‘rsatish</button>`:''}<span class="spacer"></span>${teacher?'<span class="muted">Moliyaviy ma’lumotlar faqat admin uchun</span>':tab==='fees'?'<button class="btn btn-primary" onclick="generateFees()">＋ Oylik hisoblash</button>':''}</div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Oy</th><th>Hisoblangan</th><th>To‘langan</th><th>Qarz</th><th>Holat</th>${teacher?'':'<th>Amal</th>'}</tr></thead><tbody>${rows.map(f=>`<tr><td>${person(f.full_name)}</td><td>${esc(f.billing_month)}</td><td>${money(f.amount_due)}</td><td class="money">${money(f.amount_paid)}</td><td class="${f.balance?'debt-money':'money'}">${money(f.balance)}</td><td>${badge(f.status)}</td>${teacher?'':`<td>${f.balance?`<button class="btn btn-primary btn-sm" onclick="openPaymentModal(${f.student_id},${f.id},${f.balance})">To‘lov</button>`:'—'}</td>`}</tr>`).join('')||'<tr><td colspan="7">Ma’lumot yo‘q. Oylik to‘lovlarni hisoblang.</td></tr>'}</tbody></table></div></div>`;
   if($('#groupFeeMonth'))$('#groupFeeMonth').addEventListener('change',e=>state.selectedMonth=e.target.value);
 }
}
async function loadGroupAttendance(gid){
 const date=$('#attDate')?.value||state.attendanceDate;state.attendanceDate=date;
 const rows=await api(`/api/attendance?group_id=${gid}&date=${date}`);
 $('#groupAttendance').innerHTML=`<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Davomat holati</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${person(s.full_name)}</td><td><select class="filter-select attendance-choice" data-id="${s.student_id}"><option value="present" ${s.status==='present'?'selected':''}>Keldi</option><option value="absent" ${s.status==='absent'?'selected':''}>Kelmadi</option><option value="late" ${s.status==='late'?'selected':''}>Kechikdi</option><option value="excused" ${s.status==='excused'?'selected':''}>Sababli kelmadi</option></select></td></tr>`).join('')||'<tr><td colspan="2">Faol o‘quvchi yo‘q</td></tr>'}</tbody></table></div></div>`;
}
async function saveAttendance(gid){const records=$$('.attendance-choice').map(s=>({student_id:Number(s.dataset.id),status:s.value}));try{await api('/api/attendance',{method:'POST',body:JSON.stringify({group_id:gid,lesson_date:$('#attDate')?.value||state.attendanceDate,records})});toast('Davomat saqlandi.');}catch(e){toast(e.message,'error')}}
async function loadGroupFees(gid){state.selectedMonth=$('#groupFeeMonth').value;renderGroupTab(state.groups.find(g=>g.id===gid)||{id:gid,name:'Guruh'})}
async function renderStudents(){
 const [students,groups]=await Promise.all([api('/api/students'),api('/api/groups')]);state.students=students;state.groups=groups;
 $('#pageContent').innerHTML=heading('O‘quvchilar','Barcha o‘quvchilar, guruhlari va qarzdorligini boshqaring.',`<button class="btn btn-primary" onclick="openStudentModal()">＋ O‘quvchi qo‘shish</button>`)
 +`<div class="toolbar"><input id="studentSearch" placeholder="Ism yoki telefon bo‘yicha qidirish..."><select id="studentGroupFilter"><option value="">Barcha guruhlar</option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><select id="studentStatusFilter"><option value="">Barcha holatlar</option><option value="active">Faol</option><option value="paused">To‘xtatilgan</option><option value="left">Ketgan</option></select></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>O‘quvchi telefoni</th><th>Ota-ona telefoni</th><th>Oylik</th><th>Qarz</th><th>Holat</th><th>Amallar</th></tr></thead><tbody id="studentRows">${students.map(studentRow).join('')}</tbody></table></div></div>`;
 ['studentSearch','studentGroupFilter','studentStatusFilter'].forEach(id=>$('#'+id).addEventListener('input',filterStudents));
}
function studentRow(s){return `<tr data-search="${esc((s.full_name+' '+s.phone+' '+s.parent_phone).toLowerCase())}" data-group="${s.group_id||''}" data-status="${esc(s.status)}"><td>${person(s.full_name,'ID: '+s.id)}</td><td>${esc(s.group_name||'—')}</td><td>${esc(s.phone||'—')}</td><td>${esc(s.parent_phone||'—')}</td><td>${money(s.monthly_fee)}</td><td class="${s.total_debt?'debt-money':'money'}">${money(s.total_debt)}</td><td>${badge(s.status)}</td><td><button class="btn btn-ghost btn-sm" onclick="openStudentModal(null,${s.id})">Tahrirlash</button> <button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id}, '${esc(s.full_name).replaceAll("'", "\\'")}')">O‘chirish</button></td></tr>`}
async function deleteStudent(id,name){if(!confirm(`\"${name}\" o‘quvchisini o‘chirishni xohlaysizmi? To‘lov/davomat tarixi bo‘lsa, u arxivlanadi.`))return;try{const r=await api(`/api/students/${id}`,{method:'DELETE'});toast(r.archived?'O‘quvchida tarix borligi uchun arxivlandi.':'O‘quvchi o‘chirildi.');await renderStudents()}catch(e){toast(e.message,'error')}}
function filterStudents(){const q=$('#studentSearch').value.toLowerCase(),g=$('#studentGroupFilter').value,s=$('#studentStatusFilter').value;$$('#studentRows tr').forEach(r=>r.classList.toggle('hidden',!(r.dataset.search.includes(q)&&(!g||r.dataset.group===g)&&(!s||r.dataset.status===s))))}
async function renderDebtors(){
 const [rows,groups]=await Promise.all([api('/api/debtors'),api('/api/groups')]);
 $('#pageContent').innerHTML=heading('Qarzdorlar','To‘lov qoldig‘i bor barcha o‘quvchilar.',`<button class="btn btn-secondary" onclick="navigate('payments')">To‘lovlar tarixi ↗</button>`)
 +`<div class="toolbar"><input id="debtSearch" placeholder="O‘quvchini qidirish..."><select id="debtGroup"><option value="">Barcha guruhlar</option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><select id="debtStatus"><option value="">Barcha holatlar</option><option value="overdue">Muddati o‘tgan</option><option value="partial">Qisman to‘langan</option><option value="unpaid">To‘lanmagan</option></select><span class="spacer"></span><strong class="debt-money">${money(rows.reduce((a,r)=>a+r.balance,0))}</strong></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Oy</th><th>To‘lov</th><th>To‘langan</th><th>Qarz</th><th>Muddat</th><th>Holat</th><th></th></tr></thead><tbody id="debtRows">${rows.map(debtRow).join('')||'<tr><td colspan="9">Qarzdorlar yo‘q 🎉</td></tr>'}</tbody></table></div></div>`;
 ['debtSearch','debtGroup','debtStatus'].forEach(id=>$('#'+id).addEventListener('input',()=>filterDebtors(rows)));
}
function debtRow(r){return `<tr data-search="${esc((r.full_name+' '+r.phone).toLowerCase())}" data-group="${r.group_id||''}" data-status="${r.status}"><td>${person(r.full_name,r.phone)}</td><td>${esc(r.group_name||'—')}</td><td>${esc(r.billing_month)}</td><td>${money(r.amount_due)}</td><td>${money(r.amount_paid)}</td><td class="debt-money">${money(r.balance)}</td><td>${dateUz(r.due_date)}</td><td>${badge(r.status)}</td><td><button class="btn btn-primary btn-sm" onclick="openPaymentModal(${r.student_id},${r.id},${r.balance})">To‘lov</button></td></tr>`}
function filterDebtors(rows){const q=$('#debtSearch').value.toLowerCase(),g=$('#debtGroup').value,s=$('#debtStatus').value;$$('#debtRows tr').forEach(r=>r.classList.toggle('hidden',!(r.dataset.search.includes(q)&&(!g||r.dataset.group===g)&&(!s||r.dataset.status===s))))}
async function renderAttendance(){
 const groups=await api('/api/groups');state.groups=groups;
 $('#pageContent').innerHTML=heading('Davomat','Guruhni tanlang va darsga kelgan o‘quvchilarni belgilang.')
 +`<div class="toolbar"><select id="attendanceGroup" class="filter-select"><option value="">Guruhni tanlang</option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><input type="date" id="attendanceDate" value="${state.attendanceDate}"><button class="btn btn-secondary" id="loadAttendanceBtn">Ko‘rsatish</button><span class="spacer"></span><button class="btn btn-primary" id="saveAttendanceBtn">Davomatni saqlash</button></div><div id="attendanceContent">${empty('Guruhni tanlang')}</div>`;
 $('#loadAttendanceBtn').onclick=async()=>{const gid=Number($('#attendanceGroup').value);if(!gid)return toast('Avval guruhni tanlang.','error');state.attendanceDate=$('#attendanceDate').value;try{const rows=await api(`/api/attendance?group_id=${gid}&date=${state.attendanceDate}`);$('#attendanceContent').innerHTML=`<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Holat</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${person(s.full_name)}</td><td><select class="filter-select attendance-choice" data-id="${s.student_id}"><option value="present" ${s.status==='present'?'selected':''}>Keldi</option><option value="absent" ${s.status==='absent'?'selected':''}>Kelmadi</option><option value="late" ${s.status==='late'?'selected':''}>Kechikdi</option><option value="excused" ${s.status==='excused'?'selected':''}>Sababli kelmadi</option></select></td></tr>`).join('')||'<tr><td colspan="2">Faol o‘quvchi yo‘q</td></tr>'}</tbody></table></div></div>`}catch(e){toast(e.message,'error')}};
 $('#saveAttendanceBtn').onclick=async()=>{const gid=Number($('#attendanceGroup').value);if(!gid)return toast('Guruhni tanlang.','error');try{const records=$$('.attendance-choice').map(s=>({student_id:Number(s.dataset.id),status:s.value}));await api('/api/attendance',{method:'POST',body:JSON.stringify({group_id:gid,lesson_date:$('#attendanceDate').value,records})});toast('Davomat saqlandi.')}catch(e){toast(e.message,'error')}};
}
async function renderPayments(){
 const rows=await api('/api/payments');
 $('#pageContent').innerHTML=heading('To‘lovlar','O‘quvchilar tomonidan amalga oshirilgan haqiqiy to‘lovlar.',`<button class="btn btn-primary" onclick="openPaymentModal()">＋ To‘lov kiritish</button>`)
 +`<div class="toolbar"><input id="paymentSearch" placeholder="O‘quvchi yoki guruh..."><span class="spacer"></span><span class="muted">${rows.length} ta oxirgi yozuv</span></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘quvchi</th><th>Guruh</th><th>Oy</th><th>Sana</th><th>Usul</th><th>Summa</th></tr></thead><tbody id="paymentRows">${rows.map(p=>`<tr data-search="${esc((p.full_name+' '+p.group_name).toLowerCase())}"><td>${person(p.full_name)}</td><td>${esc(p.group_name||'—')}</td><td>${esc(p.billing_month||'Boshqa')}</td><td>${dateUz(p.payment_date)}</td><td>${esc(({cash:'Naqd',card:'Karta',transfer:'O‘tkazma',other:'Boshqa'})[p.method]||p.method)}</td><td class="money">${money(p.amount)}</td></tr>`).join('')||'<tr><td colspan="6">To‘lovlar hali kiritilmagan</td></tr>'}</tbody></table></div></div>`;
 $('#paymentSearch').addEventListener('input',e=>$$('#paymentRows tr').forEach(r=>r.classList.toggle('hidden',!r.dataset.search.includes(e.target.value.toLowerCase()))));
}
async function renderFinance(){
 const [expenses,groups,report]=await Promise.all([api('/api/expenses'),api('/api/groups'),api('/api/reports/finance')]);
 $('#pageContent').innerHTML=heading('Kirim-chiqim','Haqiqiy tushum va xarajatlarni nazorat qiling.',`<button class="btn btn-primary" onclick="openExpenseModal()">＋ Xarajat qo‘shish</button>`)
 +`<div class="stats-grid">${stat('Jami kirim',money(report.income),'↗','green')}${stat('Jami chiqim',money(report.expenses),'↘','orange')}${stat('Sof pul oqimi',money(report.net),'◈')}</div><div class="toolbar"><input id="expenseSearch" placeholder="Xarajatni qidirish..."><span class="spacer"></span><span class="muted">Kirim to‘lovlar modulidan avtomatik olinadi</span></div><div class="panel"><div class="panel-head"><h3>Xarajatlar tarixi</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Xarajat</th><th>Kategoriya</th><th>Guruh</th><th>Sana</th><th>Summa</th></tr></thead><tbody id="expenseRows">${expenses.map(e=>`<tr data-search="${esc((e.description+' '+e.category+' '+e.group_name).toLowerCase())}"><td>${esc(e.description)}</td><td>${esc(e.category)}</td><td>${esc(e.group_name||'Umumiy')}</td><td>${dateUz(e.expense_date)}</td><td class="debt-money">${money(e.amount)}</td></tr>`).join('')||'<tr><td colspan="5">Xarajatlar yo‘q</td></tr>'}</tbody></table></div></div>`;
 $('#expenseSearch').addEventListener('input',e=>$$('#expenseRows tr').forEach(r=>r.classList.toggle('hidden',!r.dataset.search.includes(e.target.value.toLowerCase()))));
}
async function renderTeachers(){
 const [teachers,groups]=await Promise.all([api('/api/teachers'),api('/api/groups')]);state.teachers=teachers;state.groups=groups;
 $('#pageContent').innerHTML=heading('O‘qituvchilar','Hisoblar yarating va o‘qituvchilarni guruhlarga biriktiring.',`<button class="btn btn-primary" onclick="openTeacherModal()">＋ O‘qituvchi qo‘shish</button>`)
 +`<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>O‘qituvchi</th><th>Mutaxassislik</th><th>Telefon</th><th>Login</th><th>Holat</th><th>Amal</th></tr></thead><tbody>${teachers.map(t=>`<tr><td>${person(t.display_name)}</td><td>${esc(t.specialization||'—')}</td><td>${esc(t.phone||'—')}</td><td>${esc(t.username)}</td><td>${badge(t.active?'active':'paused')}</td><td><button class="btn btn-ghost btn-sm" onclick="openTeacherModal(${t.id})">Tahrirlash</button> <button class="btn btn-danger btn-sm" onclick="deleteTeacher(${t.id}, '${esc(t.display_name).replaceAll("'", "\\'")}')">O‘chirish</button></td></tr>`).join('')||'<tr><td colspan="6">O‘qituvchilar hali qo‘shilmagan</td></tr>'}</tbody></table></div></div>`;
}
async function deleteTeacher(id,name){if(!confirm(`\"${name}\" o‘qituvchisini o‘chirishni xohlaysizmi? Uning akkaunti o‘chiriladi va guruhlari bo‘shatiladi.`))return;try{await api(`/api/teachers/${id}`,{method:'DELETE'});toast('O‘qituvchi o‘chirildi.');await renderTeachers()}catch(e){toast(e.message,'error')}}
async function renderReports(){
 const report=await api('/api/reports/finance');
 $('#pageContent').innerHTML=heading('Hisobotlar','Moliyaviy holat bo‘yicha umumiy hisobot.')
 +`<div class="toolbar"><label class="muted">Dan <input id="reportFrom" type="date" value="${report.from}"></label><label class="muted">Gacha <input id="reportTo" type="date" value="${report.to}"></label><button class="btn btn-secondary" onclick="loadReport()">Hisoblash</button></div><div id="reportStats" class="stats-grid">${stat('Haqiqiy kirim',money(report.income),'↗','green')}${stat('Xarajatlar',money(report.expenses),'↘','orange')}${stat('Sof pul oqimi',money(report.net),'◈')}</div><div class="inline-note">Hisobotdagi kirim faqat muvaffaqiyatli qayd qilingan to‘lovlardan hisoblanadi. To‘lanmagan qarz kirim hisoblanmaydi.</div>`;
}
async function loadReport(){const r=await api(`/api/reports/finance?from=${$('#reportFrom').value}&to=${$('#reportTo').value}`);$('#reportStats').innerHTML=stat('Haqiqiy kirim',money(r.income),'↗','green')+stat('Xarajatlar',money(r.expenses),'↘','orange')+stat('Sof pul oqimi',money(r.net),'◈')}
function modal(title,body){$('#modalRoot').innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body">${body}</div></div></div>`;$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()})}
function closeModal(){$('#modalRoot').innerHTML=''}
async function openGroupModal(id=null){
 if(!state.groups.length)state.groups=await api('/api/groups');
 const g=id?state.groups.find(x=>x.id===id)||await api('/api/groups/'+id):{};
 const teachers=await api('/api/teachers').catch(()=>[]);
 modal(id?'Guruhni tahrirlash':'Yangi guruh',`<form id="groupForm" class="form-grid">
 <label>Guruh nomi *<input name="name" required value="${esc(g.name||'')}" placeholder="G1"></label>
 <label>Kurs nomi<input name="course_name" value="${esc(g.course_name||'')}" placeholder="IELTS Beginner"></label>
 <label>O‘qituvchi<select name="teacher_id"><option value="">Biriktirilmagan</option>${teachers.map(t=>`<option value="${t.id}" ${g.teacher_id===t.id?'selected':''}>${esc(t.display_name)}</option>`).join('')}</select></label>
 <label>Oylik narx (so‘m)<input name="monthly_fee" type="number" min="0" required value="${g.monthly_fee||0}"></label>
 <label>Dars kunlari<input name="schedule_days" value="${esc(g.schedule_days||'')}" placeholder="Du, Chor, Jum"></label>
 <label>Xona<input name="room" value="${esc(g.room||'')}" placeholder="204-xona"></label>
 <label>Boshlanish vaqti<input name="start_time" type="time" value="${esc(g.start_time||'')}"></label>
 <label>Tugash vaqti<input name="end_time" type="time" value="${esc(g.end_time||'')}"></label>
 <label>Boshlangan sana<input name="start_date" type="date" value="${esc(g.start_date||'')}"></label>
 <label>Holati<select name="status"><option value="active" ${g.status!=='inactive'?'selected':''}>Faol</option><option value="inactive" ${g.status==='inactive'?'selected':''}>Faol emas</option></select></label>
 <label class="full">Izoh<textarea name="notes">${esc(g.notes||'')}</textarea></label>
 <div class="full modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Bekor qilish</button><button class="btn btn-primary">${id?'Saqlash':'Guruh yaratish'}</button></div></form>`);
 $('#groupForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.monthly_fee=Number(b.monthly_fee);b.teacher_id=b.teacher_id?Number(b.teacher_id):null;try{await api(id?`/api/groups/${id}`:'/api/groups',{method:id?'PUT':'POST',body:JSON.stringify(b)});closeModal();toast('Guruh saqlandi.');await renderGroups()}catch(err){toast(err.message,'error')}};
}
async function openStudentModal(groupId=null,studentId=null){
 const [groups,students]=await Promise.all([api('/api/groups'),api('/api/students')]);state.groups=groups;const s=studentId?students.find(x=>x.id===studentId):{};
 modal(studentId?'O‘quvchini tahrirlash':'Yangi o‘quvchi',`<form id="studentForm" class="form-grid">
 <label class="full">Ism-familiya *<input name="full_name" required value="${esc(s?.full_name||'')}" placeholder="Ali Valiyev"></label>
 <label>O‘quvchining telefoni<input name="phone" value="${esc(s?.phone||'')}" placeholder="+998 90 000 00 00"></label>
 <label>Ota-onasining telefoni<input name="parent_phone" value="${esc(s?.parent_phone||'')}" placeholder="+998 90 000 00 00"></label>
 <label class="full">Guruh *<select name="group_id" id="studentGroupSelect" required><option value="">Guruhni tanlang</option>${groups.map(g=>`<option value="${g.id}" data-fee="${g.monthly_fee}" ${(s?.group_id||groupId)===g.id?'selected':''}>${esc(g.name)} — ${esc(g.course_name||'')}</option>`).join('')}</select></label>
 <label>Oylik to‘lov (so‘m)<input name="monthly_fee" id="studentFee" type="number" min="0" required value="${s?.monthly_fee??''}"></label>
 <label>Boshlagan sana<input name="enrollment_date" type="date" value="${esc(s?.enrollment_date||new Date().toISOString().slice(0,10))}"></label>
 <label>Holati<select name="status"><option value="active" ${!s||s.status==='active'?'selected':''}>Faol</option><option value="paused" ${s?.status==='paused'?'selected':''}>To‘xtatilgan</option><option value="left" ${s?.status==='left'?'selected':''}>Ketgan</option></select></label>
 <label class="full">Izoh<textarea name="notes">${esc(s?.notes||'')}</textarea></label>
 <div class="full modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Bekor qilish</button><button class="btn btn-primary">${studentId?'Saqlash':'O‘quvchi qo‘shish'}</button></div></form>`);
 $('#studentGroupSelect').addEventListener('change',e=>{if(!$('#studentFee').value||Number($('#studentFee').value)===0)$('#studentFee').value=e.target.selectedOptions[0].dataset.fee||0});
 $('#studentForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.group_id=Number(b.group_id);b.monthly_fee=Number(b.monthly_fee);try{await api(studentId?`/api/students/${studentId}`:'/api/students',{method:studentId?'PUT':'POST',body:JSON.stringify(b)});closeModal();toast('O‘quvchi saqlandi.');if(state.page==='groups'&&state.groupId){const g=state.groups.find(x=>x.id===state.groupId);await renderGroupDetail(g)}else await renderStudents()}catch(err){toast(err.message,'error')}};
}
async function openPaymentModal(studentId=null,feeId=null,balance=null){
 const students=await api('/api/students');
 const feeOptions=studentId?await api('/api/monthly-fees').catch(()=>[]):[];
 const filtered=feeOptions.filter(f=>f.student_id===studentId&&f.balance>0);
 modal('To‘lovni qayd etish',`<form id="paymentForm" class="form-grid">
 <label class="full">O‘quvchi *<select name="student_id" id="paymentStudent" required><option value="">O‘quvchini tanlang</option>${students.filter(s=>s.status==='active').map(s=>`<option value="${s.id}" ${s.id===studentId?'selected':''}>${esc(s.full_name)} · ${esc(s.group_name||'')}</option>`).join('')}</select></label>
 <label class="full">Oylik to‘lov / qarz<select name="fee_id" id="paymentFee"><option value="">Aniq oylikka biriktirmaslik</option>${filtered.map(f=>`<option value="${f.id}" ${f.id===feeId?'selected':''}>${f.billing_month} · qarz ${money(f.balance)}</option>`).join('')}</select></label>
 <label>Summa (so‘m) *<input name="amount" type="number" min="1" required value="${balance||''}"></label>
 <label>Sana<input name="payment_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
 <label>To‘lov usuli<select name="method"><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">Bank o‘tkazmasi</option><option value="other">Boshqa</option></select></label>
 <label>Izoh<input name="note" placeholder="Ixtiyoriy"></label>
 <div class="full inline-note">Qarzga biriktirilgan to‘lov miqdori shu oylik qoldig‘idan oshmasligi kerak.</div>
 <div class="full modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Bekor qilish</button><button class="btn btn-primary">To‘lovni saqlash</button></div></form>`);
 $('#paymentStudent').addEventListener('change',()=>toast('Oylik to‘lovni tanlash uchun avval oylik hisobini yarating.','error'));
 $('#paymentForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.student_id=Number(b.student_id);b.amount=Number(b.amount);b.fee_id=b.fee_id?Number(b.fee_id):null;try{await api('/api/payments',{method:'POST',body:JSON.stringify(b)});closeModal();toast('To‘lov saqlandi.');navigate(state.page)}catch(err){toast(err.message,'error')}};
}
async function generateFees(){
 const month=state.selectedMonth||new Date().toISOString().slice(0,7);
 if(!confirm(`${month} oyi uchun faol o‘quvchilarga oylik to‘lov hisoblari yaratiladi. Davom etilsinmi?`))return;
 try{const d=await api('/api/monthly-fees/generate',{method:'POST',body:JSON.stringify({month})});toast(`${d.created} ta oylik hisob yaratildi.`);if(state.groupId)renderGroupDetail(state.groups.find(g=>g.id===state.groupId));else navigate('debtors')}catch(e){toast(e.message,'error')}
}
async function openExpenseModal(){
 const groups=await api('/api/groups');
 modal('Xarajat qo‘shish',`<form id="expenseForm" class="form-grid">
 <label class="full">Xarajat nomi *<input name="description" required placeholder="Ijara to‘lovi"></label>
 <label>Kategoriya<select name="category"><option>Ijara</option><option>O‘qituvchi oyligi</option><option>Kommunal</option><option>Internet</option><option>Reklama</option><option>Jihozlar</option><option>Boshqa</option></select></label>
 <label>Summa (so‘m) *<input name="amount" type="number" min="1" required></label>
 <label>Sana<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
 <label>Guruh<select name="group_id"><option value="">Umumiy xarajat</option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>
 <label>To‘lov usuli<select name="method"><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option><option value="other">Boshqa</option></select></label>
 <label class="full">Izoh<input name="note"></label>
 <div class="full modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Bekor qilish</button><button class="btn btn-primary">Xarajatni saqlash</button></div></form>`);
 $('#expenseForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));b.amount=Number(b.amount);b.group_id=b.group_id?Number(b.group_id):null;try{await api('/api/expenses',{method:'POST',body:JSON.stringify(b)});closeModal();toast('Xarajat saqlandi.');renderFinance()}catch(err){toast(err.message,'error')}};
}
async function openTeacherModal(id=null){
 const [teachers,groups]=await Promise.all([api('/api/teachers'),api('/api/groups')]);const t=id?teachers.find(x=>x.id===id):{};
 modal(id?'O‘qituvchini tahrirlash':'O‘qituvchi qo‘shish',`<form id="teacherForm" class="form-grid">
 <label class="full">Ism-familiya *<input name="full_name" required value="${esc(t?.display_name||'')}"></label>
 <label>Telefon<input name="phone" value="${esc(t?.phone||'')}"></label>
 <label>Mutaxassislik<input name="specialization" value="${esc(t?.specialization||'')}"></label>
 ${id?'':`<label>Login *<input name="username" required></label><label>Parol (kamida 8 belgi) *<input name="password" type="password" minlength="8" required></label>`}
 ${id?`<label>Yangi parol (ixtiyoriy)<input name="password" type="password" minlength="8" placeholder="O‘zgartirmaslik uchun bo‘sh qoldiring"></label><label>Holati<select name="active"><option value="true" ${t?.active?'selected':''}>Faol</option><option value="false" ${!t?.active?'selected':''}>Faol emas</option></select></label>`:''}
 <div class="full"><div class="subheading">Biriktiriladigan guruhlar</div>${groups.map(g=>`<label class="check-row"><input type="checkbox" name="group_ids" value="${g.id}" ${g.teacher_id===t?.id?'checked':''}> <span>${esc(g.name)} — ${esc(g.course_name||'')}</span></label>`).join('')||'<p class="muted">Avval guruh yarating.</p>'}</div>
 <div class="full modal-actions"><button type="button" class="btn btn-ghost" onclick="closeModal()">Bekor qilish</button><button class="btn btn-primary">${id?'Saqlash':'Hisob yaratish'}</button></div></form>`);
 $('#teacherForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),b=Object.fromEntries(fd);b.group_ids=fd.getAll('group_ids').map(Number);if(id)b.active=b.active==='true';try{await api(id?`/api/teachers/${id}`:'/api/teachers',{method:id?'PUT':'POST',body:JSON.stringify(b)});closeModal();toast('O‘qituvchi saqlandi.');renderTeachers()}catch(err){toast(err.message,'error')}};
}
window.navigate=navigate;window.openGroup=openGroup;window.openTeacherGroup=openTeacherGroup;window.openGroupModal=openGroupModal;window.openStudentModal=openStudentModal;window.openPaymentModal=openPaymentModal;window.openExpenseModal=openExpenseModal;window.openTeacherModal=openTeacherModal;window.closeModal=closeModal;window.generateFees=generateFees;window.loadGroupAttendance=loadGroupAttendance;window.saveAttendance=saveAttendance;window.loadGroupFees=loadGroupFees;window.loadReport=loadReport;
boot();
