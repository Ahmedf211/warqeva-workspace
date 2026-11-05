// WARQÉVA — Supabase connection (server mode). No library: plain fetch to Supabase Auth + REST.
// The server decides access (Row Level Security + the act() gate). The browser only displays what it is sent.
const CFG = window.WQ_SERVER || null;
const KEY = 'wq-session';
export const enabled = !!CFG;

function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function store(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {} }
let session = load();

// After the email link, Supabase returns to this page with tokens in the address fragment
export function captureRedirect() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    session = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Date.now() / 1000 + Number(h.get('expires_in') || 3600) };
    store(session); history.replaceState(null, '', location.pathname + location.search);
    return true;
  }
  if (h.get('error_description')) { history.replaceState(null, '', location.pathname + location.search); return h.get('error_description'); }
  return false;
}

async function call(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { apikey: CFG.key, 'Content-Type': 'application/json' };
  if (auth && session) { await refreshIfNeeded(); headers.Authorization = 'Bearer ' + session.access_token; }
  const res = await fetch(CFG.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) { const err = new Error((data && (data.msg || data.message || data.error_description)) || ('HTTP ' + res.status)); err.status = res.status; throw err; }
  return data;
}
async function refreshIfNeeded() {
  if (!session || session.expires_at - Date.now() / 1000 > 60) return;
  try {
    const r = await fetch(CFG.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error_description || 'refresh failed');
    session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() / 1000 + d.expires_in }; store(session);
  } catch (e) { session = null; store(null); }
}

export const signedIn = () => !!session;
export async function sendLink(email) {
  // create_user:false — only people Ahmed has already added can sign in
  return call('/auth/v1/otp', { method: 'POST', auth: false, body: { email, create_user: false, options: { email_redirect_to: location.origin + location.pathname } } });
}
export function signOut() { const s = session; session = null; store(null); if (s) fetch(CFG.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + s.access_token } }).catch(() => {}); }

// Everything this person is allowed to see (filtered by the server)
export async function snapshot() {
  const [me, people, units, tasks, events, notes, content] = await Promise.all([
    call('/auth/v1/user'), call('/rest/v1/people?select=user_id,handle,is_founder'), call('/rest/v1/units?select=*'), call('/rest/v1/tasks?select=*'),
    call('/rest/v1/events?select=*&superseded=eq.false&order=id.asc'), call('/rest/v1/notes?select=*'), call('/rest/v1/content?select=key,body'),
  ]);
  const mine = people.find((p) => p.user_id === me.id) || null;
  return { me: mine, people, units, tasks, events, notes, content };
}
export async function act(taskId, action, payload = {}) {
  const p = { ...payload }; if (p.evidenceHash) { p.evidence_hash = p.evidenceHash; delete p.evidenceHash; }
  return call('/rest/v1/rpc/act', { method: 'POST', body: { p_task: taskId, p_action: action, p_payload: p } });
}
