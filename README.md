# WARQÉVA Workspace (v0.4)
# مساحة عمل WARQÉVA (الإصدار ٠٫٤)

Doc ID: WQ-BLD-001 · Rev 2 · 7 Nov 2026 · EN: Draft · AR: Draft (not independently language-reviewed / لم تُراجع لغوياً باستقلال)

## What this is | ما هذا
A true-3D (Three.js) campus with seven levels (Ground + Floors 1–6) on two pages:

| Page | Who | What |
|---|---|---|
| `index.html` — public showcase | Anyone | Client visit: Jade greets visitors, tap to walk, glowing spots open EN/AR reading cards. No sign-in, no private data. A **Team sign-in** button links to the workspace. |
| `workspace.html` — team workspace | Ahmed + approved team | Username + password, then 4-digit PIN (server-enforced). Tasks, role cards, legal register and private items come from Supabase only after sign-in. Not indexed by search engines. |

صفحتان: واجهة عامة للزوار، ومساحة عمل خاصة للفريق تتطلب تسجيل الدخول ورمزاً من أربعة أرقام.

## Run it | التشغيل
- Live site: GitHub Pages (`/` = showcase, `/workspace.html` = team workspace).
- Locally: serve this folder with any static server (for example `python3 -m http.server`). Opening the file directly will not work because browsers block ES modules from `file://`.
- Address options: `?walkin` replays the walk-in · `?reduced` reduced motion · `?direct` instant navigation · `#floor-5`, `#discreet`, `#tests` open a view directly.

## Live vs demonstrated vs blocked | الفعلي والتجريبي والمعطّل
| Item | Status |
|---|---|
| 3D campus, navigation, reduced motion, phone layout, client visit | Live |
| Sign-in (password + PIN) and data access rules | Live on Supabase (`warqeva-discreet-pilot`, London). Signed-out requests return no rows from any table (checked 7 Nov 2026). |
| Meedz → specialist → verifier → Ahmed workflow | Demonstrated: agent steps use fixed sample text |
| AI integration | Blocked: not connected, paid execution off |
| Approved character likenesses | Blocked: no rigged 3D models; stand-ins shown |
| Reference comparison (Sphinx walk-in, Sahra framing) | Not yet done |

## Next build steps | الخطوات التالية
1. Rigged 3D models of Meedz, Sully, Mesi and Joe from the approved sheets.
2. Connect one real AI step in the Discreet workflow (needs a cost decision).
3. Record the reference comparison and fix mismatches.

## Files | الملفات
| Path | Purpose |
|---|---|
| `index.html` | Public showcase page |
| `workspace.html` | Team workspace page (sign-in) |
| `js/server.js` | Supabase sign-in and data calls |
| `js/visit.js` | Client visit (Jade, walking, reading cards) |
| `js/app.js` | Navigation, panels, decision pop-up, handoff playback |
| `js/scene.js` | 3D building, seven floor layouts, stand-in characters, camera director, handoff paths |
| `js/data.js` | Data and action layer: permissions, workflow gates, event record, persistence |
| `js/checks.js` | In-browser acceptance checks (Test record) |
| `js/three.module.js`, `js/three.core.js`, `js/OrbitControls.js`, `js/BufferGeometryUtils.js` | Three.js, MIT licence (github.com/mrdoob/three.js) |
| `assets/discreet-logo.png` | Approved Discreet logo (background removed) |

## Live vs demonstrated vs blocked | الفعلي والتجريبي والمعطّل
| Item | Status |
|---|---|
| 3D campus, camera paths, navigation, reduced motion, phone layout | Live (runs in the browser) |
| Permission rules on read, list, search, events, actions, direct links | Live **in the browser only** — demonstrates the rules; not a security boundary |
| Meedz → Maya → Amir → Scout → Robin → Ahmed workflow | Demonstrated: agent steps are simulated with fixed sample text |
| Ahmed's decision (Yes / No / Edit), version-bound | Live in the demo data layer |
| AI integration | Blocked: not connected, paid execution off. "Run with live AI" shows the failure-recovery path |
| Server, accounts, sign-in, real data | Blocked until Stage 3 (platform/hosting choice needed) |
| Approved character likenesses | Blocked: no rigged 3D models exist; stand-ins shown (decision D1) |

## Next build steps | الخطوات التالية
1. Choose hosting + authentication + database (Stage 3) and move `data.js` rules to the server.
2. Commission or generate rigged 3D models of Meedz, Sully, Mesi and Joe from the approved sheets.
3. Extend department workflows on Floors 1–4 in small, tested increments.
