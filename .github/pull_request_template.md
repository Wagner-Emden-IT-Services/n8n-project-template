# Beschreibung

<!-- Was aendert dieser PR und warum? Kurz und konkret. -->

## Type of Change

- [ ] Bug-Fix (Aenderung, die ein Problem behebt, ohne andere Funktionalitaet zu brechen)
- [ ] Neues Feature (rueckwaertskompatibel)
- [ ] Breaking Change (bricht bestehende Workflows oder API)
- [ ] Doku / Refactoring / Tooling (kein User-sichtbarer Effekt)

## Betroffene Workflows

<!-- Liste aller `workflows/`-Files, die geaendert oder neu erstellt wurden. Falls keiner: "keine". -->

-

## Test-Plan

<!-- Wie hast du verifiziert, dass es funktioniert? -->

- [ ] `npm test` lokal gruen
- [ ] `npm run validate` lokal gruen
- [ ] `npm run normalize -- workflows --check` keine Drift
- [ ] (bei Workflow-Aenderungen) Pin-Daten unter `tests/pins/<name>.json` aktualisiert
- [ ] (bei Code-Aenderungen) neue Test-Cases fuer den geaenderten Pfad

## Checkliste

- [ ] Branch zweigt von `main` ab und zielt auf `staging`
- [ ] Commit-Messages folgen `[ENV] [ACTION]: ...`-Format
- [ ] CHANGELOG.md `[Unreleased]` aktualisiert (sofern User-sichtbarer Effekt)
- [ ] Keine Secrets / API-Keys / Tokens committet (gitleaks-Pre-Commit lokal gruen)
- [ ] Bei Breaking Change: Migrationspfad in der PR-Description erklaert

## Verwandte Issues

<!-- Closes #..., fixes #..., relates to #... -->
