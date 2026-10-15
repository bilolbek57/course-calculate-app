require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  console.log(`Admin "${username}" already exists. No changes made.`);
} else {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (username, password_hash, role, display_name, active) VALUES (?, ?, ?, ?, 1)')
    .run(username, hash, 'admin', 'Administrator');
  console.log(`Admin created: ${username}`);
  console.log('Set ADMIN_PASSWORD in .env before using this on a real network.');
}
db.close();
