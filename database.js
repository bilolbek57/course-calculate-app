const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dir = path.join(__dirname, 'database');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'education-center.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','teacher')),
 display_name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS teachers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
 phone TEXT DEFAULT '',
 specialization TEXT DEFAULT '',
 notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS groups (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 course_name TEXT DEFAULT '',
 teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
 schedule_days TEXT DEFAULT '',
 start_time TEXT DEFAULT '',
 end_time TEXT DEFAULT '',
 room TEXT DEFAULT '',
 monthly_fee INTEGER NOT NULL DEFAULT 0,
 start_date TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active',
 notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS students (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 full_name TEXT NOT NULL,
 phone TEXT DEFAULT '',
 parent_phone TEXT DEFAULT '',
 group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
 monthly_fee INTEGER NOT NULL DEFAULT 0,
 enrollment_date TEXT NOT NULL DEFAULT (date('now')),
 status TEXT NOT NULL DEFAULT 'active',
 notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS monthly_fees (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL REFERENCES students(id),
 group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
 billing_month TEXT NOT NULL,
 amount_due INTEGER NOT NULL CHECK(amount_due >= 0),
 due_date TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(student_id, billing_month)
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL REFERENCES students(id),
 group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
 fee_id INTEGER REFERENCES monthly_fees(id),
 amount INTEGER NOT NULL CHECK(amount > 0),
 payment_date TEXT NOT NULL,
 method TEXT NOT NULL DEFAULT 'cash',
 note TEXT DEFAULT '',
 received_by INTEGER REFERENCES users(id),
 reversed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS attendance (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL REFERENCES students(id),
 group_id INTEGER NOT NULL REFERENCES groups(id),
 lesson_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
 note TEXT DEFAULT '',
 created_by INTEGER REFERENCES users(id),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(student_id, group_id, lesson_date)
);
CREATE TABLE IF NOT EXISTS expenses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 description TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'Boshqa',
 amount INTEGER NOT NULL CHECK(amount > 0),
 expense_date TEXT NOT NULL,
 group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
 method TEXT NOT NULL DEFAULT 'cash',
 note TEXT DEFAULT '',
 created_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_fees_month ON monthly_fees(billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(lesson_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
`);

module.exports = db;
