import { FileText } from 'lucide-react';
import { courseColor, dueLabel, urgency } from '../lib/format.js';

// One line in any assignment list. `meta` overrides the default due-date line; `right` fills the end slot.
export default function AssignmentRow({ assignment: a, onClick, right, meta, showCourse = true }) {
  const color = courseColor(a.course_id);
  const due = a.status === 'graded' || a.status === 'submitted' ? 'later' : urgency(a.due_date);
  return (
    <button className="row-item" onClick={onClick}>
      <span className="row-icon" style={{ background: color.solid }}>
        <FileText size={18} />
      </span>
      <span className="row-main">
        <span className="row-title truncate">{a.title}</span>
        <span className="row-meta">
          {showCourse && <span className="truncate">{a.course_name}</span>}
          {showCourse && <span className="dot-sep" />}
          {meta ?? <span className={`due due-${due}`}>{dueLabel(a.due_date)}</span>}
        </span>
      </span>
      {right && <span className="row-right">{right}</span>}
    </button>
  );
}
