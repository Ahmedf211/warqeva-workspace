# WARQÉVA Workspace — first route build (v0.1)
# مساحة عمل WARQÉVA — بناء المسار الأول (الإصدار ٠٫١)

Doc ID: WQ-BLD-001 · Rev 1 · 4 Nov 2026 · EN: Draft · AR: Draft (not independently language-reviewed / لم تُراجع لغوياً باستقلال)

## What this is | ما هذا
A true-3D (Three.js) campus with a directed walk-in, seven levels (Ground + Floors 1–6, per decision D2), and one Discreet workflow running end to end on **demonstration data**. No AI is called, nothing is sent, nothing is spent.
مبنى ثلاثي الأبعاد مع دخول سينمائي وسبعة مستويات ومسار ديسكريت كامل ببيانات تجريبية. لا استدعاء للذكاء الاصطناعي ولا إرسال ولا إنفاق.

## Run it | التشغيل
- Open the published artifact link — nothing to install.
- Locally: serve this folder with any static server (for example `python3 -m http.server`) and open `index.html`. Opening the file directly will not work because browsers block ES modules from `file://`.
- Useful address options: `?nointro` skips the walk-in · `?reduced` reduced motion · `?direct` instant navigation · `?fresh` resets demo data · `#floor-5`, `#task-dsc-t-014`, `#discreet`, `#tests` open a view directly.

افتح رابط النسخة المنشورة مباشرة. محلياً: شغّل خادماً ثابتاً للمجلد ثم افتح index.html.

## Files | الملفات
| Path | Purpose |
|---|---|
| `index.html` | Interface, styles, layout for desktop and phone |
| `js/app.js` | Walk-in, navigation, panels, decision pop-up, handoff playback |
| `js/scene.js` | 3D building, seven floor layouts, stand-in characters, camera director, handoff paths |
| `js/data.js` | Data and action layer: permissions, workflow gates, event record, persistence |
| `js/checks.js` | In-browser acceptance checks (Test record) |
| `js/three.module.js`, `js/three.core.js`, `js/OrbitControls.js`, `js/BufferGeometryUtils.js` | Three.js r187, MIT licence (github.com/mrdoob/three.js) |
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
