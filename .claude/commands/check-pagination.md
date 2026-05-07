---
description: Prüft Pagination-Logik in n8n-Workflows — .all() statt .first(), Done-Output-Trap, Cursor-Korrektheit.
allowed-tools: Read, Bash, Grep
---

# /check-pagination

Prüft Pagination-Patterns gegen unsere Hard-Earned Lessons.

**Argument:** Pfad zur Workflow-JSON

## Was wird geprüft

### 1. `.first()` vs `.all()`

Suche in Code-Nodes nach:

- `$('<node>').first()` → wenn vorhergehender Node paginiert: KRITISCH (siehe Vault `n8n Code Node — .first() vs .all() bei Pagination.md`)
- `$input.first()` nach paginiertem HTTP-Request: KRITISCH

Vorschlag:

```javascript
const allBatches = $('<node>').all();
const items = allBatches.flatMap((b) => b.json.value || b.json._embedded?.items || []);
```

### 2. SplitInBatches Done-Output

- Suche nach SplitInBatches-Nodes mit Done-Output verbunden
- Wenn Done-Output direkt in Aggregate-Node fließt: WARNUNG (Done-Output ist leer → Aggregate triggert nicht)
- Lösung: HTTP-Request-Pagination + Code-Node-Aggregation, oder Code-Node mit `return $input.all()` als Bridge

### 3. HTTP-Request-Pagination konfiguriert?

Wenn ein HTTP-Request-Node API mit bekannter Pagination ansprechen soll:

- Prüfe `options.pagination.pagination.paginationMode` (`responseContainsNextURL`, `updateAParameterInEachRequest`)
- Prüfe `requestInterval` (Rate-Limiting)
- Prüfe `paginationCompleteWhen` und `completeExpression`

### 4. DataTable returnAll

- Bei DataTable-Get-Operations: `returnAll: true` MUSS gesetzt sein, sonst nur 50 Rows
- Default-`limit: 50` ohne `returnAll` → KRITISCH

### 5. Parallel-Connection-Item-Explosion

- Suche nach Merge-Nodes mit mehreren parallelen Inputs
- Wenn Inputs unterschiedliche Item-Counts haben → potential Item-Explosion (n × m statt n + m)
- Vorschlag: sequenzielles Routing (Lookup-Pattern) oder Aggregate vor Merge

## Output

Tabelle: Knoten | Issue-Typ | Schwere | Snippet | Fix.
Bei `.first()`-Pattern oder DataTable-ohne-returnAll: KRITISCH-Flag.
