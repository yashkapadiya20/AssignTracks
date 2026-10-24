import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { matches, timeAgo } from '../lib/format.js';
import { EmptyState, ErrorBox, PageHeader, SearchInput, Spinner, StatusBadge, Tabs } from '../components/ui.jsx';
import AssignmentRow from '../components/AssignmentRow.jsx';
import { AssignmentDetailModal } from '../components/AssignmentModals.jsx';

const TABS = {
  assigned: { label: 'Assigned', statuses: ['assigned'], empty: ['No work due', 'Nothing is assigned right now.', Inbox] },
  missing: { label: 'Missing', statuses: ['missing'], empty: ['No missing work', 'You turned everything in on time.', CheckCircle2] },
  done: { label: 'Done', statuses: ['submitted', 'graded'], empty: ['Nothing turned in yet', 'Work you turn in shows up here.', AlertTriangle] },
};

export default function TodoPage() {
  const { courses } = useOutletContext();
  const { data, loading, error, reload } = useFetch('/assignments');
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [open, setOpen] = useState(null);
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'assigned';

  const filtered = (data || []).filter(
    (a) => (!courseId || a.course_id === Number(courseId)) && matches(query, a.title, a.course_name, a.description)
  );
  const inTab = (key) => filtered.filter((a) => TABS[key].statuses.includes(a.status));
  const shown = inTab(tab);
  if (tab === 'done') shown.sort((a, b) => new Date(b.submission.submitted_at) - new Date(a.submission.submitted_at));
  const [emptyTitle, emptyText, EmptyIcon] = TABS[tab].empty;

  return (
    <>
      <PageHeader title="To-do" subtitle="All your assignments across classes, sorted by deadline" />

      <div className="toolbar">
        <Tabs
          value={tab}
          onChange={(key) => setParams({ tab: key })}
          tabs={Object.entries(TABS).map(([key, t]) => ({ key, label: t.label, count: inTab(key).length }))}
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
          <EmptyState icon={EmptyIcon} title={emptyTitle} text={query || courseId ? 'Try clearing the filters.' : emptyText} />
        ) : (
          <div className="list">
            {shown.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                onClick={() => setOpen(a)}
                meta={tab === 'done' ? <span>Turned in {timeAgo(a.submission.submitted_at)}</span> : undefined}
                right={
                  a.status === 'graded' ? (
                    <span className="score">
                      {a.submission.marks}/{a.max_marks}
                    </span>
                  ) : (
                    <StatusBadge status={a.status} late={a.late} />
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {open && <AssignmentDetailModal assignment={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
