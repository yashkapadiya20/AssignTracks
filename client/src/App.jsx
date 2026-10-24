import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import CoursePage from './pages/CoursePage.jsx';
import TodoPage from './pages/TodoPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import StudentWorkPage from './pages/StudentWorkPage.jsx';
import { Spinner } from './components/ui.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }

  const isTeacher = user.role === 'teacher';
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CoursePage />} />
        {isTeacher ? (
          <>
            <Route path="review" element={<ReviewPage />} />
            <Route path="assignments/:id" element={<StudentWorkPage />} />
          </>
        ) : (
          <Route path="todo" element={<TodoPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
