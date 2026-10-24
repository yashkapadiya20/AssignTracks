import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../toast.jsx';

export function CreateCourseModal({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const course = await api('/courses', { method: 'POST', body: { name, description } });
      toast(`Class created. Share code ${course.code} with students.`);
      onCreated(course);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Create class"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="create-course" disabled={busy || !name.trim()}>
            Create
          </button>
        </>
      }
    >
      <form id="create-course" className="form" onSubmit={submit}>
        <label className="field">
          <span>Class name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cloud Computing" required />
        </label>
        <label className="field">
          <span>Section / description (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. CSE 5th sem, Section A" />
        </label>
        <p className="hint">A class code is generated automatically. Students use it to join.</p>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

export function JoinCourseModal({ onClose, onJoined }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const course = await api('/courses/join', { method: 'POST', body: { code } });
      toast(`Joined ${course.name}`);
      onJoined(course);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Join class"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="join-course" disabled={busy || code.trim().length < 5}>
            Join
          </button>
        </>
      }
    >
      <form id="join-course" className="form" onSubmit={submit}>
        <p className="muted">Ask your teacher for the class code, then enter it here.</p>
        <label className="field">
          <span>Class code</span>
          <input
            className="code-input"
            autoFocus
            value={code}
            maxLength={10}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="ABC23XY"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
