import { describe, it, expect } from 'vitest';
import { normalizeWorkflow, stringifyWorkflow } from '../../scripts/lib/normalize.mjs';

const fixture = () => ({
  name: 'foo',
  active: true,
  versionId: 'v1',
  updatedAt: '2026-05-07',
  createdAt: '2026-01-01',
  triggerCount: 7,
  pinData: { Manual: [] },
  isArchived: false,
  shared: [{ project: 'p1' }],
  meta: {
    instanceId: 'inst-A',
    templateCredsSetupCompleted: true,
    customField: 'keep',
  },
  nodes: [
    {
      id: '3',
      name: 'C',
      type: 't',
      typeVersion: 1,
      position: [400, 100],
      disabled: false,
      notes: 'remove',
    },
    { id: '1', name: 'A', type: 't', typeVersion: 1, position: [100, 100] },
    { id: '2', name: 'B', type: 't', typeVersion: 1, position: [200, 100] },
  ],
  connections: {},
});

describe('normalizeWorkflow', () => {
  it('strippt volatile Top-Level-Felder', () => {
    const out = normalizeWorkflow(fixture());
    expect(out).not.toHaveProperty('versionId');
    expect(out).not.toHaveProperty('updatedAt');
    expect(out).not.toHaveProperty('createdAt');
    expect(out).not.toHaveProperty('triggerCount');
    expect(out).not.toHaveProperty('pinData');
    expect(out).not.toHaveProperty('isArchived');
    expect(out).not.toHaveProperty('shared');
  });

  it('strippt instanceId und templateCredsSetupCompleted aus meta', () => {
    // Self-contained fixture: garantiert ein nicht-volatiles meta-Feld,
    // damit der Test nicht vom shared fixture()-Default abhaengt (siehe #23).
    const wf = fixture();
    wf.meta = {
      instanceId: 'inst-A',
      templateCredsSetupCompleted: true,
      customField: 'keep',
    };
    const out = normalizeWorkflow(wf);
    expect(out.meta).toBeDefined();
    expect(out.meta).not.toHaveProperty('instanceId');
    expect(out.meta).not.toHaveProperty('templateCredsSetupCompleted');
    expect(out.meta.customField).toBe('keep');
  });

  it('entfernt meta komplett wenn nach Strip leer', () => {
    const wf = fixture();
    wf.meta = { instanceId: 'x', templateCredsSetupCompleted: true };
    const out = normalizeWorkflow(wf);
    expect(out).not.toHaveProperty('meta');
  });

  it('sortiert nodes deterministisch nach id', () => {
    const out = normalizeWorkflow(fixture());
    expect(out.nodes.map((n) => n.id)).toEqual(['1', '2', '3']);
  });

  it('entfernt nodes[].position per Default', () => {
    const out = normalizeWorkflow(fixture());
    for (const n of out.nodes) expect(n).not.toHaveProperty('position');
  });

  it('behaelt nodes[].position bei keepPositions=true', () => {
    const out = normalizeWorkflow(fixture(), { keepPositions: true });
    for (const n of out.nodes) expect(n).toHaveProperty('position');
  });

  it('entfernt disabled und notes auf Knoten-Ebene', () => {
    const out = normalizeWorkflow(fixture());
    const c = out.nodes.find((n) => n.id === '3');
    expect(c).not.toHaveProperty('disabled');
    expect(c).not.toHaveProperty('notes');
  });

  it('ist idempotent — zweimaliges Normalisieren = gleiches Output', () => {
    const a = stringifyWorkflow(normalizeWorkflow(fixture()));
    const parsed = JSON.parse(a);
    const b = stringifyWorkflow(normalizeWorkflow(parsed));
    expect(a).toBe(b);
  });

  it('stringifyWorkflow endet mit newline', () => {
    const s = stringifyWorkflow({ a: 1 });
    expect(s.endsWith('\n')).toBe(true);
  });
});
