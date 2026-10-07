const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query(
`SELECT
   e.id,
   e.name,
   e.email,
   e.password_hash,
   e.role,
   e.work_profile,
   e.designation,
   e.specialty,
   b.branch_name,
   COALESCE(
  ARRAY_AGG(ewp.work_profile)
    FILTER (WHERE ewp.work_profile IS NOT NULL),
  ARRAY[e.work_profile]::VARCHAR[]
) AS work_profiles
 FROM employees e
 LEFT JOIN branches b ON b.id = e.branch_id
 LEFT JOIN employee_work_profiles ewp
   ON ewp.employee_id = e.id
 WHERE e.email = $1
   AND e.is_active = true
 GROUP BY
   e.id,
   e.name,
   e.email,
   e.password_hash,
   e.role,
   e.work_profile,
   e.designation,
   e.specialty,
   b.branch_name`,
  [email.toLowerCase().trim()]
);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

const payload = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  work_profile: user.work_profile,
  work_profiles: user.work_profiles,
  designation: user.designation,
  specialty: user.specialty
};
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.cookie('vjc_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.json({ user: { ...payload, branch_name: user.branch_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('vjc_token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
