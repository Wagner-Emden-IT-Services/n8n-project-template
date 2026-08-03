---
description: Onboarding-Wizard fuer ein neues n8n-Projekt. 8 Phasen. PFLICHT vor /deploy-workflow.
argument-hint: "[--into-existing] [optionale Kurzbeschreibung des Projekts]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, WebFetch
---

# /onboard

Fuehrt durch 8 Phasen, an deren Ende ein vollstaendig konfiguriertes n8n-Projekt mit `.template-version.json`-Stempel, gewaehltem Staging-Profil, GitHub-Remote, Credentials-Plan und PRD-Skeleton steht.

**Argumente (optional):**
- `--into-existing` — erzwingt den In-place-Modus (Template-Installation in ein bestehendes, nicht-leeres Projektverzeichnis, siehe Abschnitt "In-place-Modus").
- Kurzbeschreibung des Projekts (eine Zeile). Wenn weggelassen, fragt Phase 0 nach.

## Vorbedingungen

- Repo aus `Wagner-Emden-IT-Services/n8n-project-template` via "Use this template" oder `gh repo create --template ...` erzeugt. **Entfaellt im In-place-Modus** — dort ist das Working Directory ein bestehendes Projektverzeichnis ohne Template-Klon.
- Working Directory = Repo-Root.
- `gh` CLI authentifiziert (`gh auth status`) — falls nicht: Phase 2 skipped GitHub-Schritte mit Warnung.
- Node.js 20+ installiert (`node --version`) — sonst Abort.

## Verhalten

- **Modus-Erkennung (vor Phase 0):** Ist das Working Directory nicht leer und KEIN Template-Klon (Marker: `.template-version.json` und `scripts/n8n-cli.mjs` fehlen beide), bietet der Wizard via AskUserQuestion den In-place-Modus an ("In bestehendes Projekt installieren / Abbrechen"). Expliziter Aufruf `/onboard --into-existing` erzwingt den Modus ohne Rueckfrage. Details: Abschnitt "In-place-Modus".
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
- `.claude/settings.local.json` — `env`-Block mit den `N8N_ACTIVE_*`-Werten aus `.env` (`N8N_ACTIVE_BASE_URL`, `N8N_ACTIVE_API_URL`, `N8N_ACTIVE_API_KEY`, `N8N_ACTIVE_MCP_URL`, `N8N_ACTIVE_MCP_TOKEN`, `N8N_ACTIVE_ENV`). Existiert die Datei schon: JSON-Merge — bestehende Keys ausserhalb `env` bleiben unangetastet, `env`-Keys werden ergaenzt/aktualisiert. Die Datei ist von Claude Code auto-gitignored.
- `.env.example` (committed) mit gleichen Keys, Werte = Platzhalter
- Optional `docker-compose.dev.yml`
- `docs/integrations/n8n-hosting.md` — generierte Doku der Instanz-URLs (KEINE API-Keys, nur URLs)

**Warum `.env` UND `.claude/settings.local.json`?** Claude Code laedt die Projekt-`.env` NICHT fuer die `${VAR}`-Expansion in `.mcp.json` — die Expansion zieht nur aus der Shell-Umgebung und den `env`-Bloecken der Settings-Dateien. `.env` versorgt ausschliesslich die Node-CLI (dotenv). Ohne den `env`-Block starten die MCP-Server mit dem Literal-Text `${VAR}` (Fehlerbild: `'url' is not a valid URL` beim http-Server bzw. stiller Teilausfall des stdio-Servers). Bei spaeterer Key-Rotation: `.env` aendern, dann `node scripts/n8n-cli.mjs env-sync` ausfuehren (regeneriert den `env`-Block aus `.env`) und Claude Code neu starten.

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
7. Knowledge-Graph (graphify) aktivieren (Default ja) — lokaler tree-sitter-AST-Graph
   ueber den Code-Anteil des Projekts (scripts/, tests/, hooks/; KEINE workflows/*.json,
   siehe `.graphifyignore`). Installation erfolgt in Phase 6 (Schritte 2b/2c), best-effort.

Files schreiben (Memory):
- `workflows/hello-world.json` kopieren oder loeschen
- `.claude/rules/skills-context.md` passt zu Phase 5 Auswahl
- `.github/workflows/drift-check.yml` Cron passt (default `0 3 * * *` nightly)
- Optional `docs/integrations/m365/` behalten oder entfernen
- Bei Option 7 = nein: `.graphifyignore` bleibt liegen (harmlos), Phase 6 Schritte 2b/2c
  werden uebersprungen
- `options.*` in `.template-version.json` festhalten (inkl. `options.graphify`)

### Phase 6 — Erzeugung + Bootstrap

Plan-Anzeige (Read-only) aller zu erzeugenden / aendernden / loeschenden Files mit `+` / `~` / `-`-Markern. Beispiel:

```
ZU ERZEUGEN / AENDERN / LOESCHEN
================================
+ .env (gitignored)
+ .claude/settings.local.json (env-Block N8N_ACTIVE_*, auto-gitignored)
+ .claude/customer.json (gitignored, DSGVO)
+ .template-version.json (version = aktuelle Template-Version, customer=engel, project=voice-rezeptionist, staging_profile=simple)
+ config/env-mapping.yaml (simple-Profil, slug=voice-rezeptionist)
+ config/secrets-vault-map.json
+ docs/integrations/credentials-setup.md
+ docs/integrations/n8n-hosting.md
+ docs/PRD.md (Status: NOT_STARTED, aus PRD.template.md)
+ .claude/skills/graphify/ (Option 7, via graphify install --project in Schritt 2c)
+ graphify-out/ (Option 7, Erst-Build in Schritt 2c — committed)
~ CLAUDE.md (Project-Identity-Block angereichert)
~ README.md (Customer-Slug + Project-Slug)
- .github/workflows/deploy-staging.yml (Phase 1 = simple -> nicht benoetigt)
```

**`.template-version.json`-Stempel (Schema 1.2):** Neben den in Phase 0-5 gesammelten Feldern (`customer_slug`, `project_slug`, `staging_profile`, `hosting`, `options.*`) setzt Phase 6 zusaetzlich:

- `installed_via: "onboard"` (im In-place-Modus: `"onboard-into-existing"`)
- `manifest_path: ".n8n-template/manifest.json"`
- `last_update_at: null` (wird von /template-update gepflegt)
- `last_update_from_version: null` (wird von /template-update gepflegt)

AskUserQuestion: "Plan ausfuehren?" (ja / abbrechen).

Bei ja:
1. Alle Files schreiben
2. `npm install`
2b. **graphify installieren (nur bei `options.graphify=true`, best-effort):**
    `uv tool install --upgrade "graphifyy[sql]"` (Fallback: pipx, dann pip). Schlaegt die
    Installation fehl (kein Python/uv): WARN + ONBOARD_LOG-Eintrag, Wizard laeuft weiter —
    NIEMALS das Onboarding blockieren.
2c. **graphify einrichten (nur wenn 2b erfolgreich):**
    `graphify install --project` (projekt-lokaler Skill) -> `graphify update .` (Erst-Build,
    Scope via `.graphifyignore`) -> `graphify hook install` (Post-Commit-Auto-Rebuild).
    Danach pruefen, ob der Installer CLAUDE.md oder `.claude/settings.json` mutiert hat —
    falls ja: `git checkout -- CLAUDE.md .claude/settings.json` (das Template liefert
    Directive-Block + Preflight-Hook selbst; wir wollen nur den Skill + graphify-out/).
    Ergebnis: `graphify-out/` geht mit in den Initial-Commit (Schritt 4).
3. `git init` (falls neu) oder Remote anlegen (`gh repo create`)
4. Initial-Commit: `feat: project initialized via n8n-project-template v<version>`
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

## In-place-Modus (`/onboard --into-existing`)

Installiert das Template nachtraeglich in ein bestehendes, nicht-leeres Projektverzeichnis — ein Projekt, ein Ort, eine Claude-Session — statt einen separaten Template-Klon zu erzwingen.

### Aktivierung

1. **Auto-Detection:** Modus-Erkennung vor Phase 0 (siehe "Verhalten") erkennt "Verzeichnis nicht leer und kein Template-Klon" und bietet den Modus an.
2. **Expliziter Aufruf:** `/onboard --into-existing` erzwingt den Modus ohne Rueckfrage.

### Ablauf

1. **Inventar:** Template-Payload (aus `Wagner-Emden-IT-Services/n8n-project-template`, aktuelle Version) gegen die Bestandsdateien matchen. Ergebnis: Liste "neu / identisch / Kollision".
2. **Kollisions-Report VOR jedem Schreiben:** Plan-Anzeige im Phase-6-Muster (`+` / `~` / `-`), Kollisionen zusaetzlich mit `!`-Marker. Pro Kollision Strategie aus dem Katalog unten waehlbar (Default = Standard-Strategie). Ohne Bestaetigung wird nichts geschrieben.
3. Danach laufen die Phasen 0-7 normal weiter (Abweichungen siehe unten).

### Kollisions-Katalog (5 Strategien, real erprobt 2026-07-31)

| # | Kollision | Standard-Strategie |
|---|-----------|--------------------|
| 1 | Bestehende Projekt-`CLAUDE.md` vs. Template-`CLAUDE.md` | Bestehenden Inhalt nach `docs/PROJECT_CONTEXT.md` verschieben (ist als USER-GENERATED/Protected vorgesehen) + `@docs/PROJECT_CONTEXT.md`-Import am Kopf der Template-CLAUDE.md — beide Kontexte laden, Template-Updates bleiben diffbar |
| 2 | Bestehendes `docs/` | Merge; Namenskonflikt-Check pro Datei. Bei Namenskonflikt: **STOPP + Einzelentscheidung** durch den User, kein Auto-Overwrite |
| 3 | Bestehende `.claude/settings.json` (z.B. `enabledPlugins`) | JSON-Merge statt Ueberschreiben — bestehende Keys bleiben erhalten, Template-Keys werden ergaenzt |
| 4 | Bestehende `.mcp.json` mit Klartext-Secrets | Werte nach `.env` migrieren (+ `env`-Block in `.claude/settings.local.json`, siehe Phase 3), variablenbasierte Template-`.mcp.json` uebernehmen. **Secret-Gate:** NUR nach expliziter Plan-Anzeige + User-Bestaetigung pro Datei — der Wizard fasst Secrets nie ungefragt an. Nebeneffekt: verhindert den gitleaks-Blocker beim ersten Commit |
| 5 | Bestandsdateien, die nicht ins (Kunden-)Remote duerfen (interne Kalkulationen etc.) | Wizard-Frage "Git-Scope fuer Bestandsdateien" -> `.gitignore`-Eintraege generieren |

### Abweichungen in den Phasen

Die uebrigen Phasen (Staging, GitHub, Hosting, Credentials, Optionen, PRD) laufen nach dem Kollisions-Report normal weiter. Unterschiede im In-place-Fall:

- **Phase 2:** Ist das Verzeichnis bereits ein Git-Repo mit Remote, Default = "existierendes Repo verwenden" (kein `gh repo create`).
- **Phase 6:** Plan-Anzeige enthaelt zusaetzlich den Kollisions-Report mit den gewaehlten Strategien. `git init` nur, falls noch kein Git-Repo existiert. `.template-version.json` erhaelt `installed_via: "onboard-into-existing"`.
- **ONBOARD_LOG:** `docs/ONBOARD_LOG.md` bekommt eine Sektion "In-place-Installation" mit Inventar-Ergebnis, Kollisions-Report und **jeder getroffenen Einzelentscheidung** (Audit-Trail — insbesondere die Secret-Gate-Bestaetigungen aus Strategie 4).

## Fehlerbehandlung

- **`gh` fehlt** -> Phase 2 GitHub-Schritte ueberspringen, Hinweis in ONBOARD_LOG, Onboard laeuft trotzdem zu Ende
- **n8n-Instanz nicht erreichbar in Phase 3** -> Smoke-Test schlaegt fehl, `options.smoke_test_passed=false`, Onboard laeuft weiter
- **context7 nicht verfuegbar** -> alle context7-Calls skippen, Fallback-Dokus schreiben, Hinweis im ONBOARD_LOG
- **Branch-Protection-API failt (Solo-User-Edge-Case)** -> WARN ausgeben, Repo bleibt ohne Protection, Onboard laeuft weiter
- **`.template-version.json` existiert schon** -> Wizard fragt am Anfang: "Bestehendes Setup neu durchlaufen? Backup nach .template-backup/<ts>/"
- **gitleaks fehlt auf Windows** -> Phase 6 markiert Pre-Commit-Hook als "manuelle Nacharbeit" und schreibt Hinweis in ONBOARD_LOG
- **graphify-Installation schlaegt fehl (kein Python/uv/pipx)** -> Schritte 2b/2c ueberspringen, `options.graphify=false` zuruecksetzen, Hinweis in ONBOARD_LOG ("manuelle Nachinstallation: siehe CLAUDE.md Sektion Graphify"), Onboard laeuft weiter
- **Namenskonflikt in `docs/` im In-place-Modus** -> STOPP, Einzelentscheidung pro Datei (behalten / Template-Version / umbenennen), Entscheidung in ONBOARD_LOG dokumentieren

## Output

- `.template-version.json` mit vollstaendigem Stempel (Schema 1.2, `installed_via: "onboard"` bzw. `"onboard-into-existing"`)
- `.claude/customer.json` (gitignored)
- `.claude/settings.local.json` mit `env`-Block der `N8N_ACTIVE_*`-Werte (auto-gitignored)
- `docs/ONBOARD_LOG.md` mit allen Phasen + Zeitstempeln
- `docs/PRD.md` (Status: NOT_STARTED)
- `config/env-mapping.yaml` aus gewaehltem Profil
- `config/secrets-vault-map.json`
- `docs/integrations/credentials-setup.md`
- Optional `docs/integrations/n8n-hosting.md`, `docker-compose.dev.yml`, GitHub-Templates
- Bei `options.graphify=true`: `.claude/skills/graphify/` + committed `graphify-out/` (Erst-Build)
- Aktualisierte CLAUDE.md / README.md / .env.example / .gitignore
