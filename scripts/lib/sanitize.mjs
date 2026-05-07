// Strippt read-only Felder, die n8n bei Create/Update nicht akzeptiert.
// Liste versioniert in docs/sanitize-fields.md.

export const READONLY_FIELDS = [
  'id',
  'versionId',
  'createdAt',
  'updatedAt',
  'triggerCount',
  'pinData',
  'meta',
  'shared',
  'isArchived',
  'staticData',
  'tags',
];

export function sanitizeForWrite(workflow) {
  const out = { ...workflow };
  for (const f of READONLY_FIELDS) delete out[f];
  return out;
}
