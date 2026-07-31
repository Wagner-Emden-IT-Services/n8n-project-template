# n8n Code-Node Pitfalls

Production-Learnings fuer Code-Nodes, die Items aus mehreren Branches aggregieren
oder per `$('NodeName').all()` aus Nodes lesen, die nicht direkt verkabelt sind.
Kurzfassung im Skill: `.claude/skills/n8n-code-javascript/SKILL.md` (Production Gotchas).

## Branch-Sibling-Lookup auf NoOp-Nodes

**Symptom:** Ein Summary-/Aggregations-Code-Node zeigt fuer eine Branch dauerhaft `0`,
obwohl die referenzierte Node in der UI sichtbar Items ausgegeben hat
(z.B. `0 skipped, 4 updated, 0 created`, waehrend die `Skip (No Changes)`-Node
2603 Items ausgegeben hat). Macht Audit-Logs unbrauchbar.

**Root Cause:** `$('NodeName').all()` ist fuer Branch-Sibling-Nodes nicht generell
zuverlaessig — insbesondere bei **NoOp-/Passthrough-Nodes**. Kommt der aufrufende
Code-Node aus einer anderen Branch, kann `.all()` ein leeres Array liefern.

**Anti-Pattern:**

```javascript
// WRONG — can silently return [] for NoOp branch siblings
const skippedItems = $('Skip (No Changes)').all();
const skipped = skippedItems.length;
```

**Workaround — Math-Derivation:** Counts aus zuverlaessigen Nodes ableiten statt
die NoOp-Branch direkt zu zaehlen:

```javascript
// CORRECT — derive from reliable upstream nodes
const totalProcessed = $('Transform Exchange Contacts').all().length;
const updated = $('Update Mappings').all().length;     // DataTable node, reliable
const created = $('Save New Mappings').all().length;   // DataTable node, reliable
const skipped = totalProcessed - updated - created;    // by definition
```

**Wann ist `$('NodeName').all()` zuverlaessig?**

| Node-Typ | Zuverlaessig? |
|----------|---------------|
| DataTable-/Action-Nodes (z.B. Update/Insert) | Ja |
| Transform-Nodes upstream im eigenen Pfad | Ja |
| NoOp-/Passthrough-Nodes in Sibling-Branches | Nein — Math-Derivation nutzen |

**Regel:** Bei jedem 3-Wege-Routing-Pattern (UPDATE / CREATE / SKIP) nicht auf
`$('Skip').all()` verlassen — Skip-Count immer per Math ableiten.

**Try-Catch fuer Source-Lookups bleibt richtig:** Nicht-NoOp-Branches (Update/Save)
koennen in manchen Laeufen legitim leer sein, weil keine Items dort hingingen.
Dort schuetzt Try-Catch vor Lookup-Fehlern:

```javascript
let updateMappings;
try {
  updateMappings = $('Update Mappings').all();
} catch (e) {
  updateMappings = [];
}
```

## pairedItem mit sourceOverwrite fuer Multi-Input Code-Nodes

**Problem:** Braucht ein Merge-Code-Node die redundante Direkt-Connection zu einer
Node, die er ohnehin via `$('NodeName').all()` lookup-t? Ja — wegen
`pairedItem`-Linking. Wie `pairedItem` in Multi-Input-Szenarien funktioniert,
ist nicht offensichtlich.

**Mechanik:** `pairedItem` ist n8ns Mechanismus fuer Item-Linking — verfolgt,
welches Source-Item welches Output-Item produziert hat. Wird gebraucht fuer:

- "View source item" in der UI
- Error-Stacktrace-Tracing zurueck zur Quelle
- Korrekte `$('UpstreamNode').itemMatching(X)`-Lookups in nachfolgenden Nodes

Wenn eine Code-Node Items aus mehreren Branches per `$().all()` aggregiert, aber
nur **eine** davon als direkte Input-Connection hat, wird `pairedItem`
defaultmaessig auf den direkten Input gemapped. Items aus den anderen Branches
verlieren ihre Source-Trace.

### pairedItem-Syntax-Varianten

```javascript
// 1. Simple — references input 0, item N
return [{ json: {...}, pairedItem: { item: 0 } }];

// 2. Multi-input — explicit input index
return [{ json: {...}, pairedItem: { item: 5, input: 1 } }];

// 3. Source overwrite — explicit source node reference (regardless of input wiring)
return [{
  json: {...},
  pairedItem: {
    item: 5,
    sourceOverwrite: {
      previousNode: 'Transform Exchange Contacts',
      previousNodeRun: 0,
      previousNodeOutput: 0
    }
  }
}];

// 4. Array — item merged from multiple sources
return [{
  json: {...},
  pairedItem: [
    { item: 3, input: 0 },
    { item: 7, input: 1 }
  ]
}];
```

### Wann `sourceOverwrite`

Wenn ein Code-Node via `$('NodeName').all()` Items aus einer Node lookup-t, die
**nicht** direkt als Input-Connection verkabelt ist. Beispiel: Code-Node iteriert
ueber Transform-Output via `.all()`, hat aber selbst nur Input von einer
DataTable-Get-Node. Ohne `sourceOverwrite` zeigt `pairedItem` auf die
DataTable-Items — die UI-Source-Trace bricht.

### Praxisrelevanz

Erlaubt es, redundante Topology-Connections zu entfernen, ohne Item-Linking zu
verlieren: In Multi-Input-Merge-Patterns existiert die direkte Input-Connection
oft nur, damit `pairedItem` korrekt auf den richtigen Source-Node zeigt. Mit
`sourceOverwrite` koennte man die Connection theoretisch loeschen.

**Praktischer Tradeoff:** Die Topology-Connection kostet nichts (keine extra
Execution, kein extra Memory). Extra-Code in `pairedItem` schon. Empirisch ist
Connection-behalten meistens besser.

---

Quelle: GitHub-Issues #18 und #20 (Hoheisen-Workflow, 2026-05).
