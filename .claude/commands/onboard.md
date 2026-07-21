---
description: Onboarding-Wizard fuer ein neues n8n-Projekt. 8 Phasen. PFLICHT vor /deploy-workflow.
argument-hint: "[optionale Kurzbeschreibung des Projekts]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, WebFetch
---

# /onboard

Fuehrt durch 8 Phasen, an deren Ende ein vollstaendig konfiguriertes n8n-Projekt mit `.template-version.json`-Stempel, gewaehltem Staging-Profil, GitHub-Remote, Credentials-Plan und PRD-Skeleton steht.

**Argument (optional):** Kurzbeschreibung des Projekts (eine Zeile). Wenn weggelassen, fragt Phase 0 nach.

## Vorbedingungen

- Repo aus `Wagner-Emden-IT-Services/n8n-project-template` via "Use this template" oder `gh repo create --template ...` erzeugt.
- Working Directory = Repo-Root.
- `gh` CLI authentifiziert (`gh auth status`) — falls nicht: Phase 2 skipped GitHub-Schritte mit Warnung.
- Node.js 20+ installiert (`node --version`) — sonst Abort.

## Verhalten

- **Re-run-sicher:** Wenn `.template-version.json` mit `installed_at` existiert, fragt der Wizard zuerst, ob er die bestehende Konfiguration neu durchlaufen soll (Backup nach `.template-backup/<ts>/` vor Reset).
- **Idempotenz:** Jede Phase prueft, ob ihre Files schon vorhanden sind. Wenn ja: User entscheidet "ueberspringen | Backup+ueberschreiben".
- **Abbruch-sicher:** Phase 6 schreibt erst, nachdem User die Plan-Anzeige bestaetigt hat. Vor Phase 6 sind alle gesammelten Werte nur in Memory + `docs/ONBOARD_LOG.md` (append-only Log).
- **Sprache:** Wizard-Fragen + Abschluss-Anzeige in Deutsch. Generierte Files (CLAUDE.md, README.md, .env.example, Slash-Commands) bleiben ASCII.

## Phasen

### Phase 0 — Project Identity

Fragen via AskUserQuestion (einzeln, nicht batched):

1. Projekt-Typ: Kunde / interner Use-Case
2. Bei Kunde: `customer_slug` (Regex `^[a-z0-9](-[a-z0-9]+)*$`, max 30 Zeichen)
3. `project_slug` (gleiche Regex)
4. Kurzbeschreibung — wenn Argument nicht uebergeben wurde
5. Verantwortliche Person/Team (Name + Rolle) — E-Mail/Telefon **nur** in `.claude/customer.json` ablegen, nicht in PRD/CLAUDE.md
6. Zielsysteme/APIs — Multi-Select aus festen Optionen (M365 / Google Workspace / Slack / Stripe / OpenAI/Anthropic / HubSpot / Salesforce / Azure / Eigene REST-API), Free-Text fuer weitere

Validierung:
- Slugs gegen Regex; bei Verletzung erneut fragen.
- Repo-Name vorbelegen mit `cc-project-{customer_slug}-{project_slug}` (bzw. `cc-project-internal-{project_slug}`).

Files schreiben (in Memory bis Phase 6):
- `.claude/customer.json` (gitignored) — vollstaendige Identitaet inkl. Kontaktdaten
- Eintrag in `.template-version.json.customer_slug` / `.project_slug`
- `docs/ONBOARD_LOG.md` Sektion "Phase 0 — Project Identity" mit Zeitstempel und gewaehlten Werten (ohne Kontaktdaten)

Gate: Zusammenfassung anzeigen, Bestaetigung holen.

### Phase 1 — Staging-Auswahl

AskUserQuestion mit 4 Optionen:

| Option | Beschreibung | Branches | Instanzen | CI-Workflows |
|--------|--------------|----------|-----------|--------------|
| **A — Kein Staging** | Single-Env-Setup, lokal entwickeln, direkt nach Prod deployen | `main` | nur Prod | `validate-on-pr.yml` + `drift-check.yml` |
| **B — Simple** | Lokales Dev + eine Prod-Instanz | `feature/*` -> `main` | Dev (lokal) + Prod | wie A + `deploy-prod.yml` |
| **C — Full (Empfohlen)** | Lokales Dev + Staging-Instanz + Prod-Instanz, Branch-promotion | `feature/*` -> `staging` -> `main` | Dev (lokal) + Staging + Prod | A + `deploy-staging.yml` + `deploy-prod.yml` |
| **D — Custom** | User definiert eigene Envs als Free-Text-Liste | User-Wahl | User-Wahl | Stub mit TODO-Marker |

Defaults:
- Bei Customer-Projekt (Phase 0.1 = Kunde) -> C empfehlen
- Bei interner Spielerei -> A oder B empfehlen
- User entscheidet final

Files generieren (Memory):
- `config/env-mapping.yaml` aus `config/staging-profiles/{none,simple,full,custom}.yaml`, Project-Slug substituiert
- `.env` aus angepasstem `.env.example` (siehe Phase 3 fuer URLs/Tokens)
- Workflow-Files-Plan: welche `.github/workflows/*.yml` bleiben/werden gerendert aus `.github/workflow-templates/`

Spezifik je Profil:
- A: `deploy-*.yml` werden in Phase 6 nicht angelegt
- B: nur `deploy-prod.yml` (gerendert aus Template, ohne `staging`-Job)
- C: Standard-Layout (deploy-staging + deploy-prod), so wie heute im Template
- D: pro Env ein Stub mit TODO-Marker, User muss nachbessern

`staging_profile` in `.template-version.json` festhalten.

Gate: Profil bestaetigen.

### Phase 2 — GitHub-Integration

Vorbedingung: `gh auth status` erfolgreich. Sonst alle Schritte skippen + Warnung in `docs/ONBOARD_LOG.md`.

AskUserQuestion-Block (sequenziell):

1. Repo neu anlegen oder existierendes verwenden?
   - Neu (Default): Repo-Name vorbelegt aus Phase 0
   - Existierend: Pfad / URL erfragen
2. Sichtbarkeit: **private (Default)** / public
3. Branch-Strategie (Default abhaengig von Phase 1):
   - A -> Trunk-only (`main`)
   - B -> Trunk + Feature-Branches (`feature/*` -> `main`)
   - C -> Three-Track (`feature/*` -> `staging` -> `main`)
   - D -> User-Wahl
4. Branch-Protection: **ja (Default)** mit `required_approving_review_count = 1`, `allow_force_pushes = false`, `allow_deletions = false`. Bei Solo-Account-Erkennung Warnung wie in `.claude/rules/template-sync.md` beschrieben — Setup laeuft trotzdem weiter.
5. PR-/Issue-Templates ausrollen: **ja (Default)** — kopiert `.github/PULL_REQUEST_TEMPLATE.md` + `.github/ISSUE_TEMPLATE/*` ins Repo
6. CI/CD: ja (Default), kommt automatisch durch Phase 1
7. CODEOWNERS-Datei: nein (Default), nur fragen wenn Phase 0 mehrere Verantwortliche nannte

Files schreiben (Memory):
- `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/{bug,feature}.md` (aus Template-Stubs)
- Optional `.github/CODEOWNERS`
- `.github/branch-protection.json` (Audit-Trail, was der Wizard setzen will)

**context7-Einsatz hier (falls verfuegbar):** Vor dem Schreiben der `.github/workflows/*.yml` einmal `mcp__context7__query-docs` fuer `actions/checkout` und `actions/setup-node` aufrufen, um aktuelle Major-Versionen zu pinnen. Bei context7 nicht verfuegbar: Fallback auf hardcoded `@v4`/`@v5` aus den Workflow-Templates.

Gate: GitHub-Setup-Plan bestaetigen. Repo-Anlage + Push passieren erst in Phase 6.

### Phase 3 — n8n-Hosting / Instanz

AskUserQuestion:

1. Hosting-Variante:
   - n8n Cloud (`https://*.app.n8n.cloud`)
   - Self-hosted Docker (eigener Host)
   - Self-hosted Kubernetes
   - n8n Desktop / Embed (lokale Dev)
2. Pro Env aus Phase 1: Base-URL + API-Key (in `.env`). API-Key kann leer bleiben — Wizard markiert dann den Slot mit `TODO: aus n8n UI > Settings > API`.
3. Docker-Compose im Repo (nur bei Self-hosted Docker, Default ja) -> generiert `docker-compose.dev.yml`
4. Reverse-Proxy/SSL bereits vorhanden (Default ja) -> kein Auto-Setup
5. Worker-Mode/Queue-Mode (Default nein)

Files schreiben (Memory):
- `.env` mit Hosts/Keys pro Env
- `.env.example` (committed) mit gleichen Keys, Werte = Platzhalter
- Optional `docker-compose.dev.yml`
- `docs/integrations/n8n-hosting.md` — generierte Doku der Instanz-URLs (KEINE API-Keys, nur URLs)

`hosting` in `.template-version.json` festhalten.

Gate: optionaler Smoke-Test `node scripts/n8n-cli.mjs --help` + `npm run list` gegen Dev-Instanz (wenn Dev-Key gesetzt). Schlaegt fehl -> User-Frage "Skip / Korrigieren". Erfolg -> `options.smoke_test_passed = true`.

### Phase 4 — Credentials / Secrets

AskUserQuestion:

1. Secret-Strategie:
   - `.env` lokal (Default fuer Solo)
   - GitHub Encrypted Secrets (fuer Actions)
   - Vault (HashiCorp / Doppler / 1Password)
   - Eigene Strategie (Free-Text)
2. Pro Zielsystem aus Phase 0.6 ein Block:
   - Credential in n8n vorhanden? (ja / wird angelegt / unklar)
   - Welche Scopes / Permissions sind noetig?
3. `config/secrets-vault-map.json` befuellen — Mapping-Doku **ohne Werte**, nur welcher Slot wofuer
4. gitleaks-Custom-Rules aktiv lassen (Default ja)

**context7-Einsatz hier (falls verfuegbar und pro Service):** Bei jedem in Phase 0.6 gewaehlten Service einmal `mcp__context7__query-docs` mit der Frage nach aktuellen OAuth-Scopes / API-Key-Setup. Ergebnis wandert in `docs/integrations/credentials-setup.md`. Bei context7 nicht verfuegbar: generischer Hinweis-Block, der den User auf die offizielle Service-Doku verweist.

Files schreiben (Memory):
- `config/secrets-vault-map.json` (committed, ohne Werte)
- `.env.example` Service-Bloecke ergaenzen
- `.github/secrets-required.md` — Liste der GitHub-Repo-Secrets, die der User manuell setzen muss
- `docs/integrations/credentials-setup.md` — pro Service Setup-Schritte (context7-informiert wo verfuegbar)

Gate: Liste fehlender Secrets anzeigen. "Jetzt setzen / spaeter nachholen".

### Phase 5 — Optionen

AskUserQuestion (jeweils ja/nein, Defaults wie unten):

1. Beispiel-Workflow `hello-world` installieren (Default ja)
2. Multi-Agent-Pipeline aktivieren (Default ja bei Customer-Projekt, sonst nein)
3. M365-Pattern-Library einbinden (Default ja, wenn M365 in Phase 0.6 gewaehlt — sonst nein)
4. Nightly Backup + Drift-Check via Cron (Default ja bei Phase 1 = C, sonst nein)
5. Health-Check-Workflow im Repo (Default nein)
6. Logging-Level: minimal / standard (Default) / verbose

Files schreiben (Memory):
- `workflows/hello-world.json` kopieren oder loeschen
- `.claude/rules/skills-context.md` passt zu Phase 5 Auswahl
- `.github/workflows/drift-check.yml` Cron passt (default `0 3 * * *` nightly)
- Optional `docs/integrations/m365/` behalten oder entfernen
- `options.*` in `.template-version.json` festhalten

### Phase 6 — Erzeugung + Bootstrap

Plan-Anzeige (Read-only) aller zu erzeugenden / aendernden / loeschenden Files mit `+` / `~` / `-`-Markern. Beispiel:

```
ZU ERZEUGEN / AENDERN / LOESCHEN
================================
+ .env (gitignored)
+ .claude/customer.json (gitignored, DSGVO)
+ .template-version.json (v0.5.0, customer=engel, project=voice-rezeptionist, staging_profile=simple)
+ config/env-mapping.yaml (simple-Profil, slug=voice-rezeptionist)
+ config/secrets-vault-map.json
+ docs/integrations/credentials-setup.md
+ docs/integrations/n8n-hosting.md
+ docs/PRD.md (Status: NOT_STARTED, aus PRD.template.md)
~ CLAUDE.md (Project-Identity-Block angereichert)
~ README.md (Customer-Slug + Project-Slug)
- .github/workflows/deploy-staging.yml (Phase 1 = simple -> nicht benoetigt)
```

AskUserQuestion: "Plan ausfuehren?" (ja / abbrechen).

Bei ja:
1. Alle Files schreiben
2. `npm install`
3. `git init` (falls neu) oder Remote anlegen (`gh repo create`)
4. Initial-Commit: `feat: project initialized via n8n-project-template v0.5.0`
5. Push zum Remote
6. Branch-Protection setzen (Solo-User-Warnung wenn API failt)
7. `.template-version.json.target_repo` mit der finalen URL befuellen
8. `docs/ONBOARD_LOG.md` Sektion "Phase 6 — Erzeugung" finalisieren

### Phase 7 — Verpflichtender PRD-Schritt

AskUserQuestion: "Setup steht. Bevor du Workflows baust, brauchst du ein PRD (Pflicht). Jetzt generieren?"

- **Ja** -> ruft `/prd-generate` direkt auf: erzeugt `docs/PRD.md` via 3-Phasen-Interview (Status DRAFT). Nach Owner-Review `Status: APPROVED` setzen — sonst greift der Hard-Gate `prd-required` beim ersten Workflow-Build.
- **Spaeter** -> schreibt `docs/PRD.md` mit `Status: NOT_STARTED` und vermerkt im Onboard-Log einen Reminder

Abschluss-Anzeige (analog golden-dev):

```
n8n-PROJEKT INITIALISIERT
==========================
Slug:           engel/voice-rezeptionist
Staging-Profil: simple (feature/* -> main, ein Prod-Env)
Hosting:        n8n-cloud
Services:       Microsoft 365, Anthropic Claude
Repo:           https://github.com/Wagner-Emden-IT-Services/cc-project-engel-voice-rezeptionist
Branch-Prot:    aktiv (1 Reviewer required)

Naechste Schritte:
  1. PRD finalisieren:    docs/PRD.md
  2. Workflow planen:     /requirements oder docs/specs/WF-1.md
  3. Workflow bauen:      n8n MCP + .claude/skills/
  4. Deployen:            /deploy-workflow (erst nach Schema-Check + PRD APPROVED)
```

## Fehlerbehandlung

- **`gh` fehlt** -> Phase 2 GitHub-Schritte ueberspringen, Hinweis in ONBOARD_LOG, Onboard laeuft trotzdem zu Ende
- **n8n-Instanz nicht erreichbar in Phase 3** -> Smoke-Test schlaegt fehl, `options.smoke_test_passed=false`, Onboard laeuft weiter
- **context7 nicht verfuegbar** -> alle context7-Calls skippen, Fallback-Dokus schreiben, Hinweis im ONBOARD_LOG
- **Branch-Protection-API failt (Solo-User-Edge-Case)** -> WARN ausgeben, Repo bleibt ohne Protection, Onboard laeuft weiter
- **`.template-version.json` existiert schon** -> Wizard fragt am Anfang: "Bestehendes Setup neu durchlaufen? Backup nach .template-backup/<ts>/"
- **gitleaks fehlt auf Windows** -> Phase 6 markiert Pre-Commit-Hook als "manuelle Nacharbeit" und schreibt Hinweis in ONBOARD_LOG

## Output

- `.template-version.json` mit vollstaendigem Stempel
- `.claude/customer.json` (gitignored)
- `docs/ONBOARD_LOG.md` mit allen Phasen + Zeitstempeln
- `docs/PRD.md` (Status: NOT_STARTED)
- `config/env-mapping.yaml` aus gewaehltem Profil
- `config/secrets-vault-map.json`
- `docs/integrations/credentials-setup.md`
- Optional `docs/integrations/n8n-hosting.md`, `docker-compose.dev.yml`, GitHub-Templates
- Aktualisierte CLAUDE.md / README.md / .env.example / .gitignore
