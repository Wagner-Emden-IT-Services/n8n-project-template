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
