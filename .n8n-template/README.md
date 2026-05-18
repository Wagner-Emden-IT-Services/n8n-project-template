# .n8n-template/

Internes Verzeichnis der Golden-Dev-Template-Mechanik. Wird vom Template ausgeliefert und vom Update-/Migrations-Workflow gepflegt.

## Inhalt

| Datei | Zweck |
|-------|-------|
| `manifest.json` | Hash-Manifest aller template-verwalteten Dateien (SHA-256 + Schutz-Tier). Quelle der Wahrheit fuer 3-Wege-Diff. |
| `protection-rules.json` | Glob-Regeln Pfad → Schutz-Tier. Wird vom Manifest-Generator gelesen. |
| `Generate-Manifest.ps1` | Generiert `manifest.json` aus dem aktuellen Projekt-Tree + den Regeln. |
| `audit.log` | Append-only ISO-Timestamp-Log aller `/template-update`/`/template-migrate`-Operationen. Wird ignoriert von Git (in `.gitignore`). |

## Schutz-Tiers (4-Tier-Modell)

| Tier | `/template-update`-Verhalten |
|------|------------------------------|
| `FROZEN` | Wird immer ueberschrieben. Wenn lokal veraendert → Warnung + Backup `<file>.bak.<timestamp>`. |
| `UPDATABLE-WITH-DIFF` | 3-Wege-Diff: wenn LOCAL == BASE → safe-update; sonst Konflikt-UI. |
| `MARKER-AWARE` | Nur Inhalt zwischen `<!-- N8N-TEMPLATE:START id="..." -->` und `<!-- N8N-TEMPLATE:END id="..." -->` wird aktualisiert. `<!-- PROJECT:START -->`-Bloecke werden NIE angefasst. |
| `USER-GENERATED` | Wird NIE ueberschrieben. Stub bleibt nur bis zur ersten Befuellung im Projekt. |

Konvention im Detail: siehe `UPDATING.md` im Template-Root.

## Audit-Log-Format

`audit.log` ist tab-separiert (TSV), ISO-8601-Timestamp:

```
2026-05-17T18:42:11Z	UPDATE	v1.5.0	v1.6.0	23	1	0	0
^timestamp           	^event	^from	^to	^updated ^conflict ^skipped ^backups
```

Events: `INSTALL`, `UPDATE`, `MIGRATE`, `MANIFEST_REGENERATE`, `SCHEMA_UPGRADE`.

## Manifest neu generieren (nur Template-Maintainer)

```powershell
pwsh .n8n-template/Generate-Manifest.ps1 -Root .
```

Im Kundenprojekt wird das Manifest ausschliesslich von `/template-update` und `/template-migrate` fortgeschrieben — nicht manuell.
