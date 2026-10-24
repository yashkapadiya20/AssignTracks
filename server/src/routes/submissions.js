const express = require('express');
const { requireAuth, requireRole } = require('../auth');

module.exports = function submissionRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.put('/:id/grade', requireRole('teacher'), async (req, res) => {
    const { marks, feedback = '' } = req.body || {};
    const { rows } = await pool.query(
      `SELECT s.id, a.max_marks, c.teacher_id
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
        WHERE s.id = $1`,
      [Number(req.params.id)]
    );
    const sub = rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (sub.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your course' });

    const value = Number(marks);
    if (!Number.isInteger(value) || value < 0 || value > sub.max_marks) {
      return res.status(400).json({ error: `marks must be an integer between 0 and ${sub.max_marks}` });
    }

    const updated = await pool.query(
      'UPDATE submissions SET marks = $1, feedback = $2, graded_at = NOW() WHERE id = $3 RETURNING *',
      [value, feedback, sub.id]
    );
    res.json(updated.rows[0]);
  });

  return router;
};
