const express = require('express');
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../auth');
const { getCourseAccess } = require('../access');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I confusion

function makeCode() {
  return Array.from(crypto.randomBytes(7), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

module.exports = function courseRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  // Teachers see courses they teach; students see courses they have joined.
  router.get('/', async (req, res) => {
    const isTeacher = req.user.role === 'teacher';
    const { rows: courses } = await pool.query(
      isTeacher
        ? `SELECT c.*, u.name AS teacher_name FROM courses c JOIN users u ON u.id = c.teacher_id
            WHERE c.teacher_id = $1 ORDER BY c.id`
        : `SELECT c.*, u.name AS teacher_name FROM courses c
             JOIN users u ON u.id = c.teacher_id
             JOIN enrollments e ON e.course_id = c.id
            WHERE e.student_id = $1 ORDER BY c.id`,
      [req.user.id]
    );
    const { rows: enrollments } = await pool.query('SELECT course_id FROM enrollments');
    const { rows: assignments } = await pool.query('SELECT course_id FROM assignments');
    const countBy = (list, id) => list.filter((r) => r.course_id === id).length;
    res.json(
      courses.map((c) => ({
        ...c,
        student_count: countBy(enrollments, c.id),
        assignment_count: countBy(assignments, c.id),
      }))
    );
  });

  router.get('/:id', async (req, res) => {
    const access = await getCourseAccess(pool, Number(req.params.id), req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { rows: students } = await pool.query(
      `SELECT u.id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.student_id
        WHERE e.course_id = $1 ORDER BY u.name`,
      [access.course.id]
    );
    res.json({ ...access.course, student_count: students.length, students });
  });

  router.post('/', requireRole('teacher'), async (req, res) => {
    const { name, description = '' } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const clash = await pool.query('SELECT 1 FROM courses WHERE code = $1', [code]);
      if (clash.rows.length) continue;
      const { rows } = await pool.query(
        'INSERT INTO courses (name, description, code, teacher_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [name.trim(), description.trim(), code, req.user.id]
      );
      return res.status(201).json({ ...rows[0], teacher_name: req.user.name, student_count: 0, assignment_count: 0 });
    }
    res.status(500).json({ error: 'Could not generate a class code, please retry' });
  });

  // Students join with the class code their teacher shares.
  router.post('/join', requireRole('student'), async (req, res) => {
    const code = String((req.body || {}).code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Class code is required' });

    const { rows } = await pool.query('SELECT * FROM courses WHERE code = $1', [code]);
    const course = rows[0];
    if (!course) return res.status(404).json({ error: 'No class found with that code' });

    const existing = await pool.query('SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2', [
      course.id,
      req.user.id,
    ]);
    if (existing.rows.length) return res.status(409).json({ error: `You are already in ${course.name}` });

    await pool.query('INSERT INTO enrollments (course_id, student_id) VALUES ($1, $2)', [course.id, req.user.id]);
    res.status(201).json(course);
  });

  return router;
};
