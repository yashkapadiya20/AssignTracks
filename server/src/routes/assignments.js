const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const { getCourseAccess } = require('../access');
const { singleFile, removeFile } = require('../uploads');

// Mirrors Google Classroom: assigned -> missing (past due) -> submitted ("turned in") -> graded.
function submissionStatus(assignment, submission, now = new Date()) {
  if (submission && submission.marks != null) return 'graded';
  if (submission) return 'submitted';
  return new Date(assignment.due_date) < now ? 'missing' : 'assigned';
}

const isLate = (assignment, submission) =>
  !!submission && new Date(submission.submitted_at) > new Date(assignment.due_date);

function validateAssignment(body) {
  const { title, due_date, max_marks = 100 } = body;
  if (!title || !title.trim() || !due_date) return 'title and due_date are required';
  if (Number.isNaN(Date.parse(due_date))) return 'due_date is not a valid date';
  if (!Number.isInteger(Number(max_marks)) || Number(max_marks) <= 0) return 'max_marks must be a positive integer';
  return null;
}

module.exports = function assignmentRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  async function teacherView(assignments) {
    const { rows: subs } = await pool.query('SELECT assignment_id, marks FROM submissions');
    const { rows: enrollments } = await pool.query('SELECT course_id FROM enrollments');
    return assignments.map((a) => {
      const mine = subs.filter((s) => s.assignment_id === a.id);
      return {
        ...a,
        student_count: enrollments.filter((e) => e.course_id === a.course_id).length,
        submission_count: mine.length,
        graded_count: mine.filter((s) => s.marks != null).length,
      };
    });
  }

  async function studentView(assignments, studentId) {
    const { rows: subs } = await pool.query('SELECT * FROM submissions WHERE student_id = $1', [studentId]);
    return assignments.map((a) => {
      const submission = subs.find((s) => s.assignment_id === a.id) || null;
      return { ...a, submission, status: submissionStatus(a, submission), late: isLate(a, submission) };
    });
  }

  async function loadAssignment(id) {
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS course_name, c.teacher_id FROM assignments a
         JOIN courses c ON c.id = a.course_id WHERE a.id = $1`,
      [id]
    );
    return rows[0];
  }

  // Loads the assignment and checks the user may see it; sends the error response if not.
  async function authorize(req, res) {
    const assignment = await loadAssignment(Number(req.params.id));
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return null;
    }
    const access = await getCourseAccess(pool, assignment.course_id, req.user);
    if (access.error) {
      res.status(access.status).json({ error: access.error });
      return null;
    }
    return assignment;
  }

  router.get('/', async (req, res) => {
    const isTeacher = req.user.role === 'teacher';
    const { rows } = await pool.query(
      isTeacher
        ? `SELECT a.*, c.name AS course_name FROM assignments a JOIN courses c ON c.id = a.course_id
            WHERE c.teacher_id = $1 ORDER BY a.due_date`
        : `SELECT a.*, c.name AS course_name FROM assignments a
             JOIN courses c ON c.id = a.course_id
             JOIN enrollments e ON e.course_id = c.id
            WHERE e.student_id = $1 ORDER BY a.due_date`,
      [req.user.id]
    );
    const courseId = req.query.course_id ? Number(req.query.course_id) : null;
    const filtered = courseId ? rows.filter((a) => a.course_id === courseId) : rows;
    res.json(isTeacher ? await teacherView(filtered) : await studentView(filtered, req.user.id));
  });

  router.get('/:id', async (req, res) => {
    const assignment = await authorize(req, res);
    if (!assignment) return;
    const [view] =
      req.user.role === 'teacher' ? await teacherView([assignment]) : await studentView([assignment], req.user.id);
    res.json(view);
  });

  router.post('/', requireRole('teacher'), async (req, res) => {
    const body = req.body || {};
    if (!body.course_id) return res.status(400).json({ error: 'course_id is required' });
    const invalid = validateAssignment(body);
    if (invalid) return res.status(400).json({ error: invalid });

    const access = await getCourseAccess(pool, Number(body.course_id), req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { rows } = await pool.query(
      `INSERT INTO assignments (course_id, title, description, due_date, max_marks)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        access.course.id,
        body.title.trim(),
        (body.description || '').trim(),
        new Date(body.due_date).toISOString(),
        Number(body.max_marks ?? 100),
      ]
    );
    res.status(201).json(rows[0]);
  });

  router.put('/:id', requireRole('teacher'), async (req, res) => {
    const assignment = await authorize(req, res);
    if (!assignment) return;
    const body = { ...assignment, ...(req.body || {}) };
    const invalid = validateAssignment(body);
    if (invalid) return res.status(400).json({ error: invalid });

    const { rows } = await pool.query(
      `UPDATE assignments SET title = $1, description = $2, due_date = $3, max_marks = $4 WHERE id = $5 RETURNING *`,
      [body.title.trim(), (body.description || '').trim(), new Date(body.due_date).toISOString(), Number(body.max_marks), assignment.id]
    );
    res.json(rows[0]);
  });

  router.delete('/:id', requireRole('teacher'), async (req, res) => {
    const assignment = await authorize(req, res);
    if (!assignment) return;
    const { rows: files } = await pool.query(
      'SELECT file_path FROM submissions WHERE assignment_id = $1 AND file_path IS NOT NULL',
      [assignment.id]
    );
    await pool.query('DELETE FROM submissions WHERE assignment_id = $1', [assignment.id]);
    files.forEach((f) => removeFile(f.file_path));
    await pool.query('DELETE FROM assignments WHERE id = $1', [assignment.id]);
    res.status(204).end();
  });

  // Teacher "Student work" view: every enrolled student with their submission (or none).
  router.get('/:id/submissions', requireRole('teacher'), async (req, res) => {
    const assignment = await authorize(req, res);
    if (!assignment) return;

    const { rows: students } = await pool.query(
      `SELECT u.id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.student_id
        WHERE e.course_id = $1 ORDER BY u.name`,
      [assignment.course_id]
    );
    const { rows: subs } = await pool.query('SELECT * FROM submissions WHERE assignment_id = $1', [assignment.id]);
    res.json(
      students.map((s) => {
        const submission = subs.find((x) => x.student_id === s.id) || null;
        return {
          student_id: s.id,
          student_name: s.name,
          student_email: s.email,
          submission,
          status: submissionStatus(assignment, submission),
          late: isLate(assignment, submission),
        };
      })
    );
  });

  // Students turn in or update work (allowed until it has been graded).
  // Accepts JSON or multipart form data with an optional PDF/Word "file".
  router.post('/:id/submissions', requireRole('student'), singleFile, async (req, res) => {
    const file = req.file;
    // Drop the uploaded file whenever the request is rejected.
    const reject = (status, error) => {
      if (file) removeFile(file.filename);
      res.status(status).json({ error });
    };
    const content = String((req.body || {}).content || '').trim();
    const removeExisting = String((req.body || {}).remove_file) === 'true';

    const assignment = await authorize(req, res);
    if (!assignment) {
      if (file) removeFile(file.filename);
      return;
    }

    const { rows: found } = await pool.query('SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2', [
      assignment.id,
      req.user.id,
    ]);
    const existing = found[0];
    if (existing && existing.marks != null) return reject(409, 'Already graded; cannot resubmit');

    // A new upload replaces the old file; otherwise keep it unless the student removed it.
    const keepOld = existing && existing.file_path && !file && !removeExisting;
    const fileFields = file
      ? [file.originalname, file.filename, file.size]
      : keepOld
        ? [existing.file_name, existing.file_path, existing.file_size]
        : [null, null, null];
    if (!content && !fileFields[1]) return reject(400, 'Add some text or attach a file');

    if (existing) {
      const { rows } = await pool.query(
        `UPDATE submissions SET content = $1, file_name = $2, file_path = $3, file_size = $4, submitted_at = NOW()
          WHERE id = $5 RETURNING *`,
        [content, ...fileFields, existing.id]
      );
      if (existing.file_path && !keepOld) removeFile(existing.file_path);
      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, content, file_name, file_path, file_size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [assignment.id, req.user.id, content, ...fileFields]
    );
    res.status(201).json(rows[0]);
  });

  // Students can withdraw ("unsubmit") work that has not been graded yet.
  router.delete('/:id/submissions', requireRole('student'), async (req, res) => {
    const assignment = await authorize(req, res);
    if (!assignment) return;
    const { rows } = await pool.query('SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2', [
      assignment.id,
      req.user.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Nothing to unsubmit' });
    if (rows[0].marks != null) return res.status(409).json({ error: 'Already graded; cannot unsubmit' });
    await pool.query('DELETE FROM submissions WHERE id = $1', [rows[0].id]);
    removeFile(rows[0].file_path);
    res.status(204).end();
  });

  return router;
};

module.exports.submissionStatus = submissionStatus;
