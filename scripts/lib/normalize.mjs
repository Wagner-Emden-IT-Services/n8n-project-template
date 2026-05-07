// Workflow-Normalize fuer deterministische Diffs.
// - strippt volatile Felder (versionId, updatedAt, instanceId, ...)
// - sortiert nodes[] nach id (oder name)
// - sortiert object-keys rekursiv
// - 2-space-indent, trailing newline
// - per Default werden auch nodes[].position entfernt (Canvas-Noise)

const VOLATILE_TOP = [
  'versionId',
  'updatedAt',
  'createdAt',
  'triggerCount',
  'pinData',
  'isArchived',
  'shared',
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
  }

  if (Array.isArray(wf.nodes)) {
    for (const n of wf.nodes) {
      if (!keepPositions) delete n.position;
      delete n.disabled;
      delete n.notes;
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
