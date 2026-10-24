// Shared lookups for "can this user see this course/assignment?" checks.

async function getCourseAccess(pool, courseId, user) {
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS teacher_name FROM courses c JOIN users u ON u.id = c.teacher_id WHERE c.id = $1`,
    [courseId]
  );
  const course = rows[0];
  if (!course) return { status: 404, error: 'Course not found' };
  if (user.role === 'teacher') {
    return course.teacher_id === user.id ? { course } : { status: 403, error: 'Not your course' };
  }
  const enrolled = await pool.query('SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2', [
    courseId,
    user.id,
  ]);
  return enrolled.rows.length ? { course } : { status: 403, error: 'You are not enrolled in this course' };
}

module.exports = { getCourseAccess };
