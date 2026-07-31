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

## DataTable dateTime TZ-Bug: alle Items werden Update-Kandidaten

Symptom: Change-Detection per `sourceModified > lastKnownModified` ist permanent `true` — jeder Run behandelt alle Items als Update-Kandidaten, obwohl sie unverändert sind. Runs dauern Minuten statt Sekunden.

Root Cause: DataTable-Columns vom Typ `dateTime` (intern `timestamp(3) with time zone`) speichern ISO-Strings mit `Z`-UTC-Suffix als Container-lokal, wenn `TZ`/`GENERIC_TIMEZONE` gesetzt sind (z.B. `Europe/Berlin`). Aus `2026-05-03T06:33:10Z` wird `2026-05-03 06:33:10+02` (= UTC 04:33:10) — die `Z`-Information geht verloren. Der Offset wechselt mit DST (-1h CET, -2h CEST), ist also kein konstanter Shift. Offenes n8n-Upstream-Issue: "Incorrect Time Zone Conversion for datetime Type Data".

Detection (Stichprobe gegen den Quell-API-Wert):

```sql
SELECT id, <ts-column>::text FROM "data_table_user_<id>" LIMIT 3;
-- Compare with the source API response for the same record:
-- stored timestamp off by 1-2h => bug is present
```

Workaround: im Prepare-Code-Node vor jedem DataTable-Write explizit nach UTC-ISO normalisieren:

```javascript
source_last_modified: new Date(matchedInput.json.source_last_modified).toISOString()
```

Einmalige SQL-Korrektur für Altbestand:

```sql
UPDATE "data_table_user_<id>"
SET <ts-column> = <ts-column> + INTERVAL '<offset> hours';
```

**WARNUNG:** Der Offset hängt vom DST-Zeitraum der jeweiligen Schreibung ab (+2h für CEST-Schreibungen, +1h für CET). Umfasst der Altbestand einen DST-Wechsel, ist ein pauschales `UPDATE` falsch — dann pro Zeitraum getrennt korrigieren oder die Table neu befüllen.

Eskalation, falls der Workaround nicht hält: Column auf Typ `string` migrieren. Das DataTable-Schema ist nach Creation immutable — neue Table mit `string`-Column anlegen, Daten migrieren, Workflow umstellen, alte Table löschen.

## DataTable Upsert Silent Bloat: Row-Count explodiert still

Symptom: DataTable wächst über Wochen unbemerkt (Produktivfall: 2.608 → 144.049 Rows in 2 Wochen, 54 Läufe). Jeder Schedule-Fire lädt bei `returnAll: true` die komplette Table (~95 MB JSON) in den Task-Runner → Host-OOM (`oom-killer` im kernel dmesg), Task-Runner gekillt, Workflow crash-loop mit `Node execution failed`.

Root Cause: `dataTable`-Node mit `operation: upsert` braucht zwingend drei Bedingungen: (1) `columns.matchingColumns` nicht leer, (2) `filters.conditions` mit gefülltem `keyName`, (3) das key-column im `columns.value`-Mapping. Fehlt eines davon, hält n8n den Upsert nicht für match-fähig und macht stillschweigend Insert statt Update — kein Fehler, keine Warnung, keine Telemetry. Pro Lauf entsteht ein kompletter neuer Row-Satz (ggf. mit NULL-Key). `n8n_validate_workflow` flaggt die Config-Lücke nicht.

Detection:

```sql
SELECT COUNT(*) AS total,
       COUNT(DISTINCT <key_column>) AS distinct_keys,
       SUM(CASE WHEN <key_column> IS NULL THEN 1 ELSE 0 END) AS null_keys
FROM "data_table_user_<id>";
-- total >> distinct_keys oder null_keys > 0 => Upsert-Config kaputt
```

Cleanup:

**WARNUNG:** Vor dem Löschen Backup ziehen (`CREATE TABLE "data_table_user_<id>_backup" AS SELECT * FROM "data_table_user_<id>";` oder `pg_dump -t`) — die DELETEs sind nicht reversibel.

```sql
-- 1. NULL-Key-Rows entfernen
DELETE FROM "data_table_user_<id>" WHERE <key_column> IS NULL;

-- 2. Duplikate entfernen, jeweils neueste Row pro Key behalten
DELETE FROM "data_table_user_<id>"
WHERE id NOT IN (
  SELECT MAX(id) FROM "data_table_user_<id>" GROUP BY <key_column>
);
```

Danach die Upsert-Config im Workflow fixen, sonst bloatet die Table sofort wieder.

Prävention: `npm run validate` fängt die Fehlkonfiguration seit v1.2.0 (Custom-Check `dataTableUpsert` in `scripts/lib/validate.mjs`, Issue #16).

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
