import { describe, it, expect } from 'vitest';
import { sanitizeForWrite, READONLY_FIELDS } from '../../scripts/lib/sanitize.mjs';

describe('sanitizeForWrite', () => {
  it('strippt alle 12 read-only Felder', () => {
    const input = {
      name: 'wf',
      active: true,
      nodes: [],
      connections: {},
      settings: {},
      id: 'abc123',
      versionId: 'v1',
      createdAt: '2026-01-01',
      updatedAt: '2026-05-07',
      triggerCount: 5,
      pinData: { foo: [] },
      meta: { instanceId: 'inst1' },
      shared: [],
      isArchived: false,
      staticData: { last: 'cursor' },
      tags: [{ id: 't1', name: 'prod' }],
    };
    const out = sanitizeForWrite(input);
    for (const f of READONLY_FIELDS) {
      expect(out, `Feld '${f}' sollte gestrippt sein`).not.toHaveProperty(f);
    }
  });

  it('laesst Pflichtfelder durch', () => {
    const input = {
      name: 'wf',
      nodes: [{ id: '1', name: 'X', type: 't', typeVersion: 1 }],
      connections: { X: { main: [[]] } },
      settings: { errorWorkflow: 'shared' },
      id: 'must-strip',
    };
    const out = sanitizeForWrite(input);
    expect(out.name).toBe('wf');
    expect(out.nodes).toHaveLength(1);
    expect(out.connections).toEqual({ X: { main: [[]] } });
    expect(out.settings).toEqual({ errorWorkflow: 'shared' });
  });

  it("entfernt 'active' (read-only bei POST /workflows, Aktivierung via /activate) — #41", () => {
    const input = {
      name: 'wf',
      active: false,
      nodes: [{ id: '1', name: 'X', type: 't', typeVersion: 1 }],
      connections: {},
      settings: {},
    };
    const out = sanitizeForWrite(input);
    expect(out).not.toHaveProperty('active');
  });

  it('mutiert Input nicht', () => {
    const input = { name: 'wf', id: 'keep-me-in-input', nodes: [] };
    const before = JSON.stringify(input);
    sanitizeForWrite(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('READONLY_FIELDS enthaelt erwartete 12 Eintraege', () => {
    expect(READONLY_FIELDS).toHaveLength(12);
    expect(READONLY_FIELDS).toEqual(
      expect.arrayContaining([
        'id',
        'versionId',
        'createdAt',
        'updatedAt',
        'triggerCount',
        'pinData',
        'meta',
        'shared',
        'isArchived',
        'staticData',
        'tags',
        'active',
      ]),
    );
  });
});
