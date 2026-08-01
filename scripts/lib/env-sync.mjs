// Sync .env -> .claude/settings.local.json (env-Block).
// Claude Code laedt die Projekt-.env NICHT fuer die ${VAR}-Expansion in
// .mcp.json — die MCP-Server sehen nur Shell-Env plus die env-Bloecke der
// settings-Files. Dieser Helper haelt beide Quellen drift-frei (fixes #39).

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import dotenv from 'dotenv';

// Only the ACTIVE_* set — exactly what .mcp.json references. Syncing all
// N8N_* would push prod/staging secrets from full-profile .env files into
// every Claude Code subprocess environment (scope escalation).
const ENV_PREFIX = 'N8N_ACTIVE_';

// Never print secrets in clear text; the length hint helps spot empty values.
export function maskValue(value) {
  return `****(${String(value).length} chars)`;
}

function readSettings(path) {
  if (!existsSync(path)) return {};
  // Strip a possible BOM so JSON.parse does not choke.
  const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Own message without file content — V8's "Unexpected token" errors embed
    // surrounding characters, which could leak secret fragments to the terminal.
    throw new Error(
      '.claude/settings.local.json ist kein gueltiges JSON — Datei reparieren oder loeschen, dann env-sync erneut ausfuehren.',
    );
  }
}

function writeSettingsAtomic(path, settings) {
  mkdirSync(dirname(path), { recursive: true });
  // Atomic: write to temp file, then rename over the target.
  // UTF-8 without BOM, 2-space indent, trailing newline.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  try {
    renameSync(tmp, path);
  } catch (err) {
    // Never leave a temp file with secrets behind (it is not gitignored).
    try { unlinkSync(tmp); } catch { /* best effort */ }
    throw err;
  }
}

export function runEnvSync({
  cwd = process.cwd(),
  dryRun = false,
  prune = false,
  log = console.log,
} = {}) {
  const envFile = resolve(cwd, '.env');
  if (!existsSync(envFile)) {
    throw new Error(
      `.env nicht gefunden (${envFile}). Zuerst .env aus .env.example anlegen und die N8N_*-Werte fuellen — env-sync liest ausschliesslich diese Datei, nicht process.env.`,
    );
  }

  // dotenv.parse on file content (NOT dotenv.config / process.env) so the
  // shell environment can never leak into settings.local.json.
  const parsed = dotenv.parse(readFileSync(envFile, 'utf8'));
  const envVars = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k.startsWith(ENV_PREFIX)) envVars[k] = v;
  }

  const settingsPath = resolve(cwd, '.claude', 'settings.local.json');
  const settings = readSettings(settingsPath);
  const currentEnv = settings.env && typeof settings.env === 'object' ? settings.env : {};

  const changes = []; // { key, action: 'add' | 'update' | 'remove', value? }
  const nextEnv = { ...currentEnv };

  for (const [k, v] of Object.entries(envVars)) {
    if (!(k in currentEnv)) changes.push({ key: k, action: 'add', value: v });
    else if (currentEnv[k] !== v) changes.push({ key: k, action: 'update', value: v });
    nextEnv[k] = v;
  }

  if (prune) {
    for (const k of Object.keys(currentEnv)) {
      if (k.startsWith(ENV_PREFIX) && !(k in envVars)) {
        delete nextEnv[k];
        changes.push({ key: k, action: 'remove' });
      }
    }
  }

  // Other top-level settings (permissions, hooks, ...) stay untouched;
  // non-N8N keys inside env stay untouched as well.
  const nextSettings = { ...settings, env: nextEnv };

  if (dryRun) {
    log(`Dry-Run (nichts geschrieben): ${settingsPath}`);
    if (changes.length === 0) {
      log('  Keine Aenderungen — settings.local.json ist aktuell.');
    }
    for (const c of changes) {
      if (c.action === 'remove') log(`  - ${c.key} (prune)`);
      else log(`  ${c.action === 'add' ? '+' : '~'} ${c.key} = ${maskValue(c.value)}`);
    }
    return { settingsPath, settings: nextSettings, changes, written: false };
  }

  const mustWrite = changes.length > 0 || !existsSync(settingsPath);
  if (mustWrite) {
    writeSettingsAtomic(settingsPath, nextSettings);
    log(
      `OK ${settingsPath} aktualisiert (${changes.length} Aenderung(en), ${Object.keys(envVars).length} N8N_*-Variablen)`,
    );
  } else {
    log('OK settings.local.json bereits aktuell — nichts geschrieben.');
  }
  log('Hinweis: Claude Code neu starten, damit die MCP-Server die Werte sehen.');
  return { settingsPath, settings: nextSettings, changes, written: mustWrite };
}
