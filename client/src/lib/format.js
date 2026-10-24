const DAY = 864e5;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const timeOf = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function shortDate(iso, now = new Date()) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export const formatDateTime = (iso) => `${shortDate(iso)}, ${timeOf(new Date(iso))}`;

// "Due today, 5:00 PM", "Due Friday, 11:59 PM", "Was due Oct 3"
export function dueLabel(iso, now = new Date()) {
  const due = new Date(iso);
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (days === 0) return `${due < now ? 'Was due' : 'Due'} today, ${timeOf(due)}`;
  if (days === 1) return `Due tomorrow, ${timeOf(due)}`;
  if (days === -1) return `Was due yesterday, ${timeOf(due)}`;
  if (days > 1 && days < 7) return `Due ${due.toLocaleDateString(undefined, { weekday: 'long' })}, ${timeOf(due)}`;
  return `${days < 0 ? 'Was due' : 'Due'} ${shortDate(iso, now)}`;
}

// past | urgent (< 24h) | soon (< 3 days) | later
export function urgency(iso, now = new Date()) {
  const hours = (new Date(iso) - now) / 36e5;
  if (hours < 0) return 'past';
  if (hours < 24) return 'urgent';
  if (hours < 72) return 'soon';
  return 'later';
}

export function timeLeft(iso, now = new Date()) {
  const ms = new Date(iso) - now;
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 36e5);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 6e4))} min left`;
  if (hours < 48) return `${hours} h left`;
  return `${Math.floor(hours / 24)} days left`;
}

export function timeAgo(iso, now = new Date()) {
  const mins = Math.round((now - new Date(iso)) / 6e4);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : shortDate(iso, now);
}

// Value for <input type="datetime-local"> in the user's timezone.
export function toLocalInput(date) {
  const d = new Date(date);
  return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}

export function defaultDue() {
  const d = new Date(Date.now() + 7 * DAY);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
}

export const STATUS = {
  assigned: { label: 'Assigned', tone: 'blue' },
  missing: { label: 'Missing', tone: 'red' },
  submitted: { label: 'Turned in', tone: 'violet' },
  graded: { label: 'Graded', tone: 'green' },
};

const COURSE_COLORS = [
  ['#4f46e5', '#7c3aed'],
  ['#0891b2', '#0e7490'],
  ['#059669', '#047857'],
  ['#ea580c', '#c2410c'],
  ['#db2777', '#be185d'],
  ['#2563eb', '#1d4ed8'],
  ['#9333ea', '#7e22ce'],
  ['#0d9488', '#115e59'],
];

export function courseColor(id) {
  const [a, b] = COURSE_COLORS[(Number(id) || 0) % COURSE_COLORS.length];
  return { solid: a, gradient: `linear-gradient(135deg, ${a}, ${b})` };
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

export const percent = (marks, max) => (max ? Math.round((marks / max) * 100) : 0);

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const matches = (query, ...fields) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => (f || '').toLowerCase().includes(q));
};

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
