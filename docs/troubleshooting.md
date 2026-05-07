# Troubleshooting

## "Nur Batch 1 wird verarbeitet" bei Pagination

Symptom: HTTP-Pagination liefert mehrere Batches, aber nachfolgende Code-Node sieht nur den ersten.

Root Cause: `.first()` statt `.all()` im Code-Node.

```javascript
// FALSCH
const data = $('HTTP Request').first().json;

// RICHTIG
const allBatches = $('HTTP Request').all();
const items = allBatches.flatMap((b) => b.json.value || []);
```

`/check-pagination` würde das fangen.

## "Aggregate-Node nach SplitInBatches wird nie ausgeführt"

Root Cause: Done-Output von SplitInBatches ist leer, n8n triggert nachfolgende Nodes nicht.

Lösung: Pattern verwerfen. HTTP-Request-Node mit eingebauter Pagination + Code-Node für Collection. Falls SplitInBatches zwingend: Code-Node mit `return $input.all()` als Bridge nach Done-Output.

## "Item-Explosion": 65.000 statt 2.600 Items

Root Cause: Parallele Connections in Merge-Node multiplizieren Items.

Lösung: Sequenzielles Routing oder Aggregate-Node nach Parallel-Split.

## "DataTable gibt nur 50 Rows zurück"

Root Cause: Default `limit: 50` ohne `returnAll: true`.

Lösung: `returnAll: true` explizit setzen.

## "fetch is not defined" / "$helpers is not defined" im Code-Node

Root Cause: n8n task-runner-mode hat keinen Zugriff auf `fetch()` oder `$helpers`.

Lösung: HTTP-Request-Node nutzen (mit Pagination konfiguriert), Code-Node nur für Aggregation/Transform.

## "getCredentials is not a function" im Code-Node

Root Cause: Credentials sind im Code-Node nicht zugänglich.

Lösung: HTTP-Request-Node mit Credential-Selection nutzen. Falls dynamisch: Switch-Node davor.

## Connection-Pool-Exhaustion bei Loops

Symptom: nach 100ten HTTP-Calls in Loop hängen die Calls.

Lösung: `Wait`-Node zwischen Calls (200-500ms), Connection-/Read-Timeout 30-60s, Batch-Size limitieren.

## Customer-Daten in Error-Messages

Symptom: Error-Workflow sendet Mail mit `Customer Stark Industries not found`.

Risiko: DSGVO + Datenleck zwischen Tenants.

Lösung: Generische Error-Messages, IDs statt Namen, Customer-Daten nur in Logs (intern, gesichert).

## Workflow läuft nicht nach Update

Mögliche Ursachen:

1. `active: false` durch Update geflippt → `activate_workflow`
2. Credentials wurden nicht migriert → Community-MCP `n8n_update_partial_workflow` nutzt Credential-Preservation
3. `typeVersion` veraltet → Community-MCP `n8n_autofix_workflow`
4. Node-Type heißt anders nach n8n-Update → `n8n_autofix_workflow`

## n8n-Instanz reagiert nicht / MCP-Server timeout

1. `curl` gegen n8n-Health-Endpoint: `curl https://<instanz>/healthz`
2. n8n-Logs prüfen (`docker logs <n8n-container>`)
3. Memory-Druck? OOM-Crash bei großen Workflows
4. Bei großen Workflows: offizieller MCP timeoutet bei 60s — Community-MCP nutzen
