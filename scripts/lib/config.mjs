// Loads .env (robust gegen `=` in Werten) und env-mapping.yaml.
// Liefert API-Endpoint + API-Key fuer prod/staging/dev.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import yaml from 'js-yaml';

const ENV_FILE = resolve(process.cwd(), '.env');
const MAPPING_FILE = resolve(process.cwd(), 'config/env-mapping.yaml');

let loaded = false;
function loadDotenv() {
  if (loaded) return;
  if (existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE });
  loaded = true;
}

export function resolveEnv(target) {
  loadDotenv();
  const env = target || process.env.N8N_ACTIVE_ENV || 'dev';
  const upper = env.toUpperCase();
  const apiUrl = process.env[`N8N_${upper}_API_URL`];
  const apiKey = process.env[`N8N_${upper}_API_KEY`];
  const baseUrl = process.env[`N8N_${upper}_BASE_URL`];
  if (!apiUrl) throw new Error(`N8N_${upper}_API_URL nicht gesetzt (.env pruefen)`);
  if (!apiKey) throw new Error(`N8N_${upper}_API_KEY nicht gesetzt (.env pruefen)`);
  return { env, apiUrl, apiKey, baseUrl };
}

export function loadEnvMapping() {
  if (!existsSync(MAPPING_FILE)) return {};
  const raw = readFileSync(MAPPING_FILE, 'utf8');
  return yaml.load(raw) || {};
}

export function workflowMapping(workflowName, env) {
  const all = loadEnvMapping();
  return all?.[workflowName]?.[env] || null;
}
