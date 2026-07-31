import { describe, it, expect } from 'vitest';
import { validateWorkflow, formatErrors } from '../../scripts/lib/validate.mjs';

const minimalValid = () => ({
  name: 'foo-bar',
  nodes: [
    {
      id: '1',
      name: 'Manual Start',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
    },
  ],
  connections: {},
});

describe('validateWorkflow', () => {
  it('akzeptiert minimal-validen Workflow', () => {
    const { ok, errors } = validateWorkflow(minimalValid());
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('lehnt fehlendes name ab', () => {
    const wf = minimalValid();
    delete wf.name;
    const { ok, errors } = validateWorkflow(wf);
    expect(ok).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('lehnt name mit Env-Prefix ab (Pattern erlaubt nur kebab-case ohne Prefix)', () => {
    const wf = minimalValid();
    wf.name = 'PROD-foo-bar';
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(false);
  });

  it('lehnt generische Knotennamen ab — "If"', () => {
    const wf = minimalValid();
    wf.nodes.push({
      id: '2',
      name: 'If',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
    });
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(false);
  });

  it('lehnt generische Knotennamen ab — "Code 2"', () => {
    const wf = minimalValid();
    wf.nodes.push({
      id: '2',
      name: 'Code 2',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
    });
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(false);
  });

  it('lehnt generische Knotennamen ab — "HTTP Request (alt)"', () => {
    const wf = minimalValid();
    wf.nodes.push({
      id: '2',
      name: 'HTTP Request (alt)',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
    });
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(false);
  });

  it('akzeptiert beschreibende Knotennamen', () => {
    const wf = minimalValid();
    wf.nodes.push({
      id: '2',
      name: 'Has user email?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
    });
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(true);
  });

  it('akzeptiert errorWorkflow als String', () => {
    const wf = minimalValid();
    wf.settings = { errorWorkflow: 'shared-error-handler' };
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(true);
  });

  it('akzeptiert errorWorkflow als Objekt', () => {
    const wf = minimalValid();
    wf.settings = { errorWorkflow: { id: 'abc', name: 'shared-error-handler' } };
    const { ok } = validateWorkflow(wf);
    expect(ok).toBe(true);
  });

  it('formatErrors gibt lesbare Strings zurueck', () => {
    const wf = minimalValid();
    delete wf.name;
    const { errors } = validateWorkflow(wf);
    const formatted = formatErrors(errors);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('-');
  });
});

describe('DataTable Upsert Custom-Check (#16)', () => {
  // Self-contained fixture: korrekt konfigurierter Upsert-Node,
  // Testfaelle brechen gezielt einzelne Bedingungen.
  const upsertNode = () => ({
    id: '2',
    name: 'Update Mappings',
    type: 'n8n-nodes-base.dataTable',
    typeVersion: 1,
    parameters: {
      operation: 'upsert',
      columns: {
        matchingColumns: ['exchange_contact_id'],
        value: {
          exchange_contact_id: '={{ $json.id }}',
          display_name: '={{ $json.displayName }}',
        },
      },
      filters: {
        conditions: [
          { keyName: 'exchange_contact_id', condition: 'eq', keyValue: '={{ $json.id }}' },
        ],
      },
    },
  });

  const withUpsert = (mutate) => {
    const wf = minimalValid();
    const node = upsertNode();
    if (mutate) mutate(node);
    wf.nodes.push(node);
    return wf;
  };

  it('akzeptiert korrekt konfigurierten Upsert', () => {
    const { ok, errors } = validateWorkflow(withUpsert());
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('lehnt leere matchingColumns ab (Silent-Insert-Bloat)', () => {
    const { ok, errors } = validateWorkflow(
      withUpsert((n) => {
        n.parameters.columns.matchingColumns = [];
      }),
    );
    expect(ok).toBe(false);
    expect(errors.some((e) => e.message.includes('matchingColumns'))).toBe(true);
    expect(formatErrors(errors)).toContain('Silent-Insert-Bloat');
  });

  it('lehnt fehlende matchingColumns ab', () => {
    const { ok } = validateWorkflow(
      withUpsert((n) => {
        delete n.parameters.columns.matchingColumns;
      }),
    );
    expect(ok).toBe(false);
  });

  it('lehnt leeres Objekt als einzige filter-Condition ab', () => {
    const { ok, errors } = validateWorkflow(
      withUpsert((n) => {
        n.parameters.filters = { conditions: [{}] };
      }),
    );
    expect(ok).toBe(false);
    expect(errors.some((e) => e.message.includes('filters.conditions'))).toBe(true);
  });

  it('lehnt fehlende filters.conditions ab', () => {
    const { ok } = validateWorkflow(
      withUpsert((n) => {
        delete n.parameters.filters;
      }),
    );
    expect(ok).toBe(false);
  });

  it('lehnt Upsert ab, dessen key-column nicht im columns.value-Mapping steht', () => {
    const { ok, errors } = validateWorkflow(
      withUpsert((n) => {
        delete n.parameters.columns.value.exchange_contact_id;
      }),
    );
    expect(ok).toBe(false);
    expect(errors.some((e) => e.message.includes("'exchange_contact_id'"))).toBe(true);
  });

  it('meldet beide feuerbaren Verstoesse im Original-Fall aus #16 (leeres matchingColumns maskiert den value-Check)', () => {
    const { ok, errors } = validateWorkflow(
      withUpsert((n) => {
        n.parameters.columns.matchingColumns = [];
        n.parameters.filters = { conditions: [{}] };
        delete n.parameters.columns.value.exchange_contact_id;
      }),
    );
    expect(ok).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.every((e) => e.params?.rule === 'dataTableUpsert')).toBe(true);
    expect(errors.every((e) => e.message.includes("'Update Mappings'"))).toBe(true);
  });

  it('akzeptiert autoMapInputData mit leerem columns.value (Laufzeit-Mapping, kein False-Positive)', () => {
    const { ok, errors } = validateWorkflow(
      withUpsert((n) => {
        n.parameters.columns.mappingMode = 'autoMapInputData';
        n.parameters.columns.value = {};
      }),
    );
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('ignoriert dataTable-Nodes mit anderer Operation', () => {
    const { ok } = validateWorkflow(
      withUpsert((n) => {
        n.parameters = { operation: 'insert' };
      }),
    );
    expect(ok).toBe(true);
  });

  it('ignoriert andere Node-Typen mit operation upsert', () => {
    const { ok } = validateWorkflow(
      withUpsert((n) => {
        n.type = 'n8n-nodes-base.postgres';
        n.parameters = { operation: 'upsert' };
      }),
    );
    expect(ok).toBe(true);
  });
});
