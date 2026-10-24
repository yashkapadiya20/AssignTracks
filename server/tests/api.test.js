const request = require('supertest');
const { createPool } = require('../src/db');
const { createApp } = require('../src/app');
const { submissionStatus } = require('../src/routes/assignments');

let app, pool;

beforeAll(async () => {
  pool = await createPool(''); // force in-memory database
  app = createApp(pool);
});

afterAll(() => pool.end());

async function register(name, role) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: `${name}@example.com`, password: 'secret123', role });
  expect(res.status).toBe(201);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();

describe('submissionStatus', () => {
  const future = { due_date: inDays(1) };
  const past = { due_date: inDays(-1) };
  test.each([
    [future, null, 'assigned'],
    [past, null, 'missing'],
    [past, { marks: null }, 'submitted'],
    [future, { marks: 7 }, 'graded'],
  ])('%#', (a, s, expected) => expect(submissionStatus(a, s)).toBe(expected));
});

describe('Assignment Tracker API', () => {
  let teacher, student, outsider, otherTeacher;
  let course, assignmentId, pastAssignmentId, submissionId;

  test('health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('register and login', async () => {
    teacher = await register('teacher', 'teacher');
    otherTeacher = await register('other', 'teacher');
    student = await register('student', 'student');
    outsider = await register('outsider', 'student');

    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: 'teacher@example.com', password: 'secret123', role: 'teacher' });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/login').send({ email: 'teacher@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);

    const ok = await request(app).post('/api/auth/login').send({ email: 'TEACHER@example.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ role: 'teacher' });
    expect(ok.body.user.password_hash).toBeUndefined();
  });

  test('protected routes require a token', async () => {
    expect((await request(app).get('/api/courses')).status).toBe(401);
  });

  test('teacher creates a course with a class code; students cannot', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set(auth(teacher))
      .send({ name: 'Cloud Computing', description: 'CS-501' });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z2-9]{7}$/);
    course = res.body;

    const denied = await request(app).post('/api/courses').set(auth(student)).send({ name: 'Nope' });
    expect(denied.status).toBe(403);
  });

  test('student joins with the class code', async () => {
    const wrong = await request(app).post('/api/courses/join').set(auth(student)).send({ code: 'NOPE123' });
    expect(wrong.status).toBe(404);

    const res = await request(app)
      .post('/api/courses/join')
      .set(auth(student))
      .send({ code: course.code.toLowerCase() });
    expect(res.status).toBe(201);

    const again = await request(app).post('/api/courses/join').set(auth(student)).send({ code: course.code });
    expect(again.status).toBe(409);

    const list = await request(app).get('/api/courses').set(auth(student));
    expect(list.body).toEqual([expect.objectContaining({ id: course.id, teacher_name: 'teacher', student_count: 1 })]);

    const none = await request(app).get('/api/courses').set(auth(outsider));
    expect(none.body).toEqual([]);
  });

  test('course detail is limited to members', async () => {
    const res = await request(app).get(`/api/courses/${course.id}`).set(auth(teacher));
    expect(res.body.students).toEqual([expect.objectContaining({ name: 'student' })]);

    expect((await request(app).get(`/api/courses/${course.id}`).set(auth(outsider))).status).toBe(403);
    expect((await request(app).get(`/api/courses/${course.id}`).set(auth(otherTeacher))).status).toBe(403);
  });

  test('teacher creates assignments; other teachers cannot', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set(auth(teacher))
      .send({ course_id: course.id, title: 'EC2 Report', due_date: inDays(7), max_marks: 50 });
    expect(res.status).toBe(201);
    assignmentId = res.body.id;

    const past = await request(app)
      .post('/api/assignments')
      .set(auth(teacher))
      .send({ course_id: course.id, title: 'Quiz 1', due_date: inDays(-2), max_marks: 10 });
    pastAssignmentId = past.body.id;

    const missing = await request(app).post('/api/assignments').set(auth(teacher)).send({ course_id: course.id });
    expect(missing.status).toBe(400);

    const foreign = await request(app)
      .post('/api/assignments')
      .set(auth(otherTeacher))
      .send({ course_id: course.id, title: 'x', due_date: inDays(1) });
    expect(foreign.status).toBe(403);
  });

  test('student sees assigned and missing work; outsider sees none', async () => {
    const res = await request(app).get('/api/assignments').set(auth(student));
    const byId = Object.fromEntries(res.body.map((a) => [a.id, a]));
    expect(byId[assignmentId]).toMatchObject({ status: 'assigned', submission: null });
    expect(byId[pastAssignmentId]).toMatchObject({ status: 'missing' });

    expect((await request(app).get('/api/assignments').set(auth(outsider))).body).toEqual([]);
    expect((await request(app).get(`/api/assignments/${assignmentId}`).set(auth(outsider))).status).toBe(403);
  });

  test('student turns in, updates and unsubmits; outsider cannot submit', async () => {
    const url = `/api/assignments/${assignmentId}/submissions`;
    const first = await request(app).post(url).set(auth(student)).send({ content: 'draft' });
    expect(first.status).toBe(201);

    const again = await request(app).post(url).set(auth(student)).send({ content: 'final answer' });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: first.body.id, content: 'final answer' });
    submissionId = again.body.id;

    expect((await request(app).post(url).set(auth(outsider)).send({ content: 'hi' })).status).toBe(403);

    const late = await request(app)
      .post(`/api/assignments/${pastAssignmentId}/submissions`)
      .set(auth(student))
      .send({ content: 'sorry' });
    expect(late.status).toBe(201);
    const view = await request(app).get(`/api/assignments/${pastAssignmentId}`).set(auth(student));
    expect(view.body).toMatchObject({ status: 'submitted', late: true });

    const unsubmit = await request(app)
      .delete(`/api/assignments/${pastAssignmentId}/submissions`)
      .set(auth(student));
    expect(unsubmit.status).toBe(204);
  });

  test('teacher sees student work with counts', async () => {
    const list = await request(app).get('/api/assignments').set(auth(teacher));
    expect(list.body.find((a) => a.id === assignmentId)).toMatchObject({
      student_count: 1,
      submission_count: 1,
      graded_count: 0,
    });

    const work = await request(app).get(`/api/assignments/${pastAssignmentId}/submissions`).set(auth(teacher));
    expect(work.body).toEqual([expect.objectContaining({ student_name: 'student', status: 'missing', submission: null })]);
  });

  test('teacher grades with marks and feedback', async () => {
    const tooHigh = await request(app)
      .put(`/api/submissions/${submissionId}/grade`)
      .set(auth(teacher))
      .send({ marks: 51 });
    expect(tooHigh.status).toBe(400);

    const res = await request(app)
      .put(`/api/submissions/${submissionId}/grade`)
      .set(auth(teacher))
      .send({ marks: 45, feedback: 'Great work' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ marks: 45, feedback: 'Great work' });
  });

  test('student sees grade and cannot resubmit or unsubmit', async () => {
    const res = await request(app).get(`/api/assignments/${assignmentId}`).set(auth(student));
    expect(res.body).toMatchObject({ status: 'graded', late: false });
    expect(res.body.submission).toMatchObject({ marks: 45, feedback: 'Great work' });

    const url = `/api/assignments/${assignmentId}/submissions`;
    expect((await request(app).post(url).set(auth(student)).send({ content: 'x' })).status).toBe(409);
    expect((await request(app).delete(url).set(auth(student))).status).toBe(409);
  });

  test('teacher edits and deletes an assignment', async () => {
    const edit = await request(app)
      .put(`/api/assignments/${pastAssignmentId}`)
      .set(auth(teacher))
      .send({ due_date: inDays(3) });
    expect(edit.status).toBe(200);
    expect(new Date(edit.body.due_date) > new Date()).toBe(true);

    const del = await request(app).delete(`/api/assignments/${pastAssignmentId}`).set(auth(teacher));
    expect(del.status).toBe(204);
    expect((await request(app).get(`/api/assignments/${pastAssignmentId}`).set(auth(teacher))).status).toBe(404);
  });
});
