// Wendet config/env-mapping.yaml auf einen Workflow an, BEVOR er deployt wird.
// - ersetzt Credential-Refs (logischer Name -> env-spezifische {id, name})
// - haengt webhook_path_suffix an Webhook-Trigger-Pfade
// Tags: n8n liefert tags read-only zurueck und akzeptiert sie nicht im Workflow-PUT.
// Wer pro Env unterschiedliche Tags will, setzt sie manuell in der UI oder via separater /tags-API.

export function applyEnvMapping(workflow, mapping) {
  if (!mapping) return workflow;
  const wf = JSON.parse(JSON.stringify(workflow));

  if (Array.isArray(wf.nodes) && mapping.credentials) {
    for (const node of wf.nodes) {
      if (!node.credentials) continue;
      const newCreds = {};
      for (const [credType, credRef] of Object.entries(node.credentials)) {
        const logical =
          (credRef && typeof credRef === 'object' ? credRef.name : credRef) || credType;
        const target = mapping.credentials[logical] || mapping.credentials[credType];
        if (target) {
          newCreds[credType] = { id: target.id, name: target.name };
        } else {
          newCreds[credType] = credRef;
        }
      }
      node.credentials = newCreds;
    }
  }

  if (Array.isArray(wf.nodes) && mapping.webhook_path_suffix) {
    const suffix = mapping.webhook_path_suffix;
    for (const node of wf.nodes) {
      const isWebhook =
        typeof node.type === 'string' &&
        (node.type.endsWith('webhook') || node.type.endsWith('formTrigger'));
      if (!isWebhook) continue;
      if (
        node.parameters &&
        typeof node.parameters.path === 'string' &&
        !node.parameters.path.endsWith(suffix)
      ) {
        node.parameters.path = node.parameters.path + suffix;
      }
    }
  }

  return wf;
}
