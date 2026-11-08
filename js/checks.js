// In-browser acceptance checks (subset of AC03, AC05, AC06, AC07, AC09, AC13). Runs on a fresh sample copy.
import { _sandbox, api, canEnterFloor, USERS } from './data.js?v=202611080200';
import { ROLES } from './roles.js?v=202611080200';

export function runChecks() {
  const R = { passed: [], failed: [], untested: [], inconclusive: [] };
  const check = (name, fn) => { try { const ok = fn(); (ok ? R.passed : R.failed).push(name); } catch (e) { R.failed.push(name + ' — error: ' + e.message); } };
  _sandbox(() => {
    const ah = api('ahmed'), su = api('suhail'), mo = api('mohamed'), yo = api('youssef'), vi = api('visitor');
    // access: founder-only via direct link, list, search, events
    for (const [who, a] of [['Suhail', su], ['Mohamed', mo], ['Youssef', yo], ['Public preview', vi]]) {
      check(`${who}: direct link to founder task F6-C-002 is denied`, () => !a.getTask('F6-C-002').ok);
      check(`${who}: founder task absent from lists and search`, () => !(a.listTasks().data || []).some((t) => t.id === 'F6-C-002') && !(a.search('priority').data || []).some((h) => h.id === 'F6-C-002'));
      check(`${who}: founder events not returned`, () => !(a.events().data || []).some((e) => e.taskId === 'F6-C-002'));
      check(`${who}: Floor 6 blocked`, () => !a.floor(6).ok);
      check(`${who}: other-unit task WQ-T-003 denied`, () => !a.getTask('WQ-T-003').ok);
      check(`${who}: Ahmed's owner-only note hidden`, () => !(a.notes().data || []).some((n) => n.id === 'N-AHMED-1'));
      check(`${who}: cannot act on founder task`, () => !a.act('F6-C-002', 'decide', {}).ok);
    }
    check('Ahmed: sees founder task and Floor 6', () => ah.getTask('F6-C-002').ok && ah.floor(6).ok);
    check('Suhail sees his private note; Mohamed and Youssef do not', () => su.notes().data.some((n) => n.id === 'N-SUHAIL-1') && !mo.notes().data.some((n) => n.id === 'N-SUHAIL-1') && !yo.notes().data.some((n) => n.id === 'N-SUHAIL-1'));
    check('Ahmed sees Suhail’s private note (head + Ahmed rule)', () => ah.notes().data.some((n) => n.id === 'N-SUHAIL-1'));
    check('Shared-agent view for heads shows availability only (no other-project task id)', () => { const l = su.agents().data.find((a) => a.id === 'leila'); return l.availability === 'Busy' && !l.busyWith; });
    check('Ahmed sees cross-project detail for Leila', () => ah.agents().data.find((a) => a.id === 'leila').busyWith === 'WQ-T-003');
    check('Public preview sees no task records at all', () => vi.listTasks().data.length === 0);
    check('Technical task DSC-T-016 stays unassigned until Suhail intake', () => ah.getTask('DSC-T-016').data.state === 'awaiting_suhail_intake' && !ah.act('DSC-T-016', 'assign', {}).ok);
    // workflow
    const id = 'DSC-T-014';
    check('Head who is not accountable cannot authorise assignment', () => su.act(id, 'assign', { idem: 'x1' }).code === 403);
    check('Meedz assignment authorised by Ahmed', () => ah.act(id, 'assign', { idem: 'a1' }).ok);
    check('Duplicate assignment request does not duplicate work (idempotent)', () => { const n = ah.events(id).data.length; ah.act(id, 'assign', { idem: 'a1' }); return ah.events(id).data.length === n; });
    check('Specialist handoff recorded with sender, recipient, status, deliverable', () => { ah.act(id, 'produce', { idem: 'p1' }); const e = ah.events(id).data.slice(-1)[0]; return e.type === 'handoff' && e.from === 'maya' && e.to === 'amir' && e.status === 'evidence_submitted' && e.deliverable && e.deliverable.version === 1; });
    check('Reviewer receives artefacts, not builder conclusions (recorded)', () => { ah.act(id, 'start_review', { idem: 'r1' }); return /artefacts only/.test(ah.events(id).data.slice(-1)[0].note); });
    check('Decision cannot be routed before reviews complete', () => !ah.act(id, 'route_decision', {}).ok);
    ah.act(id, 'complete_review', { idem: 'c1' });
    check('Approval blocked while domain review is missing', () => !ah.act(id, 'route_decision', {}).ok);
    ah.act(id, 'domain_review', { idem: 'd1' }); ah.act(id, 'route_decision', { idem: 'q1' });
    const t = ah.getTask(id).data;
    check('Decision routed to Ahmed and bound to evidence hash', () => t.state === 'awaiting_decision' && t.decision.to === 'ahmed' && !!t.decision.evidenceHash);
    check('Suhail cannot decide Ahmed’s decision', () => su.act(id, 'decide', { choice: 'approve', evidenceHash: t.decision.evidenceHash }).code === 403);
    check('Stale evidence version invalidates approval', () => ah.act(id, 'decide', { choice: 'approve', evidenceHash: 'deadbeef' }).code === 412);
    check('Edit without a note is refused', () => !ah.act(id, 'decide', { choice: 'edit', evidenceHash: t.decision.evidenceHash }).ok);
    check('Ahmed approves exact evidence version', () => ah.act(id, 'decide', { choice: 'approve', option: 'focused', evidenceHash: t.decision.evidenceHash, idem: 'z1' }).ok && ah.getTask(id).data.state === 'approved');
    check('Failed live integration leaves task state unchanged and is logged', () => { const before = ah.getTask('DSC-T-015').data.state; const r = ah.act('DSC-T-015', 'run_live', { idem: 'l1' }); return !r.ok && r.code === 503 && ah.getTask('DSC-T-015').data.state === before && ah.events('DSC-T-015').data.some((e) => e.type === 'integration_failed'); });
  });
  _sandbox(() => {
    const ah = api('ahmed'); const id = 'DSC-T-014';
    ['assign', 'produce', 'start_review'].forEach((a, i) => ah.act(id, a, { idem: 'f' + i }));
    ah.act(id, 'complete_review', { idem: 'ff', fail: true });
    check('Weak evidence returns immediately to the requester (no auto re-research)', () => { const t = ah.getTask(id).data; const e = ah.events(id).data.slice(-1)[0]; return t.state === 'returned_to_requester' && e.to === 'ahmed' && !t.decision; });
  });
  check('Every role card has duties, reporting line, independent checker and authority classes', () => ROLES.length >= 51 && ROLES.every((r) => r.duties.length && r.reportsTo && r.checkedBy && r.authority.C.length && r.authority.D));
  check('No agent is its own independent checker', () => ROLES.every((r) => !r.checkedBy.toLowerCase().startsWith(r.name.toLowerCase())));
  check('No role card claims assessment or provisioning', () => ROLES.every((r) => /not (assessed|provisioned)/.test(r.status)));
  R.untested.push('Real server-side enforcement (no backend yet — checks run in the browser)', 'Session PIN, expiry, recovery (AC04)', 'Bilingual review by an independent reviewer (AC08)', 'Backup restore timing (AC15)');
  R.inconclusive.push('Foot sliding: walk cadence is locked to distance, but there is no foot IK');
  return R;
}
