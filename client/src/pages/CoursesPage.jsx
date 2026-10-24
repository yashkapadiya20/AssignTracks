import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { matches } from '../lib/format.js';
import CourseCard from '../components/CourseCard.jsx';
import { EmptyState, PageHeader, SearchInput, Spinner } from '../components/ui.jsx';

export default function CoursesPage() {
  const { user } = useAuth();
  const { courses, coursesLoading, openCourseModal } = useOutletContext();
  const [query, setQuery] = useState('');
  const isTeacher = user.role === 'teacher';
  const shown = courses.filter((c) => matches(query, c.name, c.description, c.teacher_name, c.code));

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle={isTeacher ? 'Classes you teach' : 'Classes you are enrolled in'}
        actions={
          <button className="btn btn-primary" onClick={openCourseModal}>
            <Plus size={18} /> {isTeacher ? 'Create class' : 'Join class'}
          </button>
        }
      />
      {coursesLoading ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={BookOpen}
            title={isTeacher ? 'No classes yet' : 'Not enrolled in any class'}
            text={isTeacher ? 'Create a class and share its code with students.' : 'Join a class with the code your teacher gives you.'}
            action={
              <button className="btn btn-primary" onClick={openCourseModal}>
                {isTeacher ? 'Create class' : 'Join class'}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search classes" />
          </div>
          {shown.length === 0 ? (
            <p className="muted">No classes match "{query}".</p>
          ) : (
            <div className="course-grid">
              {shown.map((c) => (
                <CourseCard key={c.id} course={c} showCode={isTeacher} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
