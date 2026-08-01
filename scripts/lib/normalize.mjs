// Workflow-Normalize fuer deterministische Diffs.
// - strippt volatile Felder (versionId, updatedAt, instanceId, ...)
// - sortiert nodes[] nach id (oder name)
// - sortiert object-keys rekursiv
// - 2-space-indent, trailing newline
// - per Default werden auch nodes[].position entfernt (Canvas-Noise)

const VOLATILE_TOP = [
  'id',
  'versionId',
  'updatedAt',
  'createdAt',
  'triggerCount',
  'pinData',
  'isArchived',
  'shared',
  // instance-managed state: not deployable via this CLI (sanitize strips
  // both on write), so they are pure diff noise (relates to #40)
  'staticData',
  'tags',
  // activation state: read-only in write bodies since n8n 2.x (#41),
  // toggled separately via POST /workflows/:id/activate — same rationale
  'active',
  // n8n 2.x versioning/publish model — server-managed, returned by GET
  // but never part of the repo source of truth (fixes #40)
  'activeVersion',
  'activeVersionId',
  'versionCounter',
  'workflowPublishHistory',
  'sourceWorkflowId',
  'nodeGroups',
];
const VOLATILE_META = ['instanceId', 'templateCredsSetupCompleted'];

function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  }
  return obj;
}

export function normalizeWorkflow(workflow, { keepPositions = false } = {}) {
  const wf = JSON.parse(JSON.stringify(workflow));

  for (const f of VOLATILE_TOP) delete wf[f];

  if (wf.meta && typeof wf.meta === 'object') {
    for (const f of VOLATILE_META) delete wf.meta[f];
    if (Object.keys(wf.meta).length === 0) delete wf.meta;
  } else if (wf.meta === null) {
    // n8n 2.x returns meta: null on workflows without meta (relates to #40)
    delete wf.meta;
  }

  // 'description' is a legit repo field (schema allows it) — a real value must
  // stay diff-relevant. n8n 2.x returns description: null when unset, which is
  // pure noise -> strip only the null/empty case (relates to #40).
  if (wf.description === null || wf.description === '') delete wf.description;

  if (Array.isArray(wf.nodes)) {
    for (const n of wf.nodes) {
      if (!keepPositions) delete n.position;
      delete n.disabled;
      delete n.notes;
      // webhookId is auto-assigned by n8n 2.x (even on non-webhook nodes
      // like emailSend) — instance-specific, strip always (fixes #40)
      delete n.webhookId;
      // notesInFlow ist UI-only; nicht relevant fuer Diff
    }
    wf.nodes.sort((a, b) => {
      const ka = String(a.id ?? a.name ?? '');
      const kb = String(b.id ?? b.name ?? '');
      return ka.localeCompare(kb);
    });
  }

  return sortKeys(wf);
}

export function stringifyWorkflow(workflow) {
  return JSON.stringify(workflow, null, 2) + '\n';
}
