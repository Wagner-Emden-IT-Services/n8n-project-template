// AJV-Wrapper fuer Workflow-Schema-Validation.

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

export function validateWorkflow(workflow) {
  const validate = getValidator();
  const ok = validate(workflow);
  return { ok, errors: validate.errors || [] };
}

export function formatErrors(errors) {
  return errors
    .map(
      (e) =>
        `  - ${e.instancePath || '/'} ${e.message}${e.params ? ` (${JSON.stringify(e.params)})` : ''}`,
    )
    .join('\n');
}
