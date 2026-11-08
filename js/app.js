import * as THREE from 'three';
import { Campus, FH, CHOREO, loadKit } from './scene.js?v=202611080200';
import { initDB, api, USERS, UNITS, FLOORS, subscribe, resetDemo, nextStep, recoveryNotice, canSee, _debugDB } from './data.js?v=202611080200';
import { runChecks } from './checks.js?v=202611080200';
import { ROLES as ROLES_LOCAL, CLASSES as CLASSES_LOCAL, UNIVERSAL_RULES as RULES_LOCAL, buildRoles } from './roles.js?v=202611080200';
import { REGISTER as REGISTER_LOCAL } from './legal.js?v=202611080200';
import * as SV from './server.js?v=202611080200';
import { createVisit } from './visit.js?v=202611080200';
import { loadServer } from './data.js?v=202611080200';
let ROLES = ROLES_LOCAL, CLASSES = CLASSES_LOCAL, UNIVERSAL_RULES = RULES_LOCAL, REGISTER = REGISTER_LOCAL;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = { ahmed: 'Ahmed', suhail: 'Suhail', mohamed: 'Mohamed', youssef: 'Youssef', meedz: 'Meedz', maya: 'Maya', amir: 'Amir', robin: 'Robin', iris: 'Iris', scout: 'Scout', leila: 'Leila', system: 'System' };
const nm = (id) => NAMES[id] || id;

const params = new URLSearchParams(location.search);
const isMobile = () => window.matchMedia('(max-width: 1020px)').matches;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = {
  user: (() => { try { return sessionStorage.getItem('wq-user') || 'ahmed'; } catch { return 'ahmed'; } })(),
  floor: 0, reduced: prefersReduced || params.has('reduced'), direct: params.has('direct'), view: 'floor', task: null, playing: false, framed: false,
};
initDB(params.has('fresh') || SV.enabled);
if (SV.enabled) { S.user = 'visitor'; S.server = true; }
const SHOWCASE = !!window.WQ_SHOWCASE; if (SHOWCASE) S.user = 'visitor';
let A = api(S.user);
// server mode: every action goes to the server gate, then the view reloads from the server
function wrapServer(base) { return { ...base, act: async (id, action, payload) => { try { const r = await SV.act(id, action, payload); await refreshServer(); return r && r.ok === false ? r : { ok: true, ...(r || {}) }; } catch (e) { return { ok: false, code: e.status, reason: e.message }; } } }; }
async function refreshServer() {
  const snap = await SV.snapshot(); const h = loadServer(snap);
  if (!h) { S.user = 'visitor'; A = api('visitor'); return null; }
  S.user = h; A = wrapServer(api(h));
  const c = Object.fromEntries((snap.content || []).map((x) => [x.key, x.body]));
  ROLES = c.roles_src ? buildRoles(c.roles_src) : []; if (c.rules) { CLASSES = c.rules.classes; UNIVERSAL_RULES = c.rules.rules; } else { CLASSES = {}; UNIVERSAL_RULES = []; } REGISTER = c.register || [];
  return h;
}

try { await loadKit('assets/kit/'); } catch (e) { console.warn('Furniture kit not loaded; using built-in shapes', e); }
const campus = new Campus($('#stage'), { lowPower: isMobile() || params.has('lowpower'), capture: params.has('capture') });
campus.reduced = S.reduced;
window.__wq = { campus, S, api, _debugDB, runChecks: () => runChecks(api) };

new THREE.TextureLoader().load(UNITS.discreet.logo, (t) => { t.colorSpace = THREE.SRGBColorSpace; campus.setUnitLogo(t); });

// ---------------- labels ----------------
const labelsEl = $('#labels'); const chipPool = [];
campus.onFrame = () => {
  const list = S.framed || campus.mode === 'interior' ? campus.labels.filter((l) => l.floor === campus.activeFloor) : [];
  let i = 0;
  const v = new THREE.Vector3();
  const thin = isMobile() && campus.activeFloor === 4;
  for (const l of list) {
    if (thin && l.kind === 'person') continue;
    if (l.kind === 'person') { if (!l.person.root.visible) continue; l.person.root.getWorldPosition(v); v.y += 2.05 * l.person.s; } else v.copy(l.pos).add(new THREE.Vector3(0, campus.activeFloor * FH, 0));
    const p = campus.project(v); if (!p.vis) continue;
    let c = chipPool[i]; if (!c) { c = document.createElement('div'); chipPool.push(c); labelsEl.appendChild(c); c.addEventListener('click', () => { const rid = c.dataset.room; if (!rid) return; if (visit.onChip(rid)) return; if (!visit.on) openRoomById(rid); }); }
    c.className = 'chip ' + l.kind + (l.person && l.person.id === S.activePerson ? ' active' : '');
    c.textContent = l.text; c.dataset.room = l.roomId || '';
    c.style.left = p.x + 'px'; c.style.top = p.y + 'px'; c.style.display = '';
    i++;
  }
  for (; i < chipPool.length; i++) chipPool[i].style.display = 'none';
};

// ---------------- toasts ----------------
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600); }

const visit = createVisit({ campus, $, esc, toast, panel: (h) => panel(h), isMobile });
window.__wq && (window.__wq.visit = visit);
function visitPanel() { return `<div class="card"><h3>Client visit</h3><p class="muted">You are the visitor. Tap the floor to walk; tap a glowing spot to read. Jade is the AI host.</p><p class="small muted">Ground-floor showcase only. Text is sample copy awaiting approval.</p><div class="btnrow"><button class="tbtn" data-act="endvisit">End visit</button></div></div>`; }
// ---------------- intro (walk-in) ----------------
function intro() {
  campus.mode = 'exterior'; campus.showFloors(0, { exterior: true });
  // Walk-in removed at Ahmed's request (5 Nov 2026); add ?walkin to the address to replay it.
  const skipNow = !params.has('walkin');
  if (skipNow) return frameUI(true);
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // 1) establishing exterior → approach the entrance
  campus.camera.position.set(-16, 22, 104); campus.camTarget.set(0, 16, 0); campus.camera.lookAt(campus.camTarget);
  setTimeout(() => $('#introCard').classList.add('out'), params.has('capture') ? 0 : 2600);
  campus.flyPath([P(-16, 22, 104), P(-6, 11, 60), P(0, 3.4, 31), P(0, 2.1, 20.5)], [P(0, 16, 0), P(0, 9, 6), P(0, 3.2, 13), P(0, 2.0, 13)], 6.5, () => {
    if (S.framed) return;
    // 2) doors slide open
    const doors = campus.doors || [];
    campus.tween(0.9, (k) => doors.forEach((d, i) => { d.position.x = (i ? 1 : -1) * (0.78 + k * 1.45); }), () => {
      if (S.framed) return;
      campus.mode = 'interior'; campus.showFloors(0); for (const F of campus.floors) if (F.n === 0) F.front.visible = true;
      // 3) walk through, past reception, crane up to the floor overview
      const end = campus.floorView(0);
      campus.flyPath([P(0, 2.1, 20.5), P(0, 1.9, 13.5), P(0, 2.4, 9.5), P(0, 8, 13), end.pos], [P(0, 2.0, 13), P(0, 1.6, 5), P(0, 1.2, -2), P(0, 0.6, 0), end.target], 6.0, () => { if (!S.framed) frameUI(false); });
    });
  });
  $('#skip').onclick = () => frameUI(true);
}
function frameUI(skipped) {
  if (S.framed) return; S.framed = true; campus.tweens.length = 0;
  (campus.doors || []).forEach((d, i) => d.position.x = (i ? 1 : -1) * 2.23);
  campus.mode = 'interior'; campus.showFloors(S.floor); campus.floors[0].front.visible = S.floor === 0;
  document.body.classList.add('framed');
  // keep renderer in sync while the stage frame animates
  const t0 = performance.now(); const tick = () => { campus.resize(); if (performance.now() - t0 < 1100) requestAnimationFrame(tick); else { campus.resize(); route(); } }; tick();
  if (skipped) { const v = campus.floorView(S.floor); campus.flyTo(v, 0); }
  if (recoveryNotice) toast(recoveryNotice);
}

// ---------------- navigation ----------------
function renderNav() {
  const fn = $('#floorNav'); fn.innerHTML = '';
  for (const f of [...FLOORS].reverse()) {
    const ok = A.floor(f.n).ok;
    const b = document.createElement('button'); b.className = 'navbtn' + (S.floor === f.n ? ' on' : ''); b.dataset.floor = f.n;
    b.innerHTML = `<span class="n">${f.short}</span>${esc(f.name.replace(/^Floor \d · |^Ground · /, '') )}${ok ? '' : '<span class="lock">🔒</span>'}`;
    b.setAttribute('aria-label', f.name + (ok ? '' : ' (no access)'));
    b.onclick = () => goFloor(f.n); fn.appendChild(b);
  }
  const hn = $('#headNav'); hn.innerHTML = '';
  for (const [id, label] of [['u-meedz', 'Meedz'], ['u-sully', 'Sully'], ['u-mesi', 'Mesi'], ['u-joe', 'Joe']]) {
    const b = document.createElement('button'); b.className = 'navbtn'; b.innerHTML = `<span class="n">${label[0]}</span>${label}`; b.onclick = () => openRoomById(id); hn.appendChild(b);
  }
  if ($('#userSel')) $('#userSel').value = S.user;
}
function setTitle(n) { const f = FLOORS[n]; $('#ftSmall').textContent = n === 5 ? 'WARQÉVA · Discreet' : 'WARQÉVA'; $('#ftH').textContent = f.name; document.title = `${f.name} — WARQÉVA`; }

function goFloor(n, { fly = true, then } = {}) {
  if (visit.on && n !== 0) visit.stop();
  const r = A.floor(n);
  if (!r.ok) { toast(r.reason); panel(deniedCard(r.reason, `Floor ${n}`)); return false; }
  const from = campus.activeFloor; S.floor = n; S.view = 'floor';
  const instant = S.reduced || S.direct;
  const dur = instant ? 0 : Math.min(2.4, 1.2 + Math.abs(n - from) * 0.25);
  if (from !== n) campus.transitionFloors(from, n, dur * 0.8); else campus.showFloors(n);
  campus.floors[0].front.visible = n === 0;
  if (fly) campus.flyTo(campus.floorView(n), dur, then); else then && then();
  setTitle(n); renderNav(); panel(floorPanel(n)); setHash('floor-' + n);
  return true;
}
function openRoomById(id) {
  const hit = campus.rooms.find((h) => h.userData.roomId === id); if (!hit) return;
  const n = hit.userData.floor;
  const go = () => { campus.flyTo(campus.roomView(hit), S.reduced || S.direct ? 0 : 1.3); panel(roomPanel(hit)); };
  if (campus.activeFloor !== n || S.floor !== n) { if (goFloor(n, { fly: false })) go(); } else go();
}
let downXY = null;
campus.renderer.domElement.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
campus.renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6 || !S.framed || visit.on) return;
  const hit = campus.pick(e.clientX, e.clientY); if (hit) openRoomById(hit.userData.roomId);
});

// ---------------- panels ----------------
function panel(html) { const p = $('#panel'); p.innerHTML = html; p.scrollTop = 0; wire(p); }
function deniedCard(reason, what, note) { return `<div class="denied"><h3>No access</h3><p class="muted" style="color:#6d2d20">${esc(reason)}</p><p class="small">${esc(what)} · ${esc(note || 'checked in the data layer before anything is loaded. Nothing from this area was sent to the page.')}</p></div><div class="btnrow"><button class="tbtn" data-act="floor" data-n="0">Go to Ground floor</button></div>`; }

const FLOOR_NOTES = {
  0: ['Front-centre reception (Jade), side business galleries, central networking lounge, rear demonstration theatre and workshop. Operations sit behind a staff-only corridor.', 'Public showcase shows approved exhibits only.'],
  1: ['Sales and Partnerships on the left with Finance & Procurement; Marketing and Brand on the right with the rehearsal studio; central campaign & proposal table.', ''],
  2: ['Engineering left, Security right, independent assurance facing the handoff table, shared rear lab and incident room.', ''],
  3: ['Central learning garden with Learning & Development, knowledge library, evaluation lab, Agent Resources and Analytics studio around it.', ''],
  4: ['AI managers and department leaders around the Scout research library, with Meedz coordinating; Robin (Governance) and Mariam in the side rooms. Sully, Mesi and Joe sit with their humans on Floor 5.', 'Mariam’s appearance is not approved yet; stand-in shown.'],
  5: ['Business units. Each active unit shows its approved logo, colours, human leads and a unit-scoped Meedz office. Layout follows the locked Human Leadership plan.', ''],
  6: ['Private workspace for Ahmed and Meedz: business-unit priorities, confidential work and founder approvals. Owner-only.', ''],
};
function floorPanel(n) {
  const [d, note] = FLOOR_NOTES[n];
  let h = `<div class="card"><div class="k">${esc(FLOORS[n].name)}</div><p class="muted">${esc(d)}</p>${note ? `<p class="small muted">${esc(note)}</p>` : ''}<p class="small muted">Tap a room to zoom in. Characters are stand-ins until rigged versions of the approved characters exist.</p></div>`;
  if (n === 0) h = `<div class="card"><h3>Client visit</h3><p class="muted">Be greeted by Jade and walk the showcase like a game: tap to walk, tap glowing spots to read.</p><div class="btnrow"><button class="tbtn primary" data-act="visit">Start a visit</button></div></div>` + h;
  if (n === 5) h += unitsCard();
  if (n === 6) h += founderCard();
  const rooms = campus.rooms.filter((r) => r.userData.floor === n);
  h += `<div class="card"><h3>Rooms</h3><div class="list">${rooms.map((r) => `<button class="item" data-act="room" data-id="${r.userData.roomId}"><b>${esc(r.userData.label)}</b><span class="go">›</span></button>`).join('')}</div></div>`;
  return h;
}
function unitsCard() {
  const r = A.units(); if (!r.ok || !r.data.length) return `<div class="card"><h3>Business units</h3><p class="muted">No units are shared with this view.</p></div>`;
  return r.data.map((u) => `<div class="card"><div class="k">Business unit · active</div>
    <div class="unit" style="border-color:${u.colours.primary};background:${u.colours.paper}"><img src="${u.logo}" alt="${esc(u.name)} logo"><div><h3 style="color:${u.colours.primary}">${esc(u.name)}</h3><div class="muted">${esc(u.tagline)}</div>
    <div style="margin-top:6px">${Object.values(u.colours).map((c) => `<span class="sw" title="${c}" style="background:${c}"></span>`).join(' ')}</div></div></div>
    <p class="k" style="margin-top:12px">Human leads</p>
    <div class="list">${u.leads.map((id) => `<div class="item"><b>${esc(USERS[id].name)}</b><span class="muted">${esc(USERS[id].counterpart)} · ${esc(USERS[id].title)}</span></div>`).join('')}</div>
    <div class="btnrow"><button class="tbtn primary" data-act="workspace">Open Discreet workspace</button><button class="tbtn" data-act="room" data-id="u-meedz">Meedz · unit office</button></div>
    <p class="small muted">Other units: none active yet. New units need their approved logo and colours.</p></div>`).join('');
}
function founderCard() {
  const t = A.listTasks().data.filter((x) => x.visibility === 'founder');
  const notes = A.notes().data;
  return `<div class="card"><h3>Founder approvals & confidential work</h3><div class="list">${t.map(taskItem).join('') || '<p class="muted">None.</p>'}</div>
  <p class="k" style="margin-top:10px">Private notes</p>${notes.map((n) => `<div class="item"><b>${esc(n.by)}</b><span class="muted">${esc(n.text)}</span></div>`).join('')}</div>`;
}
function roomPanel(hit) {
  const u = hit.userData; const n = u.floor;
  let h = `<div class="card"><div class="k">${esc(FLOORS[n].name)}</div><h3>${esc(u.label)}</h3>`;
  if (n === 5 && u.roomId.startsWith('u-')) {
    const who = { 'u-meedz': ['Meedz', 'ahmed', 'Unit-scoped Meedz office for Discreet. Meedz assigns work and recommends; Ahmed decides.'], 'u-sully': ['Sully', 'suhail', 'Technology & Security. Every new technical task waits for Suhail’s intake review.'], 'u-mesi': ['Mesi', 'mohamed', 'Commercial Co-Head. Private assistant Deniz.'], 'u-joe': ['Joe', 'youssef', 'Commercial Co-Head. Private assistant Ece.'] }[u.roomId];
    h += `<p class="muted">${esc(who[2])}</p><p class="small muted">Visiting an office does not grant data access. Private notes are visible to ${esc(USERS[who[1]].name)} and Ahmed only.</p>`;
    const notes = A.notes().data.filter((x) => x.visibility === 'private:' + who[1]);
    h += notes.length ? notes.map((x) => `<div class="item"><b>${esc(x.by)}</b><span class="muted">${esc(x.text)}</span></div>`).join('') : `<div class="item"><span class="muted">Private notes: hidden for this viewer.</span></div>`;
    h += `<div class="btnrow"><button class="tbtn primary" data-act="workspace">Discreet tasks</button><button class="tbtn" data-act="escalateTeam">Escalate to team</button></div>`;
  } else if (u.roomId.startsWith('ai-') && ROLES.find((r) => 'ai-' + r.id === u.roomId)) { return roleCardPanel(u.roomId.slice(3)); }
  else h += `<p class="muted">Room view. Tasks, blockers and requests for this room appear here once its department workflows are built (later increment).</p>`;
  h += `<div class="btnrow"><button class="tbtn" data-act="floor" data-n="${n}">Back to floor</button></div></div>`;
  return h;
}
const STATE_LABEL = { brief_ready: 'Brief ready', assigned: 'Assigned', evidence_submitted: 'Evidence submitted', in_review: 'In independent review', review_passed: 'Quality review passed', domain_reviewed: 'Domain review done', awaiting_decision: 'Awaiting Ahmed’s decision', approved: 'Approved', closed: 'Rejected · closed', returned_for_edit: 'Returned for edit', returned_to_requester: 'Returned to requester', awaiting_owner: 'Needs accountable owner', awaiting_suhail_intake: 'Awaiting Suhail intake', in_progress: 'In progress' };
function taskItem(t) { return `<button class="item" data-act="task" data-id="${t.id}"><div><b>${esc(t.title)}</b><div class="muted">${esc(t.id)} · ${esc(STATE_LABEL[t.state] || t.state)}</div></div><span class="go">›</span></button>`; }
function workspacePanel() {
  const ts = A.listTasks('discreet'); if (!ts.ok || !ts.data.length) return deniedCard('No Discreet tasks are visible to this viewer.', 'Discreet workspace');
  const ag = A.agents().data;
  return `<div class="card"><div class="unit" style="border-color:var(--dsc);background:#FDFBEF;padding:8px"><img src="${UNITS.discreet.logo}" alt="Discreet logo" style="width:96px"><div><h3 style="color:var(--dsc)">Discreet workspace</h3><div class="muted">Sample tasks · demonstration data</div></div></div></div>
  <div class="card"><h3>Tasks</h3><div class="list">${ts.data.map(taskItem).join('')}</div></div>
  <div class="card"><h3>Shared agents</h3><p class="small muted">${S.user === 'ahmed' ? 'Founder view: full cross-project detail.' : 'Availability only. Other projects stay hidden.'}</p><div class="list">${ag.map((a) => `<div class="item"><b>${esc(a.name)}</b><span class="muted">${esc(a.role)}</span><span class="go" style="font-weight:600;font-size:12px">${esc(a.availability || (a.busyWith ? 'Busy · ' + a.busyWith : 'Available'))}</span></div>`).join('')}</div></div>
  <div class="card"><h3>Escalation</h3><div class="btnrow"><button class="tbtn primary" data-act="escalateAhmed">Escalate to Ahmed</button><button class="tbtn" data-act="escalateTeam">Escalate to team</button></div></div>`;
}
const STEPS = [['brief_ready', 'Brief prepared (Iris)'], ['assigned', 'Meedz assigns Maya'], ['evidence_submitted', 'Maya hands evidence to Amir'], ['in_review', 'Amir reviews independently'], ['review_passed', 'Amir hands assessment to Robin'], ['domain_reviewed', 'Scout domain review'], ['awaiting_decision', 'Robin routes decision to Ahmed'], ['approved', 'Ahmed decides']];
function taskPanel(id) {
  const r = A.getTask(id); if (!r.ok) return deniedCard(r.code === 404 ? 'Not found, or you do not have access to this record.' : r.reason, 'Task link');
  const t = r.data; S.task = id;
  const evs = A.events(id).data;
  const idx = STEPS.findIndex(([s]) => s === t.state);
  const failed = t.state === 'returned_to_requester';
  const step = nextStep(t);
  const isMember = S.user === 'ahmed' || USERS[S.user].units.includes(t.unit);
  let h = `<div class="card"><div class="row"><span class="pill demo">Demo task</span><span class="pill neutral">${esc(t.id)}</span></div><h3 style="margin-top:8px">${esc(t.title)}</h3>${t.titleAr ? `<div class="ar" style="font-size:14px">${esc(t.titleAr)}</div>` : ''}
  <div class="row" style="margin-top:6px"><span class="pill ${failed ? 'bad' : t.state === 'approved' ? 'ok' : 'warn'}">${esc(STATE_LABEL[t.state] || t.state)}</span><span class="small muted">Owner: ${esc(t.accountable ? nm(t.accountable) : 'unassigned')}</span></div></div>`;
  if (t.brief) h += `<details ${t.id === 'DSC-T-014' ? '' : 'open'}><summary>Improved brief</summary><div>${Object.entries(t.brief).map(([k, v]) => `<p><span class="k">${esc(k)}</span><br>${esc(v)}</p>`).join('')}</div></details>`;
  if (t.id === 'DSC-T-014') {
    h += `<div class="card"><h3>Workflow</h3><div class="stepper">${STEPS.map(([s, l], i) => `<div class="st ${failed && i === 3 ? 'fail' : i < idx || t.state === 'approved' || (failed && i < 3) ? 'done' : i === idx ? 'now' : ''}"><i></i><span>${esc(l)}</span></div>`).join('')}</div>
    ${failed ? `<p class="muted" style="color:var(--bad)">Evidence failed review and went straight back to ${esc(nm(t.requester))}. No automatic re-research — the requester chooses the next step.</p>` : ''}
    <div class="btnrow">${step && isMember ? `<button class="tbtn primary" data-act="step">${esc(step.label)}</button>` : ''}
    ${t.state === 'in_review' && isMember ? `<button class="tbtn" data-act="failreview">Simulate failed review</button>` : ''}
    ${t.state === 'awaiting_decision' ? (S.user === 'ahmed' ? `<button class="tbtn primary" data-act="decide">Review decision</button>` : `<span class="small muted">Decision is with Ahmed.</span>`) : ''}
    ${isMember ? `<button class="tbtn" data-act="live">Run with live AI</button>` : ''}</div>
    <p class="small muted">Agent steps are simulated with fixed sample text (no AI call). “Run with live AI” shows how a failed integration is handled.</p></div>`;
  }
  h += `<div class="card"><h3>Task record</h3>${evs.slice().reverse().map(evRow).join('') || '<p class="muted">No events.</p>'}</div>`;
  return h;
}
function evRow(e) {
  const hand = ['handoff', 'assigned', 'decision_routed', 'returned'].includes(e.type);
  const ch = CHOREO[`${e.type}:${e.from}>${e.to}`];
  return `<div class="ev ${hand ? 'handoff' : ''}"><div><span class="who2">${esc(nm(e.from))} → ${esc(nm(e.to))}</span> · ${esc(e.type.replace('_', ' '))}</div>
  <div class="meta"><span>Status: ${esc(STATE_LABEL[e.status] || e.status)}</span>${e.deliverable ? `<span>Deliverable: ${esc(e.deliverable.title || e.deliverable.id)} · v${esc(e.deliverable.version)}${e.deliverable.hash ? ' · #' + esc(e.deliverable.hash) : ''}</span>` : ''}<span>${esc(e.mode === 'demo' ? 'Demonstrated' : 'Live')}</span><span>${esc(new Date(e.ts).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }))}</span></div>
  ${e.note ? `<div class="muted small" style="margin-top:3px">${esc(e.note)}</div>` : ''}
  ${ch ? `<button class="tbtn" data-act="play" data-ev="${e.id}">▶ View handoff</button>` : ''}</div>`;
}
function decisionsPanel() {
  const ts = A.listTasks().data.filter((t) => t.state === 'awaiting_decision' && t.decision && t.decision.to === S.user);
  return `<div class="card"><h3>Needs your decision</h3>${ts.length ? `<div class="list">${ts.map(taskItem).join('')}</div>` : '<p class="muted">Nothing waiting for you.</p>'}</div>`;
}
function morePanel() {
  return `<div class="card"><h3>Settings</h3>${S.server ? (S.user === 'visitor' ? '<button class="tbtn primary" data-act="signin">Sign in</button>' : `<p class="muted">Signed in as ${esc(USERS[S.user].name)}</p><button class="tbtn" data-act="signout">Sign out</button>`) : `<label class="toggle">Viewing as <select id="userSel2">${Object.values(USERS).map((u) => `<option value="${u.id}" ${u.id === S.user ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>`}
  <label class="toggle">Reduced motion <input type="checkbox" id="rm2" ${S.reduced ? 'checked' : ''}></label><label class="toggle">Direct navigation <input type="checkbox" id="direct2" ${S.direct ? 'checked' : ''}></label>
  <div class="btnrow"><button class="tbtn" data-act="staff">AI staff</button><button class="tbtn" data-act="rules">Company rules</button><button class="tbtn" data-act="register">Legal register</button><button class="tbtn" data-act="tests">Test record</button><button class="tbtn" data-act="reset">Reset demo data</button><button class="tbtn" data-act="overview">Building overview</button></div></div>`;
}
function floorsListPanel() { return `<div class="card"><h3>Floors</h3><div class="list">${[...FLOORS].reverse().map((f) => { const ok = A.floor(f.n).ok; return `<button class="item" data-act="floor" data-n="${f.n}"><b>${esc(f.name)}</b>${ok ? '' : '<span class="muted">🔒 no access</span>'}<span class="go">›</span></button>`; }).join('')}</div></div>`; }
function testsPanel() {
  if (S.server) return `<div class="card"><h3>Test record</h3><p class="muted">This live version is checked on the server. Latest run (5 Nov 2026): 36/36 access tests and 14/14 workflow tests passed on the Supabase database, run as each person and as a signed-out visitor.</p><p class="small muted">Full record: Test_Record in the WARQÉVA project.</p></div>`;
  const res = runChecks(api);
  const groups = ['passed', 'failed', 'untested', 'inconclusive'];
  return `<div class="card"><h3>Test record (in-browser)</h3><p class="small muted">Runs against a fresh copy of the sample data; your current demo state is untouched.</p>${groups.map((g) => `<p class="k" style="margin-top:8px">${g} (${res[g].length})</p>${res[g].map((x) => `<div class="item"><span>${g === 'passed' ? '✅' : g === 'failed' ? '❌' : '◻️'}</span><span class="small">${esc(x)}</span></div>`).join('')}`).join('')}</div>`;
}


const staffOnly = () => USERS[S.user].role === 'visitor' ? deniedCard('Company records are not part of the public preview.', 'Company records', S.server ? 'withheld by the server: nothing was sent to this page.' : 'hidden in this view. In this demo copy the records ship with the page; the live version keeps them on the server.') : null;
function directoryPanel() {
  const d = staffOnly(); if (d) return d;
  const groups = {}; ROLES.forEach((r) => (groups[r.dept] = groups[r.dept] || []).push(r));
  return `<div class="card"><h3>AI staff directory</h3><p class="small muted">${ROLES.length} role cards · all <b>defined, not assessed, not provisioned</b>. Tap a name for the full card.</p></div>` +
    Object.entries(groups).map(([g, rs]) => `<div class="card"><div class="k">${esc(g)}</div><div class="list">${rs.map((r) => `<button class="item" data-act="role" data-id="${r.id}"><div><b>${esc(r.name)}</b><div class="muted">${esc(r.title)}</div></div><span class="muted ar" style="font-size:12px;margin-left:auto">${esc(r.titleAr)}</span></button>`).join('')}</div></div>`).join('');
}
function roleCardPanel(id) {
  const d = staffOnly(); if (d) return d;
  const r = ROLES.find((x) => x.id === id); if (!r) return deniedCard('No role card with that name.', 'Role card');
  setHash('role-' + id);
  const li = (xs) => `<ul style="margin:4px 0 0 18px;padding:0;font-size:12.8px;line-height:1.5">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<div class="card"><div class="row"><span class="pill neutral">${esc(r.dept)}</span><span class="pill warn">${esc(r.status)}</span></div><h3 style="margin-top:8px">${esc(r.name)} · ${esc(r.title)}</h3><div class="ar" style="font-size:14px">${esc(r.titleAr)}</div>
  <p class="small muted">Background (fictional identity, not capability evidence): ${esc(r.background)} · ${esc(r.artwork)}</p></div>
  <div class="card"><p class="k">Reports to</p><p class="muted">${esc(r.reportsTo)}</p><p class="k">Duties</p>${li(r.duties)}<p class="k" style="margin-top:8px">Tools (scoped)</p>${li(r.tools)}<p class="k" style="margin-top:8px">Checked independently by</p><p class="muted">${esc(r.checkedBy)}</p><p class="k">Measured by (no figures until real work)</p>${li(r.measures)}<p class="k" style="margin-top:8px">Model route</p><p class="muted">${esc(r.modelRoute)}</p></div>
  <div class="card"><h3>Authority</h3><p class="small"><b>A</b> · ${esc(r.authority.A)}</p><p class="small"><b>B</b> · ${esc(r.authority.B)}</p><p class="small"><b>C · needs a human</b></p>${li(r.authority.C)}<p class="small" style="margin-top:6px"><b>D</b> · ${esc(r.authority.D)}</p><div class="btnrow"><button class="tbtn" data-act="rules">Company rules</button><button class="tbtn" data-act="staff">All staff</button></div></div>`;
}
function rulesPanel() {
  const d = staffOnly(); if (d) return d; setHash('rules');
  return `<div class="card"><h3>Company rules for every agent</h3><ol style="margin:6px 0 0 18px;padding:0;font-size:12.8px;line-height:1.55">${UNIVERSAL_RULES.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
  <div class="card"><h3>Authority classes</h3>${Object.entries(CLASSES).map(([k, v]) => `<p class="small"><b>${k}</b> · ${esc(v.en)}</p><p class="ar" style="font-size:13px;margin-top:-6px">${esc(v.ar)}</p>`).join('')}</div>`;
}
function registerPanel() {
  const d = staffOnly(); if (d) return d; setHash('register');
  return `<div class="card"><h3>Obligations register · draft</h3><p class="small muted"><b>Not legal advice.</b> Researched by the agent team on 5 Nov 2026 from public sources. Every item needs a qualified lawyer before it is relied on. No item is marked compliant.</p></div>` +
    REGISTER.map((o) => `<details class="card" style="padding:0"><summary>${esc(o.id)} · ${esc(o.area)} <span class="pill ${/High/.test(o.risk) ? 'bad' : /Medium/.test(o.risk) ? 'warn' : 'neutral'}" style="margin-left:6px">${esc(o.risk)}</span></summary><div>
    <p><b>${esc(o.law)}</b></p><p class="muted">Applies: ${esc(o.applies)}</p><ul style="margin:4px 0 0 18px;padding:0">${o.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <p><span class="k">Next action</span><br>${esc(o.action)}</p><p class="small muted">Owner: ${esc(o.owner)} · Status: ${esc(o.status)}</p>
    ${o.sources.length ? `<p class="small">Sources: ${o.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>` : ''}</div></details>`).join('');
}
function wire(root) {
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset)));
  const u2 = $('#userSel2', root); if (u2) u2.onchange = () => setUser(u2.value);
  const r2 = $('#rm2', root); if (r2) r2.onchange = () => setReduced(r2.checked);
  const d2 = $('#direct2', root); if (d2) d2.onchange = () => { S.direct = d2.checked; $('#direct').checked = S.direct; };
}
function act(a, d) {
  if (a === 'floor') goFloor(+d.n);
  else if (a === 'room') openRoomById(d.id);
  else if (a === 'workspace') { if (campus.activeFloor !== 5) goFloor(5); panel(workspacePanel()); S.view = 'workspace'; setHash('discreet'); flyProjectTable(); }
  else if (a === 'task') openTask(d.id);
  else if (a === 'step') doStep();
  else if (a === 'failreview') doStep({ fail: true });
  else if (a === 'live') { Promise.resolve(A.act(S.task, 'run_live', { idem: 'live-' + Date.now() })).then((r) => { toast(r.reason || 'Done'); panel(taskPanel(S.task)); }); }
  else if (a === 'signin') gate();
  else if (a === 'lock') { SV.rpc('lock_session').finally(() => { S.user = 'visitor'; A = api('visitor'); setWho(); renderNav(); goFloor(0); gate(); }); }
  else if (a === 'signout') { SV.rpc('lock_session').catch(() => {}).finally(() => { SV.signOut(); location.reload(); }); }
  else if (a === 'decide') openDecision(S.task);
  else if (a === 'play') { const e = A.events().data.find((x) => x.id === d.ev); if (e) playEvent(e); }
  else if (a === 'escalateAhmed' || a === 'escalateTeam') openEscalation(a === 'escalateTeam');
  else if (a === 'tests') { panel(testsPanel()); setHash('tests'); }
  else if (a === 'reset') { resetDemo(); toast('Demo data reset to the sample state.'); panel(floorPanel(S.floor)); }
  else if (a === 'overview') overview();
  else if (a === 'visit') { if (campus.activeFloor !== 0) goFloor(0, { then: () => visit.start() }); else visit.start(); panel(visitPanel()); }
  else if (a === 'endvisit') { visit.stop(); panel(floorPanel(0)); }
  else if (a === 'staff') { panel(directoryPanel()); setHash('staff'); }
  else if (a === 'role') panel(roleCardPanel(d.id));
  else if (a === 'rules') panel(rulesPanel());
  else if (a === 'register') panel(registerPanel());
}
function openTask(id) { panel(taskPanel(id)); S.view = 'task'; setHash('task-' + id.toLowerCase()); if (id.startsWith('DSC') && A.getTask(id).ok) { if (campus.activeFloor !== 5) goFloor(5, { then: flyProjectTable }); else flyProjectTable(); panel(taskPanel(id)); } }
function flyProjectTable() { campus.flyTo({ pos: new THREE.Vector3(0, 5 * FH + 15, 13), target: new THREE.Vector3(0, 5 * FH + 0.5, -1) }, S.reduced || S.direct ? 0 : 1.4); }
function overview() { S.framed && campus.flyTo({ pos: new THREE.Vector3(-34, campus.activeFloor * FH + 26, 52), target: new THREE.Vector3(0, campus.activeFloor * FH, 0) }, S.reduced ? 0 : 1.6); }

async function doStep(opts = {}) {
  const t = A.getTask(S.task); if (!t.ok) return;
  const step = opts.fail ? { action: 'complete_review' } : nextStep(t.data); if (!step) return;
  if (t.data.state === 'in_review' && !opts.fail) step.action = 'complete_review';
  const r = await A.act(S.task, step.action, { idem: `${S.task}:${t.data.state}:${t.data.version}:${opts.fail ? 'f' : 'p'}`, fail: !!opts.fail });
  if (!r.ok) { toast(r.reason); return; }
  panel(taskPanel(S.task));
  const last = A.events(S.task).data.slice(-1)[0];
  if (last && CHOREO[`${last.type}:${last.from}>${last.to}`]) playEvent(last);
}

// ---------------- handoff playback (animation reflects a recorded event) ----------------
async function playEvent(ev) {
  const key = `${ev.type}:${ev.from}>${ev.to}`; const ch = CHOREO[key]; if (!ch) return;
  showHandoffCard(ev);
  if (S.playing) { toast('A handoff is already playing.'); return; }
  if (campus.activeFloor !== 5) { if (!goFloor(5, { fly: false })) return; }
  panel(taskPanel(ev.taskId));
  { const seat0 = campus.seats[ch.from + '@5']; const pts = [[seat0.x, seat0.z], ...ch.go]; if (ch.to) { const s2 = campus.seats[ch.to + '@5']; s2 && pts.push([s2.x, s2.z]); } if (ch.exitToLift) pts.push([0, 11.4]);
    campus.flyTo(campus.pathView(5, pts), S.reduced || S.direct ? 0 : 1.3); }
  const from = campus.person(ch.from, 5), to = ch.to ? campus.person(ch.to, 5) : null; if (!from) return;
  if (S.reduced) { S.activePerson = from.id; setTimeout(() => (S.activePerson = null), 2500); return; } // motion reduced: show the record, skip the walk
  S.playing = true; S.activePerson = from.id;
  const seat = campus.seats[ch.from + '@5'];
  try {
    await campus.stand(from);
    await campus.walk(from, ch.go);
    if (ch.exitToLift) {
      await campus.walk(from, [[0, 11.4]]);
      from.root.visible = false; toast('Decision request delivered to Ahmed (Floor 6 · founder approvals).');
      await new Promise((r) => setTimeout(r, 900));
      from.place(seat.x, seat.z, seat.ry, true); from.root.visible = true; from.typing = true;
    } else {
      await campus.face(from, ch.faceRecipient);
      S.activePerson = ch.to;
      await campus.give(from, to);
      S.activePerson = from.id;
      const back = ch.go.slice(0, -1).reverse();
      await campus.walk(from, back);
      await campus.sitDown(from, seat);
    }
  } finally { S.playing = false; S.activePerson = null; }
}
function showHandoffCard(e) {
  const c = $('#handoffCard');
  c.innerHTML = `<div class="k">Task record · ${esc(e.id)} · ${esc(e.taskId)}</div><div class="flow">${esc(nm(e.from))} <span aria-hidden="true">→</span><span class="sr">to</span> ${esc(nm(e.to))}</div>
  <div class="row" style="flex-wrap:wrap;margin-top:6px"><span class="pill warn">${esc(STATE_LABEL[e.status] || e.status)}</span>${e.deliverable ? `<span class="pill neutral">${esc(e.deliverable.title || e.deliverable.id)} · v${esc(e.deliverable.version)}</span>` : ''}<span class="pill demo">Demonstrated</span></div>
  ${S.reduced ? '<p class="small muted">Reduced motion: walk animation skipped.</p>' : ''}<button class="tbtn" style="margin-top:8px" id="hcClose">Close</button>`;
  c.classList.add('show'); $('#hcClose').onclick = () => c.classList.remove('show');
}

// ---------------- decision popup (locked design) ----------------
let lang = 'en';
const REPORT = {
  en: `<h3>Market research brief · v1 (sample)</h3><p class="k">Recommendation</p><p>Run focused desk research before any decision to expand.</p><p class="k">Risks and open questions</p><p>Order size and costs need checking. Restaurant uptake is unknown.</p><p class="small muted">These are sample draft statements, not research findings.</p>`,
  ar: `<h3>موجز أبحاث السوق · الإصدار ١ (نموذج)</h3><p class="k">التوصية</p><p>إجراء بحث مكتبي مركّز قبل اتخاذ أي قرار بالتوسع.</p><p class="k">المخاطر والأسئلة المفتوحة</p><p>يلزم التحقق من حجم الطلبات والتكاليف، ومدى إقبال المطاعم غير معروف.</p><p class="small muted">هذه عبارات نموذجية لمسودة، وليست نتائج بحث.</p>`,
};
function openDecision(id) {
  const r = A.getTask(id); if (!r.ok || !r.data.decision) return;
  const t = r.data, q = t.decision; const rv = t.review || {};
  const missing = !(rv.result === 'passed' && t.domainReview);
  const m = $('#modal'), s = $('#sheet');
  s.innerHTML = `<div class="row"><h2 id="mTitle">Review a decision</h2><div class="spacer"></div><span class="pill demo">Demo · sample data</span><button class="tbtn" id="mClose" aria-label="Close (keeps the request open)">✕</button></div>
  <div class="row small muted" style="margin:4px 0 12px;flex-wrap:wrap">${esc(q.id)} · Discreet · Evidence pack v${esc(q.evidenceVersion)} · #${esc(q.evidenceHash)} <span class="pill warn">Awaiting your decision</span> · Prepared by Maya · Checked by Amir · Routed by Robin</div>
  <div class="card" style="background:#F2F8F1;border-color:#b9d3bb"><b>Recommendation: focused desk research</b><div class="muted">Validate the market assumptions before deeper work.</div></div>
  <div class="grid2"><div>
    ${[['focused', 'Focused desk research', 'Sample sources; limited coverage.', true], ['broader', 'Broader research plan', 'More coverage; usage estimate required.'], ['revise', 'Return for revision', 'Clarify the brief before work begins.']].map(([v, l, c, rec], i) => `<label class="opt ${rec ? 'rec' : ''}"><input type="radio" name="opt" value="${v}" ${rec ? 'checked' : ''}><div><b>${i + 1}. ${l}</b>${rec ? ' <span class="pill ok" style="padding:2px 8px">Recommended</span>' : ''}<div class="muted">Consequence: ${c}</div></div></label>`).join('')}
    <div class="row" style="align-items:stretch;gap:8px"><div class="card" style="flex:1;background:#FBEFD9;border-color:#ecd3a0;margin:0"><b class="small">Limits & unknowns</b><div class="small muted">No market conclusion verified. Paid execution remains off.</div></div><div class="card" style="flex:1;margin:0"><b class="small">If waiting</b><div class="small muted">Research stays queued. Silence is not approval.</div></div></div>
  </div><div>
    <div class="k" style="margin-bottom:6px">Evidence & assessments</div>
    <details><summary>Original research report</summary><div><div class="lang" role="group" aria-label="Language"><button data-l="en" class="${lang === 'en' ? 'on' : ''}">English</button><button data-l="ar" class="${lang === 'ar' ? 'on' : ''}">العربية</button></div>
      <div class="row small" style="margin:8px 0;flex-wrap:wrap"><span class="pill neutral">Matching version · v1</span><span class="pill warn">English: Draft</span><span class="pill warn">العربية: مسودة</span></div><div id="rep" class="${lang === 'ar' ? 'ar' : ''}" ${lang === 'ar' ? 'dir="rtl" lang="ar"' : ''}>${REPORT[lang]}</div><p class="small muted">Not independently language-reviewed.</p></div></details>
    <details open><summary>Independent quality assessment · Amir</summary><div>${['passed', 'failed', 'untested', 'inconclusive'].map((k) => `<div><b>${k[0].toUpperCase() + k.slice(1)}:</b> ${esc((rv[k] || []).join(', ') || 'none')}</div>`).join('')}</div></details>
    <details><summary>Domain specialist review · ${t.domainReview ? 'Scout · provided' : 'not yet provided'}</summary><div>${esc(t.domainReview ? t.domainReview.result : 'Required before approval.')}</div></details>
    <details><summary>Sources & limitations</summary><div>Synthetic evidence packet. No external research was performed in this demonstration.</div></details>
  </div></div>
  ${missing ? '<div class="card" style="background:#FBEFD9;border-color:#ecd3a0;margin-top:10px"><b>Required review missing</b><div class="small muted">Approval stays blocked until evidence is complete.</div></div>' : ''}
  <label class="k" for="dnote" style="display:block;margin-top:10px">Decision note / conditions (needed for Edit)</label><textarea id="dnote" placeholder="Add a brief note or any conditions…">${esc(q.draft || '')}</textarea>
  <div class="foot"><span class="small muted">Applies only to this action and evidence version. Closing this window leaves the request open.</span><div class="spacer"></div>
    <button class="tbtn" id="dReject">No · Reject</button><button class="tbtn" id="dEdit">Edit</button><button class="tbtn primary" id="dApprove" ${missing ? 'disabled' : ''}>Yes · Approve</button></div>`;
  m.classList.add('show'); $('#dApprove', s).focus?.();
  s.querySelectorAll('.lang button').forEach((b) => b.onclick = () => { lang = b.dataset.l; const rep = $('#rep', s); rep.innerHTML = REPORT[lang]; rep.className = lang === 'ar' ? 'ar' : ''; rep.dir = lang === 'ar' ? 'rtl' : 'ltr'; rep.lang = lang; s.querySelectorAll('.lang button').forEach((x) => x.classList.toggle('on', x === b)); });
  const close = () => { Promise.resolve(A.act(id, 'save_note', { note: $('#dnote', s).value })); m.classList.remove('show'); toast('Closed. The request stays open; your note was kept as a draft.'); };
  $('#mClose', s).onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  const decide = async (choice) => {
    const option = s.querySelector('input[name=opt]:checked')?.value;
    const r2 = await A.act(id, 'decide', { choice, option, note: $('#dnote', s).value, evidenceHash: q.evidenceHash, idem: `${id}:decide:${q.evidenceHash}` });
    if (!r2.ok) { toast(r2.reason); return; }
    m.classList.remove('show'); toast(choice === 'approve' ? 'Approved — recorded against evidence v' + q.evidenceVersion + ' only.' : choice === 'reject' ? 'Rejected — request closed.' : 'Returned for revision; it will need fresh approval.'); panel(taskPanel(id));
  };
  $('#dApprove', s).onclick = () => decide('approve'); $('#dReject', s).onclick = () => decide('reject'); $('#dEdit', s).onclick = () => decide('edit');
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').classList.contains('show')) $('#mClose')?.click(); });

function openEscalation(team) {
  const m = $('#modal'), s = $('#sheet');
  s.innerHTML = `<div class="row"><h2 id="mTitle">${team ? 'Escalate to team' : 'Escalate to Ahmed'}</h2><div class="spacer"></div><button class="tbtn" id="mClose">✕</button></div>
  <p class="muted">Locked design. This demonstration does not send anything.</p>
  <div class="grid2"><div><label class="k">Issue</label><textarea placeholder="What is blocked?"></textarea><label class="k">Requested help</label><textarea placeholder="What do you need?"></textarea></div>
  <div><div class="card"><b>Authorised project</b><div class="muted">Discreet</div></div><div class="card"><b>Recipients & shared content preview</b><div class="small muted">Iris coordinates. ${team ? 'Selected departments only.' : 'Robin routes to Ahmed.'} Private notes and assistant history are never included automatically.</div></div><label class="toggle">Propose a meeting <input type="checkbox"></label></div></div>
  <div class="foot"><div class="spacer"></div><button class="tbtn" id="eDraft">Save draft</button><button class="tbtn primary" disabled title="Sending is disabled in the demonstration">Send (disabled in demo)</button></div>`;
  m.classList.add('show'); $('#mClose', s).onclick = () => m.classList.remove('show'); $('#eDraft', s).onclick = () => { m.classList.remove('show'); toast('Draft kept on this device only.'); };
}

// ---------------- user / settings / routing ----------------
function setUser(u) {
  S.user = u; A = api(u); try { sessionStorage.setItem('wq-user', u); } catch {}
  $('#userSel').value = u; renderNav();
  if (!A.floor(S.floor).ok) goFloor(0); else route();
  toast(`Viewing as ${USERS[u].name}. Data is re-checked for this identity.`);
}
function setReduced(v) { S.reduced = v; campus.reduced = v; $('#rm').checked = v; }
$('#userSel').onchange = (e) => setUser(e.target.value);
$('#rm').checked = S.reduced; $('#rm').onchange = (e) => setReduced(e.target.checked);
$('#direct').checked = S.direct; $('#direct').onchange = (e) => { S.direct = e.target.checked; };
$('#testsBtn').onclick = () => act('tests'); $('#staffBtn').onclick = () => act('staff'); $('#rulesBtn').onclick = () => act('rules'); $('#regBtn').onclick = () => act('register'); $('#resetBtn').onclick = () => act('reset'); $('#overviewBtn').onclick = overview;
document.querySelectorAll('#bottomNav button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('#bottomNav button').forEach((x) => x.classList.toggle('on', x === b));
  const m = b.dataset.m;
  if (m === 'home') panel(floorPanel(S.floor)); else if (m === 'floors') panel(floorsListPanel()); else if (m === 'tasks') act('workspace'); else if (m === 'decisions') panel(decisionsPanel()); else panel(morePanel());
});

let suppressHash = false;
function setHash(h) { if (location.hash.slice(1) === h) return; suppressHash = true; try { history.replaceState(null, '', '#' + h); } catch { location.hash = h; } setTimeout(() => (suppressHash = false), 0); }
function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('floor-')) goFloor(+h.slice(6));
  else if (h.startsWith('task-')) { const id = h.slice(5).toUpperCase(); const r = A.getTask(id); if (!r.ok) { goFloor(A.floor(S.floor).ok ? S.floor : 0); panel(taskPanel(id)); } else openTask(id); }
  else if (h === 'discreet') act('workspace');
  else if (h === 'tests') act('tests');
  else if (h === 'decisions') panel(decisionsPanel());
  else if (h === 'staff') act('staff');
  else if (h.startsWith('role-')) panel(roleCardPanel(h.slice(5)));
  else if (h === 'rules') panel(rulesPanel());
  else if (h === 'register') panel(registerPanel());
  else goFloor(A.floor(S.floor).ok ? S.floor : 0);
  if (S.server && S.user === 'visitor') gate();
}
window.addEventListener('hashchange', () => { if (!suppressHash && S.framed) route(); });
subscribe(() => { if (S.view === 'task' && S.task && !$('#modal').classList.contains('show')) panel(taskPanel(S.task)); });

const inp = (id, type, ph, extra = '') => `<input id="${id}" type="${type}" placeholder="${ph}" ${extra} style="width:100%;padding:11px;border:1px solid var(--line);border-radius:12px;font:inherit;margin-top:8px">`;
function signInPanel(note) {
  return `<div class="card"><h3>Sign in</h3><form id="siForm">${inp('siUser', 'text', 'Username', 'autocomplete="username" autocapitalize="none" required')}${inp('siPass', 'password', 'Password', 'autocomplete="current-password" required')}
  <div class="btnrow"><button class="tbtn primary" type="submit">Sign in</button></div></form><p class="small muted">${esc(note || 'Sign in once on this device. After that you unlock with your 4-digit PIN.')}</p></div>` + floorPanel(0);
}
function setupPanel(st, note) {
  const pw = st.must_change_password;
  return `<div class="card"><h3>${pw ? 'Set your password and PIN' : 'Set your 4-digit PIN'}</h3><form id="suForm">
  ${pw ? inp('suPw', 'password', 'New password (at least 10 characters)', 'autocomplete="new-password" minlength="10" required') + inp('suPw2', 'password', 'Repeat new password', 'autocomplete="new-password" minlength="10" required') : ''}
  ${inp('suPin', 'password', '4-digit PIN', 'inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required')}${inp('suPin2', 'password', 'Repeat PIN', 'inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required')}
  <div class="btnrow"><button class="tbtn primary" type="submit">Save</button></div></form><p class="small muted">${esc(note || 'The PIN unlocks this device for 8 hours. 5 wrong tries locks it and you sign in again with your password.')}</p></div>`;
}
function pinPanel(note) {
  return `<div class="card"><h3>Unlock</h3><form id="pnForm">${inp('pnPin', 'password', '4-digit PIN', 'inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required autofocus')}
  <div class="btnrow"><button class="tbtn primary" type="submit">Unlock</button><button class="tbtn" type="button" data-act="signout">Use password instead</button></div></form><p class="small muted">${esc(note || 'Checked by the server. 5 wrong tries locks this account for 15 minutes.')}</p></div>`;
}
function show(html, after) { panel(html); after && after(); }
function wireSignIn() { const f = $('#siForm'); if (!f) return; f.onsubmit = async (e) => { e.preventDefault(); try { await SV.signInPassword($('#siUser').value, $('#siPass').value); await gate(); } catch (err) { show(signInPanel(err.message), wireSignIn); } }; }
function wireSetup(st) { const f = $('#suForm'); if (!f) return; f.onsubmit = async (e) => { e.preventDefault();
  try {
    if (st.must_change_password) { const p1 = $('#suPw').value, p2 = $('#suPw2').value; if (p1.length < 10) throw new Error('Password needs at least 10 characters.'); if (p1 !== p2) throw new Error('Passwords do not match.'); }
    const a1 = $('#suPin').value, a2 = $('#suPin2').value; if (!/^\d{4}$/.test(a1)) throw new Error('PIN must be 4 digits.'); if (a1 !== a2) throw new Error('PINs do not match.');
    const r = await SV.rpc('set_pin', { p_pin: a1 }); if (!r.ok) throw new Error(r.reason || 'Could not set PIN.');
    if (st.must_change_password) { await SV.changePassword($('#suPw').value); await SV.rpc('password_changed'); }
    await gate();
  } catch (err) { show(setupPanel(st, err.message), () => wireSetup(st)); } }; }
function wirePin() { const f = $('#pnForm'); if (!f) return; f.onsubmit = async (e) => { e.preventDefault();
  try { const r = await SV.rpc('unlock', { p_pin: $('#pnPin').value }); if (!r.ok) { if (r.locked) { SV.signOut(); return show(signInPanel(r.reason), wireSignIn); } throw new Error(r.reason || 'Wrong PIN.'); } await gate(); }
  catch (err) { show(pinPanel(err.message), wirePin); } }; }
// decides which screen a signed-in person sees; data loads only after a server-confirmed unlock
async function gate() {
  if (!SV.signedIn()) { S.user = 'visitor'; A = api('visitor'); setWho(); return show(signInPanel(), wireSignIn); }
  let st; try { st = await SV.rpc('session_status'); } catch (e) { SV.signOut(); return show(signInPanel('Please sign in again.'), wireSignIn); }
  if (!st.ok) { SV.signOut(); return show(signInPanel(st.reason), wireSignIn); }
  if (st.must_change_password || !st.has_pin) return show(setupPanel(st), () => wireSetup(st));
  if (!st.unlocked) return show(pinPanel(), wirePin);
  await refreshServer(); setWho(); renderNav(); goFloor(S.floor || 0); toast(`Unlocked · ${USERS[S.user].name}`);
}
function setWho() {
  const el = $('#whoName'); if (!el) return; const who = S.user !== 'visitor' ? USERS[S.user] : null;
  el.innerHTML = who ? esc(who.name + ' · ' + who.title) + ' <div class="btnrow"><button class="tbtn" data-act="lock">Lock</button><button class="tbtn" data-act="signout">Sign out</button></div>' : (SV.signedIn() ? 'Locked' : 'Not signed in');
  wire(document.querySelector('.who'));
}
async function boot() {
  if (SHOWCASE) { document.body.classList.add('showcase'); }
  if (SV.enabled) {
    document.querySelector('.who').innerHTML = '<label>Account</label><div id="whoName" style="font-weight:700;color:#F8F3EA">Checking…</div><p>Access is checked by the server for every request.</p>';
    $('#resetBtn').style.display = 'none';
  }
  renderNav(); setTitle(0);
  intro();
  if (SV.enabled) setTimeout(() => gate(), 60);
  if (SHOWCASE) setTimeout(() => { act('visit'); }, 1300);
}
boot();

// path verification for handoff choreography (used by the test record + automated tests)
window.__wq.pathCheck = () => {
  const out = [];
  const solids = campus.solids[5]; const R = 0.22;
  for (const [key, ch] of Object.entries(CHOREO)) {
    const seat = campus.seats[ch.from + '@5'];
    const pts = [[seat.x, seat.z], ...ch.go, ...(ch.exitToLift ? [[0, 11.4]] : [])];
    const others = Object.values(campus.people).filter((p) => p.floor === 5 && p.id !== ch.from && p.id !== ch.to).map((p) => [p.root.position.x, p.root.position.z, p.id]);
    let hits = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        if (i === 0 && k < n * 0.3) continue; // leaving own chair
        for (const s of solids) if (x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R) hits.push(`furniture near (${x.toFixed(1)}, ${z.toFixed(1)})`);
        for (const [ox, oz, id] of others) if (Math.hypot(x - ox, z - oz) < 0.5) hits.push(`passes through ${id}`);
      }
    }
    hits = [...new Set(hits)];
    out.push({ key, ok: hits.length === 0, hits: hits.slice(0, 6) });
  }
  return out;
};
Object.assign(window.__wq, { goFloor, openTask, doStep, playEvent, openDecision, act, setUser, setReduced, openRoomById });
