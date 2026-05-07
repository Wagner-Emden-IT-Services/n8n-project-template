---
description: Validiert eine n8n-Workflow-JSON gegen Schema, prüft Knoten-Verbindungen und Credential-Refs.
allowed-tools: Read, Bash, Grep
---

# /validate-workflow

Validiert die als Argument übergebene Workflow-JSON gründlich.

**Argument:** Pfad zur Workflow-JSON (z. B. `workflows/dev/dev-test.json`)

## Schritte

1. **JSON-Syntax-Check** — File lesen, parsen. Bei Fehler abbrechen mit Zeile/Spalte.
2. **Schema-Validation** — `node scripts/n8n-cli.mjs validate <pfad>`. Alle Fehler ausgeben.
3. **Naming-Convention** — Wenn der czlonkowski-MCP-Server (`n8n-mcp`) verfügbar ist, dessen `validate_workflow` zusätzlich aufrufen — er kennt Node-Typen exakt. Falls nicht: Regex-Check `^[a-z][a-z0-9-]*$` auf `.name` (kein Env-Prefix mehr — Env via `config/env-mapping.yaml`).
4. **Connections-Konsistenz** — Jede `connections`-Referenz auf einen `nodes[].name` muss existieren. Orphan-Connections melden.
5. **Credential-Refs** — `nodes[].credentials` muss auf existierende Credentials in der Ziel-Instanz verweisen. Falls möglich: über offiziellen MCP `get_workflow_details` cross-checken.
6. **Generische Knotennamen** — Knoten mit Namen `If`, `Function`, `Code`, `HTTP Request`, `Set`, `Merge`, `Switch` melden — sollten sprechend benannt sein.

## Output

- ✓ wenn alles grün
- Liste aller Fehler mit Pfad und Zeile/Knoten-Name bei Verstößen
- Bei mehr als 5 Fehlern: nach den ersten 5 Stop und Zusammenfassung
- KEIN automatisches Fixen — nur Report
