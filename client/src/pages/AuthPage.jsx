import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarClock, CheckCircle2, Eye, EyeOff, GraduationCap, Presentation, UserRound } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const FEATURES = [
  { icon: CalendarClock, text: 'Every deadline in one place, sorted by urgency' },
  { icon: CheckCircle2, text: 'Turn in work and track Assigned, Missing and Done' },
  { icon: BarChart3, text: 'Teachers review submissions, grade and give feedback' },
];

export default function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand">
          <div className="brand-logo">
            <GraduationCap size={22} />
          </div>
          <div className="brand-name">AssignTrack</div>
        </div>
        <div className="auth-hero-body">
          <h1>Assignments, deadlines and grades. Sorted.</h1>
          <p>A cloud-based assignment tracker for teachers and students.</p>
          <ul>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="auth-feature-icon">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit}>
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{isLogin ? 'Log in to see your classes and deadlines.' : 'It takes less than a minute.'}</p>

          {!isLogin && (
            <div className="role-picker" role="radiogroup" aria-label="I am a">
              {[
                { value: 'student', label: 'Student', icon: UserRound, sub: 'Join classes, submit work' },
                { value: 'teacher', label: 'Teacher', icon: Presentation, sub: 'Create classes, grade work' },
              ].map(({ value, label, icon: Icon, sub }) => (
                <button
                  type="button"
                  key={value}
                  role="radio"
                  aria-checked={form.role === value}
                  className={`role-option ${form.role === value ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, role: value })}
                >
                  <Icon size={22} />
                  <strong>{label}</strong>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
          )}

          {!isLogin && (
            <label className="field">
              <span>Full name</span>
              <input name="name" value={form.name} onChange={update} autoComplete="name" required />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="input-with-btn">
              <input
                name="password"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={update}
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
              <button type="button" className="icon-btn" onClick={() => setShowPw(!showPw)} aria-label="Show password">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {!isLogin && <small className="hint">At least 6 characters</small>}
          </label>

          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : `Sign up as ${form.role}`}
          </button>
          <p className="muted center-text">
            {isLogin ? (
              <>
                New here? <Link to="/register">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link to="/login">Log in</Link>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  );
}
