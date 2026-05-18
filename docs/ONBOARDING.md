# Onboarding

> User-Doku zum `/onboard`-Wizard. Wenn du das Template gerade frisch
> via "Use this template" auf GitHub geklont hast: hier weiterlesen.

## Was `/onboard` macht

`/onboard` ist ein 8-Phasen-Wizard, der ein frisch geklontes n8n-Projekt
in einen produktionsfaehigen Zustand bringt. Ergebnis:

- `.template-version.json` mit Customer-Slug, Project-Slug, Staging-Profil
- Konfigurierte `.env`, `config/env-mapping.yaml`, `config/secrets-vault-map.json`
- GitHub-Remote (optional) inkl. Branch-Protection, PR-/Issue-Templates
- CI/CD-Workflows passend zum gewaehlten Staging-Profil
- `docs/ONBOARD_LOG.md` mit nachvollziehbarem Audit-Trail
- `docs/PRD.md` Skeleton (Status: NOT_STARTED) als Pflicht-Schritt fuer
  spaetere `/prd-generate`-Generierung (ab v1.0.0)

## Voraussetzungen

- Repo aus `Wagner-Emden-IT-Services/n8n-project-template` via "Use this
  template" oder `gh repo create --template ...` erzeugt
- Working Directory ist Repo-Root
- Node.js 20+ installiert (`node --version`)
- `gh` CLI authentifiziert (`gh auth status`) — falls fehlt, ueberspringt
  Phase 2 alle GitHub-Schritte mit Warnung

## Ablauf

1. Claude Code im Repo starten: `claude`
2. `/onboard` aufrufen (optional mit Kurzbeschreibung: `/onboard Voice-Rezeptionist fuer Kunde X`)
3. Die 8 Phasen sequenziell beantworten — jede Phase hat ein Bestaetigungs-Gate
4. In Phase 6 wird ein vollstaendiger Plan angezeigt. Erst nach "Ja" werden Files geschrieben
5. In Phase 7 entweder direkt PRD generieren (ab v1.0.0) oder spaeter manuell befuellen

## Phasen-Uebersicht

| Phase | Zweck | Schreibt nach |
|-------|-------|---------------|
| 0 | Project Identity (Slugs, Verantwortliche, Zielsysteme) | `.claude/customer.json`, `.template-version.json`, ONBOARD_LOG |
| 1 | Staging-Auswahl (none / simple / full / custom) | `config/env-mapping.yaml`, `.template-version.json.staging_profile` |
| 2 | GitHub-Integration (Repo, Branch-Protection, Templates) | `.github/`, gh repo create |
| 3 | n8n-Hosting (Cloud / Docker / K8s / Desktop) | `.env`, `.env.example`, `docs/integrations/n8n-hosting.md` |
| 4 | Credentials + Secrets-Strategie | `config/secrets-vault-map.json`, `docs/integrations/credentials-setup.md`, `.github/secrets-required.md` |
| 5 | Optionen (hello-world, M365, Multi-Agent, Backup, Logging) | `workflows/`, `.template-version.json.options` |
| 6 | Plan-Anzeige + Erzeugung + Initial-Commit + Push | alle gesammelten Files, `git init`/`gh repo create`, Branch-Protection |
| 7 | PRD-Pflicht-Schritt | `docs/PRD.md` |

## Staging-Profile

| Profil | Branches | Instanzen | Wann |
|--------|----------|-----------|------|
| **none** | `main` | nur Prod | Hobby/POC, kein Risk |
| **simple** | `feature/*` -> `main` | Dev (lokal) + Prod | Solo-Customer-Projekt mit einem Live-System |
| **full** (empfohlen) | `feature/*` -> `staging` -> `main` | Dev + Staging + Prod | Customer-Projekt mit echtem Live-Risiko |
| **custom** | User-Wahl | User-Wahl | Sonderfaelle |

Source: `config/staging-profiles/{none,simple,full}.yaml`.
Wechsel nach Onboard: manuell — siehe `docs/UPDATE.md` (ab v0.6.0).

## DSGVO / Kontaktdaten

`.claude/customer.json` enthaelt vollstaendige Identitaet inkl. Kontaktdaten
und ist **immer in `.gitignore`**. Sie wird beim Klone des Repos durch
einen neuen Mitarbeiter NICHT mitgenommen — der Wizard kann sie via
`/onboard` neu erfassen.

In den committed Files (CLAUDE.md, README.md, ONBOARD_LOG.md, PRD.md):
- ERLAUBT: Customer-Slug, Project-Slug, Domaene
- VERBOTEN: voller Kundenname, E-Mail, Telefon, Anschrift

## Wiederholbare Ausfuehrung

Wenn `.template-version.json` mit `installed_at` schon existiert, fragt
der Wizard zuerst: "Bestehendes Setup neu durchlaufen?" Bei "Ja" wird ein
Backup in `.template-backup/<timestamp>/` angelegt, bevor Files veraendert
werden.

## Wenn etwas schief geht

- **Phase 2 GitHub failt** (kein `gh`, Solo-Account, Branch-Protection-API): Onboard laeuft trotzdem zu Ende, Hinweise in ONBOARD_LOG. Manuelle Nacharbeit dokumentiert.
- **Phase 3 Smoke-Test failt** (n8n-Instanz nicht erreichbar): Onboard laeuft weiter, `options.smoke_test_passed = false`.
- **gitleaks fehlt** (Windows): Pre-Commit-Hook nicht installiert, Vermerk in ONBOARD_LOG.
- **`/onboard` ganz brechen**: Repo bleibt im Zwischenzustand, vorhandene Files unter `.template-backup/` zurueckholen, dann `/onboard` von vorn.

## Was kommt nach `/onboard`

1. PRD finalisieren (`docs/PRD.md` oder via `/prd-generate` ab v1.0.0)
2. Pro Workflow eine WF-X-Spec in `docs/specs/` anlegen (Pflicht ab 3+ Nodes oder Webhook/Schedule)
3. Workflow bauen (n8n-MCP-Tools + lokale `.claude/skills/`)
4. Deployment: `/deploy-workflow workflows/<name>.json --env=<env>` (erst nach gruener `/validate-workflow`)
