import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CalendarClock, ChevronRight, Pencil, Trash2, Users } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../lib/api.js';
import { dueLabel, formatDateTime, percent, urgency } from '../lib/format.js';
import { useToast } from '../toast.jsx';
import { Avatar, EmptyState, ErrorBox, Progress, Spinner, StatusBadge, Tabs } from '../components/ui.jsx';
import { ConfirmModal } from '../components/Modal.jsx';
import { AssignmentFormModal } from '../components/AssignmentModals.jsx';

const FILTERS = {
  all: { label: 'All', test: () => true },
  submitted: { label: 'Turned in', test: (s) => s.status === 'submitted' },
  graded: { label: 'Graded', test: (s) => s.status === 'graded' },
  notIn: { label: 'Pending', test: (s) => s.status === 'assigned' || s.status === 'missing' },
};

// Ungraded work first, then graded, then students who haven't turned anything in.
const ORDER = { submitted: 0, graded: 1, missing: 2, assigned: 3 };

export default function StudentWorkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { courses, reloadCourses } = useOutletContext();
  const assignment = useFetch(`/assignments/${id}`);
  const work = useFetch(`/assignments/${id}/submissions`);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (assignment.loading || work.loading) return <Spinner />;
  if (assignment.error) return <ErrorBox message={assignment.error} onRetry={assignment.reload} />;
  if (work.error) return <ErrorBox message={work.error} onRetry={work.reload} />;

  const a = assignment.data;
  const students = [...work.data].sort(
    (x, y) => ORDER[x.status] - ORDER[y.status] || x.student_name.localeCompare(y.student_name)
  );
  const count = (s) => students.filter((x) => x.status === s).length;
  const graded = students.filter((s) => s.status === 'graded');
  const avg = graded.length
    ? Math.round(graded.reduce((n, s) => n + percent(s.submission.marks, a.max_marks), 0) / graded.length)
    : null;
  const turnedIn = count('submitted') + graded.length;
  const shown = students.filter(FILTERS[filter].test);
  const selected = students.find((s) => s.student_id === selectedId) || shown.find((s) => s.submission) || null;

  const refresh = () => {
    work.reload();
    assignment.reload();
  };

  function afterGrade(studentId) {
    refresh();
    const next = students.find((s) => s.status === 'submitted' && s.student_id !== studentId);
    if (next) setSelectedId(next.student_id);
  }

  async function confirmDelete() {
    try {
      await api(`/assignments/${a.id}`, { method: 'DELETE' });
      toast('Assignment deleted');
      reloadCourses();
      navigate(`/courses/${a.course_id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <Link to={`/courses/${a.course_id}`} className="back-link">
        <ArrowLeft size={16} /> {a.course_name}
      </Link>

      <div className="panel work-header">
        <div className="work-title">
          <h1>{a.title}</h1>
          <div className="detail-facts">
            <span className={`fact due-${urgency(a.due_date)}`}>
              <CalendarClock size={16} /> {dueLabel(a.due_date)}
            </span>
            <span className="fact">
              <Award size={16} /> {a.max_marks} points
            </span>
          </div>
          {a.description && <p className="instructions">{a.description}</p>}
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} /> Edit
          </button>
          <button className="btn btn-ghost danger" onClick={() => setDeleting(true)}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="metric-strip">
        <Metric value={turnedIn} label="Turned in" />
        <Metric value={count('assigned')} label="Assigned" />
        <Metric value={count('missing')} label="Missing" tone="red" />
        <Metric value={graded.length} label="Graded" tone="green" />
        <Metric value={avg == null ? '—' : `${avg}%`} label="Class average" />
      </div>

      {students.length === 0 ? (
        <section className="panel">
          <EmptyState icon={Users} title="No students in this class yet" text="Share the class code from the class page." />
        </section>
      ) : (
        <div className="grading">
          <section className="panel grading-list">
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={Object.entries(FILTERS).map(([key, f]) => ({
                key,
                label: f.label,
                count: students.filter(f.test).length,
              }))}
            />
            <div className="student-list">
              {shown.length === 0 && <p className="muted pad">No students in this group.</p>}
              {shown.map((s) => (
                <button
                  key={s.student_id}
                  className={`student-row ${selected?.student_id === s.student_id ? 'active' : ''}`}
                  onClick={() => setSelectedId(s.student_id)}
                >
                  <Avatar name={s.student_name} size={32} />
                  <span className="student-name truncate">{s.student_name}</span>
                  {s.status === 'graded' ? (
                    <span className="score">
                      {s.submission.marks}/{a.max_marks}
                    </span>
                  ) : (
                    <StatusBadge status={s.status} late={s.late} />
                  )}
                  <ChevronRight size={16} className="chev" />
                </button>
              ))}
            </div>
          </section>

          <section className="panel grading-detail">
            {selected ? (
              <GradePanel key={selected.student_id} student={selected} assignment={a} onSaved={afterGrade} />
            ) : (
              <EmptyState icon={Users} title="Select a student" text="Pick a student on the left to review their work." />
            )}
          </section>
        </div>
      )}

      {editing && (
        <AssignmentFormModal
          courses={courses}
          assignment={a}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete assignment?"
          text={`"${a.title}" and all ${turnedIn} submission(s) will be permanently deleted.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}

function Metric({ value, label, tone }) {
  return (
    <div className="metric">
      <div className={`metric-value ${tone ? `text-${tone}` : ''}`}>{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function GradePanel({ student: s, assignment: a, onSaved }) {
  const toast = useToast();
  const [marks, setMarks] = useState(s.submission?.marks ?? '');
  const [feedback, setFeedback] = useState(s.submission?.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/submissions/${s.submission.id}/grade`, {
        method: 'PUT',
        body: { marks: Number(marks), feedback },
      });
      toast(`Graded ${s.student_name}: ${marks}/${a.max_marks}`);
      onSaved(s.student_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grade-panel">
      <div className="grade-student">
        <Avatar name={s.student_name} size={44} />
        <div>
          <h2>{s.student_name}</h2>
          <div className="muted small">{s.student_email}</div>
        </div>
        <StatusBadge status={s.status} late={s.late} />
      </div>

      {!s.submission ? (
        <EmptyState
          icon={CalendarClock}
          title={s.status === 'missing' ? 'Missing' : 'Not turned in yet'}
          text={s.status === 'missing' ? 'The deadline has passed and nothing was turned in.' : 'The deadline has not passed yet.'}
        />
      ) : (
        <>
          <div className="work-card">
            <div className="work-head">
              <h3>Submission</h3>
              <span className="muted small">
                {formatDateTime(s.submission.submitted_at)}
                {s.late && ' · late'}
              </span>
            </div>
            <pre className="submission-text">{s.submission.content}</pre>
          </div>

          <form className="form" onSubmit={save}>
            <div className="grade-input-row">
              <label className="field">
                <span>Marks</span>
                <div className="marks-input">
                  <input
                    type="number"
                    min="0"
                    max={a.max_marks}
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    required
                    autoFocus
                  />
                  <span>/ {a.max_marks}</span>
                </div>
              </label>
              {marks !== '' && (
                <div className="grade-preview">
                  <strong>{percent(Number(marks), a.max_marks)}%</strong>
                  <Progress value={percent(Number(marks), a.max_marks)} tone="green" />
                </div>
              )}
            </div>
            <label className="field">
              <span>Feedback for the student</span>
              <textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What went well, what to improve…"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="actions-end">
              <button className="btn btn-primary" disabled={busy || marks === ''}>
                {s.status === 'graded' ? 'Update grade' : 'Save grade'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
