import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { makeClient } from '../../scripts/lib/api.mjs';

const API = 'http://test-instance/api/v1';

beforeEach(() => {
  nock.cleanAll();
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

describe('listAllWorkflows (Cursor-Pagination)', () => {
  it('foldet zwei Pages mit nextCursor zusammen — Regression gegen .first()-Bug', async () => {
    const page1 = Array.from({ length: 250 }, (_, i) => ({ id: `id-${i}`, name: `wf-${i}` }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({
      id: `id-${250 + i}`,
      name: `wf-${250 + i}`,
    }));

    nock('http://test-instance')
      .get('/api/v1/workflows?limit=250')
      .reply(200, { data: page1, nextCursor: 'cursor-X' });

    nock('http://test-instance')
      .get('/api/v1/workflows?limit=250&cursor=cursor-X')
      .reply(200, { data: page2, nextCursor: null });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const all = await client.listAllWorkflows();

    expect(all).toHaveLength(350);
    expect(all[0].id).toBe('id-0');
    expect(all[349].id).toBe('id-349');
  });

  it('liefert leeres Array bei einer leeren Page', async () => {
    nock('http://test-instance')
      .get('/api/v1/workflows?limit=250')
      .reply(200, { data: [], nextCursor: null });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const all = await client.listAllWorkflows();
    expect(all).toEqual([]);
  });
});

describe('findWorkflowByName', () => {
  it('matcht exakt, nicht prefix', async () => {
    nock('http://test-instance')
      .get('/api/v1/workflows?limit=250')
      .times(3)
      .reply(200, {
        data: [
          { id: '1', name: 'foo' },
          { id: '2', name: 'foo-bar' },
          { id: '3', name: 'foo-baz' },
        ],
        nextCursor: null,
      });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    expect((await client.findWorkflowByName('foo')).id).toBe('1');
    expect((await client.findWorkflowByName('foo-bar')).id).toBe('2');
    expect(await client.findWorkflowByName('nonexistent')).toBeNull();
  });
});

describe('ensureOk (Fehlerpfad fuer Auto-Rollback)', () => {
  it('wirft auf 4xx mit Status, Body, und Original-URL im Error-Message', async () => {
    nock('http://test-instance')
      .put('/api/v1/workflows/abc')
      .reply(422, { message: 'invalid name' });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });

    await expect(client.updateWorkflow('abc', { name: 'x' })).rejects.toMatchObject({
      status: 422,
      body: { message: 'invalid name' },
    });
  });

  it('wirft auf 500 fuer den Auto-Rollback-Pfad', async () => {
    nock('http://test-instance').put('/api/v1/workflows/abc').reply(500, 'server exploded');

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    let err;
    try {
      await client.updateWorkflow('abc', { name: 'x' });
    } catch (e) {
      err = e;
    }
    expect(err.status).toBe(500);
    expect(err.message).toContain('PUT');
    expect(err.message).toContain('500');
  });
});

describe('CRUD-URLs', () => {
  it('createWorkflow POSTet auf /workflows', async () => {
    nock('http://test-instance')
      .post('/api/v1/workflows', { name: 'new-wf' })
      .reply(201, { id: 'new-id', name: 'new-wf' });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const result = await client.createWorkflow({ name: 'new-wf' });
    expect(result.id).toBe('new-id');
  });

  it('updateWorkflow PUTet auf /workflows/<id>', async () => {
    nock('http://test-instance')
      .put('/api/v1/workflows/abc', { name: 'updated' })
      .reply(200, { id: 'abc', name: 'updated' });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const result = await client.updateWorkflow('abc', { name: 'updated' });
    expect(result.name).toBe('updated');
  });

  it('activateWorkflow POSTet auf /workflows/<id>/activate', async () => {
    nock('http://test-instance').post('/api/v1/workflows/abc/activate').reply(200, { ok: true });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const result = await client.activateWorkflow('abc');
    expect(result.ok).toBe(true);
  });

  it('deactivateWorkflow POSTet auf /workflows/<id>/deactivate', async () => {
    nock('http://test-instance').post('/api/v1/workflows/abc/deactivate').reply(200, { ok: true });

    const client = makeClient({ apiUrl: API, apiKey: 'k' });
    const result = await client.deactivateWorkflow('abc');
    expect(result.ok).toBe(true);
  });

  it('setzt X-N8N-API-KEY-Header auf jedem Request', async () => {
    let captured;
    nock('http://test-instance')
      .get('/api/v1/workflows?limit=250')
      .reply(function () {
        captured = this.req.headers['x-n8n-api-key'];
        return [200, { data: [], nextCursor: null }];
      });

    const client = makeClient({ apiUrl: API, apiKey: 'super-secret' });
    await client.listAllWorkflows();
    expect(captured).toBe('super-secret');
  });
});
