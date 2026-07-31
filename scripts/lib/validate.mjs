// AJV-Wrapper fuer Workflow-Schema-Validation + Custom-Checks,
// die sich nicht in JSON Schema ausdruecken lassen (Cross-Field-Logik).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const SCHEMA_PATH = resolve(process.cwd(), 'schemas/workflow-schema.json');

let cached = null;
function getValidator() {
  if (cached) return cached;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  cached = ajv.compile(schema);
  return cached;
}

// DataTable-Upsert-Check (Issue #16): ein Upsert ohne matchingColumns,
// ohne filter-Conditions oder ohne den Key-Column im value-Mapping wird
// von n8n stillschweigend zum Insert — kein Fehler, keine Warnung, aber
// bei jedem Lauf neue Rows (Silent-Insert-Bloat, im Produktivfall
// 2.608 -> 144.049 Rows -> 95 MB JSON -> Host-OOM).
// Errors kommen im AJV-Error-Shape zurueck, damit formatErrors sie rendert.
function checkDataTableUpserts(workflow) {
  const errors = [];
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  nodes.forEach((node, i) => {
    if (node?.type !== 'n8n-nodes-base.dataTable') return;
    const params = node.parameters || {};
    if (params.operation !== 'upsert') return;

    const nodeName = node.name || node.id || `#${i}`;
    const base = `/nodes/${i}/parameters`;
    const err = (path, message) =>
      errors.push({
        instancePath: `${base}${path}`,
        message,
        params: { rule: 'dataTableUpsert', node: nodeName },
      });

    const matching = params.columns?.matchingColumns;
    if (!Array.isArray(matching) || matching.length === 0) {
      err(
        '/columns/matchingColumns',
        `DataTable Upsert ohne matchingColumns wird zum Insert -> Silent-Insert-Bloat bei jedem Lauf. Node: '${nodeName}'`,
      );
    }

    const conditions = params.filters?.conditions;
    const hasUsableCondition =
      Array.isArray(conditions) &&
      conditions.length > 0 &&
      conditions.every((c) => c && typeof c === 'object' && c.keyName);
    if (!hasUsableCondition) {
      err(
        '/filters/conditions',
        `DataTable Upsert mit leerem/unvollstaendigem filters.conditions (keyName fehlt) wird zum Insert -> Silent-Insert-Bloat. Node: '${nodeName}'`,
      );
    }

    // Check 3 nur bei manuellem Mapping: bei mappingMode 'autoMapInputData'
    // mappt n8n zur Laufzeit automatisch aus den Input-Daten — columns.value
    // ist dann legitim leer (kein False-Positive erzeugen).
    const autoMap = params.columns?.mappingMode === 'autoMapInputData';
    if (Array.isArray(matching) && !autoMap) {
      const value = params.columns?.value;
      for (const col of matching) {
        if (value?.[col] === undefined) {
          err(
            '/columns/value',
            `DataTable Upsert ohne matching column '${col}' im columns.value-Mapping -> Rows werden mit NULL-Key gespeichert (Silent-Insert-Bloat). Node: '${nodeName}'`,
          );
        }
      }
    }
  });
  return errors;
}

export function validateWorkflow(workflow) {
  const validate = getValidator();
  const ok = validate(workflow);
  const errors = [...(validate.errors || []), ...checkDataTableUpserts(workflow)];
  return { ok: ok && errors.length === 0, errors };
}

export function formatErrors(errors) {
  return errors
    .map(
      (e) =>
        `  - ${e.instancePath || '/'} ${e.message}${e.params ? ` (${JSON.stringify(e.params)})` : ''}`,
    )
    .join('\n');
}
