import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEnvSync, maskValue } from '../../scripts/lib/env-sync.mjs';

function makeProject({ env = null, settings = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'env-sync-test-'));
  if (env != null) writeFileSync(join(dir, '.env'), env, 'utf8');
  if (settings != null) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.local.json'),
      JSON.stringify(settings, null, 2) + '\n',
      'utf8',
    );
  }
  return dir;
}

function readSettings(dir) {
  return JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
}

const noop = () => {};

describe('runEnvSync', () => {
  it('sync in leeres Projekt: legt settings.local.json mit N8N_*-env-Block an', () => {
    const dir = makeProject({
      env: 'N8N_ACTIVE_API_URL=https://n8n.example.com/api/v1\nN8N_ACTIVE_API_KEY=secret-1\nBACKUP_PATH=./backups\n',
    });
    const result = runEnvSync({ cwd: dir, log: noop });
    expect(result.written).toBe(true);

    const settings = readSettings(dir);
    expect(settings.env).toEqual({
      N8N_ACTIVE_API_URL: 'https://n8n.example.com/api/v1',
      N8N_ACTIVE_API_KEY: 'secret-1',
    });
    // Nicht-N8N-Variablen aus .env landen NICHT in settings.local.json
    expect(settings.env).not.toHaveProperty('BACKUP_PATH');

    // Datei-Format: UTF-8 ohne BOM, 2-space-indent, trailing newline
    const raw = readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8');
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    expect(raw).toContain('  "env"');
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('merged mit bestehendem env-Block ohne fremde Keys/Settings anzufassen', () => {
    const dir = makeProject({
      env: 'N8N_ACTIVE_API_KEY=new-secret\nN8N_ACTIVE_API_URL=https://new.example.com\n',
      settings: {
        permissions: { allow: ['Bash(node:*)'] },
        env: { OTHER_TOOL_TOKEN: 'keep-me', N8N_ACTIVE_API_KEY: 'old-secret' },
      },
    });
    runEnvSync({ cwd: dir, log: noop });

    const settings = readSettings(dir);
    expect(settings.permissions).toEqual({ allow: ['Bash(node:*)'] });
    expect(settings.env.OTHER_TOOL_TOKEN).toBe('keep-me');
    expect(settings.env.N8N_ACTIVE_API_KEY).toBe('new-secret');
    expect(settings.env.N8N_ACTIVE_API_URL).toBe('https://new.example.com');
  });

  it('ohne --prune bleiben stale N8N_*-Keys stehen, mit --prune werden sie entfernt', () => {
    const settings = {
      env: { N8N_ACTIVE_STALE_KEY: 'gone-from-env', OTHER_TOOL_TOKEN: 'keep-me' },
    };
    const env = 'N8N_ACTIVE_API_KEY=secret-1\n';

    const dirNoPrune = makeProject({ env, settings });
    runEnvSync({ cwd: dirNoPrune, log: noop });
    expect(readSettings(dirNoPrune).env).toHaveProperty('N8N_ACTIVE_STALE_KEY');

    const dirPrune = makeProject({ env, settings });
    const result = runEnvSync({ cwd: dirPrune, prune: true, log: noop });
    const after = readSettings(dirPrune).env;
    expect(after).not.toHaveProperty('N8N_ACTIVE_STALE_KEY');
    expect(after.OTHER_TOOL_TOKEN).toBe('keep-me');
    expect(after.N8N_ACTIVE_API_KEY).toBe('secret-1');
    expect(result.changes).toContainEqual({ key: 'N8N_ACTIVE_STALE_KEY', action: 'remove' });
  });

  it('--dry-run maskiert Werte und schreibt nichts', () => {
    const secret = 'super-secret-key-123';
    const dir = makeProject({ env: `N8N_ACTIVE_API_KEY=${secret}\n` });
    const lines = [];
    const result = runEnvSync({ cwd: dir, dryRun: true, log: (l) => lines.push(l) });

    expect(result.written).toBe(false);
    expect(existsSync(join(dir, '.claude', 'settings.local.json'))).toBe(false);

    const output = lines.join('\n');
    expect(output).not.toContain(secret);
    expect(output).toContain('N8N_ACTIVE_API_KEY');
    expect(output).toContain(maskValue(secret));
  });

  it('ohne .env: sprechender Fehler', () => {
    const dir = makeProject();
    expect(() => runEnvSync({ cwd: dir, log: noop })).toThrow(/\.env nicht gefunden/);
  });

  it('synct nur N8N_ACTIVE_*: PROD-/STAGING-/DEV-Secrets bleiben draussen (Scope-Schutz)', () => {
    const dir = makeProject({
      env: 'N8N_ACTIVE_API_KEY=active-1\nN8N_PROD_API_KEY=prod-secret\nN8N_STAGING_MCP_TOKEN=stag-secret\nN8N_DEV_API_KEY=dev-secret\n',
    });
    runEnvSync({ cwd: dir, log: noop });
    const env = readSettings(dir).env;
    expect(env).toEqual({ N8N_ACTIVE_API_KEY: 'active-1' });
  });

  it('zweiter Lauf ohne Aenderungen schreibt nichts (Idempotenz)', () => {
    const dir = makeProject({ env: 'N8N_ACTIVE_API_KEY=secret-1\n' });
    const first = runEnvSync({ cwd: dir, log: noop });
    const second = runEnvSync({ cwd: dir, log: noop });
    expect(first.written).toBe(true);
    expect(second.written).toBe(false);
    expect(second.changes).toEqual([]);
  });

  it('settings.local.json mit BOM wird korrekt gelesen', () => {
    const dir = makeProject({ env: 'N8N_ACTIVE_API_KEY=secret-1\n' });
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.local.json'),
      '﻿' + JSON.stringify({ env: { OTHER_TOOL_TOKEN: 'keep-me' } }, null, 2) + '\n',
      'utf8',
    );
    runEnvSync({ cwd: dir, log: noop });
    const env = readSettings(dir).env;
    expect(env.OTHER_TOOL_TOKEN).toBe('keep-me');
    expect(env.N8N_ACTIVE_API_KEY).toBe('secret-1');
  });

  it('--prune + --dry-run meldet remove-Aenderungen, schreibt aber nichts', () => {
    const dir = makeProject({
      env: 'N8N_ACTIVE_API_KEY=secret-1\n',
      settings: { env: { N8N_ACTIVE_STALE_KEY: 'gone-from-env', N8N_ACTIVE_API_KEY: 'secret-1' } },
    });
    const result = runEnvSync({ cwd: dir, dryRun: true, prune: true, log: noop });
    expect(result.written).toBe(false);
    expect(result.changes).toContainEqual({ key: 'N8N_ACTIVE_STALE_KEY', action: 'remove' });
    expect(readSettings(dir).env).toHaveProperty('N8N_ACTIVE_STALE_KEY');
  });

  it('kaputtes settings.local.json: inhaltsfreier Fehler ohne Secret-Fragment', () => {
    const dir = makeProject({ env: 'N8N_ACTIVE_API_KEY=secret-1\n' });
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.local.json'),
      '{ "env": { "X_KEY": sk-supersecret } }',
      'utf8',
    );
    let caught;
    try {
      runEnvSync({ cwd: dir, log: noop });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toContain('kein gueltiges JSON');
    expect(caught.message).not.toContain('sk-supersecret');
  });
});

describe('maskValue', () => {
  it('gibt den Klartext-Wert niemals zurueck', () => {
    expect(maskValue('hunter2')).not.toContain('hunter2');
    expect(maskValue('hunter2')).toContain('****');
  });
});
