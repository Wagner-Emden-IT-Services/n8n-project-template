#!/usr/bin/env node
// n8n-CLI — Cross-Platform-Ersatz fuer alle scripts/*.sh und *.ps1.
// Subcommands: deploy, backup, export, validate, normalize, drift-check, env-sync.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename, relative, dirname } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';

import { resolveEnv, workflowMapping } from './lib/config.mjs';
import { makeClient } from './lib/api.mjs';
import { sanitizeForWrite } from './lib/sanitize.mjs';
import { normalizeWorkflow, stringifyWorkflow } from './lib/normalize.mjs';
import { validateWorkflow, formatErrors } from './lib/validate.mjs';
import { applyEnvMapping } from './lib/env-mapper.mjs';
import { runEnvSync } from './lib/env-sync.mjs';

const program = new Command();
program
  .name('n8n-cli')
  .description(
    'n8n-Workflow-Operations: deploy, backup, export, validate, normalize, drift-check, env-sync',
  )
  .version('0.3.0');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, obj) {
  writeFileSync(path, stringifyWorkflow(obj), 'utf8');
}

function safeFilename(name) {
  return String(name).replace(/[^\w\-]/g, '-');
}

function listWorkflowFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) out.push(...listWorkflowFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------------- deploy ----------------
program
  .command('deploy')
  .description(
    'Deployt eine Workflow-JSON gegen die Ziel-Instanz (Sanitize, Pre-Deploy-Backup, optional Auto-Rollback).',
  )
  .argument('<file>', 'Pfad zur Workflow-JSON')
  .option('-e, --env <env>', 'Ziel-Env (prod|staging|dev)')
  .option(
    '--auto-rollback',
    'Bei HTTP-Fehler im PUT automatisch Backup zurueckspielen + verifizieren',
    false,
  )
  .option('--no-mapping', 'config/env-mapping.yaml ignorieren')
  .action(async (file, opts) => {
    const { env, apiUrl, apiKey } = resolveEnv(opts.env);
    const client = makeClient({ apiUrl, apiKey });

    const raw = readJson(resolve(file));
    const name = raw.name;
    if (!name) throw new Error(`Workflow ohne 'name': ${file}`);

    const mapping = opts.mapping ? workflowMapping(name, env) : null;
    const mapped = applyEnvMapping(raw, mapping);
    const body = sanitizeForWrite(mapped);

    console.log(chalk.cyan(`Deploy '${name}' -> ${env}`));
    if (mapping) console.log(chalk.gray(`  Env-Mapping aus config/env-mapping.yaml angewendet`));

    const existing = await client.findWorkflowByName(name);

    if (existing) {
      const ts = timestamp();
      const backupRoot = process.env.BACKUP_PATH || './backups';
      const backupDir = resolve(backupRoot, env, `pre-deploy-${ts}`);
      mkdirSync(backupDir, { recursive: true });
      const backupFile = join(backupDir, `${existing.id}.json`);
      const fullExisting = await client.getWorkflow(existing.id);
      writeFileSync(backupFile, JSON.stringify(fullExisting, null, 2) + '\n', 'utf8');
      console.log(chalk.gray(`  Backup -> ${backupFile}`));

      try {
        await client.updateWorkflow(existing.id, body);
        console.log(chalk.green(`  ✓ Updated workflow ${existing.id}`));
      } catch (err) {
        console.error(chalk.red(`  ✗ Update fehlgeschlagen: ${err.message}`));
        if (opts.autoRollback) {
          console.error(chalk.yellow(`  -> Auto-Rollback: spiele ${backupFile} zurueck`));
          const rollbackBody = sanitizeForWrite(fullExisting);
          try {
            await client.updateWorkflow(existing.id, rollbackBody);
            console.error(chalk.yellow(`  -> Rollback verifiziert (HTTP 2xx)`));
          } catch (rbErr) {
            console.error(chalk.red(`  ✗✗ ROLLBACK SELBST FEHLGESCHLAGEN: ${rbErr.message}`));
            console.error(chalk.red(`     Manueller Eingriff noetig. Backup: ${backupFile}`));
            process.exit(2);
          }
        }
        process.exit(1);
      }
    } else {
      const created = await client.createWorkflow(body);
      const newId = created.id || created?.data?.id || '<unknown>';
      console.log(chalk.green(`  ✓ Created workflow ${newId}`));
      if (raw.active === true) {
        // 'active' is read-only in write bodies since n8n 2.x (#41) — the intent
        // in the repo JSON would otherwise get lost silently.
        console.log(chalk.yellow(`  ! Workflow inaktiv erstellt — Aktivierung laeuft separat (n8n-UI oder MCP activate_workflow)`));
      }
    }
    console.log(chalk.green('OK Deploy fertig'));
  });

// ---------------- backup ----------------
program
  .command('backup')
  .description('Vollstaendiges Backup aller Workflows einer Instanz (Cursor-paginiert).')
  .option('-e, --env <env>', 'Ziel-Env (prod|staging|dev)')
  .action(async (opts) => {
    const { env, apiUrl, apiKey } = resolveEnv(opts.env);
    const client = makeClient({ apiUrl, apiKey });
    const ts = timestamp();
    const backupRoot = process.env.BACKUP_PATH || './backups';
    const backupDir = resolve(backupRoot, env, ts);
    mkdirSync(backupDir, { recursive: true });
    console.log(chalk.cyan(`Backup -> ${backupDir}`));

    const list = await client.listAllWorkflows();
    let count = 0;
    for (const wf of list) {
      const detail = await client.getWorkflow(wf.id);
      writeFileSync(
        join(backupDir, `${wf.id}.json`),
        JSON.stringify(detail, null, 2) + '\n',
        'utf8',
      );
      count++;
    }
    console.log(chalk.green(`✓ ${count} Workflows gesichert`));
  });

// ---------------- export ----------------
program
  .command('export')
  .description(
    'Exportiert alle Workflows als einzelne JSONs nach workflows/ (normalized, env-agnostisch).',
  )
  .option('-e, --env <env>', 'Quell-Env (prod|staging|dev)')
  .option('-o, --out <dir>', 'Ziel-Verzeichnis', 'workflows')
  .option('--keep-positions', 'nodes[].position behalten (Default: gestrippt)', false)
  .action(async (opts) => {
    const { apiUrl, apiKey } = resolveEnv(opts.env);
    const client = makeClient({ apiUrl, apiKey });
    const outDir = resolve(opts.out);
    mkdirSync(outDir, { recursive: true });

    const list = await client.listAllWorkflows();
    let count = 0;
    for (const wf of list) {
      const detail = await client.getWorkflow(wf.id);
      const normalized = normalizeWorkflow(detail, { keepPositions: opts.keepPositions });
      const file = join(outDir, `${safeFilename(detail.name)}.json`);
      writeJson(file, normalized);
      console.log(chalk.gray(`  + ${detail.name} -> ${relative(process.cwd(), file)}`));
      count++;
    }
    console.log(chalk.green(`✓ Export fertig (${count} Workflows)`));
  });

// ---------------- validate ----------------
program
  .command('validate')
  .description('Validiert eine Workflow-JSON (oder ein Verzeichnis) gegen das lokale Schema.')
  .argument('[target]', 'Pfad zur JSON oder Verzeichnis', 'workflows')
  .action((target) => {
    const resolved = resolve(target);
    if (!existsSync(resolved)) {
      console.error(chalk.red(`Pfad nicht gefunden: ${resolved}`));
      process.exit(1);
    }
    const files = listWorkflowFiles(resolved);
    if (files.length === 0) {
      console.log(chalk.yellow(`Keine .json-Files unter ${resolved}`));
      return;
    }
    let errors = 0;
    for (const file of files) {
      const wf = readJson(file);
      const { ok, errors: errs } = validateWorkflow(wf);
      if (ok) {
        console.log(chalk.green(`✓ ${relative(process.cwd(), file)}`));
      } else {
        console.log(chalk.red(`✗ ${relative(process.cwd(), file)}`));
        console.log(formatErrors(errs));
        errors++;
      }
    }
    console.log(`\nTotal: ${files.length} | Errors: ${errors}`);
    process.exit(errors === 0 ? 0 : 1);
  });

// ---------------- normalize ----------------
program
  .command('normalize')
  .description(
    'Normalisiert eine Workflow-JSON in-place (volatile Felder strippen, Nodes sortieren). Mit --check exit-code-only.',
  )
  .argument('<target>', 'Pfad zur JSON oder Verzeichnis')
  .option('--check', 'Nur pruefen (exit 1 bei Diff), nicht schreiben', false)
  .option('--keep-positions', 'nodes[].position behalten', false)
  .action((target, opts) => {
    const resolved = resolve(target);
    if (!existsSync(resolved)) {
      console.error(chalk.red(`Pfad nicht gefunden: ${resolved}`));
      process.exit(1);
    }
    const files = listWorkflowFiles(resolved);
    let changed = 0;
    for (const file of files) {
      const before = readFileSync(file, 'utf8');
      const wf = JSON.parse(before);
      const normalized = normalizeWorkflow(wf, { keepPositions: opts.keepPositions });
      const after = stringifyWorkflow(normalized);
      if (before !== after) {
        if (opts.check) {
          console.log(chalk.yellow(`! ${relative(process.cwd(), file)} (nicht normalized)`));
        } else {
          writeFileSync(file, after, 'utf8');
          console.log(chalk.cyan(`~ ${relative(process.cwd(), file)} (normalized)`));
        }
        changed++;
      } else {
        console.log(chalk.gray(`✓ ${relative(process.cwd(), file)}`));
      }
    }
    if (opts.check && changed > 0) process.exit(1);
  });

// ---------------- drift-check ----------------
program
  .command('drift-check')
  .description(
    'Vergleicht Repo-Workflows mit Live-Instanz. Exit 1 bei Drift, optional Markdown-Report.',
  )
  .option('-e, --env <env>', 'Ziel-Env (prod|staging|dev)')
  .option('-o, --output <file>', 'Markdown-Report-Datei')
  .option('-d, --dir <dir>', 'Repo-Workflow-Verzeichnis', 'workflows')
  .action(async (opts) => {
    const { env, apiUrl, apiKey } = resolveEnv(opts.env);
    const client = makeClient({ apiUrl, apiKey });

    const repoDir = resolve(opts.dir);
    const repoFiles = existsSync(repoDir) ? listWorkflowFiles(repoDir) : [];
    const repoByName = new Map();
    for (const f of repoFiles) {
      const wf = readJson(f);
      if (wf.name) repoByName.set(wf.name, { file: f, workflow: wf });
    }

    const live = await client.listAllWorkflows();
    const liveById = new Map(live.map((w) => [w.id, w]));

    const report = [];
    let drift = 0;

    for (const wf of live) {
      const detail = await client.getWorkflow(wf.id);
      const repoEntry = repoByName.get(detail.name);
      if (!repoEntry) {
        report.push(
          `### Live-only: \`${detail.name}\` (id ${detail.id})\nIn Instanz aber nicht im Repo.`,
        );
        drift++;
        continue;
      }
      const mapping = workflowMapping(detail.name, env);
      const repoMapped = applyEnvMapping(repoEntry.workflow, mapping);
      const a = stringifyWorkflow(normalizeWorkflow(detail));
      const b = stringifyWorkflow(normalizeWorkflow(repoMapped));
      if (a !== b) {
        report.push(
          `### Drift: \`${detail.name}\`\nLive vs Repo unterscheiden sich.\n- Repo-File: \`${relative(process.cwd(), repoEntry.file)}\`\n- Live-ID: \`${detail.id}\``,
        );
        drift++;
      }
    }

    for (const [name, entry] of repoByName) {
      const inLive = live.some((w) => w.name === name);
      if (!inLive) {
        report.push(
          `### Repo-only: \`${name}\`\nIm Repo aber nicht in Instanz.\n- Repo-File: \`${relative(process.cwd(), entry.file)}\``,
        );
        drift++;
      }
    }

    const md = `# Drift-Report (${env}, ${new Date().toISOString()})\n\nLive: ${liveById.size} | Repo: ${repoByName.size} | Drift-Items: ${drift}\n\n${report.join('\n\n')}\n`;
    if (opts.output) {
      writeFileSync(resolve(opts.output), md, 'utf8');
      console.log(chalk.gray(`Report -> ${opts.output}`));
    }
    if (drift === 0) {
      console.log(chalk.green('✓ Kein Drift'));
    } else {
      console.log(chalk.yellow(`! Drift: ${drift} Item(s)`));
      console.log(md);
      process.exit(1);
    }
  });

// ---------------- env-sync ----------------
program
  .command('env-sync')
  .description(
    'Synct N8N_*-Variablen aus .env in den env-Block von .claude/settings.local.json (Claude Code laedt die Projekt-.env fuer .mcp.json NICHT).',
  )
  .option('--dry-run', 'Nur Plan anzeigen (Werte maskiert), nichts schreiben', false)
  .option('--prune', 'N8N_*-Keys entfernen, die nicht mehr in .env stehen', false)
  .action((opts) => {
    runEnvSync({ dryRun: opts.dryRun, prune: opts.prune });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`Error: ${err.message}`));
  if (process.env.DEBUG && err.stack) console.error(chalk.gray(err.stack));
  process.exit(1);
});
