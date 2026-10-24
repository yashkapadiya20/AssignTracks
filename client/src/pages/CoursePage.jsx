import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../lib/api.js';
import { courseColor } from '../lib/format.js';
import { useToast } from '../toast.jsx';
import { Avatar, EmptyState, ErrorBox, Spinner, StatusBadge, Tabs } from '../components/ui.jsx';
import AssignmentRow from '../components/AssignmentRow.jsx';
import CopyCode from '../components/CopyCode.jsx';
import { ConfirmModal } from '../components/Modal.jsx';
import { AssignmentDetailModal, AssignmentFormModal } from '../components/AssignmentModals.jsx';

export default function CoursePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { courses, reloadCourses } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();
  const course = useFetch(`/courses/${id}`);
  const assignments = useFetch(`/assignments?course_id=${id}`);
  const [tab, setTab] = useState('classwork');
  const [form, setForm] = useState(null); // {} for new, assignment for edit
  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const isTeacher = user.role === 'teacher';

  if (course.loading) return <Spinner />;
  if (course.error) return <ErrorBox message={course.error} onRetry={course.reload} />;

  const c = course.data;
  const list = assignments.data || [];
  const refresh = () => {
    assignments.reload();
    reloadCourses();
  };

  async function confirmDelete() {
    try {
      await api(`/assignments/${toDelete.id}`, { method: 'DELETE' });
      toast('Assignment deleted');
      setToDelete(null);
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <Link to="/courses" className="back-link">
        <ArrowLeft size={16} /> Classes
      </Link>

      <div className="course-hero" style={{ background: courseColor(c.id).gradient }}>
        <div>
          <h1>{c.name}</h1>
          {c.description && <p>{c.description}</p>}
          <p className="course-hero-sub">
            {c.teacher_name} · {c.student_count} student{c.student_count === 1 ? '' : 's'}
          </p>
        </div>
        {isTeacher && <CopyCode code={c.code} />}
      </div>

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'classwork', label: 'Classwork', count: list.length },
            { key: 'people', label: 'People', count: c.student_count + 1 },
          ]}
        />
        {isTeacher && tab === 'classwork' && (
          <button className="btn btn-primary" onClick={() => setForm({})}>
            <Plus size={18} /> Create assignment
          </button>
        )}
      </div>

      {tab === 'classwork' ? (
        <section className="panel">
          {assignments.loading ? (
            <Spinner />
          ) : assignments.error ? (
            <ErrorBox message={assignments.error} onRetry={assignments.reload} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No assignments yet"
              text={isTeacher ? 'Post the first assignment for this class.' : 'Your teacher has not posted any work yet.'}
              action={
                isTeacher && (
                  <button className="btn btn-primary" onClick={() => setForm({})}>
                    Create assignment
                  </button>
                )
              }
            />
          ) : (
            <div className="list">
              {list.map((a) =>
                isTeacher ? (
                  <div key={a.id} className="row-with-actions">
                    <AssignmentRow
                      assignment={a}
                      showCourse={false}
                      onClick={() => navigate(`/assignments/${a.id}`)}
                      right={
                        <span className="counts">
                          <span>
                            <strong>{a.submission_count}</strong> turned in
                          </span>
                          <span>
                            <strong>{a.student_count - a.submission_count}</strong> assigned
                          </span>
                        </span>
                      }
                    />
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setForm(a)} aria-label="Edit" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => setToDelete(a)} aria-label="Delete" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    showCourse={false}
                    onClick={() => setDetail(a)}
                    right={<StatusBadge status={a.status} late={a.late} />}
                  />
                )
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <h3 className="people-head">Teacher</h3>
          <div className="person">
            <Avatar name={c.teacher_name} color={courseColor(c.id).solid} />
            <span>{c.teacher_name}</span>
          </div>
          <h3 className="people-head">
            Students <span className="muted">({c.student_count})</span>
          </h3>
          {c.students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students yet"
              text={isTeacher ? `Share the class code ${c.code} so students can join.` : undefined}
            />
          ) : (
            c.students.map((s) => (
              <div className="person" key={s.id}>
                <Avatar name={s.name} />
                <span>{s.name}</span>
                {isTeacher && <span className="muted small person-email">{s.email}</span>}
              </div>
            ))
          )}
        </section>
      )}

      {form && (
        <AssignmentFormModal
          courses={courses}
          courseId={c.id}
          assignment={form.id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
      {detail && <AssignmentDetailModal assignment={detail} onClose={() => setDetail(null)} onChanged={assignments.reload} />}
      {toDelete && (
        <ConfirmModal
          title="Delete assignment?"
          text={`"${toDelete.title}" and all ${toDelete.submission_count} submission(s) will be permanently deleted.`}
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </>
  );
}
