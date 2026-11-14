// WARQÉVA — role cards for the AI workforce (Rev 1, 5 Nov 2026)
// Sources: Full_Scope_EN_AR.md §2–6 and §10, Character roster, Mariam role card, Meedz_AI_Staff.pdf (47 entries) + 4 counterparts = 51-role baseline (v0.4).
// Status for every card: DEFINED, not yet assessed. No agent is provisioned, trained or running.

// Authority classes (Full scope §6, Mariam card §4). Stage 1: only A runs; B is treated as C.
export const CLASSES = {};

export const UNIVERSAL_RULES = [];

// department defaults: duties, tools, independent checker, model route (START_HERE routing table)
export const DEPT = {
  Secretariat: { reports: 'Iris → Ahmed', tools: ['Task intake & briefs', 'Calendar/availability (read)', 'Private notes of own human only'], check: 'Owning human', route: 'Lowest-cost model passing brief and language tests', kpi: ['Brief completeness', 'Turnaround', 'Escalations routed correctly'] },
  Strategy: { reports: 'Ahmed', tools: ['Authorised briefs and evidence', 'Planning wall'], check: 'Amir (business quality)', route: 'Standard reasoning; escalate hard trade-offs after budget check', kpi: ['Options with consequences', 'Evidence cited'] },
  Research: { reports: 'Scout → Ahmed', tools: ['Web research (when connected)', 'Evidence packets', 'Source log'], check: 'Lukas team + domain review', route: 'Browsing model for retrieval; long-context for synthesis', kpi: ['Original sources with dates', 'Unknowns stated', 'Review pass rate'] },
  Engineering: { reports: 'Dev → Suhail (Discreet) / Ahmed', tools: ['Code repository (scoped)', 'Test runner', 'Dev environment only'], check: 'Hannah (technical quality)', route: 'Strong coding model after benchmark', kpi: ['Executed tests', 'Small reversible diffs', 'Rollback ready'] },
  Security: { reports: 'Min-jun → Suhail (Discreet) / Ahmed', tools: ['Scanners (read-only)', 'Permission test suite', 'Incident log'], check: 'Qualified human security reviewer', route: 'Strong reasoning + deterministic tests', kpi: ['Findings with evidence', 'Access tests run', 'No “secure” claims'] },
  'Independent Quality': { reports: 'Lukas → Ahmed (outside Engineering)', tools: ['Authorised artefacts and environments only', 'Check templates'], check: 'Ahmed samples; other model family where practical', route: 'Independent context, different model family where practical', kpi: ['Four result lists', 'Reproduction steps', 'Independence kept'] },
  Governance: { reports: 'Robin → Ahmed', tools: ['Decision queue', 'Approval records', 'Obligations register'], check: 'Ahmed; qualified legal review for legal items', route: 'Standard reasoning', kpi: ['One decision per query', 'Evidence version attached', 'Waiting cost stated'] },
  Finance: { reports: 'Kai → Ahmed', tools: ['Spreadsheet calculations', 'Read-only cost data'], check: 'Amir; deterministic reconciliation', route: 'Code/spreadsheet calculations; model explains assumptions', kpi: ['Inputs reconciled', 'Sensitivity shown', 'No transactions'] },
  Analytics: { reports: 'Markus → Ahmed', tools: ['Analytics data (scoped)', 'Notebooks'], check: 'Theo/Amir peer check', route: 'Code calculations; model explains', kpi: ['Method stated', 'Uncertainty shown', 'No invented metrics'] },
  Communications: { reports: 'Nadia → Ahmed (or unit head)', tools: ['Draft editor', 'Brand guide'], check: 'Amir + human head before any external use', route: 'Cost-efficient writing model passing brand tests', kpi: ['Brief met', 'Claims supported', 'No unauthorised outreach'] },
  'Brand and Design': { reports: 'Leila → Ahmed', tools: ['Approved asset library', 'Design tools'], check: 'Amir; human approval of final artwork', route: 'Reuse approved assets; image models only after low-volume comparison', kpi: ['Identity consistency', 'Editable sources kept'] },
  Growth: { reports: 'Khalid → Ahmed (or unit head)', tools: ['Campaign plans (draft)', 'Analytics (read)'], check: 'Theo (measurement) + human head', route: 'Cost-efficient writing model', kpi: ['Test design', 'Measured results', 'No spend without approval'] },
  Sales: { reports: 'Commercial co-head (Mesi/Joe)', tools: ['Prospect list (scoped)', 'Proposal drafts'], check: 'Human head reviews every offer', route: 'Cost-efficient writing model', kpi: ['Qualified prospects', 'Offers reviewed'] },
  Operations: { reports: 'Rory → Ahmed', tools: ['Process maps', 'Service workflows'], check: 'Amir', route: 'Standard model; calculations deterministic', kpi: ['Bottlenecks found', 'Measured improvement'] },
  Procurement: { reports: 'Chen Wei → Ahmed', tools: ['Supplier research', 'Comparison sheets'], check: 'Kai (cost) + Ahmed (any contract)', route: 'Standard model', kpi: ['Up to three supplier options', 'Costs and terms shown'] },
  'Agent Resources': { reports: 'Ling → Ahmed', tools: ['Curriculum records', 'Assessment results'], check: 'Helen evaluates; Lukas samples', route: 'Low-cost assembly; stronger model for evaluation design', kpi: ['Badges only after assessment + supervised use'] },
  Translation: { reports: 'Mariam → Ahmed', tools: ['Document editor', 'Scoped glossary'], check: 'Independent bilingual reviewer + subject owner', route: 'Best EN/AR model from real translation benchmark', kpi: ['Meaning errors', 'Terminology consistency', 'RTL defects'] },
  'Customer Centre': { reports: 'Rory → Ahmed', tools: ['Approved showcase only', 'Visitor intake'], check: 'Amir', route: 'Lowest-cost model passing tests', kpi: ['Correct routing', 'No unpublished work shown'] },
  'On Demand': { reports: 'Assigning head', tools: ['Scoped brief only'], check: 'Qualified human specialist', route: 'By task', kpi: ['Questions for qualified humans prepared'] },
};

// name, dept, title, titleAr, background, artwork, specific duties, extra C items, explicit D items
export const R = []; // role cards are served from Supabase after sign-in

export const COUNTERPARTS = [];

export const CHECK_OVERRIDE = { Iris: 'Robin + Ahmed', Theo: 'Markus + Amir', Helen: 'Lukas samples; Ling reviews', Markus: 'Theo + Amir', Ling: 'Helen + Lukas samples', Lukas: 'Ahmed samples; external reviewer where practical' };
export function buildRoles({ R, DEPT, COUNTERPARTS, CHECK_OVERRIDE }) { return R.map(([name, dept, title, titleAr, bg, art, duties, cExtra]) => {
  const d = { ...DEPT[dept] }; if (CHECK_OVERRIDE[name]) d.check = CHECK_OVERRIDE[name];
  return {
    id: name.toLowerCase().replace(/[^a-z]/g, ''), name, dept, title, titleAr, background: bg, artwork: art ? 'Saved artwork' : 'Artwork pending',
    reportsTo: d.reports.startsWith(name + ' →') ? d.reports.slice(name.length + 3) : d.reports, duties, tools: d.tools, checkedBy: d.check, modelRoute: d.route, measures: d.kpi,
    authority: { A: 'Allowed (Stage 1)', B: 'Treated as C (Stage 1)', C: ['Anything in the company C list', ...cExtra], D: 'Prohibited — see company D list' },
    status: 'Defined · not assessed · not provisioned', kind: 'agent',
  };
}).concat(COUNTERPARTS.map(([name, human, role, ar]) => ({
  id: name.toLowerCase(), name, dept: 'Personal counterparts', title: `${human}’s counterpart`, titleAr: ar, background: '—', artwork: 'Approved sheet',
  reportsTo: human, duties: [role, 'Coordinates and recommends; never approves as a human'], tools: ['Own human’s workspace'], checkedBy: human,
  modelRoute: 'Standard reasoning; escalate complex trade-offs after budget check', measures: ['Recommendations with evidence'],
  authority: { A: 'Allowed', B: 'Treated as C', C: ['All approvals belong to ' + human], D: 'Approving on behalf of ' + human }, status: 'Defined · not provisioned', kind: 'counterpart',
}))); }
export const ROLES = buildRoles({ R, DEPT, COUNTERPARTS, CHECK_OVERRIDE });
