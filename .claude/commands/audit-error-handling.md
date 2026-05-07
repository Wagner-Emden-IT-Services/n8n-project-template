---
description: Prüft konfiguriertes Error-Workflow + Retry-Settings auf kritischen Knoten.
allowed-tools: Read, Bash, Grep
---

# /audit-error-handling

Prüft ob der Workflow bei Fehlern sicher fehlschlägt und alarmiert.

**Argument:** Pfad zur Workflow-JSON

## Was wird geprüft

### 1. Error-Workflow konfiguriert

- `settings.errorWorkflow` muss gesetzt sein für Production-Workflows
- Error-Workflow sollte existieren (in `workflows/shared/error-handler.json` o. Ä.)
- Bei `prod-*`-Workflows ohne Error-Workflow: KRITISCH

### 2. Retry-Settings auf kritischen Knoten

Kritische Knoten = HTTP-Requests an externe APIs, DB-Schreiboperationen, Third-Party-Integrations.

Pflicht-Settings:

- `retryOnFail: true`
- `maxTries: 3` (mindestens)
- `waitBetweenTries: 1000-5000` (Backoff)

Bei kritischem Knoten ohne Retry: WARNUNG.

### 3. `continueOnFail` in Loops

- In SplitInBatches-Loops: `continueOnFail: true` auf inneren Knoten verhindert dass ein Item-Fehler den ganzen Loop killt
- Bei großen Sync-Workflows: empfohlen + Error-Sammlung in separatem Branch

### 4. Timeout-Handling

- HTTP-Request-Knoten ohne `options.timeout` (default 5min!) bei lang-laufenden APIs problematisch
- Connection-Timeout 30s, Read-Timeout 60-120s als Default

### 5. Customer-Daten in Error-Messages

- Suche nach `expression`-Strings die Customer-Daten in Error-Sections leaken
- DSGVO-Risiko + Datenleck

### 6. Notification-Targets

- Error-Workflow MUSS jemanden alarmieren (Slack, Mail, Pager)
- Stille Fehler = unentdeckte Datenintegritäts-Probleme

## Output

Tabelle: Knoten | Issue-Typ | Schwere | Fix-Vorschlag.

Bei `prod-*`-Workflow ohne Error-Workflow oder ohne Retry auf kritischen Knoten: STOPP-Empfehlung vor Deploy.
