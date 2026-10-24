const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, requireAuth } = require('../auth');

module.exports = function authRoutes(pool) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'name, email, password and role (teacher|student) are required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalized = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalized]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name.trim(), normalized, hash, role]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password_hash, created_at, ...safe } = user;
    res.json({ token: signToken(safe), user: safe });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  });

  return router;
};
