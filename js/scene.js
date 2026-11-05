// WARQÉVA campus — Three.js scene, procedural architecture, stand-in characters, camera director.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------------- Kenney Furniture Kit (CC0) ----------------
const KIT = {};
const KIT_NAMES = ['desk', 'chairDesk', 'chairCushion', 'loungeSofa', 'loungeSofaLong', 'loungeChair', 'pottedPlant', 'plantSmall1', 'plantSmall2', 'bookcaseOpen', 'books', 'lampRoundFloor', 'lampRoundTable', 'tableRound', 'table', 'tableCoffee', 'computerScreen', 'laptop', 'rugRound', 'rugRectangle', 'sideTable', 'coatRackStanding'];
export async function loadKit(base) {
  const L = new GLTFLoader();
  const res = await Promise.allSettled(KIT_NAMES.map((n) => L.loadAsync(base + n + '.glb').then((g) => [n, g.scene])));
  for (const r of res) if (r.status === 'fulfilled') {
    const [n, sc] = r.value; sc.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sc), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); sc.position.set(-c.x, -box.min.y, -c.z); holder.add(sc); KIT[n] = { obj: holder, size };
  }
  return Object.keys(KIT).length;
}

export const FH = 5;            // floor-to-floor height
export const W = 36, D = 26;    // floor footprint (x, z); front of building = +z
const HW = W / 2, HD = D / 2;

// ---------------- palette (from approved concept renders) ----------------
const P = {
  floor: 0xEADBC4, floorExec: 0xE5D2B4, slab: 0xF3EEE6, wall: 0xF5F0E7, oak: 0xC9A275, oakLight: 0xDCC09A,
  walnut: 0x5A3C27, sage: 0x5F7F5B, sageDark: 0x3F5E44, greenDeep: 0x24432F, cream: 0xF3EADB, ivory: 0xF8F3EA,
  leaf: 0x5E8E48, leaf2: 0x7AA45A, leaf3: 0x4A7A3C, trunk: 0x7A5A3C, pot: 0xEFE8DC, frame: 0x3E5B47,
  screen: 0x2B3A33, screenGlow: 0xEAF2E6, glass: 0xDCEDE6, metal: 0xB9BCB6, brass: 0xC29B5B, book1: 0x8C5A3C,
  book2: 0x5F7F5B, book3: 0xC9A275, book4: 0xE7DCC6, rug: 0xE4D6BE, grass: 0xC9D6AE, paving: 0xE7E0D3, sky: 0xF3EFE6,
};

// ---------------- materials (cached per floor so floors can fade independently) ----------------
const matCache = new Map();
const floorMats = new Map(); // floor -> Set(materials)
function mat(floor, key, color, opts = {}) {
  const k = `${floor}|${key}|${color}`;
  let m = matCache.get(k);
  if (!m) {
    if (opts.glass) m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: opts.opacity ?? 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false });
    else m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.78, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1, map: opts.map || null });
    m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent;
    matCache.set(k, m);
    if (!floorMats.has(floor)) floorMats.set(floor, new Set());
    floorMats.get(floor).add(m);
  }
  return m;
}
export function setFloorOpacity(floor, o) {
  const s = floorMats.get(floor); if (!s) return;
  for (const m of s) {
    const b = m.userData.baseOpacity;
    if (o >= 0.999) { m.opacity = b; m.transparent = m.userData.baseTransparent; m.depthWrite = !m.userData.baseTransparent; }
    else { m.transparent = true; m.opacity = b * o; m.depthWrite = o > 0.6 && !m.userData.baseTransparent; }
    m.needsUpdate = true;
  }
}

// ---------------- geometry cache ----------------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  sph: new THREE.IcosahedronGeometry(0.5, 2),
  sphLo: new THREE.IcosahedronGeometry(0.5, 1),
  cone: new THREE.CylinderGeometry(0.36, 0.5, 1, 18),
};

// ---------------- text textures ----------------
export function textTexture(text, { w = 512, h = 128, bg = '#24432F', fg = '#F8F3EA', font = '600 54px Inter, Arial, sans-serif', radius = 40, sub = null, subFont = '500 26px Inter, Arial', align = 'center' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, radius); x.fill(); }
  x.fillStyle = fg; x.textAlign = align; x.textBaseline = 'middle'; x.font = font;
  const tx = align === 'center' ? w / 2 : 30;
  x.fillText(text, tx, sub ? h * 0.4 : h / 2);
  if (sub) { x.font = subFont; x.globalAlpha = 0.8; x.fillText(sub, tx, h * 0.72); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const _floorTex = {};
function floorTexture(exec) {
  if (_floorTex[exec]) return _floorTex[exec];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
  const base = exec ? [214, 190, 152] : [224, 203, 170];
  for (let row = 0; row < 32; row++) { let px = -((row * 137) % 260); while (px < 1024) { const len = 180 + ((row * 31 + px) % 140); const v = ((row * 17 + px * 7) % 13) - 6; x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v - 2})`; x.fillRect(px, row * 32, len - 2, 30); px += len; } }
  x.fillStyle = 'rgba(120,90,60,0.10)'; for (let row = 0; row <= 32; row++) x.fillRect(0, row * 32 - 1, 1024, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3.6); t.anisotropy = 8; return (_floorTex[exec] = t);
}
function screenTexture(kind = 'chart', accent = '#5F7F5B') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#F4F1E8'; x.fillRect(0, 0, 256, 160);
  x.strokeStyle = accent; x.fillStyle = accent; x.lineWidth = 6;
  if (kind === 'chart') { x.beginPath(); x.moveTo(20, 120); x.bezierCurveTo(80, 40, 140, 140, 236, 40); x.stroke(); }
  else if (kind === 'bars') { [50, 80, 60, 110, 90].forEach((v, i) => x.fillRect(30 + i * 42, 140 - v, 26, v)); }
  else if (kind === 'flow') { for (let i = 0; i < 4; i++) { x.fillRect(16 + i * 60, 66, 44, 28); if (i < 3) x.fillRect(60 + i * 60, 78, 16, 4); } }
  else if (kind === 'shield') { x.beginPath(); x.moveTo(128, 20); x.lineTo(190, 45); x.lineTo(180, 110); x.lineTo(128, 140); x.lineTo(76, 110); x.lineTo(66, 45); x.closePath(); x.stroke(); }
  else if (kind === 'list') { for (let i = 0; i < 5; i++) { x.fillRect(30, 26 + i * 24, 14, 14); x.fillRect(56, 30 + i * 24, 150 - i * 10, 6); } }
  else if (kind === 'landscape') { x.fillStyle = '#C8D7B4'; x.fillRect(0, 0, 256, 160); x.fillStyle = accent; x.beginPath(); x.moveTo(0, 160); x.bezierCurveTo(60, 60, 120, 140, 256, 70); x.lineTo(256, 160); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------- builder ----------------
function kitColor(name, exec, fabric) {
  switch (name) {
    case 'wood': return [exec ? P.walnut : P.oak, {}]; case 'woodDark': return [P.walnut, {}];
    case 'carpet': case 'carpetBlue': return [fabric ?? P.sage, { rough: 0.95 }]; case 'carpetDarker': return [new THREE.Color(fabric ?? P.sage).multiplyScalar(0.75).getHex(), { rough: 0.95 }];
    case 'metal': return [0xBFC2BC, { rough: 0.35, metal: 0.5 }]; case 'metalMedium': return [0x6E716C, { rough: 0.4, metal: 0.4 }]; case 'metalDark': return [0x2B3A33, { rough: 0.4, metal: 0.3 }];
    case 'plant': return [P.leaf, {}]; case 'lamp': return [0xFFF1D6, { emissive: 0xFFD9A0, ei: 0.7 }]; default: return [P.cream, {}];
  }
}
class Builder {
  constructor(group, floor, opts = {}) { this.g = group; this.f = floor; this.solids = []; this.rooms = []; this.labels = []; this.seats = {}; this.exec = !!opts.exec; this.shadows = opts.shadows !== false; }
  m(key, color, o) { return mat(this.f, key, color, o); }
  // place a Kenney model: size {w,h,d} per-axis, or s uniform scale of the model's height h
  kit(name, x, y, z, ry, { w, h, d, fabric, solid = true } = {}) {
    const K = KIT[name]; if (!K) return null;
    const g = K.obj.clone(true); const sz = K.size;
    g.scale.set(w ? w / sz.x : (h ? h / sz.y : 1), h ? h / sz.y : 1, d ? d / sz.z : (h ? h / sz.y : 1));
    g.position.set(x, y, z); g.rotation.y = ry;
    g.traverse((o) => { if (o.isMesh) { const nm = o.material && o.material.name; const [c, opt] = kitColor(nm, this.exec, fabric); o.material = this.m('kit:' + nm + ':' + (fabric ?? ''), c, opt); o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    this.g.add(g);
    if (solid) this.solid(x, z, (w || sz.x * g.scale.x), (d || sz.z * g.scale.z), ry);
    return g;
  }
  add(mesh, cast = true, recv = true) { mesh.castShadow = cast && this.shadows; mesh.receiveShadow = recv && this.shadows; this.g.add(mesh); return mesh; }
  box(w, h, d, x, y, z, color, { ry = 0, cast = true, solid = false, key = 'b', o } = {}) {
    const soft = ['planter', 'kiosk', 'pot', 'rack'].includes(key); const me = new THREE.Mesh(soft ? G.rbox : G.box, this.m(key, color, o)); me.scale.set(w, h, d); me.position.set(x, y + h / 2, z); me.rotation.y = ry; this.add(me, cast);
    if (solid) this.solid(x, z, w, d, ry); return me;
  }
  cyl(r, h, x, y, z, color, { cast = true, key = 'c', seg8 = false, rt } = {}) {
    const me = new THREE.Mesh(seg8 ? G.cyl8 : G.cyl, this.m(key, color)); me.scale.set(r * 2, h, r * 2); me.position.set(x, y + h / 2, z); this.add(me, cast); return me;
  }
  sph(r, x, y, z, color, { key = 's', lo = true, sy = 1 } = {}) { const me = new THREE.Mesh(lo ? G.sphLo : G.sph, this.m(key, color)); me.scale.set(r * 2, r * 2 * sy, r * 2); me.position.set(x, y, z); this.add(me); return me; }
  solid(x, z, w, d, ry = 0) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const ew = w * c + d * s, ed = w * s + d * c; this.solids.push({ x0: x - ew / 2, x1: x + ew / 2, z0: z - ed / 2, z1: z + ed / 2 }); }
  label(text, x, y, z, kind = 'room', extra = {}) { this.labels.push({ text, pos: new THREE.Vector3(x, y, z), kind, floor: this.f, ...extra }); }
  room(id, label, x, z, w, d, { open = [], door = null, height = 2.7, tint = null, kind = 'room', glassSides = ['n', 's', 'e', 'w'], wallColor = null } = {}) {
    // floor inlay
    this.box(w - 0.1, 0.02, d - 0.1, x, 0, z, tint ?? (this.exec ? 0xDCC8A8 : 0xE6D7BF), { cast: false, key: 'inlay' });
    const sides = { n: [x, z - d / 2, w, 0], s: [x, z + d / 2, w, 0], w: [x - w / 2, z, d, Math.PI / 2], e: [x + w / 2, z, d, Math.PI / 2] };
    for (const [k, [cx, cz, len, ry]] of Object.entries(sides)) {
      if (open.includes(k)) continue;
      const isGlass = glassSides.includes(k);
      // door gap
      const segs = [];
      if (door && door.side === k) {
        const along = door.at ?? 0, dw = door.w ?? 1.2;
        const a0 = -len / 2, a1 = along - dw / 2, b0 = along + dw / 2, b1 = len / 2;
        if (a1 - a0 > 0.05) segs.push([(a0 + a1) / 2, a1 - a0]);
        if (b1 - b0 > 0.05) segs.push([(b0 + b1) / 2, b1 - b0]);
      } else segs.push([0, len]);
      for (const [off, l] of segs) {
        const px = ry ? cx : cx + off, pz = ry ? cz + off : cz;
        // low base + glass + top rail + posts
        this.box(ry ? 0.12 : l, 0.18, ry ? l : 0.12, px, 0, pz, wallColor ?? P.wall, { key: 'base' });
        if (isGlass) {
          const gm = new THREE.Mesh(G.box, this.m('glass', P.glass, { glass: true, opacity: 0.22 }));
          gm.scale.set(ry ? 0.04 : l, height - 0.2, ry ? l : 0.04); gm.position.set(px, 0.18 + (height - 0.2) / 2, pz); this.g.add(gm);
          this.box(ry ? 0.07 : l, 0.06, ry ? l : 0.07, px, height - 0.04, pz, P.frame, { key: 'frame', cast: false });
          const n = Math.max(1, Math.round(l / 1.6));
          for (let i = 0; i <= n; i++) { const t = -l / 2 + (l / n) * i; this.box(0.06, height, 0.06, ry ? px : px + t, 0, ry ? pz + t : pz, P.frame, { key: 'frame', cast: false }); }
        } else {
          this.box(ry ? 0.14 : l, height, ry ? l : 0.14, px, 0, pz, wallColor ?? P.wall, { key: 'wall' });
        }
        this.solid(px, pz, ry ? 0.2 : l, ry ? l : 0.2);
      }
    }
    const hit = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.set(w, height, d); hit.position.set(x, height / 2, z); hit.userData = { roomId: id, label, floor: this.f, kind, cx: x, cz: z, w, d };
    this.g.add(hit); this.rooms.push(hit);
    this.label(label, x, height + 0.5, z - d / 2 + 0.2, 'room', { roomId: id });
    return hit;
  }
  rug(x, z, r, color = P.rug) { if (KIT.rugRound) { this.kit('rugRound', x, 0.01, z, 0, { w: r * 2, h: 0.02, d: r * 2, fabric: color, solid: false }); return; } const me = new THREE.Mesh(G.cyl, this.m('rug', color)); me.scale.set(r * 2, 0.02, r * 2); me.position.set(x, 0.02, z); this.add(me, false); }
  plant(x, z, s = 1, { tall = false } = {}) {
    if (KIT.pottedPlant) { this.kit(tall ? 'pottedPlant' : (KIT.plantSmall2 ? 'plantSmall2' : 'pottedPlant'), x, 0, z, (x * 7 + z) % 6, { h: (tall ? 1.35 : 0.75) * s }); return; }
    this.cyl(0.22 * s, 0.4 * s, x, 0, z, P.pot, { key: 'pot', seg8: true });
    const h = tall ? 1.1 : 0.6;
    const cols = [P.leaf, P.leaf2, P.leaf3];
    for (let i = 0; i < (tall ? 6 : 4); i++) {
      const a = i * 2.1; const rr = 0.14 * s;
      this.sph((0.22 + (i % 3) * 0.04) * s, x + Math.cos(a) * rr, (0.45 + h * (0.3 + (i % 3) * 0.25)) * s, z + Math.sin(a) * rr, cols[i % 3], { key: 'leaf' });
    }
    this.solid(x, z, 0.5 * s, 0.5 * s);
  }
  tree(x, z, s = 1) {
    this.cyl(0.12 * s, 1.6 * s, x, 0, z, P.trunk, { key: 'trunk', seg8: true });
    const cols = [P.leaf, P.leaf2, P.leaf3];
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = (i % 3) * 0.35 * s; this.sph((0.55 + (i % 2) * 0.15) * s, x + Math.cos(a) * r, (1.7 + (i % 4) * 0.25) * s, z + Math.sin(a) * r, cols[i % 3], { key: 'leaf' }); }
  }
  desk(x, z, ry = 0, { w = 1.5, d = 0.7, wood = null, screen = true, laptop = false } = {}) {
    if (KIT.desk) {
      this.kit('desk', x, 0, z, ry, { w, h: 0.76, d });
      const c = Math.cos(ry), sn = Math.sin(ry), off = -d / 2 + 0.16; // monitor at the far side, facing the seat
      if (screen && KIT.computerScreen) this.kit('computerScreen', x + sn * off, 0.76, z + c * off, ry, { w: 0.6, h: 0.45, d: 0.14, solid: false });
      else if (KIT.laptop) this.kit('laptop', x, 0.76, z, ry, { w: 0.36, h: 0.22, d: 0.3, solid: false });
      return null;
    }
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.g.add(g);
    const wd = wood ?? (this.exec ? P.walnut : P.oak);
    const top = new THREE.Mesh(G.box, this.m('wood', wd)); top.scale.set(w, 0.05, d); top.position.y = 0.74; g.add(top);
    const side = this.m('wood', wd);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(G.box, side); l.scale.set(0.05, 0.72, d * 0.9); l.position.set(sx * (w / 2 - 0.05), 0.36, 0); g.add(l); }
    if (screen) { const s = new THREE.Mesh(G.box, this.m('scr', P.screen)); s.scale.set(0.55, 0.34, 0.03); s.position.set(0, 1.0, -d / 2 + 0.12); g.add(s); const st = new THREE.Mesh(G.box, s.material); st.scale.set(0.05, 0.15, 0.05); st.position.set(0, 0.82, -d / 2 + 0.12); g.add(st); const sg = new THREE.Mesh(G.box, this.m('scrg', P.screenGlow, { emissive: 0xD9E8D2, ei: 0.35 })); sg.scale.set(0.5, 0.29, 0.005); sg.position.set(0, 1.0, -d / 2 + 0.14); g.add(sg); }
    if (laptop) { const lp = new THREE.Mesh(G.box, this.m('metal', P.metal)); lp.scale.set(0.34, 0.02, 0.24); lp.position.set(0, 0.78, 0); g.add(lp); const lid = new THREE.Mesh(G.box, lp.material); lid.scale.set(0.34, 0.22, 0.02); lid.position.set(0, 0.88, -0.12); lid.rotation.x = -0.25; g.add(lid); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    this.solid(x, z, w, d, ry);
    return g;
  }
  chair(x, z, ry = 0, color = null, { arm = false } = {}) {
    if (arm && KIT.loungeChair) return this.kit('loungeChair', x, 0, z, ry, { w: 0.8, h: 0.8, d: 0.8, fabric: color ?? P.sage, solid: false });
    if (!color && KIT.chairDesk) return this.kit('chairDesk', x, 0, z, ry, { w: 0.6, h: 1.0, d: 0.58, fabric: P.sageDark, solid: false });
    if (KIT.chairCushion) return this.kit('chairCushion', x, 0, z, ry, { w: 0.5, h: 0.95, d: 0.5, fabric: color ?? P.sage, solid: false });
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.g.add(g);
    const c = this.m('fab', color ?? P.sage);
    const seat = new THREE.Mesh(G.rbox, c); seat.scale.set(0.5, 0.1, 0.48); seat.position.y = 0.46; g.add(seat);
    const back = new THREE.Mesh(G.rbox, c); back.scale.set(0.5, 0.5, 0.08); back.position.set(0, 0.76, -0.22); g.add(back);
    const leg = new THREE.Mesh(G.cyl8, this.m('metal', 0x5b5f5a)); leg.scale.set(0.06, 0.42, 0.06); leg.position.y = 0.21; g.add(leg);
    const base = new THREE.Mesh(G.cyl8, leg.material); base.scale.set(0.46, 0.04, 0.46); base.position.y = 0.02; g.add(base);
    if (arm) for (const sx of [-1, 1]) { const a = new THREE.Mesh(G.rbox, c); a.scale.set(0.07, 0.2, 0.4); a.position.set(sx * 0.27, 0.6, 0); g.add(a); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    return g;
  }
  // seat = chair + register a seat (person root sits at chair centre facing ry)
  seat(id, x, z, ry, color, opts) { this.chair(x, z, ry, color, opts); this.seats[id] = { x, z, ry }; return this.seats[id]; }
  sofa(x, z, w, ry = 0, color = P.sage) {
    if (KIT.loungeSofa) { this.kit(w > 2.8 && KIT.loungeSofaLong ? 'loungeSofaLong' : 'loungeSofa', x, 0, z, ry, { w, h: 0.85, d: 0.9, fabric: color }); return; }
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.g.add(g);
    const c = this.m('fab', color);
    const b = new THREE.Mesh(G.rbox, c); b.scale.set(w, 0.42, 0.85); b.position.y = 0.21; g.add(b);
    const bk = new THREE.Mesh(G.rbox, c); bk.scale.set(w, 0.45, 0.2); bk.position.set(0, 0.62, -0.33); g.add(bk);
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(G.rbox, c); a.scale.set(0.18, 0.55, 0.85); a.position.set(sx * (w / 2 - 0.09), 0.27, 0); g.add(a); }
    const cu = this.m('cush', P.cream); for (let i = 0; i < Math.max(1, Math.floor(w / 0.9)); i++) { const p = new THREE.Mesh(G.rbox, cu); p.scale.set(0.38, 0.3, 0.1); p.position.set(-w / 2 + 0.5 + i * 0.9, 0.6, -0.2); p.rotation.x = -0.2; g.add(p); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    this.solid(x, z, w, 0.85, ry);
  }
  curvedSofa(cx, cz, r, a0, a1, color = P.sage) {
    const n = 7; const c = this.m('fab', color);
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n; const seg = (r * Math.abs(a1 - a0)) / n + 0.05;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const s = new THREE.Mesh(G.box, c); s.scale.set(seg, 0.42, 0.8); s.position.set(x, 0.21, z); s.rotation.y = -a - Math.PI / 2; this.add(s);
      const bx = cx + Math.cos(a) * (r + 0.32), bz = cz + Math.sin(a) * (r + 0.32);
      const bk = new THREE.Mesh(G.box, c); bk.scale.set(seg, 0.5, 0.18); bk.position.set(bx, 0.6, bz); bk.rotation.y = -a - Math.PI / 2; this.add(bk);
      this.solid(x, z, 0.8, 0.8);
    }
  }
  roundTable(x, z, r, wood = null, h = 0.74) {
    if (KIT.tableRound) { this.kit('tableRound', x, 0, z, 0, { w: r * 2, h, d: r * 2 }); return; }
    const wd = wood ?? (this.exec ? P.walnut : P.oak);
    this.cyl(r, 0.05, x, h - 0.05, z, wd, { key: 'wood' }); this.cyl(0.08, h - 0.05, x, 0, z, 0x5b5f5a, { key: 'metal', seg8: true }); this.cyl(0.35, 0.03, x, 0, z, 0x5b5f5a, { key: 'metal', seg8: true });
    this.solid(x, z, r * 1.8, r * 1.8);
  }
  rectTable(x, z, w, d, wood = null) { if (KIT.table) { this.kit('table', x, 0, z, 0, { w, h: 0.75, d }); return; } const wd = wood ?? (this.exec ? P.walnut : P.oak); this.box(w, 0.06, d, x, 0.7, z, wd, { key: 'wood' }); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(0.08, 0.7, 0.08, x + sx * (w / 2 - 0.2), 0, z + sz * (d / 2 - 0.2), wd, { key: 'wood' }); this.solid(x, z, w, d); }
  shelf(x, z, w, ry = 0, h = 2.0) {
    if (KIT.bookcaseOpen) {
      this.kit('bookcaseOpen', x, 0, z, ry, { w, h, d: 0.4 });
      if (KIT.books) { const c = Math.cos(ry), sn = Math.sin(ry); for (let k = 0; k < 4; k++) { const off = ((k % 2) - 0.5) * w * 0.4; this.kit('books', x + c * off, h * (0.06 + k * 0.245), z - sn * off, ry + (k % 2 ? 0.1 : -0.05), { w: w * 0.38, h: h * 0.14, d: 0.26, solid: false }); } }
      return null;
    }
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.g.add(g);
    const wd = this.m('wood', this.exec ? P.walnut : P.oak);
    const back = new THREE.Mesh(G.box, wd); back.scale.set(w, h, 0.36); back.position.y = h / 2; g.add(back);
    const cols = [P.book1, P.book2, P.book3, P.book4, P.greenDeep];
    for (let r = 0; r < 4; r++) {
      let px = -w / 2 + 0.1; let i = r * 3;
      while (px < w / 2 - 0.15) { const bw = 0.05 + ((i * 7) % 5) * 0.012; const bh = 0.26 + ((i * 3) % 4) * 0.03; if ((i % 9) !== 4) { const b = new THREE.Mesh(G.box, this.m('book' + (i % 5), cols[i % 5])); b.scale.set(bw, bh, 0.24); b.position.set(px + bw / 2, 0.15 + r * (h / 4.2) + bh / 2, 0.08); g.add(b); } px += bw + 0.012; i++; }
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    this.solid(x, z, w, 0.4, ry);
  }
  display(x, y, z, w, h, ry = 0, tex = null, { frame = P.walnut } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.g.add(g);
    const f = new THREE.Mesh(G.box, this.m('dframe', frame)); f.scale.set(w + 0.08, h + 0.08, 0.05); g.add(f);
    const sm = new THREE.MeshStandardMaterial({ map: tex || screenTexture('chart'), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: tex || null });
    sm.userData.baseOpacity = 1; sm.userData.baseTransparent = false; floorMats.get(this.f)?.add(sm);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm); s.position.z = 0.03; g.add(s);
    return g;
  }
  lamp(x, z, h = 1.5) { if (KIT.lampRoundFloor) { this.kit('lampRoundFloor', x, 0, z, 0, { h: h + 0.2, solid: false }); return; } this.cyl(0.02, h, x, 0, z, P.brass, { key: 'brass' }); const sh = this.cyl(0.18, 0.22, x, h, z, 0xFFF1D6, { key: 'shade' }); sh.material = this.m('shadeE', 0xFFF1D6, { emissive: 0xFFD9A0, ei: 0.6 }); }
  core(x, z, { stairs = true, facing = 1 } = {}) {
    // lift + stairs block
    this.box(2.2, 3.0, 0.3, x, 0, z - facing * 0.9, P.wall, { solid: true, key: 'wall' });
    this.box(1.4, 2.3, 0.06, x, 0, z - facing * 0.73, P.metal, { key: 'metal', cast: false });
    this.box(0.04, 2.3, 0.07, x, 0, z - facing * 0.71, 0x8d908b, { key: 'metal2', cast: false });
    this.solid(x, z - facing * 0.6, 2.2, 0.6);
    if (stairs) { for (let i = 0; i < 8; i++) this.box(1.8, 0.17 * (i + 1), 0.32, x + 2.4, 0, z - facing * (0.2 + i * 0.3) + facing * 0.9, P.oakLight, { key: 'stair', cast: true }); this.solid(x + 2.4, z - facing * 0.5, 1.9, 2.6); }
  }
  receptionDesk(x, z, w = 3.2, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; this.g.add(g);
    const wd = this.m('wood', this.exec ? P.walnut : P.oakLight);
    const front = new THREE.Mesh(G.rbox, wd); front.scale.set(w, 1.05, 0.5); front.position.set(0, 0.525, 0.25); g.add(front);
    const top = new THREE.Mesh(G.rbox, this.m('cream', P.ivory)); top.scale.set(w + 0.1, 0.05, 0.75); top.position.set(0, 1.07, 0.15); g.add(top);
    const glow = new THREE.Mesh(G.rbox, this.m('glow', 0xFFE9C4, { emissive: 0xFFD8A0, ei: 0.7 })); glow.scale.set(w, 0.04, 0.02); glow.position.set(0, 0.06, 0.51); g.add(glow);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    this.solid(x, z + 0.25, w, 0.8, ry);
  }
}

// ---------------- characters (stand-ins; approved likenesses need rigged models) ----------------
const skinTones = [0xC99A78, 0xD8AE8E, 0xB98563, 0xE2BFA0, 0xA87656];
export const CAST = {
  meedz: { name: 'Meedz', skin: 0xC99A78, hair: 0x15120F, hairStyle: 'curly', glasses: true, top: 0x1F4D36, coat: 0x3B3B3D, long: true, legs: 0x3A3A3C, shoes: 0x111111, h: 1.0, lead: true },
  sully: { name: 'Sully', skin: 0xC79A74, hair: 0x231A14, hairStyle: 'wavy', glasses: true, beard: true, top: 0xF4F4F2, coat: 0x6B6E72, legs: 0x6B6E72, shoes: 0x151515, lanyard: true, h: 1.0, lead: true },
  mesi:  { name: 'Mesi', skin: 0xD3A585, hair: 0x2B211B, hairStyle: 'short', top: 0xE3D9C4, coat: 0xEDE6D6, overshirt: true, legs: 0x44464A, shoes: 0x111111, h: 1.0, lead: true },
  joe:   { name: 'Joe', skin: 0xD1A07C, hair: 0x1B1410, hairStyle: 'curly', top: 0xF1EADB, coat: 0x343537, long: true, legs: 0x2C2D30, shoes: 0x1a1a1a, h: 1.07, lead: true },
};
// Looks taken from the saved character artwork (Meedz_AI_Staff.pdf, 4 Nov 2026) — colours/hair only; stand-in geometry
const ART = {
  atlas:  { skin: 0x8D5A3B, hair: 0x2A2420, hairStyle: 'bald', beard: true, top: 0x6E1F2A, legs: 0x45474A, shoes: 0x4A2C1A, h: 1.02 },
  iris:   { skin: 0xEBC8A8, hair: 0x15120F, hairStyle: 'bun', top: 0x6F87AE, legs: 0x2E3447, shoes: 0x9A6A3A, h: 0.95 },
  scout:  { skin: 0xC8936A, hair: 0x2E2118, hairStyle: 'wavy', beard: true, coat: 0x23314F, top: 0xF2F0EA, legs: 0xCFC3AA, shoes: 0x2B3550, h: 1.0 },
  kai:    { skin: 0xE1B48E, hair: 0x5A3E2A, hairStyle: 'wavy', glasses: true, top: 0xA9C4E8, vest: 0x6E6356, legs: 0x2E3650, shoes: 0x4A2C1A, h: 1.0 },
  nadia:  { skin: 0xD9AC88, hair: 0x1E1612, hairStyle: 'long', top: 0x7D9474, legs: 0x3C3E42, shoes: 0x5B1F1F, h: 0.95 },
  priya:  { skin: 0xB98260, hair: 0x15120F, hairStyle: 'short', top: 0x4A4D52, legs: 0x5F6650, shoes: 0x1A1A1A, h: 1.0 },
  markus: { skin: 0x6E4630, hair: 0x15120F, hairStyle: 'curly', coat: 0xA899C4, top: 0xF4F1EA, legs: 0x2E3447, shoes: 0xEDEDED, h: 0.96 },
  leila:  { skin: 0xCFA07C, hair: 0x1E1612, hairStyle: 'long', top: 0xB2593A, legs: 0xE8DFCC, shoes: 0x3A2416, h: 0.95 },
};
function castFor(id, name, i = 0, extra = {}) {
  if (CAST[id]) return { ...CAST[id], id };
  if (ART[id]) return { id, name, art: true, ...ART[id], ...extra };
  const fem = ['iris', 'robin', 'ling', 'maya', 'leila', 'nadia', 'mariam', 'priya', 'simone', 'amelia', 'hannah', 'elena', 'sofia', 'grace', 'hana', 'farah', 'eva', 'nour', 'helen', 'maria', 'deniz', 'ece', 'jade'].includes(id);
  const tops = [0x7F9A7A, 0xEFE7D8, 0x5F7F5B, 0xD9C7A6, 0x8FA6B8, 0xE8DCCB, 0x6E7F6A];
  return { id, name, skin: skinTones[i % 5], hair: [0x1B1410, 0x3A2A1E, 0x5A3E2A, 0x15120F][i % 4], hairStyle: fem ? (i % 2 ? 'bun' : 'long') : (i % 2 ? 'short' : 'wavy'), top: tops[i % tops.length], coat: null, legs: [0x3A3A3C, 0x4F5B56, 0x6B6E72, 0x2F3B35][i % 4], shoes: 0x2a2a2a, h: fem ? 0.95 : 1.0, ...extra };
}

export { castFor };
export class Person {
  constructor(floor, spec, shadows = true) {
    this.spec = spec; this.id = spec.id; this.floor = floor;
    const M = (k, c) => mat(floor, 'p' + k, c);
    const root = new THREE.Group(); this.root = root; root.userData.personId = spec.id;
    const s = spec.h; this.s = s;
    const pelvis = new THREE.Group(); pelvis.position.y = 0.92 * s; root.add(pelvis); this.pelvis = pelvis;
    const mk = (geo, m, sx, sy, sz, x, y, z, parent) => { const me = new THREE.Mesh(geo, m); me.userData.personPart = true; me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = shadows; parent.add(me); return me; };
    const cap = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
    const torsoMat = M('top', spec.top), coatMat = spec.coat ? M('coat', spec.coat) : torsoMat;
    const torso = new THREE.Group(); torso.position.y = 0.05; pelvis.add(torso); this.torso = torso;
    mk(G.box, coatMat, 0.36, 0.16, 0.22, 0, 0.02, 0, pelvis); // hips
    mk(cap, torsoMat, 0.32, 0.22, 0.2, 0, 0.3, 0.005, torso);
    if (spec.coat) { mk(cap, coatMat, 0.36, 0.2, 0.22, -0.0, 0.31, -0.01, torso); mk(G.box, torsoMat, 0.12, 0.34, 0.02, 0, 0.32, 0.118, torso); }
    if (spec.vest) mk(cap, M('vest', spec.vest), 0.335, 0.2, 0.215, 0, 0.3, 0.004, torso);
    if (spec.long) { const tail = mk(G.box, coatMat, 0.38, 0.42, 0.06, 0, -0.18, -0.1, pelvis); this.tail = tail; }
    if (spec.lanyard) { mk(G.box, M('lan', 0x2D5BD0), 0.02, 0.26, 0.01, 0, 0.36, 0.125, torso); mk(G.box, M('badge', 0xffffff), 0.06, 0.08, 0.01, 0, 0.22, 0.13, torso); }
    // head
    const head = new THREE.Group(); head.position.y = 0.62; torso.add(head); this.head = head;
    mk(G.cyl8, M('skin', spec.skin), 0.08, 0.1, 0.08, 0, -0.03, 0, head);
    mk(G.sph, M('skin', spec.skin), 0.27, 0.3, 0.27, 0, 0.14, 0.01, head);
    for (const ex of [-0.05, 0.05]) mk(G.sphLo, M('eye', 0x1d1a18), 0.03, 0.036, 0.02, ex, 0.15, 0.128, head);
    const hm = M('hair', spec.hair);
    if (spec.hairStyle === 'curly') { for (let i = 0; i < 11; i++) { const a = i * 0.57; mk(G.sphLo, hm, 0.1, 0.1, 0.1, Math.cos(a) * 0.1, 0.24 + (i % 3) * 0.02, Math.sin(a) * 0.09 - 0.01, head); } mk(G.sph, hm, 0.25, 0.14, 0.25, 0, 0.22, -0.01, head); }
    else if (spec.hairStyle === 'bun') { mk(G.sph, hm, 0.255, 0.2, 0.26, 0, 0.2, -0.01, head); mk(G.sphLo, hm, 0.11, 0.11, 0.11, 0, 0.27, -0.1, head); }
    else if (spec.hairStyle === 'long') { mk(G.sph, hm, 0.26, 0.22, 0.27, 0, 0.19, -0.015, head); mk(G.box, hm, 0.24, 0.3, 0.08, 0, 0.04, -0.09, head); }
    else if (spec.hairStyle === 'bald') { /* no hair */ }
    else { mk(G.sph, hm, 0.255, 0.17, 0.26, 0, 0.215, -0.01, head); if (spec.hairStyle === 'wavy') mk(G.sphLo, hm, 0.12, 0.08, 0.1, 0.05, 0.27, 0.06, head); }
    if (spec.beard) mk(G.sph, hm, 0.2, 0.12, 0.16, 0, 0.04, 0.06, head);
    if (spec.glasses) { const gm = M('glasses', 0x111111); mk(G.box, gm, 0.22, 0.022, 0.02, 0, 0.155, 0.138, head); for (const ex of [-0.05, 0.05]) mk(G.box, gm, 0.075, 0.055, 0.012, ex, 0.15, 0.14, head); }
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.2, 0.47, 0); torso.add(sh);
      mk(cap, coatMat, 0.09, 0.16, 0.09, 0, -0.13, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      mk(cap, coatMat, 0.08, 0.15, 0.08, 0, -0.12, 0, el);
      const hand = mk(G.sphLo, M('skin', spec.skin), 0.08, 0.09, 0.08, 0, -0.26, 0, el);
      this.arms.push({ sh, el, hand, sx });
    }
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.095, -0.03, 0); pelvis.add(hip);
      mk(cap, M('legs', spec.legs), 0.13, 0.3, 0.13, 0, -0.21, 0, hip);
      const kn = new THREE.Group(); kn.position.y = -0.43; hip.add(kn);
      mk(cap, M('legs', spec.legs), 0.11, 0.3, 0.11, 0, -0.2, 0, kn);
      const ft = mk(G.box, M('shoes', spec.shoes), 0.11, 0.07, 0.25, 0, -0.43, 0.05, kn);
      this.legs.push({ hip, kn, ft, sx });
    }
    root.scale.setScalar(1);
    // state
    this.phase = 0; this.sit = 0; this.sitTarget = 0; this.reach = 0; this.reachTarget = 0; this.typing = 0; this.queue = []; this.busy = false; this.speed = 1.15; this.t = Math.random() * 10;
    this.prop = null;
  }
  place(x, z, ry, seated = false) { this.root.position.set(x, 0, z); this.root.rotation.y = ry; this.sit = this.sitTarget = seated ? 1 : 0; this.seatAt = seated ? { x, z, ry } : null; this.pose(0); }
  // pose from state; dt for blends
  pose(dt) {
    const s = this.s;
    this.sit += (this.sitTarget - this.sit) * Math.min(1, dt * 4.5);
    if (Math.abs(this.sitTarget - this.sit) < 0.002) this.sit = this.sitTarget;
    this.reach += (this.reachTarget - this.reach) * Math.min(1, dt * 5);
    const k = this.sit; const walk = this.walking ? 1 : 0;
    const ph = this.phase; const sw = Math.sin(ph) * 0.42 * walk;
    // pelvis: seated lowers to chair height; root at chair centre, pelvis slightly back
    this.pelvis.position.y = THREE.MathUtils.lerp(0.92 * s + Math.abs(Math.cos(ph)) * 0.02 * walk, 0.52, k);
    this.pelvis.position.z = THREE.MathUtils.lerp(0, -0.05, k);
    for (const L of this.legs) {
      const dir = L.sx;
      const swing = sw * dir;
      L.hip.rotation.x = THREE.MathUtils.lerp(-swing, -Math.PI / 2, k);
      const kneeWalk = Math.max(0, Math.sin(ph * 1 + (dir > 0 ? 0 : Math.PI) + 0.9)) * 0.55 * walk;
      L.kn.rotation.x = THREE.MathUtils.lerp(kneeWalk, Math.PI / 2, k);
    }
    this.t += dt;
    const type = this.typing && k > 0.9 ? 1 : 0;
    for (const A of this.arms) {
      const swing = -sw * A.sx * 0.8;
      let shx = THREE.MathUtils.lerp(swing, type ? -0.5 : -0.25, k);
      let elx = THREE.MathUtils.lerp(-0.15, type ? -1.05 : -0.6, k) + (type ? Math.sin(this.t * 9 + A.sx) * 0.04 : 0);
      if (A.sx > 0 && this.reach > 0.01) { shx = THREE.MathUtils.lerp(shx, -1.25, this.reach); elx = THREE.MathUtils.lerp(elx, -0.2, this.reach); }
      A.sh.rotation.x = shx; A.el.rotation.x = elx; A.sh.rotation.z = A.sx * 0.06;
    }
    this.torso.rotation.x = THREE.MathUtils.lerp(0.02 * walk, 0.05, k) + (type ? 0.08 : 0);
    if (this.tail) this.tail.rotation.x = k * 1.2;
  }
  holdProp(prop) { this.prop = prop; if (prop) { const h = this.arms[1].hand; h.add(prop); prop.position.set(0, -0.08, 0.06); prop.rotation.set(0, 0, 0); } }
}

// ---------------- campus ----------------
export class Campus {
  constructor(container, { lowPower = false, capture = false } = {}) {
    this.container = container; this.lowPower = lowPower; this.capture = capture;
    const r = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = !lowPower; r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement); this.renderer = r;
    const sc = new THREE.Scene(); this.scene = sc;
    sc.background = this.skyTexture(); sc.fog = new THREE.Fog(0xF1ECE2, 90, 220);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: 0.45, maxPolarAngle: 1.2, rotateSpeed: 0.5, zoomSpeed: 0.7 });
    this.controls.enabled = false;
    // lights
    if (!lowPower) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.22; }
    sc.add(new THREE.HemisphereLight(0xFFF3E0, 0xE4D8C4, 0.95));
    const sun = new THREE.DirectionalLight(0xFFDDB0, 2.4); sun.position.set(-18, 40, 26); sun.castShadow = !lowPower;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 120 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    sc.add(sun); sc.add(sun.target); this.sun = sun;
    const fill = new THREE.DirectionalLight(0xE8F0FF, 0.35); fill.position.set(20, 15, -10); sc.add(fill);
    this.floors = []; this.rooms = []; this.labels = []; this.people = {}; this.seats = {}; this.solids = {};
    this.activeFloor = 0; this.mode = 'exterior'; this.follow = null; this.followOffset = new THREE.Vector3(0, 7.5, 8.5);
    this.buildSite();
    for (let n = 0; n <= 6; n++) this.buildFloor(n);
    this.buildRoof();
    this.camTarget = new THREE.Vector3(); this.tweens = []; this.clock = { _t: performance.now(), getDelta() { const n = performance.now(); const d = (n - this._t) / 1000; this._t = n; return d; } }; this.paused = false; this.reduced = false;
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this.resize(); window.addEventListener('resize', () => this.resize());
    if (!capture) r.setAnimationLoop(() => this.frame());
  }
  skyTexture() { const c = document.createElement('canvas'); c.width = 2; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#DDE8EE'); g.addColorStop(0.55, '#F4EFE6'); g.addColorStop(1, '#EFE7D8'); x.fillStyle = g; x.fillRect(0, 0, 2, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  resize() { const w = this.container.clientWidth, h = this.container.clientHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  buildSite() {
    const g = new THREE.Group(); this.site = g; this.scene.add(g);
    const b = new Builder(g, 'site', { shadows: !this.lowPower });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('site', 'grass', P.grass)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true; g.add(ground);
    b.box(W + 14, 0.02, D + 30, 0, -0.35, 6, P.paving, { cast: false, key: 'pave' });
    b.box(7, 0.03, 26, 0, -0.34, 26, 0xEEE8DC, { cast: false, key: 'path' });
    for (const [x, z, s] of [[-26, 4, 1.6], [-27, -10, 1.8], [26, 2, 1.7], [27, -12, 1.5], [-9, 24, 1.2], [9, 24, 1.2], [-14, 30, 1.4], [14, 31, 1.3], [-30, 20, 1.9], [30, 18, 1.8], [0, -24, 2.2], [-18, -22, 2], [18, -22, 2]]) { const t = b.tree(x, z, s); }
    g.position.y = 0; bake(g, this.lowPower);
  }
  buildRoof() { const g = this.floors[6].group; const b = new Builder(g, 6); this.roof = b.box(W + 0.6, 0.4, D + 0.6, 0, 4.65, 0, P.slab, { key: 'roof' }); this.roof.visible = true; }

  buildFloor(n) {
    const g = new THREE.Group(); g.position.y = n * FH; this.scene.add(g);
    const shell = new THREE.Group(); const inner = new THREE.Group(); const front = new THREE.Group(); g.add(shell, inner, front);
    const exec = n >= 5;
    const sb = new Builder(shell, n, { exec, shadows: !this.lowPower });
    sb.box(W + 0.6, 0.36, D + 0.6, 0, -0.36, 0, P.slab, { key: 'slab' });
    sb.box(W, 0.02, D, 0, 0, 0, 0xffffff, { cast: false, key: 'floor', o: { map: floorTexture(exec), rough: 0.62 } });
    // facade: back + sides glass full height with mullions
    const fullH = 4.6;
    const glassM = mat(n, 'fglass', 0xCFE3DF, { glass: true, opacity: 0.28 });
    const addGlass = (grp, x, z, len, ry) => { const gm = new THREE.Mesh(G.box, glassM); gm.scale.set(ry ? 0.05 : len, fullH, ry ? len : 0.05); gm.position.set(x, fullH / 2, z); grp.add(gm); };
    addGlass(shell, 0, -HD, W, 0); addGlass(shell, -HW, 0, D, 1); addGlass(shell, HW, 0, D, 1);
    for (let i = 0; i <= 12; i++) { const x = -HW + (W / 12) * i; sb.box(0.12, fullH, 0.12, x, 0, -HD, P.wall, { key: 'mull', cast: false }); }
    for (let i = 0; i <= 8; i++) { const z = -HD + (D / 8) * i; sb.box(0.12, fullH, 0.12, -HW, 0, z, P.wall, { key: 'mull', cast: false }); sb.box(0.12, fullH, 0.12, HW, 0, z, P.wall, { key: 'mull', cast: false }); }
    // front: low planter edge (always) + full glass facade (exterior view only)
    sb.box(W, 0.5, 0.5, 0, 0, HD - 0.25, P.wall, { key: 'planter' });
    for (let i = 0; i < 16; i++) { if (n === 0 && Math.abs(-HW + 1.2 + i * 2.25) < 3.5) continue; sb.sph(0.34, -HW + 1.2 + i * 2.25, 0.62, HD - 0.25, i % 2 ? P.leaf : P.leaf2, { key: 'leaf' }); }
    const fb = new Builder(front, n, { exec, shadows: false });
    const fgl = new THREE.Mesh(G.box, glassM); fgl.scale.set(W, fullH, 0.05); fgl.position.set(0, fullH / 2, HD + 0.02); front.add(fgl);
    for (let i = 0; i <= 12; i++) fb.box(0.12, fullH, 0.12, -HW + (W / 12) * i, 0, HD, P.wall, { key: 'mull', cast: false });
    fb.box(W + 0.6, 0.12, 0.2, 0, fullH - 0.1, HD, P.wall, { key: 'mull', cast: false });
    const b = new Builder(inner, n, { exec, shadows: !this.lowPower });
    this.floorBuilders = this.floorBuilders || {};
    const F = { n, group: g, shell, inner, front, b, people: [] };
    this.floors[n] = F;
    [this.layoutGround, this.layoutCommercial, this.layoutTechnology, this.layoutResources, this.layoutAI, this.layoutUnits, this.layoutFounder][n].call(this, b, F);
    for (const grp of [shell, inner, front]) bake(grp, this.lowPower);
    this.rooms.push(...b.rooms); this.labels.push(...b.labels); Object.assign(this.seats, Object.fromEntries(Object.entries(b.seats).map(([k, v]) => [k, { ...v, floor: n }])));
    this.solids[n] = b.solids.concat(sb.solids);
  }
  addPerson(F, id, name, x, z, ry, { seated = true, typing = true, i = 0, label = true, extra = {} } = {}) {
    const p = new Person(F.n, castFor(id, name, i, extra), !this.lowPower);
    p.place(x, z, ry, seated); p.typing = typing && seated; F.inner.add(p.root); this.people[id + '@' + F.n] = p; F.people.push(p);
    if (label) this.labels.push({ text: name, kind: 'person', floor: F.n, person: p, pos: new THREE.Vector3() });
    return p;
  }
  // person seated at a desk: chair behind desk, facing the desk
  deskStation(F, id, name, x, z, ry, opts = {}) {
    const b = F.b; const dx = Math.sin(ry), dz = Math.cos(ry);
    b.desk(x + dx * 0.55, z + dz * 0.55, ry + Math.PI, opts.desk || {});
    b.seat(id + '@' + F.n, x, z, ry, opts.chair);
    if (opts.person !== false) return this.addPerson(F, id, name, x, z, ry, { i: opts.i || 0, extra: opts.extra });
  }

  // ---- Ground: Customer Centre
  layoutGround(b, F) {
    // entrance doors + sign (front centre)
    const fz = HD;
    for (const sx of [-1, 1]) { const dm = new THREE.Mesh(G.box, mat(0, 'doorglass', 0xD6EAE4, { glass: true, opacity: 0.3 })); dm.scale.set(1.5, 2.8, 0.06); dm.position.set(sx * 0.78, 1.4, fz + 0.05); dm.userData.keep = true; b.g.add(dm); b.box(0.08, 2.9, 0.1, sx * 1.55, 0, fz + 0.05, P.frame, { key: 'frame' }); const edge = new THREE.Mesh(G.box, mat(0, 'frame', P.frame)); edge.scale.set(0.07, 2.8, 0.1); edge.position.set(-sx * 0.72, 0, 0); edge.userData.keep = true; dm.add(edge); edge.scale.divide(dm.scale); edge.position.x = -sx * 0.48; (this.doors = this.doors || []).push(dm); }
    b.box(3.2, 0.1, 0.12, 0, 2.85, fz + 0.05, P.frame, { key: 'frame' });
    const sign = this.signGroup = b.display(0, 3.6, fz + 0.18, 5.2, 0.9, 0, textTexture('WARQÉVA', { w: 1024, h: 180, bg: '#F8F3EA', fg: '#24432F', font: '600 110px Fraunces, Georgia, serif', radius: 10 }), { frame: P.wall });
    sign.traverse((o) => { o.userData.keep = true; });
    this.signPos = new THREE.Vector3(0, 3.6, fz + 0.2);
    b.box(6, 0.02, 2.4, 0, 0, fz - 1.6, 0xD8C9AE, { key: 'mat', cast: false });
    // reception
    b.receptionDesk(0, 6.2, 3.6);
    b.seat('jade@0', 0, 5.6, Math.PI, P.cream);
    this.addPerson(F, 'jade', 'Jade', 0, 5.6, Math.PI, { i: 1 });
    b.plant(-2.6, 6.6, 1.1, { tall: true }); b.plant(2.6, 6.6, 1.1, { tall: true }); b.lamp(1.2, 6.4, 1.3);
    b.label('Reception', 0, 2.0, 6.9);
    // lounge
    b.rug(0, -0.5, 5.2);
    b.curvedSofa(-0.2, -0.5, 3.6, Math.PI * 0.62, Math.PI * 1.05, P.sageDark); b.curvedSofa(0.2, -0.5, 3.6, -Math.PI * 0.05, Math.PI * 0.38, P.sageDark);
    b.cyl(1.0, 0.5, 0, 0, -0.5, P.oakLight, { key: 'planter' }); b.tree(0, -0.5, 1.0);
    b.roundTable(-2.3, 0.9, 0.45, P.oakLight, 0.42); b.roundTable(2.3, 0.9, 0.45, P.oakLight, 0.42);
    b.label('Networking lounge', 0, 3.6, 2.4);
    this.addPerson(F, 'visitor1', 'Visitor', -3.3, -1.0, 1.2, { i: 2, typing: false, label: false });
    this.addPerson(F, 'visitor2', 'Visitor', 3.3, -1.2, -1.2, { i: 3, typing: false, label: false });
    // theatre (rear, semicircle)
    b.room('theatre', 'Demonstration theatre', 3, -9.3, 11, 7, { open: ['s'], glassSides: [], height: 3 });
    for (const r of [2.4, 3.4]) b.curvedSofa(3, -11.2, r, Math.PI * 0.15, Math.PI * 0.85, r < 3 ? P.sage : P.sageDark);
    b.display(3, 2.0, -12.6, 3.2, 1.6, 0, screenTexture('landscape'));
    // workshop
    b.room('workshop', 'Workshop', 13.6, -8.6, 8.4, 8.4, { open: ['w', 's'], glassSides: ['n', 'e'] });
    for (const [x, z] of [[12, -10], [15, -10], [12, -6.8], [15, -6.8]]) { b.rectTable(x, z, 2, 1.1, P.oakLight); for (const sz of [-0.85, 0.85]) b.chair(x - 0.45, z + sz, sz > 0 ? Math.PI : 0, P.cream); }
    // staff-only operations
    b.room('ops', 'Operations · staff only', -13.4, -9.2, 9, 7.4, { door: { side: 's', at: 3.3 }, glassSides: ['n', 'w'], tint: 0xE6DDCB });
    this.deskStation(F, 'rory', 'Rory', -15.6, -10, Math.PI, { i: 0 }); this.deskStation(F, 'grace', 'Grace', -12.6, -10, Math.PI, { i: 1 });
    b.box(0.08, 2.3, 1.1, -9, 0, -5.3, P.walnut, { key: 'wood' });
    // core
    b.core(-5.2, -11.2, { facing: 1 });
    // galleries
    for (const sx of [-1, 1]) {
      const gx = sx * 15.6; b.room('gallery' + (sx < 0 ? 'L' : 'R'), 'Business gallery', gx, 4.4, 4.6, 12, { open: [sx < 0 ? 'e' : 'w'], glassSides: [] , height: 3, wallColor: P.oakLight });
      for (const z of [0.4, 3.4, 6.4, 9.0]) b.display(gx - sx * 2.15, 1.5, z, 2.0, 1.2, sx < 0 ? Math.PI / 2 : -Math.PI / 2, screenTexture(z > 5 ? 'landscape' : 'chart'));
      b.box(0.6, 1.0, 0.5, gx - sx * 0.6, 0, 2.2, P.oakLight, { key: 'kiosk', solid: true }); b.display(gx - sx * 0.6, 1.25, 2.2, 0.9, 0.6, sx < 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4, screenTexture('chart'));
    }
    for (const [x, z] of [[-8, 9], [8, 9], [-8, -5], [8, -4.5], [-10, 1], [10, 1]]) b.plant(x, z, 1.2, { tall: true });
  }

  // ---- Floor 1: Commercial
  layoutCommercial(b, F) {
    const L = [['finance', 'Finance & Procurement', -9.2, ['Farah', 'Evelyn']], ['partnerships', 'Partnerships', -1.6, ['Omar']], ['sales', 'Sales', 6.2, ['Tariq']]];
    const R = [['pitch', 'Pitch rehearsal', -9.2, []], ['brand', 'Brand', -1.6, ['Sofia']], ['marketing', 'Marketing', 6.2, []]];
    let i = 0;
    for (const [side, list] of [[-1, L], [1, R]]) for (const [id, label, z, ppl] of list) {
      const x = side * 13.2; b.room(id, label, x, z, 9, 6.6, { door: { side: side < 0 ? 'e' : 'w', at: 1.8 } });
      b.display(x - side * 0.5, 1.4, z - 3.1, 2.2, 1.2, 0, screenTexture(['chart', 'bars', 'flow'][i % 3]));
      if (id === 'pitch') { for (let k = 0; k < 6; k++) b.chair(x - 2.4 + (k % 3) * 1.2, z + 0.6 + Math.floor(k / 3) * 1.2, Math.PI, P.sage); b.cyl(0.04, 1.4, x + 3, 0, z - 1.5, 0x333333); }
      else { b.rectTable(x - side * 0.6, z + 0.4, 3.2, 1.4); ppl.forEach((nm, j) => { const sx = x - side * 0.6 + (j ? 0.8 : -0.8); b.seat(nm.toLowerCase() + '@1', sx, z + 1.5, Math.PI, P.cream); this.addPerson(F, nm.toLowerCase().replace(' ', ''), nm, sx, z + 1.5, Math.PI, { i: i + j }); }); }
      b.plant(x + side * 3.6, z - 2.4, 1); i++;
    }
    b.rug(0, 0, 5.4); b.rectTable(0, 0, 6, 2.6);
    for (const k of [-2, -0.7, 0.7, 2]) { b.chair(k, -1.85, 0); b.chair(k, 1.85, Math.PI); }
    b.chair(-3.6, 0, Math.PI / 2); b.chair(3.6, 0, -Math.PI / 2);
    b.label('Campaign & proposal table', 0, 1.6, 2.6);
    b.core(-5, -11.2); b.sofa(4.5, -11.2, 3.4, 0, P.sage); b.roundTable(4.5, -9.6, 0.5, null, 0.42); b.plant(7.6, -11.4, 1.2, { tall: true });
    b.receptionDesk(0, 7.6, 3.0); b.label('Reception', 0, 1.8, 8.4);
    for (const [x, z] of [[-6.5, 9.5], [6.5, 9.5], [-6.5, -6], [6.5, -6]]) b.plant(x, z, 1.1, { tall: true });
  }

  // ---- Floor 2: Technology
  layoutTechnology(b, F) {
    const rooms = [['eng', 'Engineering & Integrations', -13.2, -9.2, 9, 6.6, 'e', [['priya', 'Priya']]], ['arch', 'Architecture & Development', -13.2, -1.6, 9, 6.6, 'e', [['oliver', 'Oliver']]], ['sys', 'Systems & Integrations', -13.2, 6.2, 9, 6.6, 'e', [['kiran', 'Kiran']]],
      ['lab', 'Shared technical lab', 2.4, -10, 11, 5.6, 's', []], ['incident', 'Incident room', 13.4, -9.6, 8.8, 6, 'w', [['daniel', 'Daniel']]], ['sec', 'Security & Resilience', 13.4, 2.6, 8.8, 10.4, 'w', [['simone', 'Simone'], ['amelia', 'Amelia']]],
      ['assure', 'Independent assurance', 0, 8.4, 8, 5, 'n', [['hannah', 'Hannah']]]];
    let i = 0;
    for (const [id, label, x, z, w, d, ds, ppl] of rooms) {
      b.room(id, label, x, z, w, d, { door: { side: ds, at: ds === 'n' || ds === 's' ? -1.5 : 1.5 } });
      b.display(x, 1.5, z - d / 2 + 0.15, 2.2, 1.2, 0, screenTexture(id === 'sec' || id === 'assure' ? 'shield' : ['flow', 'chart', 'bars'][i % 3]));
      ppl.forEach(([pid, nm], j) => { const px = x - w / 2 + 1.8 + j * 2.4; const pz = z + d / 2 - 1.3; this.deskStation(F, pid, nm, px, pz, Math.PI, { i: i + j }); });
      if (id === 'lab') { b.rectTable(x - 1.5, z + 0.6, 3.4, 1.1, P.oakLight); b.box(1.2, 1.6, 0.6, x + 3.4, 0, z - 1.8, 0x9DA39C, { key: 'rack', solid: true }); }
      i++;
    }
    b.rug(0, -1.4, 4.6); b.roundTable(0, -1.4, 1.6);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.chair(Math.cos(a) * 2.3, -1.4 + Math.sin(a) * 2.3, -a - Math.PI / 2); }
    b.label('Technical handoff', 0, 1.6, 0.9);
    b.core(-5.2, -11.2);
    for (const [x, z] of [[-6.5, 4.5], [6.5, 4.5], [-7, -6.5], [7, -5.2]]) b.plant(x, z, 1.1, { tall: true });
  }

  // ---- Floor 3: Agent Resources
  layoutResources(b, F) {
    const rooms = [['ld', 'Learning & Development', -13.2, -9.2, 9, 6.6, 'e'], ['library3', 'Knowledge library', 1.6, -10, 12, 5.6, 's'], ['eval', 'Evaluation lab', 13.4, -9.4, 8.8, 6.6, 'w'], ['agentres', 'Agent Resources', -13.2, 6.0, 9, 7, 'e'], ['analytics', 'Analytics studio', 13.4, 6.0, 8.8, 7, 'w']];
    const ppl = { ld: [['nour', 'Nour']], eval: [['helen', 'Helen']], agentres: [], analytics: [['theo', 'Theo']], library3: [] };
    let i = 0;
    for (const [id, label, x, z, w, d, ds] of rooms) {
      b.room(id, label, x, z, w, d, { door: { side: ds, at: ds === 's' ? 2 : 1.6 } });
      if (id === 'library3') { b.shelf(x - 3.5, z - 2.4, 4); b.shelf(x + 1.2, z - 2.4, 4); b.rectTable(x - 1, z + 0.8, 3, 1); }
      else b.display(x, 1.5, z - d / 2 + 0.15, 2.2, 1.2, 0, screenTexture(['list', 'chart', 'bars', 'flow'][i % 4]));
      ppl[id].forEach(([pid, nm], j) => this.deskStation(F, pid, nm, x - w / 2 + 2 + j * 2.6, z + d / 2 - 1.4, Math.PI, { i: i + j }));
      i++;
    }
    // learning garden
    b.cyl(2.4, 0.55, 0, 0, -0.5, 0xE9DFCC, { key: 'planter' }); b.tree(0, -0.5, 1.5);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.plant(Math.cos(a) * 1.9, -0.5 + Math.sin(a) * 1.9, 0.9); }
    b.curvedSofa(0, -0.5, 3.6, Math.PI * 0.15, Math.PI * 0.85, P.oak);
    for (const [x, z] of [[-5.6, 2.6], [5.6, 2.6], [-5.2, -4.2], [5.2, -4.2]]) { b.roundTable(x, z, 0.6); b.chair(x - 0.9, z, Math.PI / 2, P.sage); b.chair(x + 0.9, z, -Math.PI / 2, P.sage); }
    b.label('Learning garden', 0, 4.2, 1.5);
    b.box(2.6, 1.6, 0.12, -7.6, 0.6, -2, P.wall, { key: 'board' }); b.display(-7.6, 1.5, -1.92, 2.4, 1.2, 0, textTexture('Development reports', { w: 512, h: 256, bg: '#F8F3EA', fg: '#24432F', font: '600 40px Inter', sub: 'Assigned · Completed · Assessed · Usage · Next', subFont: '500 22px Inter' }));
    b.core(-5.2, -11.2);
    for (const [x, z] of [[-7, 9.5], [7, 9.5]]) b.plant(x, z, 1.1, { tall: true });
  }

  // ---- Floor 4: AI Leadership
  layoutAI(b, F) {
    const back = ['Meedz', 'Atlas', 'Iris', 'Markus', 'Ling'], backR = ['Kai', 'Rory', 'Chen Wei', 'Mesi'];
    const front = ['Sully', 'Dev', 'Min-jun', 'Lukas'], frontR = ['Nadia', 'Leila', 'Khalid', 'Joe'];
    const ow = 3.4, od = 4.4; let i = 0;
    const office = (nm, x, z, facing) => {
      const id = 'ai-' + nm.toLowerCase().replace(/\W/g, '');
      const lead = ['Meedz', 'Sully', 'Mesi', 'Joe'].includes(nm);
      b.room(id, nm, x, z, ow, od, { door: { side: facing > 0 ? 's' : 'n', at: 0.9, w: 1.0 }, tint: lead ? 0xE6DCC4 : null });
      b.display(x - 0.6, 1.55, z - facing * (od / 2 - 0.12), 1.4, 0.9, facing > 0 ? 0 : Math.PI, screenTexture(['bars', 'chart', 'list', 'shield', 'flow'][i % 5]));
      const pid = nm.toLowerCase().replace(/\W/g, '');
      this.deskStation(F, pid, nm, x - 0.4, z - facing * 0.2, facing > 0 ? 0 : Math.PI, { i, person: true });
      b.plant(x + ow / 2 - 0.45, z - facing * (od / 2 - 0.5), 0.8); i++;
    };
    back.forEach((nm, k) => office(nm, -HW + ow / 2 + 0.2 + k * ow, -HD + od / 2 + 0.3, 1));
    backR.forEach((nm, k) => office(nm, HW - ow / 2 - 0.2 - (3 - k) * ow, -HD + od / 2 + 0.3, 1));
    front.forEach((nm, k) => office(nm, -HW + ow / 2 + 0.2 + k * ow, HD - od / 2 - 0.8, -1));
    frontR.forEach((nm, k) => office(nm, HW - ow / 2 - 0.2 - (3 - k) * ow, HD - od / 2 - 0.8, -1));
    // side rooms: Robin (left), Mariam (right)
    b.room('ai-robin', 'Robin · Governance', -HW + 2.4, 0, 4.4, 5, { door: { side: 'e', at: 0 } }); this.deskStation(F, 'robin', 'Robin', -HW + 1.6, 0, Math.PI / 2, { i: 3 });
    b.room('ai-mariam', 'Mariam · Translation & Docs', HW - 2.4, 0, 4.4, 5, { door: { side: 'w', at: 0 } }); this.deskStation(F, 'mariam', 'Mariam (appearance pending)', HW - 1.6, 0, -Math.PI / 2, { i: 4, extra: { pending: true } });
    // back-centre lounge between wings
    b.sofa(1.7, -11.6, 3.2, 0, P.sage); b.chair(-0.2, -10, Math.PI * 0.75, P.sage, { arm: true }); b.chair(3.6, -10, -Math.PI * 0.75, P.sage, { arm: true }); b.roundTable(1.7, -10.3, 0.5, null, 0.42);
    // Scout library: shelf ring + evidence table
    b.rug(0, 0, 6.2, 0xE6D7BB);
    for (let k = 0; k < 7; k++) { const a = Math.PI * 1.05 + (k / 6) * Math.PI * 0.9; b.shelf(Math.cos(a) * 5.4, Math.sin(a) * 4.2 - 0.4, 2.2, -a - Math.PI / 2, 1.8); }
    b.rectTable(0, 0, 5.2, 1.8);
    for (const k of [-1.8, -0.6, 0.6, 1.8]) { b.chair(k, -1.3, 0); b.chair(k, 1.3, Math.PI); }
    b.display(-1.3, 0.85, 0, 1.6, 0.9, 0, textTexture('Current meeting', { w: 512, h: 256, bg: '#F8F3EA', fg: '#24432F', font: '600 44px Inter' })).rotation.x = -Math.PI / 2 + 0.25;
    b.display(1.3, 0.85, 0, 1.6, 0.9, 0, textTexture('Meeting archive', { w: 512, h: 256, bg: '#F8F3EA', fg: '#24432F', font: '600 44px Inter' })).rotation.x = -Math.PI / 2 + 0.25;
    this.deskStation(F, 'scout', 'Scout', 0, 4.1, Math.PI, { i: 2, desk: { w: 2.2 } });
    b.label('Scout research library', 0, 2.9, -3.6);
    b.core(0, HD - 1.0, { facing: -1, stairs: false });
    for (const [x, z] of [[-6.5, -5.4], [6.5, -5.4], [-6.5, 5.6], [6.5, 5.6]]) b.plant(x, z, 1.2, { tall: true });
  }

  // ---- Floor 5: Business Units — Discreet (Human Leadership layout, locked positions)
  layoutUnits(b, F) {
    // left column: Meedz (back-left) above Sully (front-left); right column: Mesi (back-right) above Joe (front-right)
    b.room('u-meedz', 'Meedz · Discreet office', -12.2, -7.2, 11.6, 11.2, { door: { side: 'e', at: 1.8 }, tint: 0xE4D6BC });
    b.room('u-sully', 'Sully', -12.2, 6.8, 11.6, 9.2, { door: { side: 'e', at: -1.6 } });
    b.room('u-mesi', 'Mesi', 12.2, -7.2, 11.6, 11.2, { door: { side: 'w', at: 1.8 } });
    b.room('u-joe', 'Joe', 12.2, 6.8, 11.6, 9.2, { door: { side: 'w', at: -1.6 } });
    // sliding doors in shared partitions, near lobby-facing (inner) ends
    for (const sx of [-1, 1]) { const dx = sx * 7.6; b.box(1.2, 2.5, 0.08, dx, 0, 2.2, P.walnut, { key: 'slide' }); b.box(0.05, 0.08, 2.4, dx, 2.5, 2.2, P.brass, { key: 'brass' }); }
    this.slidingDoors = [[-7.6, 2.2], [7.6, 2.2]];
    // Meedz unit office: desk, 4-person table, library, lounge
    b.display(-12.2, 1.6, -12.7, 2.6, 1.3, 0, screenTexture('landscape', '#0B5A3C'));
    this.deskStation(F, 'meedz', 'Meedz', -13.6, -10.2, 0, { desk: { w: 1.8 } });
    b.rectTable(-14.2, -4.4, 2.4, 1.4); for (const [cx, cz, r] of [[-14.8, -5.4, 0], [-13.6, -5.4, 0], [-14.8, -3.4, Math.PI], [-13.6, -3.4, Math.PI]]) b.chair(cx, cz, r, P.sage);
    b.shelf(-17.4, -7.4, 3.2, Math.PI / 2); b.sofa(-9.0, -11.6, 2.6, 0, P.cream); b.lamp(-10.6, -11.9, 1.5); b.plant(-7.2, -12.0, 1.2, { tall: true });
    // Sully: desk on the outer-left wall
    this.deskStation(F, 'sully', 'Sully', -15.6, 6.6, Math.PI / 2, { desk: { w: 1.7 } });
    b.chair(-13.6, 6.0, -Math.PI / 2, P.sage); b.chair(-13.6, 7.2, -Math.PI / 2, P.sage);
    b.sofa(-10.6, 10.0, 2.6, Math.PI, P.cream); b.shelf(-12.6, 2.6, 2.6, 0, 1.6); b.plant(-17.0, 10.4, 1.1, { tall: true });
    // Mesi
    b.display(12.2, 1.6, -12.7, 2.6, 1.3, 0, screenTexture('bars', '#0B5A3C'));
    this.deskStation(F, 'mesi', 'Mesi', 13.6, -10.2, 0, { desk: { w: 1.8 } });
    b.chair(13.0, -7.8, Math.PI, P.sage); b.chair(14.2, -7.8, Math.PI, P.sage);
    b.sofa(9.4, -4.6, 2.6, Math.PI, P.cream); b.shelf(17.4, -7.0, 3.0, -Math.PI / 2); b.plant(7.4, -12.0, 1.2, { tall: true });
    // Joe: desk on the outer-right wall
    this.deskStation(F, 'joe', 'Joe', 15.6, 6.6, -Math.PI / 2, { desk: { w: 1.7 } });
    b.chair(13.6, 6.0, Math.PI / 2, P.sage); b.chair(13.6, 7.2, Math.PI / 2, P.sage);
    b.sofa(10.6, 10.0, 2.6, Math.PI, P.cream); b.shelf(12.6, 2.6, 2.6, 0, 1.6); b.plant(17.0, 10.4, 1.1, { tall: true });
    // back-centre lounge with Discreet unit wall
    b.box(8, 3.2, 0.2, 0, 0, -12.6, 0x0B5A3C, { key: 'unitwall', solid: true });
    this.unitLogoSpot = { floor: 5, x: 0, y: 1.9, z: -12.45 };
    b.sofa(0, -10.6, 3.4, 0, P.sage); b.chair(-2.6, -9.0, Math.PI * 0.7, P.sage, { arm: true }); b.chair(2.6, -9.0, -Math.PI * 0.7, P.sage, { arm: true }); b.roundTable(0, -9.0, 0.55, null, 0.42);
    b.label('Discreet lounge', 0, 3.6, -12.2);
    // central Discreet project table (scoped agent instances)
    b.rug(0, -2, 4.2, 0xE2D3B6);
    b.rectTable(0, -2, 4.6, 2.2);
    const seatsBack = [[-1.2, -3.65], [1.2, -3.65]], seatsFront = [[-1.2, -0.35], [1.2, -0.35]];
    b.seat('maya@5', -1.2, -3.65, 0); b.seat('x1@5', 1.2, -3.65, 0, P.sage);
    b.seat('robin@5', -1.2, -0.35, Math.PI); b.seat('amir@5', 1.2, -0.35, Math.PI);
    b.chair(-2.9, -2, Math.PI / 2); b.chair(2.9, -2, -Math.PI / 2);
    this.addPerson(F, 'maya', 'Maya', -1.2, -3.65, 0, { i: 1 });
    this.addPerson(F, 'robin', 'Robin', -1.2, -0.35, Math.PI, { i: 3 });
    this.addPerson(F, 'amir', 'Amir', 1.2, -0.35, Math.PI, { i: 2 });
    b.label('Discreet project table', 0, 1.7, 0.6);
    // Iris reception + private assistants
    b.receptionDesk(0, 5.4, 3.2); b.seat('iris@5', 0, 4.9, Math.PI, P.cream); this.addPerson(F, 'iris', 'Iris', 0, 4.9, Math.PI, { i: 1 });
    b.label('Iris · Secretariat', 0, 1.9, 6.2);
    this.deskStation(F, 'luan', 'Luan', -5.0, 5.0, Math.PI / 2, { i: 0, desk: { w: 1.2 } });
    this.deskStation(F, 'deniz', 'Deniz', 5.0, -5.6, -Math.PI / 2, { i: 2, desk: { w: 1.2 } });
    this.deskStation(F, 'ece', 'Ece', 5.0, 5.0, -Math.PI / 2, { i: 3, desk: { w: 1.2 } });
    b.core(0, HD - 1.0, { facing: -1, stairs: false });
    b.plant(-3.0, 9.6, 1.2, { tall: true }); b.plant(3.0, 9.6, 1.2, { tall: true }); b.plant(-5.6, -7.4, 1.0); b.plant(5.6, -7.4, 1.0);
  }

  // ---- Floor 6: Founder (Ahmed + Meedz, owner-only)
  layoutFounder(b, F) {
    b.room('f-suite', 'Founder suite · Ahmed & Meedz', -7, -4.8, 21.6, 15.4, { door: { side: 's', at: 6.5, w: 1.6 }, tint: 0xE2D2B4 });
    this.deskStation(F, 'meedz', 'Meedz', -11.5, -10.0, 0, { desk: { w: 2.0 } });
    b.display(-11.5, 1.7, -12.3, 3.4, 1.5, 0, textTexture('Founder approvals', { w: 512, h: 256, bg: '#24432F', fg: '#F8F3EA', font: '600 44px Fraunces, Georgia', sub: 'Decisions · Risks · Priorities', subFont: '500 24px Inter' }));
    b.rectTable(-11.2, -4.0, 3, 1.6); for (const [cx, cz, r] of [[-12, -5.2, 0], [-10.4, -5.2, 0], [-12, -2.8, Math.PI], [-10.4, -2.8, Math.PI]]) b.chair(cx, cz, r, P.sage);
    b.shelf(-17.4, -6, 4, Math.PI / 2); b.shelf(-17.4, -1.5, 3.6, Math.PI / 2);
    b.rug(-2.6, -8.4, 2.6); b.sofa(-2.6, -10.6, 3.2, 0, P.cream); b.chair(-4.7, -8.2, Math.PI / 2, P.sage, { arm: true }); b.chair(-0.5, -8.2, -Math.PI / 2, P.sage, { arm: true }); b.roundTable(-2.6, -8.3, 0.55, null, 0.42); b.lamp(-5, -11.8, 1.5);
    b.plant(3.0, -11.8, 1.3, { tall: true }); b.plant(-16.8, 1.8, 1.2, { tall: true });
    b.room('f-priorities', 'Business-unit priorities', 11.4, -6.6, 12, 11.8, { door: { side: 'w', at: 3.6 } });
    b.display(11.4, 1.6, -12.35, 4.2, 1.6, 0, screenTexture('list', '#B48A4A'));
    b.rectTable(11.4, -6.2, 5, 2); for (const k of [-1.6, 0, 1.6]) { b.chair(11.4 + k, -7.6, 0); b.chair(11.4 + k, -4.8, Math.PI); }
    this.deskStation(F, 'maria', 'Maria', 6.0, 6.4, -Math.PI / 2, { i: 1, desk: { w: 1.3 } });
    b.label('Maria · private assistant', 6.0, 2.0, 7.6);
    b.core(0, HD - 1.0, { facing: -1, stairs: false });
    for (const [x, z] of [[-6, 7.5], [-12, 7.5], [12, 6.5], [16, 3]]) b.plant(x, z, 1.2, { tall: true });
  }

  // ---------------- runtime ----------------
  setUnitLogo(tex) {
    const s = this.unitLogoSpot; const F = this.floors[s.floor];
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7 }); m.userData.baseOpacity = 1; m.userData.baseTransparent = true; floorMats.get(5).add(m);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.4), mat(5, 'paper', 0xFDFBEF)); bg.position.set(s.x, s.y, s.z + 0.02); F.inner.add(bg);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.576), m); lg.scale.set(1, 1, 1); lg.position.set(s.x, s.y, s.z + 0.04); F.inner.add(lg);
  }
  floorView(n, { aspect = this.camera.aspect } = {}) {
    const y = n * FH;
    // fit floor width into the view: distance grows on portrait screens
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const needW = W + 1, needH = D * 0.62 + 4;
    const distW = (needW / 2) / (Math.tan(fov / 2) * aspect), distH = (needH / 2) / Math.tan(fov / 2);
    const dist = Math.max(distW, distH) * 1.02;
    const dir = new THREE.Vector3(0, 0.62, 0.78).normalize();
    const target = new THREE.Vector3(0, y + 0.2, 0.4);
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }
  roomView(hit) {
    const u = hit.userData; const y = u.floor * FH; const size = Math.max(u.w, u.d * 1.3);
    const target = new THREE.Vector3(u.cx, y + 0.6, u.cz);
    const dist = Math.max(9, size * 1.6) / Math.min(1, this.camera.aspect * 1.2);
    const dir = new THREE.Vector3(u.cx * 0.02, 0.72, 0.7).normalize();
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }
  pathView(n, pts) {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs) + 6, (Math.max(...zs) - Math.min(...zs) + 5) * 1.5, 10);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (span / 2) / (Math.tan(fov / 2) * Math.min(1.6, this.camera.aspect)) * 1.05;
    const target = new THREE.Vector3(cx, n * FH + 0.5, cz); const dir = new THREE.Vector3(0.05, 0.68, 0.73).normalize();
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }
  showFloors(active, { exterior = false } = {}) {
    this.activeFloor = active;
    for (const F of this.floors) {
      const above = F.n > active;
      F.group.visible = exterior || F.n === active;
      F.front.visible = exterior;
      F.inner.visible = exterior ? true : F.n === active;
      for (const p of F.people) p.root.visible = !exterior || F.n === 0;
      setFloorOpacity(F.n, 1);
    }
    this.roof.visible = exterior;
    this.site.visible = exterior || active === 0;
    this.sun.target.position.set(0, active * FH, 0); this.sun.position.set(-18, active * FH + 40, 26);
  }
  // fade between floors (camera tween handled by caller)
  transitionFloors(from, to, dur) {
    const fl = this.floors;
    fl[to].group.visible = true; fl[to].inner.visible = true; this.site.visible = to === 0 || from === 0; fl[to].front.visible = false; this.roof.visible = false;
    for (const F of fl) F.front.visible = false;
    if (dur <= 0) { this.showFloors(to); return; }
    setFloorOpacity(to, 0);
    this.tween(dur, (k) => {
      setFloorOpacity(to, k);
      if (from > to) setFloorOpacity(from, 1 - k);
      for (const F of fl) if (F.n !== to && F.n !== from) F.group.visible = false;
    }, () => this.showFloors(to));
  }
  tween(dur, fn, done, ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) {
    const tw = { t: 0, dur: Math.max(0.0001, dur), fn, done, ease }; this.tweens.push(tw); return tw;
  }
  flyTo({ pos, target }, dur = 1.6, done) {
    this.controls.enabled = false;
    const p0 = this.camera.position.clone(), t0 = this.camTarget.clone();
    if (dur <= 0 || this.reduced) { this.camera.position.copy(pos); this.camTarget.copy(target); this.camera.lookAt(target); this.syncControls(); done && done(); return; }
    // arc: lift camera slightly mid-flight for a crane feel
    const lift = Math.min(6, p0.distanceTo(pos) * 0.12);
    this.tween(dur, (k) => { this.camera.position.lerpVectors(p0, pos, k); this.camera.position.y += Math.sin(k * Math.PI) * lift; this.camTarget.lerpVectors(t0, target, k); this.camera.lookAt(this.camTarget); }, () => { this.syncControls(); done && done(); });
  }
  // multi-key camera path (Catmull-Rom) for the walk-in
  flyPath(points, targets, dur, done) {
    this.controls.enabled = false;
    const cp = new THREE.CatmullRomCurve3(points, false, 'centripetal'), ct = new THREE.CatmullRomCurve3(targets, false, 'centripetal');
    this.tween(dur, (k) => { this.camera.position.copy(cp.getPoint(k)); this.camTarget.copy(ct.getPoint(k)); this.camera.lookAt(this.camTarget); }, () => { this.syncControls(); done && done(); }, (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  }
  syncControls() { this.controls.target.copy(this.camTarget); this.controls.update(); this.controls.enabled = this.interactive !== false; this.controls.minDistance = 6; this.controls.maxDistance = 90; }
  pick(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const cands = this.rooms.filter((h) => h.userData.floor === this.activeFloor);
    const hit = this.ray.intersectObjects(cands, false)[0];
    return hit ? hit.object : null;
  }
  pickFloor(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.activeFloor * FH); const out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(plane, out) ? { x: out.x, z: out.z } : null;
  }
  addVisitor(floor, x, z, ry) { const F = this.floors[floor]; const p = new Person(floor, castFor('guest', 'You', 3, { top: 0xD9B24C, legs: 0x3E4A44, hairStyle: 'short' }), !this.lowPower); p.place(x, z, ry, false); F.inner.add(p.root); F.people.push(p); this.people['guest@' + floor] = p; return p; }
  removeVisitor(floor) { const p = this.people['guest@' + floor]; if (!p) return; p.root.parent && p.root.parent.remove(p.root); const F = this.floors[floor]; F.people = F.people.filter((x) => x !== p); delete this.people['guest@' + floor]; }
  person(id, floor) { return this.people[id + '@' + floor]; }
  // queue-based actions
  walk(p, path) { return new Promise((res) => p.queue.push({ type: 'walk', path: path.map(([x, z]) => new THREE.Vector2(x, z)), res })); }
  stand(p) { return new Promise((res) => p.queue.push({ type: 'stand', res })); }
  sitDown(p, seat) { return new Promise((res) => p.queue.push({ type: 'sit', seat, res })); }
  face(p, ry) { return new Promise((res) => p.queue.push({ type: 'face', ry, res })); }
  wait(p, s) { return new Promise((res) => p.queue.push({ type: 'wait', s, res })); }
  async give(from, to) {
    const prop = new THREE.Mesh(G.box, mat(from.floor, 'folder', 0xF8B123, { emissive: 0xF8B123, ei: 0.35 })); prop.scale.set(0.22, 0.03, 0.3);
    from.holdProp(prop); from.reachTarget = 1; to.reachTarget = 1;
    await Promise.all([this.wait(from, 0.7), this.wait(to, 0.7)]);
    to.holdProp(prop); from.prop = null; from.reachTarget = 0;
    await this.wait(to, 0.5); to.reachTarget = 0; await this.wait(to, 0.35);
    prop.parent && prop.parent.remove(prop); to.prop = null;
  }
  stepPerson(p, dt) {
    const a = p.queue[0]; p.walking = false;
    if (!a) { p.pose(dt); return; }
    p.typing = false;
    if (a.type === 'stand') { p.sitTarget = 0; if (p.sit < 0.02) { p.sit = 0; p.queue.shift(); a.res(); } }
    else if (a.type === 'sit') {
      // align then sit
      const s = a.seat; const d = Math.hypot(s.x - p.root.position.x, s.z - p.root.position.z);
      const dr = angDiff(p.root.rotation.y, s.ry); p.root.rotation.y += dr * Math.min(1, dt * 6);
      if (d > 0.02) { p.root.position.x += (s.x - p.root.position.x) * Math.min(1, dt * 4); p.root.position.z += (s.z - p.root.position.z) * Math.min(1, dt * 4); }
      if (Math.abs(dr) < 0.08) p.sitTarget = 1;
      if (p.sit > 0.98 && Math.abs(dr) < 0.02) { p.sit = 1; p.typing = true; p.queue.shift(); a.res(); }
    }
    else if (a.type === 'face') { const dr = angDiff(p.root.rotation.y, a.ry); p.root.rotation.y += dr * Math.min(1, dt * 7); if (Math.abs(dr) < 0.02) { p.root.rotation.y = a.ry; p.queue.shift(); a.res(); } }
    else if (a.type === 'wait') { a.s -= dt; if (a.s <= 0) { p.queue.shift(); a.res(); } }
    else if (a.type === 'walk') {
      const tgt = a.path[0];
      if (!tgt) { p.queue.shift(); a.res(); }
      else {
        const dx = tgt.x - p.root.position.x, dz = tgt.y - p.root.position.z; const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz); const dr = angDiff(p.root.rotation.y, want);
        p.root.rotation.y += dr * Math.min(1, dt * 8);
        // turn on the spot first if facing away (avoids moonwalking)
        const step = Math.abs(dr) > 1.0 ? 0 : Math.min(dist, p.speed * dt * (1 - Math.abs(dr) / 1.6));
        if (step > 0) { p.root.position.x += (dx / dist) * step; p.root.position.z += (dz / dist) * step; p.phase += step * (Math.PI * 2 / 1.25); p.walking = true; }
        else if (Math.abs(dr) > 0.2) { p.phase += dt * 4; p.walking = true; }
        if (dist < 0.05) a.path.shift();
      }
    }
    p.pose(dt);
  }
  frame() {
    const dt = this.capture ? 1 / 30 : Math.min(0.05, this.clock.getDelta());
    for (let i = this.tweens.length - 1; i >= 0; i--) { const tw = this.tweens[i]; tw.t += dt / tw.dur; const k = Math.min(1, tw.t); tw.fn(tw.ease(k)); if (k >= 1) { this.tweens.splice(i, 1); tw.done && tw.done(); } }
    const F = this.floors[this.activeFloor];
    if (!this.paused) { const list = this.mode === 'exterior' ? [] : F.people; for (const p of list) this.stepPerson(p, this.reduced ? dt * 4 : dt); }
    if (this.follow && this.tweens.length === 0) {
      const fp = this.follow.root.position; const y = this.activeFloor * FH;
      const tgt = new THREE.Vector3(fp.x, y + 0.9, fp.z); const k = 1 - Math.exp(-dt * 3);
      this.camTarget.lerp(tgt, k); this.camera.position.lerp(tgt.clone().add(this.followOffset), k); this.camera.lookAt(this.camTarget);
    }
    this.onTick && this.onTick(dt);
    if (this.controls.enabled) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame && this.onFrame();
  }
  step(n = 1) { for (let i = 0; i < n; i++) this.frame(); }
  project(v) { const p = v.clone().project(this.camera); const r = this.renderer.domElement; return { x: (p.x * 0.5 + 0.5) * r.clientWidth, y: (-p.y * 0.5 + 0.5) * r.clientHeight, vis: p.z < 1 && p.z > -1 }; }
}
// merge static meshes per material: ~10k draw calls → a few hundred
function bake(root, lowPower) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(); const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.personPart || o.userData.keep || o.material.visible === false || o.material.isMeshBasicMaterial) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    let b = buckets.get(key); if (!b) { b = { m: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] }; buckets.set(key, b); }
    let gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
    if (!gg.attributes.normal) gg.computeVertexNormals();
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); b.geos.push(gg); victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  for (const b of buckets.values()) { const geo = mergeGeometries(b.geos, false); const me = new THREE.Mesh(geo, b.m); me.castShadow = b.cast && !lowPower; me.receiveShadow = b.recv && !lowPower; me.matrixAutoUpdate = false; root.add(me); b.geos.forEach((g) => g.dispose()); }
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------------- handoff choreography (Floor 5, Discreet) ----------------
// Paths are hand-authored around furniture and verified by tests/collision.mjs against registered solids.
export const CHOREO = {
  'assigned:meedz>maya': { from: 'meedz', to: 'maya', go: [[-12.3, -10.4], [-11.6, -8.6], [-8.6, -6.6], [-7.4, -5.4], [-5.6, -5.4], [-3.0, -4.6], [-1.95, -4.2]], faceRecipient: Math.PI / 2 },
  'handoff:maya>amir':   { from: 'maya', to: 'amir', go: [[-1.2, -4.35], [-3.3, -4.35], [-3.6, -2.0], [-3.3, 0.45], [0.5, 0.5]], faceRecipient: Math.PI / 2 },
  'handoff:amir>robin':  { from: 'amir', to: 'robin', go: [[1.2, 0.45], [-0.45, 0.55]], faceRecipient: -Math.PI / 2 },
  'decision_routed:robin>ahmed': { from: 'robin', to: null, go: [[-1.2, 0.45], [-2.6, 1.6], [-2.6, 7.2], [-1.0, 9.0], [0, 9.6]], exitToLift: true },
};
