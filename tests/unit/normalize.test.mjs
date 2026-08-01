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

  // --- n8n 2.x Versioning-Felder (#40) ---

  it('n8n-2.x-Live-Payload normalisiert == normalisierte Repo-Version (#40)', () => {
    const repo = {
      name: 'foo',
      // deliberately different from live (true): activation state is
      // instance-managed since #41 and must not show up as drift
      active: false,
      nodes: [
        { id: '1', name: 'A', type: 't', typeVersion: 1 },
        { id: '2', name: 'B', type: 'n8n-nodes-base.emailSend', typeVersion: 2 },
      ],
      connections: {},
      settings: { executionTimeout: 60 },
    };
    // Live-GET von einer n8n-2.x-Instanz: Versioning-/Publish-Felder,
    // eingebettete activeVersion-Kopie inkl. nodes, webhookId auf Nodes.
    const live = {
      name: 'foo',
      active: true,
      id: 'wf-live-123',
      description: null,
      meta: null,
      staticData: null,
      tags: [],
      activeVersion: {
        id: 'ver-9',
        versionId: 'ver-9',
        nodes: [{ id: '1', name: 'A', type: 't', typeVersion: 1, position: [100, 100] }],
        connections: {},
      },
      activeVersionId: 'ver-9',
      versionCounter: 9,
      workflowPublishHistory: [{ versionId: 'ver-9', publishedAt: '2026-07-30' }],
      sourceWorkflowId: null,
      nodeGroups: [],
      nodes: [
        {
          id: '2',
          name: 'B',
          type: 'n8n-nodes-base.emailSend',
          typeVersion: 2,
          position: [300, 100],
          webhookId: 'auto-assigned-uuid',
        },
        { id: '1', name: 'A', type: 't', typeVersion: 1, position: [100, 100] },
      ],
      connections: {},
      settings: { executionTimeout: 60 },
    };
    const a = stringifyWorkflow(normalizeWorkflow(live));
    const b = stringifyWorkflow(normalizeWorkflow(repo));
    expect(a).toBe(b);
  });

  it('strippt nodes[].webhookId (auto-assigned) — #40', () => {
    const wf = fixture();
    wf.nodes[0].webhookId = 'abc-123';
    const out = normalizeWorkflow(wf);
    for (const n of out.nodes) expect(n).not.toHaveProperty('webhookId');
  });

  it('behaelt eine echte description, strippt nur null/leer — #40', () => {
    const withDesc = fixture();
    withDesc.description = 'Legitimes Repo-Feld';
    expect(normalizeWorkflow(withDesc).description).toBe('Legitimes Repo-Feld');

    const withNull = fixture();
    withNull.description = null;
    expect(normalizeWorkflow(withNull)).not.toHaveProperty('description');

    const withEmpty = fixture();
    withEmpty.description = '';
    expect(normalizeWorkflow(withEmpty)).not.toHaveProperty('description');
  });

  it('entfernt meta: null (2.x-Payload) — #40', () => {
    const wf = fixture();
    wf.meta = null;
    expect(normalizeWorkflow(wf)).not.toHaveProperty('meta');
  });

  it('strippt id, staticData und tags top-level — #40', () => {
    const wf = fixture();
    wf.id = 'wf-1';
    wf.staticData = { last: 'cursor' };
    wf.tags = [{ id: 't1', name: 'prod' }];
    const out = normalizeWorkflow(wf);
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('staticData');
    expect(out).not.toHaveProperty('tags');
  });
});
