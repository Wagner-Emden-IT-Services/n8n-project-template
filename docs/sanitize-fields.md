# Sanitize-Felder beim Deploy

`scripts/lib/sanitize.mjs` strippt diese Felder aus jeder Workflow-JSON, **bevor** sie via `POST /workflows` oder `PUT /workflows/:id` an die n8n-API geht. n8n akzeptiert sie nicht (read-only) und antwortet sonst mit `400`.

## Aktuelle Liste

| Feld           | Grund                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| `id`           | Vom Server vergeben — bei Create darf nichts gesetzt sein, bei Update steht die ID in der URL |
| `versionId`    | Server-managed Versions-Counter                                                               |
| `createdAt`    | Server-Timestamp                                                                              |
| `updatedAt`    | Server-Timestamp                                                                              |
| `triggerCount` | Server-managed Statistik                                                                      |
| `pinData`      | Pin-Daten gehoeren in `tests/pins/<name>.json`, nicht in den Workflow selbst                  |
| `meta`         | Enthaelt `instanceId`, `templateCredsSetupCompleted` — gebunden an die Quell-Instanz          |
| `shared`       | Sharing-Status, instanz-spezifisch                                                            |
| `isArchived`   | Archivierungs-Status, instanz-spezifisch                                                      |
| `staticData`   | Persistente Trigger-State (z.B. last-cursor); gehoert nicht ins Repo                          |
| `tags`         | n8n-API liefert tags read-only zurueck; setzen via separate `/tags`-API                       |
| `active`       | Seit n8n 2.x read-only im Request-Body — Aktivierung laeuft separat via `POST /workflows/:id/activate` |

## Wann erweitern

- Wenn `node scripts/n8n-cli.mjs deploy ...` mit `400 Bad Request` und `<feld> is read-only` antwortet → Feld in `READONLY_FIELDS` ergaenzen, hier eintragen.
- Bei n8n-Major-Updates: Release-Notes pruefen, ob neue Server-managed Felder dazugekommen sind.

## Wann NICHT entfernen

- `name`, `nodes`, `connections`, `settings` — Pflicht fuer Create/Update.
- Keine Felder aus `nodes[]` oder `connections{}` anfassen (kein Sanitize auf Knoten-Ebene).

## Geschichte

| Datum      | Aenderung                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-05-07 | Initial — id, versionId, createdAt, updatedAt, triggerCount, pinData, meta, shared, isArchived, staticData, tags |
| 2026-08-01 | `active` ergaenzt — n8n 2.x lehnt es mit `request/body/active is read-only` ab (fixes #41)                        |
