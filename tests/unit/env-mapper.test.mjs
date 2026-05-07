import { describe, it, expect } from 'vitest';
import { applyEnvMapping } from '../../scripts/lib/env-mapper.mjs';

const baseWorkflow = () => ({
  name: 'exchange-sync',
  nodes: [
    {
      id: '1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      parameters: { path: 'exchange' },
    },
    {
      id: '2',
      name: 'Send Slack',
      type: 'n8n-nodes-base.slack',
      typeVersion: 2,
      parameters: {},
      credentials: {
        slackApi: { id: 'old-id', name: 'slack-api-dev' },
      },
    },
    {
      id: '3',
      name: 'HTTP Call',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      parameters: { url: 'https://api.example.com' },
    },
  ],
  connections: {},
});

describe('applyEnvMapping', () => {
  it('passthrough bei mapping=null', () => {
    const wf = baseWorkflow();
    const out = applyEnvMapping(wf, null);
    expect(out).toEqual(wf);
  });

  it('ersetzt Credential-Refs nach logischem Namen', () => {
    const mapping = {
      credentials: {
        'slack-api-dev': { id: 'new-prod-id', name: 'slack-api-prod' },
      },
    };
    const out = applyEnvMapping(baseWorkflow(), mapping);
    const slackNode = out.nodes.find((n) => n.name === 'Send Slack');
    expect(slackNode.credentials.slackApi).toEqual({
      id: 'new-prod-id',
      name: 'slack-api-prod',
    });
  });

  it('ersetzt Credential-Refs nach credType als Fallback', () => {
    const mapping = {
      credentials: {
        slackApi: { id: 'by-type-id', name: 'slack-api-prod' },
      },
    };
    const out = applyEnvMapping(baseWorkflow(), mapping);
    const slackNode = out.nodes.find((n) => n.name === 'Send Slack');
    expect(slackNode.credentials.slackApi.id).toBe('by-type-id');
  });

  it('haengt webhook_path_suffix an Webhook-Node', () => {
    const out = applyEnvMapping(baseWorkflow(), { webhook_path_suffix: '-prod' });
    const webhook = out.nodes.find((n) => n.name === 'Webhook');
    expect(webhook.parameters.path).toBe('exchange-prod');
  });

  it('haengt webhook_path_suffix nicht doppelt an', () => {
    const wf = baseWorkflow();
    const once = applyEnvMapping(wf, { webhook_path_suffix: '-prod' });
    const twice = applyEnvMapping(once, { webhook_path_suffix: '-prod' });
    const webhook = twice.nodes.find((n) => n.name === 'Webhook');
    expect(webhook.parameters.path).toBe('exchange-prod');
  });

  it('laesst nicht-Webhook-Nodes unveraendert', () => {
    const out = applyEnvMapping(baseWorkflow(), { webhook_path_suffix: '-prod' });
    const http = out.nodes.find((n) => n.name === 'HTTP Call');
    expect(http.parameters.url).toBe('https://api.example.com');
  });

  it('mutiert Original-Workflow nicht (deep-copy)', () => {
    const wf = baseWorkflow();
    const before = JSON.stringify(wf);
    applyEnvMapping(wf, {
      credentials: { slackApi: { id: 'x', name: 'y' } },
      webhook_path_suffix: '-prod',
    });
    expect(JSON.stringify(wf)).toBe(before);
  });

  it('laesst Credential-Refs ohne Mapping unveraendert', () => {
    const mapping = { credentials: {} };
    const out = applyEnvMapping(baseWorkflow(), mapping);
    const slackNode = out.nodes.find((n) => n.name === 'Send Slack');
    expect(slackNode.credentials.slackApi).toEqual({
      id: 'old-id',
      name: 'slack-api-dev',
    });
  });
});
