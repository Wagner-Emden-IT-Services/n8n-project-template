# Disaster Recovery

Schritt-fuer-Schritt-Anleitung fuer Notfall-Szenarien. Lies das **bevor** der Notfall eintritt.

## Praevention (Pflicht — vor jedem Going-Live)

### 1. Encryption-Key in 3 Locations

n8n verschluesselt **alle** gespeicherten Credentials mit `N8N_ENCRYPTION_KEY`. Ohne den Key sind die Credentials in einem Backup wertlos.

- **Primaer:** Secret-Vault (Azure Key Vault / HashiCorp Vault / AWS Secrets Manager) — von dort wird er beim n8n-Start gelesen.
- **Sekundaer:** Zweite Vault-Region oder zweiter Provider — Vault-Provider-Outage darf nicht zum Total-Loss fuehren.
- **Off-Site-Backup:** Verschluesselter Container (VeraCrypt / 1Password Vault) auf einem Geraet, das **nicht** mit der Cloud-Infrastruktur verbunden ist. Nur fuer den Fall, dass beide Online-Vaults nicht erreichbar sind.

Pfade in `credentials/secrets-vault-map.yaml` dokumentieren.

### 2. Woechentliches Full-Instance-Backup

Cron-Job auf dem n8n-Host (oder als externer Worker):

```bash
n8n export:workflow --all --output=backup-$(date +%F)/workflows --separate
n8n export:credentials --all --output=backup-$(date +%F)/credentials.json
# credentials.json bleibt encrypted — kein --decrypted in produktiven Backups
tar czf backup-$(date +%F).tar.gz backup-$(date +%F)/
# Upload nach S3 / Backblaze / B2 — separater Account, eigenes IAM
```

Retention: 30 Tage daily + 12 Monate monthly.

### 3. Repo-Backup (Git)

Git-Remote ist primaer (GitHub/GitLab). Zusaetzlich woechentlich:

```bash
git clone --mirror <repo-url> repo-mirror-$(date +%F).git
tar czf repo-mirror-$(date +%F).tar.gz repo-mirror-$(date +%F).git
# Upload zu Off-Site-Storage
```

### 4. Backup-Verifikation (monatlich)

Restore-Drill in einer Sandbox-Instanz. Wenn Restore scheitert: Backup-Pipeline ist kaputt. Sofort fixen.

---

## Szenario A — Workflow-Korruption (haeufig)

**Symptom:** Ein Workflow funktioniert nicht mehr nach einer Aenderung. Live und Repo sind out-of-sync.

**Pfad:**

1. Drift identifizieren:
   ```bash
   node scripts/n8n-cli.mjs drift-check --env=prod --output=drift.md
   ```
2. Letztes Repo-Backup finden:
   ```bash
   ls backups/prod/pre-deploy-*/
   ```
3. Workflow-File aus Backup zurueck nach `workflows/<name>.json` kopieren.
4. Validation + Normalize lokal:
   ```bash
   node scripts/n8n-cli.mjs validate workflows/<name>.json
   node scripts/n8n-cli.mjs normalize workflows/<name>.json
   ```
5. PR-Pfad: `feature/restore-<name>` → staging → main.
6. Auto-Deploy uebernimmt.

**RTO:** ~30 Minuten (PR-Pfad).
**RPO:** Letzter Pre-Deploy-Backup-Snapshot.

---

## Szenario B — VPS / Instanz-Verlust (mittel)

**Symptom:** n8n-Host weg (gekuendigt, kompromittiert, Hardware-Tod).

**Pfad:**

1. Neue Instanz hochziehen (gleicher Tech-Stack — Docker / VM / managed).
2. **Encryption-Key zuerst restoren** — sonst sind Credentials beim Import nutzlos:
   ```bash
   export N8N_ENCRYPTION_KEY="$(read-from-vault)"
   ```
3. n8n starten ohne Workflows / Credentials.
4. Letztes Backup importieren:
   ```bash
   n8n import:credentials --input=backup-<latest>/credentials.json
   n8n import:workflow --input=backup-<latest>/workflows/ --separate
   ```
5. Aktivierungs-Status pruefen — nach Import sind Workflows oft deaktiviert. `active: true` selektiv setzen.
6. DNS auf neue Instanz umbiegen.
7. Webhook-URLs pruefen — bei DNS-Wechsel muessen alle Third-Parties neu informiert werden (z.B. GitHub-Webhooks, Stripe-Endpoints).
8. Repo-Stand vergleichen:
   ```bash
   node scripts/n8n-cli.mjs drift-check --env=prod
   ```
9. Bei Drift: Repo-Stand re-deployen (Repo ist Source-of-Truth):
   ```bash
   for f in workflows/*.json; do
     node scripts/n8n-cli.mjs deploy "$f" --env=prod
   done
   ```

**RTO:** 2-4 Stunden (DNS-Propagation + Smoke-Tests).
**RPO:** Letztes woechentliches Full-Backup + alle Repo-Commits danach.

---

## Szenario C — Encryption-Key-Verlust (kritisch)

**Symptom:** Key ist weg. Credentials in Backups und in der laufenden Instanz nicht mehr entschluesselbar.

### C.1 — Key vorhanden in Off-Site-Backup

1. Key aus Off-Site-Vault holen.
2. Setzen, n8n neu starten.
3. Vaults wieder befuellen (Primary + Secondary).
4. Post-Mortem: Wie konnte Primary + Secondary gleichzeitig verloren gehen?

### C.2 — Key vollstaendig verloren (Worst-Case)

**Alle gespeicherten Credentials sind unwiederbringlich verloren.**

Notfall-Plan:

1. Komplette Liste aller Third-Party-Integrationen aufstellen (aus `credentials/secrets-vault-map.yaml` + manuelle Pruefung der Workflows).
2. **Bei jedem Provider:** API-Key / OAuth-Token rotieren — die alten sind in unbekannten Haenden, falls der Key durch Kompromittierung verloren ging.
3. n8n-Instanz neu aufsetzen mit frischem Encryption-Key.
4. Alle Credentials neu in n8n anlegen (UI) oder via External-Secrets-Feature.
5. Alle Workflows aus Repo neu deployen — Credential-Refs werden ueber `config/env-mapping.yaml` neu gemappt:
   ```bash
   for f in workflows/*.json; do
     node scripts/n8n-cli.mjs deploy "$f" --env=prod
   done
   ```
6. Aktivierungs-Status manuell pruefen.

> **Diesen Pfad NIE erreichen.** Encryption-Key-Backup in 3 Locations ist non-negotiable. Der Aufwand fuer Schritt 1-6 ist 1-2 Tage Vollzeit, plus Trust-Schaden bei den Third-Parties.

**RTO:** 1-2 Tage Engineering-Vollzeit.
**RPO:** Alle gespeicherten Credentials weg — Workflows kommen aus dem Repo zurueck.

---

## Szenario D — Vollstaendige Repo-Korruption

**Symptom:** Git-Remote weg, lokale Clones korrupt. Nur die laufende n8n-Instanz hat noch die Workflows.

**Pfad:**

1. Lokal frischen Repo-Stand vom Off-Site-Mirror oder Mirror-Backup wiederherstellen, falls vorhanden.
2. Falls nicht: aus der Live-Instanz exportieren:
   ```bash
   node scripts/n8n-cli.mjs export --env=prod --out=workflows
   ```
3. Env-Mapping muss aus n8n-Tags rueckwaerts rekonstruiert werden — siehe `config/env-mapping.yaml.example`.
4. Neu committen, neuen Remote anlegen, Branch-Protection neu setzen.
5. CI-Secrets im neuen Remote neu hinterlegen.

**RTO:** 4-8 Stunden.
**RPO:** Live-Instanz-Stand (Repo-Historie ist verloren, falls keine Mirror-Backups existieren).

---

## RTO/RPO-Targets (vom Repo-Owner auszufuellen)

| Szenario                 | RTO-Ziel | RPO-Ziel | Verantwortlich |
| ------------------------ | -------- | -------- | -------------- |
| A — Workflow-Korruption  | \_ Min   | \_ Min   | \_             |
| B — Instanz-Verlust      | \_ h     | \_ h     | \_             |
| C.1 — Key aus Off-Site   | \_ h     | \_ h     | \_             |
| C.2 — Key total verloren | \_ Tage  | n/a      | \_             |
| D — Repo-Korruption      | \_ h     | \_ h     | \_             |

---

## Recovery-Drill-Checkliste (quartalsweise)

Datum letzter Drill: \***\*\_\_\*\***

- [ ] Sandbox-n8n-Instanz hochgezogen (clean state)
- [ ] Encryption-Key aus Vault geholt — Zugriff funktioniert
- [ ] Letztes Workflow-Backup importiert — alle Workflows da
- [ ] Letztes Credential-Backup importiert — alle Credentials entschluesselbar
- [ ] 1 Workflow manuell ausgefuehrt — laeuft erfolgreich gegen die Sandbox-Credentials
- [ ] Repo-Mirror-Backup geklont — alle Branches + Tags da
- [ ] CI-Secret-Liste verifiziert — alle Secrets in einem Inventar dokumentiert
- [ ] Lessons-Learned in dieses Runbook gepflegt

Wenn ein Punkt scheitert: **dieses Runbook an der Stelle korrigieren**, nicht den Drill nachbessern.
