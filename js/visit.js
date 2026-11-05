// WARQÉVA — Sims-style client visit (Ground floor showcase only).
// Jade greets the visitor; tap the floor to walk; glowing spots open reading cards (EN / العربية).
// All exhibit text is SAMPLE copy awaiting Ahmed's approval. No unpublished client work is shown.
import * as THREE from 'three';
import { FH } from './scene.js?v=202611051731';

export const EXHIBITS = [
  { id: 'welcome', at: [0, 9.2], look: [0, 1.6, 6.2], stand: [0, 8.6],
    en: { t: 'Welcome to WARQÉVA', b: 'We build bespoke websites, brands and marketing with an AI-assisted team. People check every piece of work before you see it, and nothing goes live without your approval.' },
    ar: { t: 'مرحباً بكم في وارقيفا', b: 'نصمّم مواقع إلكترونية وهويات تجارية وحملات تسويقية مخصّصة بمساعدة فريق يعمل بالذكاء الاصطناعي. يراجع البشر كل عمل قبل أن يصلكم، ولا يُنشر شيء دون موافقتكم.' } },
  { id: 'websites', at: [-12.4, 3.2], look: [-13.45, 1.5, 3.4], stand: [-11.9, 3.2],
    en: { t: 'Websites', b: 'Fast, bilingual websites designed around your customers. You see versioned previews, comment on exact sections, and choose the direction.' },
    ar: { t: 'المواقع الإلكترونية', b: 'مواقع سريعة بلغتين مصمّمة حول عملائكم. تطّلعون على معاينات بإصدارات محدّدة، وتعلّقون على أقسام بعينها، وتختارون الاتجاه.' } },
  { id: 'brands', at: [12.4, 3.2], look: [13.45, 1.5, 3.4], stand: [11.9, 3.2],
    en: { t: 'Branding & marketing', b: 'Names, logos, colours and campaigns built from research about your audience. Every claim is checked before it is published.' },
    ar: { t: 'الهوية التجارية والتسويق', b: 'أسماء وشعارات وألوان وحملات مبنية على أبحاث جمهوركم. يُتحقَّق من كل ادعاء قبل نشره.' } },
  { id: 'how', at: [3, -5.2], look: [3, 2.0, -12.5], stand: [3, -5.4],
    en: { t: 'How we work', b: '1 · Your brief  →  2 · Research  →  3 · Design and build  →  4 · Independent check  →  5 · Your approval. You can see each handoff as it happens.' },
    ar: { t: 'طريقة عملنا', b: '١ · موجزكم ← ٢ · البحث ← ٣ · التصميم والتنفيذ ← ٤ · فحص مستقل ← ٥ · موافقتكم. يمكنكم متابعة كل مرحلة تسليم لحظة حدوثها.' } },
  { id: 'workshop', at: [11.2, -4.6], look: [13.5, 0.9, -8.4], stand: [11.2, -4.4],
    en: { t: 'Workshop', b: 'Plan your project with us: goals, audience, budget and timing. Missing details become clear questions, never guesses.' },
    ar: { t: 'ورشة العمل', b: 'خطّطوا لمشروعكم معنا: الأهداف والجمهور والميزانية والتوقيت. تتحوّل التفاصيل الناقصة إلى أسئلة واضحة، لا إلى تخمينات.' } },
];

export function createVisit({ campus, $, esc, toast, panel, isMobile }) {
  let me = null, youLabel = null, on = false, lang = 'en', rings = [], tour = null;
  const floor = 0, y0 = floor * FH;
  // ---------- grid pathfinding over the floor's furniture ----------
  const CELL = 0.3, X0 = -17.6, Z0 = -12.6, NX = Math.ceil(35.2 / CELL), NZ = Math.ceil(25.2 / CELL), R = 0.34;
  let grid = null;
  function buildGrid() {
    grid = new Uint8Array(NX * NZ);
    const people = campus.floors[floor].people.filter((p) => p !== me);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      let b = 0;
      for (const s of campus.solids[floor]) if (x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R) { b = 1; break; }
      if (!b) for (const p of people) if (Math.hypot(p.root.position.x - x, p.root.position.z - z) < 0.55) { b = 1; break; }
      grid[i + j * NX] = b;
    }
  }
  const cellOf = (x, z) => [Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL)];
  const free = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && !grid[i + j * NX];
  function nearestFree(i, j) { for (let r = 0; r < 12; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) if (free(i + di, j + dj)) return [i + di, j + dj]; return null; }
  function los(a, b) { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let k = 0; k <= n; k++) { const i = Math.round(a[0] + (b[0] - a[0]) * k / n), j = Math.round(a[1] + (b[1] - a[1]) * k / n); if (!free(i, j)) return false; } return true; }
  function findPath(fx, fz, tx, tz) {
    if (!grid) buildGrid();
    let s = cellOf(fx, fz), g = cellOf(tx, tz); s = free(...s) ? s : nearestFree(...s); g = free(...g) ? g : nearestFree(...g); if (!s || !g) return null;
    const key = (i, j) => i + j * NX, open = new Map(), came = new Map(), gs = new Map([[key(...s), 0]]);
    const h = (i, j) => Math.hypot(i - g[0], j - g[1]); open.set(key(...s), h(...s));
    let guard = 0;
    while (open.size && guard++ < 40000) {
      let ck = null, cf = Infinity; for (const [k, f] of open) if (f < cf) { cf = f; ck = k; }
      open.delete(ck); const ci = ck % NX, cj = (ck / NX) | 0;
      if (ci === g[0] && cj === g[1]) { const out = [[ci, cj]]; let k = ck; while (came.has(k)) { k = came.get(k); out.push([k % NX, (k / NX) | 0]); } out.reverse();
        const sm = [out[0]]; let a = 0; for (let b = 2; b < out.length; b++) if (!los(out[a], out[b])) { sm.push(out[b - 1]); a = b - 1; } sm.push(out[out.length - 1]);
        return sm.slice(1).map(([i, j]) => [X0 + i * CELL, Z0 + j * CELL]); }
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue; if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const nk = key(ni, nj), ng = gs.get(ck) + Math.hypot(di, dj); if (ng < (gs.get(nk) ?? Infinity)) { gs.set(nk, ng); came.set(nk, ck); open.set(nk, ng + h(ni, nj)); }
      }
    }
    return null;
  }
  // ---------- hotspot rings ----------
  function addRings() {
    const g = new THREE.RingGeometry(0.45, 0.62, 40); const m = new THREE.MeshBasicMaterial({ color: 0xF8B123, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    for (const e of EXHIBITS) { const r = new THREE.Mesh(g, m); r.rotation.x = -Math.PI / 2; r.position.set(e.stand[0], 0.04, e.stand[1]); r.userData.exhibit = e.id; campus.floors[floor].inner.add(r); rings.push(r); }
    let t = 0; campus.onTick = (dt) => { t += dt; for (const r of rings) { const s = 1 + Math.sin(t * 3) * 0.08; r.scale.set(s, s, s); } };
  }
  function clearRings() { rings.forEach((r) => r.parent && r.parent.remove(r)); rings = []; campus.onTick = null; }
  // ---------- labels for hotspots (DOM) ----------
  function hotspotChips() { return EXHIBITS.map((e) => ({ text: (lang === 'ar' ? e.ar.t : e.en.t) + '  ·  ' + (lang === 'ar' ? 'اقرأ' : 'Read'), pos: new THREE.Vector3(e.stand[0], 1.2, e.stand[1]), kind: 'room spot', floor, roomId: 'spot:' + e.id })); }
  let chipLabels = [];
  function showChips() { chipLabels = hotspotChips(); campus.labels.push(...chipLabels); }
  function hideChips() { campus.labels = campus.labels.filter((l) => !chipLabels.includes(l)); chipLabels = []; }
  // ---------- movement ----------
  async function walkTo(x, z) {
    if (!me) return false;
    const path = findPath(me.root.position.x, me.root.position.z, x, z); if (!path || !path.length) { toast(lang === 'ar' ? 'لا يمكن الوصول إلى هناك' : 'You can’t walk there.'); return false; }
    me.queue.length = 0; me.walking = false;
    await campus.walk(me, path); return true;
  }
  async function visitExhibit(id) {
    const e = EXHIBITS.find((x) => x.id === id); if (!e) return;
    closeCard();
    const ok = await walkTo(e.stand[0], e.stand[1]); if (!ok) return;
    const ry = Math.atan2(e.look[0] - me.root.position.x, e.look[2] - me.root.position.z); await campus.face(me, ry);
    // close-up at the visitor's eye level ("as if you are standing there")
    campus.follow = null;
    const eye = new THREE.Vector3(me.root.position.x, y0 + 1.65, me.root.position.z).add(new THREE.Vector3(-Math.sin(ry) * 0.6, 0.15, -Math.cos(ry) * 0.6));
    campus.flyTo({ pos: eye, target: new THREE.Vector3(e.look[0], y0 + e.look[1], e.look[2]) }, campus.reduced ? 0 : 1.1, () => openCard(e));
  }
  // ---------- reading card ----------
  let card = null;
  function openCard(e) {
    closeCard(); card = document.createElement('div'); card.className = 'readcard';
    const render = () => { const c = e[lang]; card.innerHTML = `<div class="row"><span class="pill demo">${lang === 'ar' ? 'نص تجريبي' : 'Sample text'}</span><div class="spacer"></div><div class="lang"><button data-l="en" class="${lang === 'en' ? 'on' : ''}">English</button><button data-l="ar" class="${lang === 'ar' ? 'on' : ''}">العربية</button></div></div>
      <div ${lang === 'ar' ? 'dir="rtl" lang="ar" class="ar"' : ''}><h2 style="margin:10px 0 6px;color:var(--emerald)">${esc(c.t)}</h2><p style="font-size:15px;line-height:1.6;margin:0">${esc(c.b)}</p></div>
      <div class="btnrow"><button class="tbtn primary" data-x="back">${lang === 'ar' ? 'متابعة الجولة' : 'Keep exploring'}</button>${tour ? `<button class="tbtn" data-x="next">${lang === 'ar' ? 'المحطة التالية' : 'Next stop'}</button>` : ''}</div>`;
      card.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => { lang = b.dataset.l; render(); hideChips(); showChips(); });
      card.querySelector('[data-x=back]').onclick = () => { closeCard(); resumeFollow(); tour = null; };
      const nx = card.querySelector('[data-x=next]'); if (nx) nx.onclick = () => nextStop(); };
    render(); $('#stage').appendChild(card);
  }
  function closeCard() { if (card) { card.remove(); card = null; } }
  function resumeFollow() { campus.follow = me; }
  // ---------- tour ----------
  function nextStop() { if (!tour) return; tour.i++; if (tour.i >= EXHIBITS.length) { tour = null; closeCard(); resumeFollow(); toast(lang === 'ar' ? 'انتهت الجولة. تجوّلوا بحرية.' : 'Tour finished. Explore freely.'); return; } visitExhibit(EXHIBITS[tour.i].id); }
  // ---------- greeting ----------
  function greet() {
    const jade = campus.person('jade', floor);
    const g = document.createElement('div'); g.className = 'readcard greet';
    g.innerHTML = `<div class="row"><b style="color:var(--emerald)">Jade · ${lang === 'ar' ? 'الاستقبال' : 'Reception'}</b><span class="pill demo" style="margin-left:auto">AI host</span></div>
      <p style="font-size:15px;margin:8px 0 10px">Welcome to WARQÉVA. How can I help today?<br><span class="ar" dir="rtl" style="display:block;font-size:14px">مرحباً بكم في وارقيفا. كيف يمكنني مساعدتكم اليوم؟</span></p>
      <div class="list"><button class="item" data-g="tour"><b>Show me around</b><span class="muted ar" style="margin-left:auto">جولة تعريفية</span></button>
      <button class="item" data-g="project"><b>I have a project</b><span class="muted ar" style="margin-left:auto">لديّ مشروع</span></button>
      <button class="item" data-g="browse"><b>Just browse</b><span class="muted ar" style="margin-left:auto">أتجوّل بحرية</span></button></div>
      <p class="small muted" style="margin-top:8px">Jade is an AI host. Tap the floor to walk; tap a glowing spot to read.</p>`;
    g.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { g.remove(); const k = b.dataset.g;
      if (k === 'tour') { tour = { i: -1 }; nextStop(); }
      else if (k === 'project') projectCard();
      else { resumeFollow(); toast('Tap anywhere on the floor to walk.'); } });
    $('#stage').appendChild(g); card = g;
    if (jade) jade.reachTarget = 0;
  }
  function projectCard() {
    closeCard(); card = document.createElement('div'); card.className = 'readcard';
    card.innerHTML = `<h2 style="margin:0 0 6px;color:var(--emerald)">Tell us about your project</h2><p class="small muted">Demo only — nothing is sent yet.</p>
      <form id="pjForm"><input placeholder="Business name" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:12px;font:inherit;margin-top:6px"><textarea placeholder="What do you need? (website, brand, campaign…)" style="margin-top:8px"></textarea>
      <div class="btnrow"><button class="tbtn primary" type="submit">Prepare my brief</button><button class="tbtn" type="button" data-x="back">Back to the visit</button></div></form>`;
    card.querySelector('form').onsubmit = (ev) => { ev.preventDefault(); toast('In the live version, Iris turns this into a clear brief and asks only for what is missing. Nothing was sent.'); closeCard(); resumeFollow(); };
    card.querySelector('[data-x=back]').onclick = () => { closeCard(); resumeFollow(); };
    $('#stage').appendChild(card);
  }
  // ---------- input ----------
  let down = null;
  const el = campus.renderer.domElement;
  el.addEventListener('pointerdown', (e) => { if (on) down = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!on || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
    const hit = campus.pickFloor(e.clientX, e.clientY); if (!hit) return;
    const near = EXHIBITS.find((x) => Math.hypot(x.stand[0] - hit.x, x.stand[1] - hit.z) < 0.9);
    closeCard(); tour = null; if (!campus.follow) resumeFollow();
    if (near) visitExhibit(near.id); else walkTo(hit.x, hit.z);
  });
  function onChip(roomId) { if (!on || !roomId.startsWith('spot:')) return false; tour = null; visitExhibit(roomId.slice(5)); return true; }
  // ---------- start / stop ----------
  function start() {
    if (on) return; on = true; document.body.classList.add('visiting');
    campus.controls.enabled = false; campus.interactive = false; campus.floors[floor].front.visible = false; if (campus.signGroup) campus.signGroup.visible = false;
    me = campus.addVisitor(floor, 0, 10.6, Math.PI); grid = null; buildGrid();
    addRings(); showChips(); youLabel = { text: 'You', kind: 'person', floor, person: me, pos: new THREE.Vector3() }; campus.labels.push(youLabel);
    campus.followOffset.set(0, isMobile() ? 12 : 10, isMobile() ? 9 : 8);
    campus.flyTo({ pos: new THREE.Vector3(0, y0 + 7.5, 14.2), target: new THREE.Vector3(0, y0 + 0.9, 8.4) }, campus.reduced ? 0 : 1.2, async () => {
      await campus.walk(me, [[0, 8.6]]); await campus.face(me, Math.PI);
      const jade = campus.person('jade', floor); if (jade) { jade.reachTarget = 0.6; setTimeout(() => (jade.reachTarget = 0), 900); }
      greet();
    });
  }
  function stop() {
    if (!on) return; on = false; document.body.classList.remove('visiting'); closeCard(); hideChips(); clearRings(); campus.labels = campus.labels.filter((l) => l !== youLabel);
    campus.follow = null; campus.interactive = true; if (campus.signGroup) campus.signGroup.visible = true; campus.floors[floor].front.visible = true; campus.removeVisitor(floor); me = null; tour = null;
    campus.flyTo(campus.floorView(floor), campus.reduced ? 0 : 1.2);
  }
  return { start, stop, onChip, get on() { return on; }, findPath: (a, b, c, d) => { grid = null; buildGrid(); return findPath(a, b, c, d); } };
}
