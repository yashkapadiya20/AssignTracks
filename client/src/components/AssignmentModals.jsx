import { useState } from 'react';
import { Award, CalendarClock, Clock, MessageSquare, Undo2 } from 'lucide-react';
import Modal from './Modal.jsx';
import { StatusBadge, Progress } from './ui.jsx';
import { api } from '../lib/api.js';
import { defaultDue, dueLabel, formatDateTime, percent, timeLeft, toLocalInput, urgency } from '../lib/format.js';
import { useToast } from '../toast.jsx';

// Teacher: create (no `assignment`) or edit an assignment.
export function AssignmentFormModal({ courses, courseId, assignment, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!assignment;
  const [form, setForm] = useState({
    course_id: assignment?.course_id ?? courseId ?? courses[0]?.id ?? '',
    title: assignment?.title ?? '',
    description: assignment?.description ?? '',
    due_date: assignment ? toLocalInput(assignment.due_date) : defaultDue(),
    max_marks: assignment?.max_marks ?? 100,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
      course_id: Number(form.course_id),
      max_marks: Number(form.max_marks),
      due_date: new Date(form.due_date).toISOString(),
    };
    try {
      const saved = editing
        ? await api(`/assignments/${assignment.id}`, { method: 'PUT', body })
        : await api('/assignments', { method: 'POST', body });
      toast(editing ? 'Assignment updated' : 'Assignment posted');
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit assignment' : 'New assignment'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="assignment-form" disabled={busy}>
            {editing ? 'Save changes' : 'Assign'}
          </button>
        </>
      }
    >
      <form id="assignment-form" className="form" onSubmit={submit}>
        <label className="field">
          <span>Title</span>
          <input name="title" autoFocus value={form.title} onChange={update} placeholder="e.g. Lab 3: Deploy a web server" required />
        </label>
        <label className="field">
          <span>Instructions (optional)</span>
          <textarea
            name="description"
            rows={5}
            value={form.description}
            onChange={update}
            placeholder="What should students do? Add links, word limits, submission format…"
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Class</span>
            <select name="course_id" value={form.course_id} onChange={update} disabled={editing} required>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Due</span>
            <input name="due_date" type="datetime-local" value={form.due_date} onChange={update} required />
          </label>
          <label className="field">
            <span>Points</span>
            <input name="max_marks" type="number" min="1" value={form.max_marks} onChange={update} required />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

// Student: view an assignment, turn in / update / unsubmit work, see grade and feedback.
export function AssignmentDetailModal({ assignment: a, onClose, onChanged }) {
  const toast = useToast();
  const [content, setContent] = useState(a.submission?.content ?? '');
  const [editing, setEditing] = useState(!a.submission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const graded = a.status === 'graded';
  const left = timeLeft(a.due_date);

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(message);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const turnIn = (e) => {
    e.preventDefault();
    run(
      () => api(`/assignments/${a.id}/submissions`, { method: 'POST', body: { content } }),
      a.submission ? 'Submission updated' : 'Assignment turned in'
    );
  };
  const unsubmit = () =>
    run(() => api(`/assignments/${a.id}/submissions`, { method: 'DELETE' }), 'Submission withdrawn');

  return (
    <Modal title={a.title} onClose={onClose} wide>
      <div className="detail">
        <div className="detail-meta">
          <span className="muted">{a.course_name}</span>
          <StatusBadge status={a.status} late={a.late} />
        </div>

        <div className="detail-facts">
          <div className={`fact due-${a.submission ? 'later' : urgency(a.due_date)}`}>
            <CalendarClock size={16} /> {dueLabel(a.due_date)}
          </div>
          {left && !a.submission && (
            <div className="fact">
              <Clock size={16} /> {left}
            </div>
          )}
          <div className="fact">
            <Award size={16} /> {a.max_marks} points
          </div>
        </div>

        {a.description ? <p className="instructions">{a.description}</p> : <p className="muted">No instructions.</p>}

        {graded && (
          <div className="grade-card">
            <div className="grade-score">
              <span className="grade-big">{a.submission.marks}</span>
              <span className="muted">/ {a.max_marks}</span>
              <span className="grade-pct">{percent(a.submission.marks, a.max_marks)}%</span>
            </div>
            <Progress value={percent(a.submission.marks, a.max_marks)} tone="green" />
            {a.submission.feedback && (
              <div className="feedback">
                <MessageSquare size={16} />
                <p>{a.submission.feedback}</p>
              </div>
            )}
          </div>
        )}

        <div className="work-card">
          <div className="work-head">
            <h3>Your work</h3>
            {a.submission && (
              <span className="muted small">
                Turned in {formatDateTime(a.submission.submitted_at)}
                {a.late && ' (late)'}
              </span>
            )}
          </div>

          {editing && !graded ? (
            <form onSubmit={turnIn} className="form">
              <textarea
                rows={7}
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your answer, or paste a link to your document / GitHub repo / Drive file"
                required
              />
              {a.status === 'missing' && <p className="hint warn">This is past the deadline and will be marked late.</p>}
              {error && <p className="form-error">{error}</p>}
              <div className="actions-end">
                {a.submission && (
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                )}
                <button className="btn btn-primary" disabled={busy || !content.trim()}>
                  {a.submission ? 'Update submission' : 'Turn in'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <pre className="submission-text">{a.submission?.content}</pre>
              {error && <p className="form-error">{error}</p>}
              {!graded && (
                <div className="actions-end">
                  <button className="btn btn-ghost" onClick={unsubmit} disabled={busy}>
                    <Undo2 size={16} /> Unsubmit
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
