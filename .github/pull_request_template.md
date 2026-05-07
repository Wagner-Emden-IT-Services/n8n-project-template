# Beschreibung

<!-- Was aendert dieser PR und warum? Kurz und konkret. -->

## Type of Change

<!-- Eines ankreuzen — sollte mit dem Conventional-Commit-Type des PR-Titels uebereinstimmen. -->

- [ ] `feat` — neues Feature (rueckwaertskompatibel)
- [ ] `fix` — Bug-Fix
- [ ] `docs` — nur Doku
- [ ] `refactor` — Code-Umbau ohne User-sichtbaren Effekt
- [ ] `test` — Tests hinzu/geaendert
- [ ] `chore` — Wartung, Deps, Build-Tools
- [ ] `ci` — CI/CD-Konfig
- [ ] **Breaking Change** (zusaetzlich `!` im Commit-Type oder Footer `BREAKING CHANGE:`)

## Betroffene Workflows

<!-- Liste aller `workflows/`-Files, die geaendert oder neu erstellt wurden. Falls keiner: "keine". -->

-

## Test-Plan

<!-- Wie hast du verifiziert, dass es funktioniert? -->

- [ ] `npm test` lokal gruen
- [ ] `npm run validate` lokal gruen
- [ ] `npm run normalize -- workflows --check` keine Drift
- [ ] `npm run format:check` lokal gruen
- [ ] (bei Workflow-Aenderungen) Pin-Daten unter `tests/pins/<name>.json` aktualisiert
- [ ] (bei Code-Aenderungen) neue Test-Cases fuer den geaenderten Pfad

## Checkliste

- [ ] Branch zweigt von `main` ab und zielt auf `staging`
- [ ] PR-Titel und Commit-Messages folgen [Conventional Commits](https://www.conventionalcommits.org)
- [ ] CHANGELOG.md `[Unreleased]` aktualisiert (sofern User-sichtbarer Effekt)
- [ ] Keine Secrets / API-Keys / Tokens committet (gitleaks-Pre-Commit lokal gruen)
- [ ] Bei Breaking Change: Migrationspfad in der PR-Description erklaert

## Verwandte Issues

<!-- Closes #..., fixes #..., relates to #... -->
