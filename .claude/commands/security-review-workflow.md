---
description: Security-Audit eines n8n-Workflows — Credentials, Webhook, Rate-Limits, Logging-Hygiene, Repo-Hygiene
allowed-tools: Read, Grep, Glob, Bash(node:*)
argument-hint: "[workflow.json]"
---

Security-Review eines n8n-Workflows. Wenn ein Pfad uebergeben wurde,
fokussiert auf diese Datei. Sonst alle Workflows unter `workflows/` pruefen.

## Vorgehen

1. **Workflow-JSON lesen**
   - Bei Argument: Read $ARGUMENTS
   - Sonst: Glob `workflows/**/*.json`, dann reihum

2. **Credentials**
   - [ ] Alle `credentials`-Referenzen verweisen auf Credential-Store-IDs (Format `{ name, id }`), keine Plaintext-Secrets im JSON.
   - [ ] Keine API-Keys, Bearer-Tokens, Passwords, Encryption-Keys im JSON-Body (Grep auf `key`, `token`, `secret`, `password` mit Werten).
   - [ ] Credential-Typen sind dokumentiert in `credentials/secrets-vault-map.yaml.example` (Vault-Pfade, keine Werte).
   - [ ] Bash: `node scripts/n8n-cli.mjs validate <file>` laeuft sauber — schemas verlangen credential-by-name, nicht inline.

3. **Permissions / Scopes (bei OAuth-Credentials)**
   - [ ] Least Privilege: keine `*.All`-Scopes, wenn ein spezifischer Scope reicht.
   - [ ] Bei M365: Delegated vs App-Only korrekt? — Verweis: `docs/integrations/m365/auth-patterns.md`.
   - [ ] Keine Admin-Rechte wo User-Rechte reichen.

4. **Webhook-Trigger**
   - [ ] `path` ist nicht trivial / leicht zu erraten.
   - [ ] `httpMethod` auf das Notwendige beschraenkt (kein wildcard).
   - [ ] Authentication-Setting NICHT auf `none` (oder mindestens Webhook-URL als Geheimnis behandelt + Rate-Limit auf Reverse-Proxy).
   - [ ] Input-Validierung im ersten Code-Node oder via JSON-Schema-Node.

5. **Rate-Limits / Retries**
   - [ ] HTTP-Request-Nodes haben `retryOnFail: true` mit `maxTries ≤ 5`.
   - [ ] Kein Endlos-Retry bei 429 — Backoff dokumentiert.
   - [ ] Bei Graph-API: Pagination via `@odata.nextLink` (siehe `docs/integrations/m365/error-handling.md`).

6. **Datenhandling / Logging-Hygiene**
   - [ ] Code-Nodes loggen keine PII (E-Mails, Namen, Telefon) auf Console.
   - [ ] Keine PII in Workflow-Notizen / `notes`-Feldern.
   - [ ] Output-Daten minimal — `$select` bei Graph-API, kein "alles weitergeben".
   - [ ] Error-Handler-Workflow loggt keine Secrets (`shared/error-handler.json` pruefen).

7. **Repo-Hygiene**
   - [ ] `node scripts/n8n-cli.mjs normalize --check <file>` ist sauber — keine `versionId`, `position`, `instanceId` leaks.
   - [ ] gitleaks-Pre-Commit-Hook ist installiert (`.git/hooks/pre-commit` zeigt auf `hooks/pre-commit`).
   - [ ] `.gitleaks.toml`-Custom-Rules sind vorhanden (5 erwartet: n8n-encryption-key, n8n-api-key, slack-webhook, bearer-token, jwt).
   - [ ] Bash: `gitleaks detect --source <file>` (oder ueber `.gitleaks.toml`-Default) ist sauber.

8. **Bericht**
   - Pro Pruefpunkt: ✓ / ✗ / NA mit kurzer Begruendung
   - Bei ✗: konkrete Empfehlung mit Pfad/Zeile/Node-Name
   - Severity-Bewertung der Findings: Critical / High / Medium / Low
   - Gesamt-Verdikt: APPROVED | NEEDS CHANGES

## Output-Format

```markdown
## Security Review: <workflow-file>
**Datum:** YYYY-MM-DD
**Status:** APPROVED | NEEDS CHANGES

### Checkliste
- [✓] Credentials per Reference
- [✓] Least Privilege Scopes
- [✗] Webhook ohne Auth — siehe Finding #1
- ...

### Findings
| # | Severity | Pruefpunkt | Finding | Empfehlung |
|---|----------|-----------|---------|------------|
| 1 | High | Webhook | path=/test1, kein Auth | Webhook-URL als Secret oder Auth-Setting=basicAuth |
```

## Constraints
- Nur lesen, nichts modifizieren
- Credential-WERTE niemals lesen oder ausgeben — nur Typ, Scope, Nutzung
- Bei Unklarheit: nicht raten, sondern als ⚠️ NEEDS REVIEW markieren
