import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarClock, CheckCircle2, FileText } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { matches } from '../lib/format.js';
import { EmptyState, ErrorBox, PageHeader, SearchInput, Spinner, Tabs } from '../components/ui.jsx';
import AssignmentRow from '../components/AssignmentRow.jsx';

const now = () => new Date();
const TABS = {
  grade: { label: 'Needs grading', test: (a) => a.submission_count > a.graded_count },
  upcoming: { label: 'Upcoming', test: (a) => new Date(a.due_date) > now() },
  past: { label: 'Past due', test: (a) => new Date(a.due_date) <= now() },
  all: { label: 'All', test: () => true },
};

export default function ReviewPage() {
  const navigate = useNavigate();
  const { courses } = useOutletContext();
  const { data, loading, error, reload } = useFetch('/assignments');
  const [tab, setTab] = useState('grade');
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');

  const filtered = (data || []).filter(
    (a) => (!courseId || a.course_id === Number(courseId)) && matches(query, a.title, a.course_name)
  );
  const shown = filtered.filter(TABS[tab].test);
  if (tab === 'past') shown.reverse();

  return (
    <>
      <PageHeader title="To review" subtitle="Every assignment you've posted, with submission progress" />

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={Object.entries(TABS).map(([key, t]) => ({ key, label: t.label, count: filtered.filter(t.test).length }))}
        />
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="Search assignments" />
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Filter by class">
            <option value="">All classes</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="panel">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={tab === 'grade' ? CheckCircle2 : tab === 'upcoming' ? CalendarClock : FileText}
            title={tab === 'grade' ? 'All caught up' : 'No assignments here'}
            text={tab === 'grade' ? 'Every submission has been graded.' : 'Open a class to post an assignment.'}
          />
        ) : (
          <div className="list">
            {shown.map((a) => {
              const ungraded = a.submission_count - a.graded_count;
              return (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onClick={() => navigate(`/assignments/${a.id}`)}
                  right={
                    <span className="counts">
                      <span>
                        <strong>{a.submission_count}</strong>/{a.student_count} turned in
                      </span>
                      {ungraded > 0 ? (
                        <span className="badge tone-amber">{ungraded} to grade</span>
                      ) : (
                        <span>
                          <strong>{a.graded_count}</strong> graded
                        </span>
                      )}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
