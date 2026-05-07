// n8n REST-Client.
// - Cursor-Pagination fuer alle list-Operationen (zentrale Loop, kein .first()-Anti-Pattern)
// - HTTP-Status-Verifikation auf JEDEM write (auch Rollback-PUT)
// - throwOn4xx5xx via axios validateStatus

import axios from 'axios';

export function makeClient({ apiUrl, apiKey, timeoutMs = 30000 }) {
  const http = axios.create({
    baseURL: apiUrl,
    timeout: timeoutMs,
    headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' },
    validateStatus: () => true, // wir entscheiden selbst, damit Bodies bei Fehlern nicht verloren gehen
  });

  async function ensureOk(method, path, resp, ctx = '') {
    if (resp.status < 200 || resp.status >= 300) {
      const body = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      const err = new Error(
        `${method} ${path} -> HTTP ${resp.status}${ctx ? ` (${ctx})` : ''}: ${body}`,
      );
      err.status = resp.status;
      err.body = resp.data;
      throw err;
    }
    return resp.data;
  }

  async function listAllWorkflows({ pageLimit = 250 } = {}) {
    const all = [];
    let cursor = null;
    while (true) {
      const url = `/workflows?limit=${pageLimit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const resp = await http.get(url);
      await ensureOk('GET', url, resp);
      const data = resp.data?.data || [];
      all.push(...data);
      cursor = resp.data?.nextCursor || null;
      if (!cursor) break;
    }
    return all;
  }

  async function findWorkflowByName(name) {
    const list = await listAllWorkflows();
    return list.find((w) => w.name === name) || null;
  }

  async function getWorkflow(id) {
    const url = `/workflows/${encodeURIComponent(id)}`;
    const resp = await http.get(url);
    return ensureOk('GET', url, resp);
  }

  async function createWorkflow(body) {
    const resp = await http.post('/workflows', body);
    return ensureOk('POST', '/workflows', resp);
  }

  async function updateWorkflow(id, body) {
    const url = `/workflows/${encodeURIComponent(id)}`;
    const resp = await http.put(url, body);
    return ensureOk('PUT', url, resp);
  }

  async function activateWorkflow(id) {
    const url = `/workflows/${encodeURIComponent(id)}/activate`;
    const resp = await http.post(url);
    return ensureOk('POST', url, resp);
  }

  async function deactivateWorkflow(id) {
    const url = `/workflows/${encodeURIComponent(id)}/deactivate`;
    const resp = await http.post(url);
    return ensureOk('POST', url, resp);
  }

  return {
    listAllWorkflows,
    findWorkflowByName,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    activateWorkflow,
    deactivateWorkflow,
  };
}
