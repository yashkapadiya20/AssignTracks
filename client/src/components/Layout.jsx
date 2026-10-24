import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import { useFetch } from '../lib/useFetch.js';
import { courseColor } from '../lib/format.js';
import { Avatar } from './ui.jsx';
import { CreateCourseModal, JoinCourseModal } from './CourseModals.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [courseModal, setCourseModal] = useState(false);
  const courses = useFetch('/courses');
  const isTeacher = user.role === 'teacher';

  const nav = isTeacher
    ? [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/review', label: 'To review', icon: ClipboardCheck },
        { to: '/courses', label: 'Classes', icon: BookOpen },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/todo', label: 'To-do', icon: ListTodo },
        { to: '/courses', label: 'Classes', icon: BookOpen },
      ];

  const ctx = {
    courses: courses.data || [],
    coursesLoading: courses.loading,
    reloadCourses: courses.reload,
    openCourseModal: () => setCourseModal(true),
  };

  // Close the mobile drawer on navigation.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="brand-name">AssignTrack</div>
            <div className="brand-sub">{isTeacher ? 'Teacher workspace' : 'Student workspace'}</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-section">
          <div className="nav-section-head">
            <span>{isTeacher ? 'Teaching' : 'Enrolled'}</span>
            <button
              className="icon-btn"
              onClick={() => setCourseModal(true)}
              aria-label={isTeacher ? 'Create class' : 'Join class'}
              title={isTeacher ? 'Create class' : 'Join class'}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="nav-courses">
            {ctx.courses.length === 0 && !courses.loading && <p className="nav-empty">No classes yet</p>}
            {ctx.courses.map((c) => (
              <NavLink key={c.id} to={`/courses/${c.id}`} className="nav-link nav-course">
                <span className="course-dot" style={{ background: courseColor(c.id).gradient }}>
                  {c.name[0].toUpperCase()}
                </span>
                <span className="truncate">{c.name}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div className="sidebar-foot">
          <button className="nav-link" onClick={toggle}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="user-card">
            <Avatar name={user.name} size={34} />
            <div className="user-meta">
              <div className="truncate user-name">{user.name}</div>
              <div className="truncate user-email">{user.email}</div>
            </div>
            <button
              className="icon-btn"
              onClick={() => {
                logout();
                navigate('/');
              }}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main-col">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="brand-name">AssignTrack</span>
          <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>
        <main className="content">
          <Outlet context={ctx} />
        </main>
      </div>

      {courseModal &&
        (isTeacher ? (
          <CreateCourseModal
            onClose={() => setCourseModal(false)}
            onCreated={(c) => {
              setCourseModal(false);
              courses.reload();
              navigate(`/courses/${c.id}`);
            }}
          />
        ) : (
          <JoinCourseModal
            onClose={() => setCourseModal(false)}
            onJoined={(c) => {
              setCourseModal(false);
              courses.reload();
              navigate(`/courses/${c.id}`);
            }}
          />
        ))}
    </div>
  );
}
