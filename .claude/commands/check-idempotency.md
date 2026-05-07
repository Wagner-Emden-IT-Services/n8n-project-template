---
description: Prüft Workflow auf Idempotenz — INSERT ohne UPSERT, POST ohne Dedup-Key, fehlende Checkpoints.
allowed-tools: Read, Bash, Grep
---

# /check-idempotency

Prüft ob der Workflow bei Re-Run sicher ist.

**Argument:** Pfad zur Workflow-JSON

## Was wird geprüft

### 1. Datenbank-Inserts

- Suche nach SQL-Strings mit `INSERT INTO`
- Wenn vorhanden: muss `ON CONFLICT DO UPDATE` (PostgreSQL/SQLite) oder `INSERT ... ON DUPLICATE KEY UPDATE` (MySQL) oder UPSERT-Syntax enthalten
- Bei n8n-DB-Knoten: prüfe `operation: "upsert"` statt `"insert"`

### 2. HTTP-POST-Calls

- POST-Aufrufe an externe APIs ohne Dedup-Key sind verdächtig
- Prüfe Header auf `Idempotency-Key` (Stripe, Shopify, ...)
- Prüfe Body auf eindeutige Client-Reference-IDs

### 3. Workflow-State (Checkpoints)

- Lange Sync-Workflows: `last_modified` / `last_synced_at` muss persistiert werden (DataTable, externe DB, n8n-Static-Data)
- Bei Re-Run nach Crash sollte ab dem letzten Checkpoint weitergehen können

### 4. Email/Notification-Sends

- POST an Slack/Mail ohne Dedup → bei Re-Run werden doppelte Nachrichten verschickt
- Vorschlag: Hash über Content + Recipient als Dedup-Schlüssel, persistieren

## Output

Tabelle: Knoten-Name | Operation | Idempotenz-Risiko | Vorschlag.

Bei kritischen Funden (Money-Movement, irreversible API-Calls): klare Warnung.
