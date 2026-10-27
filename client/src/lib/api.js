const TOKEN_KEY = 'tracker_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// `body` may be FormData (file uploads); the browser then sets the multipart Content-Type itself.
export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const headers = { ...authHeaders(), ...(isForm ? {} : { 'Content-Type': 'application/json' }) };

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Is the API running?');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Fetches a protected file as a Blob (needs the auth header, so a plain link won't work).
export async function fetchFile(path) {
  let res;
  try {
    res = await fetch(`/api${path}`, { headers: authHeaders() });
  } catch {
    throw new Error('Cannot reach the server. Is the API running?');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed (${res.status})`);
  }
  return res.blob();
}

export async function downloadFile(path, fileName) {
  const url = URL.createObjectURL(await fetchFile(path));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}
