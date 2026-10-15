require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'education.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-change-this-session-secret-before-deploying',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const currentUser = req => req.session && req.session.user;
function requireAuth(req,res,next) {
  if (!currentUser(req)) return res.status(401).json({ error: 'Tizimga kiring.' });
  const user = db.prepare('SELECT id, username, role, display_name, active FROM users WHERE id=?').get(currentUser(req).id);
  if (!user || !user.active) { req.session.destroy(()=>{}); return res.status(401).json({ error:'Hisob faol emas.' }); }
  req.user = user; next();
}
function requireAdmin(req,res,next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error:'Bu amal faqat admin uchun.' });
  next();
}
function requireTeacher(req,res,next) {
  if (!req.user || req.user.role !== 'teacher') return res.status(403).json({ error:'Bu amal faqat o‘qituvchi uchun.' });
  next();
}
function teacherIdForUser(userId) {
  const t = db.prepare('SELECT id FROM teachers WHERE user_id=?').get(userId);
  return t && t.id;
}
function canAccessGroup(req, groupId) {
  if (req.user.role === 'admin') return true;
  const tid = teacherIdForUser(req.user.id);
  return !!tid && !!db.prepare('SELECT id FROM groups WHERE id=? AND teacher_id=?').get(groupId, tid);
}
function asInt(value) { const n = Number(value); return Number.isSafeInteger(n) ? n : NaN; }
function cleanText(v, max=200) { return String(v ?? '').trim().slice(0,max); }
function feeTotals(studentId, billingMonth) {
  const fee = db.prepare('SELECT * FROM monthly_fees WHERE student_id=? AND billing_month=?').get(studentId,billingMonth);
  if (!fee) return null;
  const p = db.prepare('SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE fee_id=? AND reversed=0').get(fee.id).paid;
  return {...fee, amount_paid:p, balance:Math.max(0,fee.amount_due-p), status:p>=fee.amount_due?'paid':p>0?'partial':(fee.due_date < new Date().toISOString().slice(0,10)?'overdue':'unpaid')};
}
function studentBalances(studentId) {
  const fees = db.prepare('SELECT * FROM monthly_fees WHERE student_id=? ORDER BY billing_month DESC').all(studentId);
  return fees.reduce((sum,f)=>sum+Math.max(0,f.amount_due-db.prepare('SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE fee_id=? AND reversed=0').get(f.id).paid),0);
}
function groupStudentQuery(groupId) {
  return db.prepare(`SELECT s.*, g.name AS group_name, g.course_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.group_id=? ORDER BY s.full_name`).all(groupId);
}
function feeForMonth(studentId, month) {
  return db.prepare('SELECT * FROM monthly_fees WHERE student_id=? AND billing_month=?').get(studentId, month);
}

app.post('/api/auth/login', (req,res) => {
  const username=cleanText(req.body.username,100), password=String(req.body.password||'');
  const user=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
  if (!user || !bcrypt.compareSync(password,user.password_hash)) return res.status(401).json({error:'Login yoki parol noto‘g‘ri.'});
  req.session.regenerate(err => {
    if(err) return res.status(500).json({error:'Sessiya yaratilmadi.'});
    req.session.user={id:user.id};
    res.json({user:{id:user.id,username:user.username,role:user.role,display_name:user.display_name}});
  });
});
app.post('/api/auth/logout', (req,res) => req.session.destroy(()=>res.json({ok:true})));
app.get('/api/auth/me', requireAuth, (req,res)=>res.json({user:{id:req.user.id,username:req.user.username,role:req.user.role,display_name:req.user.display_name}}));

app.get('/api/dashboard/stats', requireAuth, (req,res) => {
  if (req.user.role==='teacher') return res.status(403).json({error:'Admin statistikasi faqat admin uchun.'});
  const today=new Date().toISOString().slice(0,10), month=today.slice(0,7);
  const students=db.prepare("SELECT COUNT(*) n FROM students WHERE status='active'").get().n;
  const groups=db.prepare("SELECT COUNT(*) n FROM groups WHERE status='active'").get().n;
  const present=db.prepare("SELECT COUNT(*) n FROM attendance WHERE lesson_date=? AND status IN ('present','late')").get(today).n;
  const absent=db.prepare("SELECT COUNT(*) n FROM attendance WHERE lesson_date=? AND status='absent'").get(today).n;
  const income=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE reversed=0 AND substr(payment_date,1,7)=?").get(month).n;
  const expenses=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE substr(expense_date,1,7)=?").get(month).n;
  const debt=db.prepare(`SELECT COALESCE(SUM(f.amount_due - COALESCE(p.paid,0)),0) n FROM monthly_fees f LEFT JOIN (SELECT fee_id,SUM(amount) paid FROM payments WHERE reversed=0 GROUP BY fee_id) p ON p.fee_id=f.id`).get().n;
  const recentPayments=db.prepare(`SELECT p.*,s.full_name,g.name group_name FROM payments p JOIN students s ON s.id=p.student_id LEFT JOIN groups g ON g.id=p.group_id WHERE p.reversed=0 ORDER BY p.id DESC LIMIT 6`).all();
  const debtors=db.prepare(`SELECT s.id,s.full_name,g.name group_name, SUM(MAX(0,f.amount_due-COALESCE(p.paid,0))) debt FROM students s JOIN monthly_fees f ON f.student_id=s.id LEFT JOIN (SELECT fee_id,SUM(amount) paid FROM payments WHERE reversed=0 GROUP BY fee_id) p ON p.fee_id=f.id LEFT JOIN groups g ON g.id=s.group_id GROUP BY s.id HAVING debt>0 ORDER BY debt DESC LIMIT 8`).all();
  res.json({students,groups,present,absent,income,expenses,net:income-expenses,debt,recentPayments,debtors});
});

app.get('/api/groups', requireAuth, (req,res) => {
  if(req.user.role==='teacher') {
    const tid=teacherIdForUser(req.user.id);
    return res.json(db.prepare(`SELECT g.*, COUNT(DISTINCT s.id) student_count FROM groups g LEFT JOIN students s ON s.group_id=g.id AND s.status='active' WHERE g.teacher_id=? GROUP BY g.id ORDER BY g.name`).all(tid||-1));
  }
  res.json(db.prepare(`SELECT g.*, u.display_name teacher_name, COUNT(DISTINCT s.id) student_count,
    (SELECT COUNT(*) FROM students ds WHERE ds.group_id=g.id AND ds.status='active' AND EXISTS (SELECT 1 FROM monthly_fees f LEFT JOIN (SELECT fee_id,SUM(amount) paid FROM payments WHERE reversed=0 GROUP BY fee_id) p ON p.fee_id=f.id WHERE f.student_id=ds.id AND f.amount_due>COALESCE(p.paid,0))) debtors
    FROM groups g LEFT JOIN teachers t ON t.id=g.teacher_id LEFT JOIN users u ON u.id=t.user_id LEFT JOIN students s ON s.group_id=g.id AND s.status='active' GROUP BY g.id ORDER BY g.name`).all());
});
app.post('/api/groups', requireAuth, requireAdmin, (req,res) => {
  const b=req.body, name=cleanText(b.name,80);
  if(!name) return res.status(400).json({error:'Guruh nomini kiriting.'});
  const fee=asInt(b.monthly_fee||0); if(!Number.isSafeInteger(fee)||fee<0) return res.status(400).json({error:'Oylik narx noto‘g‘ri.'});
  try {
    const r=db.prepare(`INSERT INTO groups(name,course_name,teacher_id,schedule_days,start_time,end_time,room,monthly_fee,start_date,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(name,cleanText(b.course_name,100),b.teacher_id?asInt(b.teacher_id):null,cleanText(b.schedule_days,100),cleanText(b.start_time,10),cleanText(b.end_time,10),cleanText(b.room,40),fee,cleanText(b.start_date,10),b.status==='inactive'?'inactive':'active',cleanText(b.notes,500));
    res.status(201).json(db.prepare('SELECT * FROM groups WHERE id=?').get(r.lastInsertRowid));
  } catch(e) { res.status(400).json({error:e.message.includes('UNIQUE')?'Bu guruh nomi mavjud.':'Guruh yaratilmadi.'}); }
});
app.put('/api/groups/:id', requireAuth, requireAdmin, (req,res) => {
  const id=asInt(req.params.id), b=req.body, name=cleanText(b.name,80), fee=asInt(b.monthly_fee||0);
  if(!name||!Number.isSafeInteger(fee)||fee<0) return res.status(400).json({error:'Ma’lumotlarni tekshiring.'});
  try {
    const r=db.prepare(`UPDATE groups SET name=?,course_name=?,teacher_id=?,schedule_days=?,start_time=?,end_time=?,room=?,monthly_fee=?,start_date=?,status=?,notes=? WHERE id=?`)
      .run(name,cleanText(b.course_name,100),b.teacher_id?asInt(b.teacher_id):null,cleanText(b.schedule_days,100),cleanText(b.start_time,10),cleanText(b.end_time,10),cleanText(b.room,40),fee,cleanText(b.start_date,10),b.status==='inactive'?'inactive':'active',cleanText(b.notes,500),id);
    if(!r.changes) return res.status(404).json({error:'Guruh topilmadi.'});
    res.json(db.prepare('SELECT * FROM groups WHERE id=?').get(id));
  } catch(e) {res.status(400).json({error:'Guruhni saqlashda xato.'});}
});
app.delete('/api/groups/:id', requireAuth, requireAdmin, (req,res) => {
  const id=asInt(req.params.id);
  const has=db.prepare('SELECT COUNT(*) n FROM students WHERE group_id=?').get(id).n;
  if(has) { db.prepare("UPDATE groups SET status='inactive' WHERE id=?").run(id); return res.json({ok:true,archived:true}); }
  db.prepare('DELETE FROM groups WHERE id=?').run(id); res.json({ok:true});
});
app.get('/api/teachers', requireAuth, requireAdmin, (req,res)=>res.json(db.prepare(`SELECT t.*,u.username,u.display_name,u.active FROM teachers t JOIN users u ON u.id=t.user_id ORDER BY u.display_name`).all()));
app.post('/api/teachers', requireAuth, requireAdmin, (req,res)=>{
  const b=req.body, username=cleanText(b.username,80), password=String(b.password||''), name=cleanText(b.full_name,120);
  if(!username||password.length<8||!name) return res.status(400).json({error:'Ism, login va kamida 8 belgili parol kiriting.'});
  const create=db.transaction(()=>{
    const u=db.prepare('INSERT INTO users(username,password_hash,role,display_name,active) VALUES(?,?,?,?,1)').run(username,bcrypt.hashSync(password,12),'teacher',name);
    const t=db.prepare('INSERT INTO teachers(user_id,phone,specialization,notes) VALUES(?,?,?,?)').run(u.lastInsertRowid,cleanText(b.phone,40),cleanText(b.specialization,100),cleanText(b.notes,500));
    if(Array.isArray(b.group_ids)) for(const gid of b.group_ids) db.prepare('UPDATE groups SET teacher_id=? WHERE id=?').run(t.lastInsertRowid,asInt(gid));
    return t.lastInsertRowid;
  });
  try {const id=create();res.status(201).json(db.prepare(`SELECT t.*,u.username,u.display_name,u.active FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=?`).get(id));}
  catch(e){res.status(400).json({error:e.message.includes('UNIQUE')?'Bu login band.':'O‘qituvchi yaratilmadi.'});}
});
app.put('/api/teachers/:id', requireAuth, requireAdmin, (req,res)=>{
  const id=asInt(req.params.id), b=req.body, t=db.prepare('SELECT * FROM teachers WHERE id=?').get(id);
  if(!t) return res.status(404).json({error:'O‘qituvchi topilmadi.'});
  db.prepare('UPDATE teachers SET phone=?,specialization=?,notes=? WHERE id=?').run(cleanText(b.phone,40),cleanText(b.specialization,100),cleanText(b.notes,500),id);
  db.prepare('UPDATE users SET display_name=?,active=? WHERE id=?').run(cleanText(b.full_name,120),b.active===false?0:1,t.user_id);
  if(b.password && String(b.password).length>=8) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(b.password),12),t.user_id);
  if(Array.isArray(b.group_ids)) {
    db.prepare('UPDATE groups SET teacher_id=NULL WHERE teacher_id=?').run(id);
    for(const gid of b.group_ids) db.prepare('UPDATE groups SET teacher_id=? WHERE id=?').run(id,asInt(gid));
  }
  res.json({ok:true});
});

app.delete('/api/teachers/:id', requireAuth, requireAdmin, (req,res)=>{
  const id=asInt(req.params.id), t=db.prepare('SELECT * FROM teachers WHERE id=?').get(id);
  if(!t) return res.status(404).json({error:'O‘qituvchi topilmadi.'});
  const tx=db.transaction(()=>{
    db.prepare('UPDATE groups SET teacher_id=NULL WHERE teacher_id=?').run(id);
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(t.user_id);
    db.prepare('DELETE FROM teachers WHERE id=?').run(id);
  });
  tx(); res.json({ok:true});
});

app.get('/api/students', requireAuth, (req,res)=>{
  const groupId=req.query.group_id?asInt(req.query.group_id):null;
  const search=cleanText(req.query.search,100);
  let sql=`SELECT s.*,g.name group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE 1=1`, args=[];
  if(req.user.role==='teacher') {
    const tid=teacherIdForUser(req.user.id);
    sql+=' AND g.teacher_id=?'; args.push(tid||-1);
  }
  if(groupId){ if(!canAccessGroup(req,groupId)) return res.status(403).json({error:'Bu guruhga ruxsat yo‘q.'}); sql+=' AND s.group_id=?';args.push(groupId);}
  if(search){sql+=' AND (s.full_name LIKE ? OR s.phone LIKE ?)';args.push(`%${search}%`,`%${search}%`);}
  sql+=' ORDER BY s.full_name';
  res.json(db.prepare(sql).all(...args).map(s=>({...s,total_debt:studentBalances(s.id)})));
});
app.post('/api/students', requireAuth, requireAdmin, (req,res)=>{
  const b=req.body, name=cleanText(b.full_name,120), gid=asInt(b.group_id), fee=asInt(b.monthly_fee||0);
  if(!name||!Number.isSafeInteger(gid)||!Number.isSafeInteger(fee)||fee<0) return res.status(400).json({error:'Ism, guruh va to‘lov summasini tekshiring.'});
  const g=db.prepare('SELECT * FROM groups WHERE id=?').get(gid); if(!g) return res.status(400).json({error:'Guruh topilmadi.'});
  const r=db.prepare(`INSERT INTO students(full_name,phone,parent_phone,group_id,monthly_fee,enrollment_date,status,notes) VALUES(?,?,?,?,?,?,?,?)`)
    .run(name,cleanText(b.phone,40),cleanText(b.parent_phone,40),gid,fee,cleanText(b.enrollment_date,10)||new Date().toISOString().slice(0,10),b.status==='paused'?'paused':'active',cleanText(b.notes,500));
  res.status(201).json(db.prepare('SELECT s.*,g.name group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=?').get(r.lastInsertRowid));
});
app.put('/api/students/:id', requireAuth, requireAdmin, (req,res)=>{
  const b=req.body,id=asInt(req.params.id),fee=asInt(b.monthly_fee||0),gid=b.group_id?asInt(b.group_id):null;
  if(!cleanText(b.full_name,120)||!Number.isSafeInteger(fee)||fee<0) return res.status(400).json({error:'Ma’lumotlarni tekshiring.'});
  db.prepare(`UPDATE students SET full_name=?,phone=?,parent_phone=?,group_id=?,monthly_fee=?,enrollment_date=?,status=?,notes=? WHERE id=?`)
    .run(cleanText(b.full_name,120),cleanText(b.phone,40),cleanText(b.parent_phone,40),gid,fee,cleanText(b.enrollment_date,10),['active','paused','left'].includes(b.status)?b.status:'active',cleanText(b.notes,500),id);
  res.json({ok:true});
});
app.delete('/api/students/:id', requireAuth, requireAdmin, (req,res)=>{
  const id=asInt(req.params.id);
  const history=db.prepare('SELECT (SELECT COUNT(*) FROM payments WHERE student_id=?) + (SELECT COUNT(*) FROM attendance WHERE student_id=?) n').get(id,id).n;
  if(history){db.prepare("UPDATE students SET status='left' WHERE id=?").run(id);return res.json({ok:true,archived:true});}
  db.prepare('DELETE FROM students WHERE id=?').run(id);res.json({ok:true});
});

app.post('/api/monthly-fees/generate', requireAuth, requireAdmin, (req,res)=>{
  const month=cleanText(req.body.month,7);
  if(!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({error:'Oyni YYYY-MM formatida tanlang.'});
  const dueDate=cleanText(req.body.due_date,10)||`${month}-10`;
  const students=db.prepare("SELECT * FROM students WHERE status='active' AND enrollment_date<=?").all(`${month}-31`);
  const insert=db.prepare('INSERT OR IGNORE INTO monthly_fees(student_id,group_id,billing_month,amount_due,due_date) VALUES(?,?,?,?,?)');
  let count=0;
  const tx=db.transaction(()=>{for(const s of students){const r=insert.run(s.id,s.group_id,month,s.monthly_fee,dueDate);count+=r.changes;}});
  tx();res.json({ok:true,created:count});
});
app.get('/api/monthly-fees', requireAuth, (req,res)=>{
  const month=cleanText(req.query.month,7), groupId=req.query.group_id?asInt(req.query.group_id):null;
  let sql=`SELECT f.*,s.full_name,s.phone,g.name group_name,COALESCE(p.paid,0) amount_paid FROM monthly_fees f JOIN students s ON s.id=f.student_id LEFT JOIN groups g ON g.id=f.group_id LEFT JOIN (SELECT fee_id,SUM(amount) paid FROM payments WHERE reversed=0 GROUP BY fee_id) p ON p.fee_id=f.id WHERE 1=1`,args=[];
  if(req.user.role==='teacher'){const tid=teacherIdForUser(req.user.id);sql+=' AND g.teacher_id=?';args.push(tid||-1);}
  if(month){sql+=' AND f.billing_month=?';args.push(month);}
  if(groupId){if(!canAccessGroup(req,groupId))return res.status(403).json({error:'Ruxsat yo‘q.'});sql+=' AND f.group_id=?';args.push(groupId);}
  sql+=' ORDER BY f.due_date,s.full_name';
  res.json(db.prepare(sql).all(...args).map(f=>({...f,balance:Math.max(0,f.amount_due-f.amount_paid),status:f.amount_paid>=f.amount_due?'paid':f.amount_paid>0?'partial':f.due_date<new Date().toISOString().slice(0,10)?'overdue':'unpaid'})));
});
app.get('/api/debtors', requireAuth, (req,res)=>{
  const groupId=req.query.group_id?asInt(req.query.group_id):null;
  let sql=`SELECT f.*,s.full_name,s.phone,g.name group_name,COALESCE(p.paid,0) amount_paid FROM monthly_fees f JOIN students s ON s.id=f.student_id LEFT JOIN groups g ON g.id=f.group_id LEFT JOIN (SELECT fee_id,SUM(amount) paid FROM payments WHERE reversed=0 GROUP BY fee_id) p ON p.fee_id=f.id WHERE f.amount_due>COALESCE(p.paid,0)`,args=[];
  if(req.user.role==='teacher'){const tid=teacherIdForUser(req.user.id);sql+=' AND g.teacher_id=?';args.push(tid||-1);}
  if(groupId){if(!canAccessGroup(req,groupId))return res.status(403).json({error:'Ruxsat yo‘q.'});sql+=' AND f.group_id=?';args.push(groupId);}
  sql+=' ORDER BY f.due_date,s.full_name';
  res.json(db.prepare(sql).all(...args).map(f=>({...f,balance:f.amount_due-f.amount_paid,status:f.due_date<new Date().toISOString().slice(0,10)?'overdue':f.amount_paid?'partial':'unpaid'})));
});
app.post('/api/payments', requireAuth, requireAdmin, (req,res)=>{
  const b=req.body, studentId=asInt(b.student_id), amount=asInt(b.amount), feeId=b.fee_id?asInt(b.fee_id):null;
  if(!Number.isSafeInteger(studentId)||!Number.isSafeInteger(amount)||amount<=0) return res.status(400).json({error:'O‘quvchi va musbat to‘lov summasini kiriting.'});
  const student=db.prepare('SELECT * FROM students WHERE id=?').get(studentId);if(!student)return res.status(404).json({error:'O‘quvchi topilmadi.'});
  const transaction=db.transaction(()=>{
    let fee=feeId?db.prepare('SELECT * FROM monthly_fees WHERE id=? AND student_id=?').get(feeId,studentId):null;
    if(feeId&&!fee) throw new Error('fee');
    if(fee){const paid=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE fee_id=? AND reversed=0').get(fee.id).n;if(amount>fee.amount_due-paid)throw new Error('overpay');}
    db.prepare('INSERT INTO payments(student_id,group_id,fee_id,amount,payment_date,method,note,received_by) VALUES(?,?,?,?,?,?,?,?)')
      .run(studentId,fee?fee.group_id:student.group_id,fee?fee.id:null,amount,cleanText(b.payment_date,10)||new Date().toISOString().slice(0,10),['cash','card','transfer','other'].includes(b.method)?b.method:'cash',cleanText(b.note,300),req.user.id);
  });
  try{transaction();res.status(201).json({ok:true});}catch(e){res.status(400).json({error:e.message==='overpay'?'To‘lov qolgan qarzdan ko‘p.':'To‘lovni saqlab bo‘lmadi.'});}
});
app.get('/api/payments', requireAuth, (req,res)=>{
  if(req.user.role==='teacher')return res.status(403).json({error:'To‘lovlar faqat admin uchun.'});
  res.json(db.prepare(`SELECT p.*,s.full_name,g.name group_name,f.billing_month,u.display_name received_by_name FROM payments p JOIN students s ON s.id=p.student_id LEFT JOIN groups g ON g.id=p.group_id LEFT JOIN monthly_fees f ON f.id=p.fee_id LEFT JOIN users u ON u.id=p.received_by WHERE p.reversed=0 ORDER BY p.payment_date DESC,p.id DESC LIMIT 500`).all());
});
app.get('/api/expenses', requireAuth, requireAdmin, (req,res)=>res.json(db.prepare(`SELECT e.*,g.name group_name FROM expenses e LEFT JOIN groups g ON g.id=e.group_id ORDER BY e.expense_date DESC,e.id DESC LIMIT 500`).all()));
app.post('/api/expenses', requireAuth, requireAdmin, (req,res)=>{
  const b=req.body,amount=asInt(b.amount),description=cleanText(b.description,160);
  if(!description||!Number.isSafeInteger(amount)||amount<=0)return res.status(400).json({error:'Xarajat nomi va musbat summa kiriting.'});
  const r=db.prepare('INSERT INTO expenses(description,category,amount,expense_date,group_id,method,note,created_by) VALUES(?,?,?,?,?,?,?,?)').run(description,cleanText(b.category,60)||'Boshqa',amount,cleanText(b.expense_date,10)||new Date().toISOString().slice(0,10),b.group_id?asInt(b.group_id):null,['cash','card','transfer','other'].includes(b.method)?b.method:'cash',cleanText(b.note,300),req.user.id);
  res.status(201).json({id:r.lastInsertRowid,ok:true});
});
app.get('/api/teacher/dashboard', requireAuth, requireTeacher, (req,res)=>{
  const tid=teacherIdForUser(req.user.id);
  const groups=db.prepare(`SELECT g.*,COUNT(DISTINCT s.id) student_count FROM groups g LEFT JOIN students s ON s.group_id=g.id AND s.status='active' WHERE g.teacher_id=? GROUP BY g.id ORDER BY g.name`).all(tid||-1);
  const ids=groups.map(g=>g.id);const placeholders=ids.length?ids.map(()=>'?').join(','):'NULL';
  const today=new Date().toISOString().slice(0,10);
  const present=ids.length?db.prepare(`SELECT COUNT(*) n FROM attendance WHERE group_id IN (${placeholders}) AND lesson_date=? AND status IN ('present','late')`).get(...ids,today).n:0;
  const absent=ids.length?db.prepare(`SELECT COUNT(*) n FROM attendance WHERE group_id IN (${placeholders}) AND lesson_date=? AND status='absent'`).get(...ids,today).n:0;
  res.json({groups,group_count:groups.length,students:groups.reduce((a,g)=>a+g.student_count,0),present,absent,today});
});
app.get('/api/teacher/groups/:id/students', requireAuth, requireTeacher, (req,res)=>{
  const gid=asInt(req.params.id);if(!canAccessGroup(req,gid))return res.status(403).json({error:'Bu guruh sizga biriktirilmagan.'});
  res.json(groupStudentQuery(gid).map(s=>({id:s.id,full_name:s.full_name,phone:s.phone,status:s.status,group_name:s.group_name})));
});
app.get('/api/attendance', requireAuth, (req,res)=>{
  const date=cleanText(req.query.date,10)||new Date().toISOString().slice(0,10), groupId=req.query.group_id?asInt(req.query.group_id):null;
  if(!groupId)return res.status(400).json({error:'Guruhni tanlang.'});
  if(!canAccessGroup(req,groupId))return res.status(403).json({error:'Bu guruhga ruxsat yo‘q.'});
  const rows=db.prepare(`SELECT s.id student_id,s.full_name,a.id attendance_id,a.status,a.note FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.group_id=s.group_id AND a.lesson_date=? WHERE s.group_id=? AND s.status='active' ORDER BY s.full_name`).all(date,groupId);
  res.json(rows);
});
app.post('/api/attendance', requireAuth, (req,res)=>{
  if(!['admin','teacher'].includes(req.user.role))return res.status(403).json({error:'Ruxsat yo‘q.'});
  const gid=asInt(req.body.group_id), date=cleanText(req.body.lesson_date,10), records=req.body.records;
  if(!canAccessGroup(req,gid))return res.status(403).json({error:'Bu guruhga ruxsat yo‘q.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(records))return res.status(400).json({error:'Davomat ma’lumotlari noto‘g‘ri.'});
  const allowed=['present','absent','late','excused'];
  const save=db.transaction(()=>{
    for(const r of records){
      const sid=asInt(r.student_id),status=String(r.status);
      const student=db.prepare('SELECT id FROM students WHERE id=? AND group_id=? AND status=\'active\'').get(sid,gid);
      if(!student||!allowed.includes(status))throw new Error('invalid');
      db.prepare(`INSERT INTO attendance(student_id,group_id,lesson_date,status,note,created_by,updated_at) VALUES(?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(student_id,group_id,lesson_date) DO UPDATE SET status=excluded.status,note=excluded.note,created_by=excluded.created_by,updated_at=datetime('now')`)
      .run(sid,gid,date,status,cleanText(r.note,200),req.user.id);
    }
  });
  try{save();res.json({ok:true,saved:records.length});}catch(e){res.status(400).json({error:'Davomat saqlanmadi. O‘quvchilar guruhga tegishli ekanini tekshiring.'});}
});
app.get('/api/reports/finance', requireAuth, requireAdmin, (req,res)=>{
  const from=cleanText(req.query.from,10)||new Date().toISOString().slice(0,7)+'-01',to=cleanText(req.query.to,10)||new Date().toISOString().slice(0,10);
  const income=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE reversed=0 AND payment_date BETWEEN ? AND ?').get(from,to).n;
  const expenses=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE expense_date BETWEEN ? AND ?').get(from,to).n;
  res.json({income,expenses,net:income-expenses,from,to});
});

app.use('/api', (req,res)=>res.status(404).json({error:'API endpoint topilmadi.'}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Serverda kutilmagan xato yuz berdi.'});});
app.listen(PORT,()=>console.log(`Education Center CRM: http://localhost:${PORT}`));
