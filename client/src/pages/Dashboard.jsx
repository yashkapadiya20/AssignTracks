import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Inbox,
  Plus,
  Star,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { greeting, percent, timeAgo } from '../lib/format.js';
import { EmptyState, ErrorBox, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import AssignmentRow from '../components/AssignmentRow.jsx';
import CourseCard from '../components/CourseCard.jsx';
import { AssignmentDetailModal } from '../components/AssignmentModals.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'teacher' ? <TeacherHome user={user} /> : <StudentHome user={user} />;
}

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function StudentHome({ user }) {
  const { courses, openCourseModal } = useOutletContext();
  const { data, loading, error, reload } = useFetch('/assignments');
  const [open, setOpen] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const list = data || [];
  const by = (s) => list.filter((a) => a.status === s);
  const graded = by('graded');
  const avg = graded.length
    ? Math.round(graded.reduce((sum, a) => sum + percent(a.submission.marks, a.max_marks), 0) / graded.length)
    : null;
  const upcoming = by('assigned').slice(0, 5);
  const missing = by('missing');
  const recentGrades = [...graded]
    .sort((a, b) => new Date(b.submission.graded_at) - new Date(a.submission.graded_at))
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={today()}
        actions={
          <button className="btn btn-primary" onClick={openCourseModal}>
            <Plus size={18} /> Join class
          </button>
        }
      />

      <div className="stats-grid">
        <StatCard icon={CalendarClock} label="Assigned" value={by('assigned').length} tone="blue" />
        <StatCard icon={AlertTriangle} label="Missing" value={missing.length} tone="red" />
        <StatCard icon={CheckCircle2} label="Turned in" value={by('submitted').length + graded.length} tone="violet" />
        <StatCard icon={Star} label="Average grade" value={avg == null ? '—' : `${avg}%`} tone="green" />
      </div>

      {missing.length > 0 && (
        <Link to="/todo?tab=missing" className="alert alert-red">
          <AlertTriangle size={18} />
          You have {missing.length} missing assignment{missing.length > 1 ? 's' : ''}. You can still turn them in late.
        </Link>
      )}

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>Due soon</h2>
            <Link to="/todo">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing due" text="You're all caught up. Nice work!" />
          ) : (
            <div className="list">
              {upcoming.map((a) => (
                <AssignmentRow key={a.id} assignment={a} onClick={() => setOpen(a)} />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent grades</h2>
          </div>
          {recentGrades.length === 0 ? (
            <EmptyState icon={Star} title="No grades yet" text="Grades appear here once your teacher marks your work." />
          ) : (
            <div className="list">
              {recentGrades.map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onClick={() => setOpen(a)}
                  meta={<span>Graded {timeAgo(a.submission.graded_at)}</span>}
                  right={
                    <span className="score">
                      {a.submission.marks}/{a.max_marks}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <div className="panel-head">
          <h2>My classes</h2>
          <Link to="/courses">All classes</Link>
        </div>
        {courses.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={BookOpen}
              title="You haven't joined any classes"
              text="Ask your teacher for a class code to get started."
              action={
                <button className="btn btn-primary" onClick={openCourseModal}>
                  Join class
                </button>
              }
            />
          </div>
        ) : (
          <div className="course-grid">
            {courses.slice(0, 6).map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      {open && <AssignmentDetailModal assignment={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function TeacherHome({ user }) {
  const { courses, openCourseModal } = useOutletContext();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/assignments');

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const list = data || [];
  const toGrade = list.filter((a) => a.submission_count > a.graded_count);
  const pendingCount = toGrade.reduce((n, a) => n + a.submission_count - a.graded_count, 0);
  const students = courses.reduce((n, c) => n + c.student_count, 0);
  const upcoming = list.filter((a) => new Date(a.due_date) > new Date()).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={today()}
        actions={
          <button className="btn btn-primary" onClick={openCourseModal}>
            <Plus size={18} /> Create class
          </button>
        }
      />

      <div className="stats-grid">
        <StatCard icon={BookOpen} label="Classes" value={courses.length} tone="blue" />
        <StatCard icon={Users} label="Enrolled students" value={students} tone="violet" />
        <StatCard icon={FileText} label="Assignments" value={list.length} tone="green" />
        <StatCard icon={ClipboardCheck} label="Waiting to grade" value={pendingCount} tone="amber" />
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>Needs grading</h2>
            <Link to="/review">View all</Link>
          </div>
          {toGrade.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up" text="No submissions are waiting for a grade." />
          ) : (
            <div className="list">
              {toGrade.slice(0, 5).map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onClick={() => navigate(`/assignments/${a.id}`)}
                  right={<span className="badge tone-amber">{a.submission_count - a.graded_count} to grade</span>}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming deadlines</h2>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No upcoming deadlines" text="Open a class to post an assignment." />
          ) : (
            <div className="list">
              {upcoming.map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onClick={() => navigate(`/assignments/${a.id}`)}
                  right={
                    <span className="muted small">
                      {a.submission_count}/{a.student_count} turned in
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <div className="panel-head">
          <h2>My classes</h2>
          <Link to="/courses">All classes</Link>
        </div>
        {courses.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={BookOpen}
              title="Create your first class"
              text="You'll get a class code to share with your students."
              action={
                <button className="btn btn-primary" onClick={openCourseModal}>
                  Create class
                </button>
              }
            />
          </div>
        ) : (
          <div className="course-grid">
            {courses.slice(0, 6).map((c) => (
              <CourseCard key={c.id} course={c} showCode />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
