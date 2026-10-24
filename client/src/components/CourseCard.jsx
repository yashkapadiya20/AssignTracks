import { Link } from 'react-router-dom';
import { FileText, Users } from 'lucide-react';
import { courseColor } from '../lib/format.js';
import CopyCode from './CopyCode.jsx';

export default function CourseCard({ course, showCode }) {
  return (
    <Link to={`/courses/${course.id}`} className="course-card">
      <div className="course-banner" style={{ background: courseColor(course.id).gradient }}>
        <h3 className="truncate">{course.name}</h3>
        {course.description && <p className="truncate">{course.description}</p>}
        <span className="course-teacher">{course.teacher_name}</span>
      </div>
      <div className="course-foot">
        <span>
          <Users size={15} /> {course.student_count} student{course.student_count === 1 ? '' : 's'}
        </span>
        <span>
          <FileText size={15} /> {course.assignment_count} assignment{course.assignment_count === 1 ? '' : 's'}
        </span>
        {showCode && <CopyCode code={course.code} compact />}
      </div>
    </Link>
  );
}
