---
description: Prüft Workflow- und Node-Namen gegen unsere Naming-Convention.
allowed-tools: Read, Bash, Grep
---

# /check-naming

Prüft den als Argument übergebenen Workflow auf Naming-Verstöße.

**Argument:** Pfad zur Workflow-JSON oder Verzeichnis (Default: `workflows/`)

## Regeln

| Was            | Pattern                                                               | Beispiel          |
| -------------- | --------------------------------------------------------------------- | ----------------- |
| Workflow-Name  | `[funktion]` (kebab-case, lowercase, kein Env-Prefix)                 | `exchange-sync`   |
| Knoten-Name    | sprechende Klartext-Frage/-Aussage                                    | `Has user email?` |
| Credential-Ref | `<service>-<env>` (instanz-spezifisch, via `config/env-mapping.yaml`) | `slack-api-prod`  |

## Schritte

1. Lade Workflow-JSON (bzw. iteriere über alle in einem Verzeichnis).
2. **Workflow-Name** prüfen:
   - Pattern-Match `^[a-z][a-z0-9-]*$` (kebab-case, kein Env-Prefix)
   - Bei Mismatch: aktuellen Namen + Fix-Vorschlag ausgeben
3. **Path-Konsistenz** prüfen: liegt die Datei in `workflows/` (env-agnostisch) oder einem `workflows/<env>/`-Legacy-Verzeichnis?
4. **Knoten-Namen** prüfen:
   - Verboten: `If`, `Function`, `Code`, `HTTP Request`, `Set`, `Merge`, `Switch`, `Workflow 1`, `URGENT-FIX-DO-NOT-TOUCH`
   - Bei Mismatch: Knoten-ID + aktueller Name + Vorschlag (z. B. "What does this If check? Beschreibe es als Frage.")
5. **Credential-Refs** prüfen: Pattern `<service>-<env>`. Bei Verstoß flaggen.
6. **Git-Commit-Convention** Hinweis: Reminder dass der nächste Commit `[ENV] [ACTION]: ...` Format haben sollte.

## Output

Tabelle: Datei | Verstoß-Typ | Aktuell | Vorschlag.
Kein automatisches Fixen ohne explizite Bestätigung.
