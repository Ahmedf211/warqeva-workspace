// WARQÉVA — data and action layer (demonstration build)
// Every read and write in the UI goes through `api(userId)`. The permission checks here run in the
// browser, so they DEMONSTRATE the rules; they are not a security boundary. A real server must
// enforce the same rules (spec Stage 3) before any real or private data is loaded.

export const SCHEMA = 'warqeva-demo-v1';

export const USERS = {
  ahmed:   { id: 'ahmed',   name: 'Ahmed',   counterpart: 'Meedz', role: 'founder', units: ['*'], title: 'Founder' },
  suhail:  { id: 'suhail',  name: 'Suhail',  counterpart: 'Sully', role: 'head', units: ['discreet'], title: 'Technology & Security · Discreet' },
  mohamed: { id: 'mohamed', name: 'Mohamed', counterpart: 'Mesi',  role: 'head', units: ['discreet'], title: 'Commercial Co-Head · Discreet' },
  youssef: { id: 'youssef', name: 'Youssef', counterpart: 'Joe',   role: 'head', units: ['discreet'], title: 'Commercial Co-Head · Discreet' },
  visitor: { id: 'visitor', name: 'Public preview', counterpart: null, role: 'visitor', units: [], title: 'Approved showcase only' },
};

export const UNITS = {
  discreet: { id: 'discreet', name: 'Discreet', nameAr: 'ديسكريت', tagline: 'More Deals. More You.',
    colours: { primary: '#0B5A3C', secondary: '#07805F', accent: '#F8B123', paper: '#FDFBEF' },
    logo: 'assets/discreet-logo.png', leads: ['ahmed', 'suhail', 'mohamed', 'youssef'], active: true },
  warqeva: { id: 'warqeva', name: 'WARQÉVA', nameAr: 'وارقيفا', tagline: 'Umbrella workspace', colours: { primary: '#12402F', secondary: '#2F5D46', accent: '#B48A4A', paper: '#F7F2E8' },
    logo: null, leads: ['ahmed'], active: false, umbrella: true },
};

// Floors after decision D2 (Ahmed, 4 Nov 2026)
export const FLOORS = [
  { n: 0, key: 'ground', name: 'Ground · Customer Centre', short: 'G', access: 'all' },
  { n: 1, key: 'commercial', name: 'Floor 1 · Commercial', short: '1', access: 'staff' },
  { n: 2, key: 'technology', name: 'Floor 2 · Technology', short: '2', access: 'staff' },
  { n: 3, key: 'resources', name: 'Floor 3 · Agent Resources', short: '3', access: 'staff' },
  { n: 4, key: 'ai', name: 'Floor 4 · AI Leadership', short: '4', access: 'staff' },
  { n: 5, key: 'units', name: 'Floor 5 · Business Units', short: '5', access: 'unit' },
  { n: 6, key: 'founder', name: 'Floor 6 · Founder', short: '6', access: 'founder' },
];

const now0 = Date.parse('2026-11-04T09:00:00Z');
const t = (m) => new Date(now0 + m * 60000).toISOString();

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

const AGENTS = {
      maya:  { id: 'maya', name: 'Maya', role: 'Market Research Specialist', dept: 'Research', busyWith: null },
      amir:  { id: 'amir', name: 'Amir', role: 'Business Quality Specialist', dept: 'Independent Quality', busyWith: null },
      robin: { id: 'robin', name: 'Robin', role: 'Governance Head', dept: 'Governance', busyWith: null },
      iris:  { id: 'iris', name: 'Iris', role: 'Secretariat Head', dept: 'Secretariat', busyWith: null },
      leila: { id: 'leila', name: 'Leila', role: 'Brand & Design Head', dept: 'Brand', busyWith: 'WQ-T-003' },
    };

// Visibility: 'unit' = members of the unit; 'founder' = Ahmed only; 'private:<user>' = that user + Ahmed; 'owner' = Ahmed only
function seed() {
  return { schema: SCHEMA, seq: 100, tasks: {}, notes: {}, agents: JSON.parse(JSON.stringify(AGENTS)), events: [], integration: { live: false }, _evidenceText: '' };
}

let DB = null;
const KEY = 'warqeva-demo-db';
export let recoveryNotice = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.schema === SCHEMA && d.tasks && Array.isArray(d.events)) return d;
      recoveryNotice = 'Saved demo state was unreadable or outdated, so the sample data was restored.';
    }
  } catch (e) { recoveryNotice = 'Saved demo state could not be read, so the sample data was restored.'; }
  return seed();
}
function save() { if (muted) return; try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage unavailable: in-memory only */ } }
export function resetDemo() { DB = seed(); save(); emit(); }
export function initDB(fresh) { DB = fresh ? seed() : load(); save(); }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(ev) { if (muted) return; listeners.forEach((f) => { try { f(ev); } catch (e) { console.error(e); } }); }

// ---------- permission rules ----------
function memberOf(user, unit) { return user.units.includes('*') || user.units.includes(unit); }
export function canSee(user, rec) {
  if (!user || !rec) return false;
  if (user.role === 'visitor') return false; // public preview sees showcase only — no records
  const v = rec.visibility;
  if (v === 'owner' || v === 'founder') return user.id === 'ahmed';
  if (v && v.startsWith('private:')) return user.id === 'ahmed' || user.id === v.slice(8);
  if (v === 'unit') return memberOf(user, rec.unit);
  return false;
}
export function canEnterFloor(user, n) {
  const f = FLOORS[n]; if (!f) return false;
  if (f.access === 'all') return true;
  if (user.role === 'visitor') return false;
  if (f.access === 'founder') return user.id === 'ahmed';
  return true; // staff + unit floors: room scenes visible; data still filtered per record
}

const DENY = (code, reason) => ({ ok: false, code, reason });
const OK = (data) => ({ ok: true, data });

// Redact before delivery (spec §9): non-founders see shared-agent availability only
function agentView(user, a) {
  if (user.id === 'ahmed') return { ...a };
  const busy = a.busyWith ? (DB.tasks[a.busyWith] && canSee(user, DB.tasks[a.busyWith]) ? a.busyWith : 'busy') : null;
  return { id: a.id, name: a.name, role: a.role, dept: a.dept, availability: a.busyWith ? 'Busy' : 'Available', busyWith: busy === 'busy' ? undefined : busy };
}

function nextId(p) { DB.seq += 1; return `${p}-${DB.seq}`; }
function record(ev) {
  const e = { id: nextId('E'), ts: new Date().toISOString(), mode: 'demo', ...ev };
  DB.events.push(e); save(); emit(e); return e;
}

// ---------- workflow (deterministic demonstration) ----------
// Each step names who may trigger it. Agent steps are SIMULATED and labelled as such.
const FLOW = {
  brief_ready:        { action: 'assign',          by: ['ahmed'], label: 'Meedz assigns Maya (scoped Discreet instance)' },
  assigned:           { action: 'produce',         by: 'agent', label: 'Maya produces evidence packet (simulated)' },
  evidence_submitted: { action: 'start_review',    by: 'agent', label: 'Amir starts independent review (simulated)' },
  in_review:          { action: 'complete_review', by: 'agent', label: 'Amir records review result (simulated)' },
  review_passed:      { action: 'domain_review',   by: 'agent', label: 'Scout records domain review (simulated)' },
  domain_reviewed:    { action: 'route_decision',  by: 'agent', label: 'Robin routes decision to Ahmed (simulated)' },
};
export function nextStep(task) { return FLOW[task?.state] || null; }

function doAction(user, task, action, payload = {}) {
  const key = payload.idem;
  if (key && DB.events.some((e) => e.idem === key)) return OK({ duplicate: true, task }); // idempotent
  switch (action) {
    case 'assign': {
      if (task.state !== 'brief_ready') return DENY(409, 'Task is not ready for assignment.');
      if (task.technical && !task.suhailReviewed) return DENY(423, 'Technical tasks stay unassigned until Suhail reviews intake.');
      if (!(user.id === 'ahmed' || (user.role === 'head' && memberOf(user, task.unit) && task.accountable === user.id))) return DENY(403, 'Only the accountable human can authorise assignment.');
      const a = DB.agents.maya;
      if (a.busyWith && a.busyWith !== task.id) return DENY(409, 'Scheduling conflict: Maya is busy. Routed to Ahmed via Iris (no silent pre-emption).');
      task.state = 'assigned'; task.assignee = 'maya'; a.busyWith = task.id;
      record({ taskId: task.id, type: 'assigned', from: 'meedz', to: 'maya', status: 'assigned', idem: key, deliverable: { id: 'BRIEF-014', version: 1, title: 'Improved brief' }, note: `Authorised by ${user.name}. Meedz assigned Maya (instance maya@discreet).` });
      return OK({ task });
    }
    case 'produce': {
      if (task.state !== 'assigned') return DENY(409, 'Not assigned.');
      task.version += 1;
      task.evidence = { id: 'EVP-014', version: 1, hash: hash(DB._evidenceText), text: DB._evidenceText };
      task.state = 'evidence_submitted';
      DB.agents.maya.busyWith = null; DB.agents.amir.busyWith = task.id;
      record({ taskId: task.id, type: 'handoff', from: 'maya', to: 'amir', status: 'evidence_submitted', idem: key,
        deliverable: { ...task.evidence, text: undefined, title: 'Evidence packet v1 (synthetic)' }, note: 'Simulated agent output — sample text, not research.' });
      return OK({ task });
    }
    case 'start_review': {
      if (task.state !== 'evidence_submitted') return DENY(409, 'No evidence submitted.');
      task.state = 'in_review';
      record({ taskId: task.id, type: 'review_started', from: 'amir', to: 'amir', status: 'in_review', idem: key, note: 'Amir received artefacts only — not Maya\'s conclusions or conversation.' });
      return OK({ task });
    }
    case 'complete_review': {
      if (task.state !== 'in_review') return DENY(409, 'Review not started.');
      const fail = !!payload.fail;
      task.review = fail
        ? { result: 'failed', passed: ['Scope format'], failed: ['Sources are placeholders'], untested: ['Market claims'], inconclusive: ['Feasibility'] }
        : { result: 'passed', passed: ['Scope format', 'Structure', 'Labels'], failed: [], untested: ['Market claims (synthetic data)'], inconclusive: ['Feasibility'] };
      DB.agents.amir.busyWith = null;
      if (fail) {
        task.state = 'returned_to_requester';
        record({ taskId: task.id, type: 'returned', from: 'amir', to: task.requester, status: 'returned_to_requester', idem: key, deliverable: { id: 'QA-014', version: 1, title: 'Quality assessment (failed)' }, note: 'Weak evidence returned immediately to requester. No automatic re-research.' });
      } else {
        task.state = 'review_passed';
        record({ taskId: task.id, type: 'handoff', from: 'amir', to: 'robin', status: 'review_passed', idem: key, deliverable: { id: 'QA-014', version: 1, title: 'Independent quality assessment' }, note: 'Assessment attached; required domain review still shown as not provided.' });
      }
      return OK({ task });
    }
    case 'domain_review': {
      if (task.state !== 'review_passed') return DENY(409, 'Quality review has not passed.');
      task.state = 'domain_reviewed'; task.domainReview = { by: 'scout', result: 'conclusions consistent with sample evidence (synthetic)' };
      record({ taskId: task.id, type: 'domain_review', from: 'scout', to: 'robin', status: 'domain_reviewed', idem: key, deliverable: { id: 'DR-014', version: 1, title: 'Domain specialist review' }, note: 'Scout checked conclusions against the evidence packet (simulated).' });
      return OK({ task });
    }
    case 'route_decision': {
      if (task.state !== 'domain_reviewed') return DENY(409, 'Required reviews are not complete.');
      task.state = 'awaiting_decision';
      task.decision = { id: 'Q-014', to: 'ahmed', evidenceVersion: task.evidence.version, evidenceHash: task.evidence.hash, status: 'open', note: '' };
      record({ taskId: task.id, type: 'decision_routed', from: 'robin', to: 'ahmed', status: 'awaiting_decision', idem: key, deliverable: { id: 'Q-014', version: 1, title: 'Decision request' } });
      return OK({ task });
    }
    case 'decide': {
      if (task.state !== 'awaiting_decision') return DENY(409, 'No open decision.');
      if (user.id !== task.decision.to) return DENY(403, 'Only the authorised human can decide.');
      const choice = payload.choice; // 'approve' | 'reject' | 'edit'
      if (choice === 'edit' && !(payload.note || '').trim()) return DENY(400, 'Edit needs a note saying what to change.');
      if (choice === 'approve' && !(task.review?.result === 'passed' && task.domainReview)) return DENY(423, 'Required review missing: approval stays blocked.');
      if (payload.evidenceHash !== task.decision.evidenceHash) return DENY(412, 'Evidence changed since this decision was prepared. Approval is version-bound.');
      if (!['approve', 'reject', 'edit'].includes(choice)) return DENY(400, 'Unknown choice.');
      task.decision.status = choice; task.decision.note = (payload.note || '').slice(0, 500); task.decision.option = payload.option || null;
      task.state = choice === 'approve' ? 'approved' : choice === 'reject' ? 'closed' : 'returned_for_edit';
      record({ taskId: task.id, type: 'decided', from: user.id, to: 'robin', status: task.state, idem: key, note: `${user.name} chose ${choice.toUpperCase()}${payload.option ? ' · ' + payload.option : ''}. Applies to evidence v${task.decision.evidenceVersion} only.` });
      return OK({ task });
    }
    case 'run_live': {
      DB.integration.lastError = 'Live AI integration is not connected (paid execution off, calibration pending).';
      record({ taskId: task.id, type: 'integration_failed', from: 'system', to: user.id, status: task.state, idem: key, note: DB.integration.lastError + ' Task state unchanged; demo path still available.' });
      return DENY(503, DB.integration.lastError);
    }
    case 'save_note': {
      if (task.state !== 'awaiting_decision') return DENY(409, 'No open decision.');
      if (user.id !== task.decision.to) return DENY(403, 'Not your decision.');
      task.decision.draft = (payload.note || '').slice(0, 500); save();
      return OK({ task });
    }
    default: return DENY(400, 'Unknown action.');
  }
}

export function api(userId) {
  const user = USERS[userId];
  if (!user) throw new Error('unknown user');
  return {
    user,
    listTasks(unit) {
      return OK(Object.values(DB.tasks).filter((tk) => canSee(user, tk) && (!unit || tk.unit === unit)).map((tk) => ({ ...tk, evidence: tk.evidence ? { ...tk.evidence } : null })));
    },
    getTask(id) {
      const tk = DB.tasks[id];
      if (!tk) return DENY(404, 'Not found.');
      if (!canSee(user, tk)) return DENY(404, 'Not found.'); // deny without confirming existence
      return OK(JSON.parse(JSON.stringify(tk)));
    },
    events(taskId) {
      return OK(DB.events.filter((e) => { const tk = DB.tasks[e.taskId]; return tk && canSee(user, tk) && (!taskId || e.taskId === taskId); }).map((e) => ({ ...e })));
    },
    search(q) {
      const s = (q || '').toLowerCase();
      const hits = [];
      for (const tk of Object.values(DB.tasks)) if (canSee(user, tk) && (tk.title + ' ' + (tk.brief?.outcome || '')).toLowerCase().includes(s)) hits.push({ kind: 'task', id: tk.id, title: tk.title });
      for (const n of Object.values(DB.notes)) if (canSee(user, n) && n.text.toLowerCase().includes(s)) hits.push({ kind: 'note', id: n.id, title: n.text });
      return OK(hits);
    },
    notes() { return OK(Object.values(DB.notes).filter((n) => canSee(user, n)).map((n) => ({ ...n }))); },
    agents() { return OK(Object.values(DB.agents).map((a) => agentView(user, a))); },
    floor(n) { return canEnterFloor(user, n) ? OK(FLOORS[n]) : DENY(403, n === 6 ? 'Floor 6 is founder-only.' : 'Staff floors are not part of the public preview.'); },
    units() { return OK(Object.values(UNITS).filter((u) => !u.umbrella && (user.units.includes('*') || user.units.includes(u.id))).map((u) => ({ ...u }))); },
    act(taskId, action, payload) {
      const tk = DB.tasks[taskId];
      if (!tk || !canSee(user, tk)) return DENY(404, 'Not found.');
      if (user.role === 'visitor') return DENY(403, 'Read-only preview.');
      const step = FLOW[tk.state];
      if (step && step.action === action && step.by === 'agent' && !memberOf(user, tk.unit)) return DENY(403, 'Not a member of this unit.');
      return doAction(user, tk, action, payload);
    },
  };
}

export function _debugDB() { return DB; }

// Server mode: replace local data with exactly what the server sent this person (already filtered by RLS)
export function loadServer(snap) {
  const h = snap.me && snap.me.handle;
  if (h && USERS[h]) USERS[h].units = snap.me.is_founder ? ['*'] : ['discreet'];
  const agents = JSON.parse(JSON.stringify(AGENTS));
  DB = { schema: SCHEMA, seq: 100000, server: true, integration: { live: false }, _evidenceText: '', agents,
    tasks: Object.fromEntries(snap.tasks.map((t) => [t.id, { id: t.id, unit: t.unit_id, visibility: t.visibility, demo: t.demo, title: t.title, type: t.technical ? 'Technical' : 'Task', technical: t.technical,
      requester: t.requester, accountable: t.accountable, brief: t.brief ? Object.fromEntries(Object.entries(t.brief).filter(([k]) => k !== 'domainReview')) : null, state: t.state, version: t.version,
      evidence: t.evidence, review: t.review, decision: t.decision, domainReview: t.brief && t.brief.domainReview ? { by: 'scout', result: t.brief.domainReview } : null, assignee: null, verifier: 'amir' }])),
    events: snap.events.map((e) => ({ id: 'E-' + e.id, ts: e.created_at, taskId: e.task_id, type: e.type, from: e.from_actor, to: e.to_actor, status: e.status, deliverable: e.deliverable, note: e.note, mode: e.mode })),
    notes: Object.fromEntries(snap.notes.map((n) => [n.id, { id: n.id, unit: n.unit_id, visibility: n.visibility, by: n.by_agent, text: n.body }])),
  };
  emit();
  return h;
}
let muted = false;
export function _sandbox(fn) {
  const snap = JSON.stringify(DB); muted = true;
  try { DB = seed(); return fn(); } finally { DB = JSON.parse(snap); muted = false; save(); }
}
