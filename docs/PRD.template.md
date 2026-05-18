---
status: NOT_STARTED
created: {{INSTALLED_AT}}
template_version: 0.5.0
---

# Product Requirements Document — {{PROJECT_SLUG}}

> Pflicht-Dokument auf Projekt-Ebene. Wird ab `n8n-project-template v1.0.0`
> via `/prd-generate` halbautomatisch erzeugt (basierend auf
> `skill-community-n8n-prd-generator`). Bis dahin manuell ausfuellen.
>
> Status-Werte: NOT_STARTED -> DRAFT -> APPROVED. Hard-Gate fuer Workflow-Build
> ab v1.0.0: `Status: APPROVED` erforderlich, und es duerfen keine `{{`-Placeholder
> mehr im Dokument stehen.
>
> Pro Workflow zusaetzlich eine WF-X-Spec in `docs/specs/` anlegen (Pflicht ab
> 3+ Nodes oder Webhook/Schedule-Trigger). PRD = Projekt-Ebene, WF-X = pro
> Workflow.

**Status:** NOT_STARTED

## 0. Projekt-Identitaet

> Wird automatisch aus `.template-version.json` und `.claude/customer.json`
> uebernommen. Kontaktdaten **nicht** ins PRD schreiben (DSGVO) — die liegen
> in `.claude/customer.json`.

- Customer-Slug: {{CUSTOMER_SLUG}}
- Project-Slug: {{PROJECT_SLUG}}
- Verantwortliche(r) (Rolle): {{OWNER_ROLE}}
- Beteiligte Zielsysteme: {{TARGET_SYSTEMS}}
- Staging-Profil: {{STAGING_PROFILE}}
- Hosting: {{HOSTING}}

## 1. Ziel und Kontext

- Geschaeftsziel:
- Aktuelle Schmerzpunkte ohne Automation:
- Stakeholder:
- Erfolgsmessung (qualitativ + quantitativ):

## 2. Trigger und Zeitplan

- Trigger-Typ(en): Webhook | Schedule | Manual | Sub-Workflow-Aufruf
- Beispiel-Payload(s):

  ```json
  { }
  ```

- Cron-Expression (falls Schedule):
- Erwartete Frequenz (Events pro Tag/Stunde):

## 3. Datenfluss

- Datenquellen (System + Endpoint + Auth):
- Datentransformationen (Schritt fuer Schritt):
- Datensenken (System + Endpoint + Auth):
- Daten-Persistenz (n8n-Workflow-Static-Data / externe DB / nirgendwo):

## 4. Beteiligte Services und Credentials

> n8n-Credential-Naming: `{Service} - {Environment}` (z.B. "Slack API - Production").
> Vault-Slot: Verweis auf `config/secrets-vault-map.json`.

| Service | Auth-Mechanik | n8n-Credential-Name | Vault-Slot | Scopes / Berechtigungen |
|---------|---------------|---------------------|------------|--------------------------|
|         |               |                     |            |                          |

## 5. Pro-Workflow-Architektur-Uebersicht

> Pro geplanter Workflow eine Zeile. Detail-Architektur kommt in die WF-X-Spec
> unter `docs/specs/`.

| WF-ID | Funktion | Trigger | Datenflus-Skizze | Status |
|-------|----------|---------|-------------------|--------|
| WF-1  |          |         |                   | Planned |

## 6. Error-Handling-Strategie

> Pflicht pro Workflow: Error-Workflow im n8n-Settings referenziert.

- Globaler Error-Workflow: `workflows/shared/error-handler.json` (Default)
- Inline-Error-Handling bei kritischen HTTP-Knoten: Retry mit Backoff (3 Versuche)
- Notification bei Fail: Slack | Mail | Both | None
- Error-Persistenz: n8n-Execution-History | externe DB | Log-File | None
- Personenbezogene Daten in Error-Messages: NIE (DSGVO)

## 7. Pitfalls (n8n-spezifisch)

> 7 Standard-Kategorien aus n8n-Best-Practices. Pro Kategorie pruefen und entscheiden.

- **Idempotency-Gates:** Wie wird Re-Run-Sicherheit garantiert?
  - INSERT mit ON CONFLICT DO UPDATE | POST mit Dedup-Key | Checkpoints (`last_modified`)
- **Error-Workflow trigger vs. inline:** Globaler Error-WF (Default) oder pro kritischem Node inline?
- **Retry mit Backoff:** Auf welchen Nodes? Welche Strategie?
- **Pagination-Handling:** `.all()` statt `.first()`, n8n-HTTP-Node Pagination-Container, kein SplitInBatches-Done-Trap
- **Webhook-Deduplication:** Webhook-Body Hash oder Idempotency-Header?
- **Rate-Limit-Handling:** `batching` Konfig pro Service, `X-RateLimit-Remaining`-Beobachtung
- **Partial-Success-Protokoll:** Was passiert bei Teilfehler im Batch?

## 8. Akzeptanzkriterien

> Konkret + testbar. Vor "Status: APPROVED" muss jedes Kriterium pruefbar sein.

- [ ]
- [ ]
- [ ]

## 9. Offene Fragen / Annahmen

- ?
- Annahme:

## 10. Workflow-Inventur

> Volle Liste der geplanten / aktiven Workflows. Erweiterung pro neuem
> Workflow erforderlich.

| WF-ID | Funktion | Trigger | Schedule | Owner | Status |
|-------|----------|---------|----------|-------|--------|
| WF-1  |          |         |          |       | Planned |

## 11. Deployment-Strategie

> Referenziert das Staging-Profil aus `.template-version.json`.

- Staging-Profil: {{STAGING_PROFILE}}
- Branch-Strategie: _(siehe ONBOARDING.md)_
- CI-Workflows aktiv: validate-on-pr | deploy-staging | deploy-prod | drift-check
- Backup-Strategie 3-Tier:
  - Git: Workflow-JSONs in Repo, Pre-Deploy-Backup als Artifact (90d Retention)
  - Object-Storage (optional): S3 / Google Drive — Konfiguration in `BACKUP_PATH`
  - n8n-DB-Snapshot: Verantwortung beim Hosting-Provider (n8n Cloud) oder Operator (self-hosted)
- Rollback-Pfad: `/deploy-workflow` mit `--auto-rollback` (verifiziert), Backup-Restore via REST-API

## 12. Disaster-Recovery-Bezug

> Verlinkt die DR-Runbook + Drill-Plan.

- DR-Runbook: [docs/disaster-recovery.md](disaster-recovery.md)
- DR-Szenarien (4): Workflow-Korruption, Instanz-Verlust, Encryption-Key-Verlust, Repo-Korruption
- Encryption-Key-Persistenz: _(wo wird der n8n-Encryption-Key gesichert? Pflicht: 3 Locations)_
- Drill-Frequenz: quartalsweise / halbjaehrlich / einmalig vor Go-Live

---

**Approval-Block** _(nach vollstaendigem Ausfuellen)_

- [ ] Alle `{{}}`-Placeholder ersetzt
- [ ] Akzeptanzkriterien (Section 8) konkret und testbar
- [ ] Workflow-Inventur (Section 10) vollstaendig
- [ ] DR-Bezug (Section 12) geklaert
- [ ] Owner-Approval: _(Datum, Name)_

Nach Approval: Status auf `APPROVED` setzen und alle WF-X-Specs anlegen.
