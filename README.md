# Potty Quest

Töpfchen-Tracker als installierbare Offline-PWA. Erfassen in zwei bis vier Taps,
verspielte Auswertung, und ein Tipp-System, das erkannte Muster gegen Schwellenwerte
aus Leitlinien und Fachliteratur prüft (Grundlage: `docs/evidenz-basis.md`).

**Alle Daten bleiben auf dem Gerät.** Kein Backend, kein Netzwerkzugriff, keine Analytics.

## Starten

Ein statischer Server genügt – IndexedDB und Service Worker funktionieren nicht über `file://`:

```bash
node toepfchen-app/tools/serve.mjs
```

Dann `http://localhost:4173` öffnen. Auf dem Handy über „Zum Homescreen hinzufügen“
installieren – danach läuft alles offline.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `index.html`, `css/app.css` | Shell und Comic-Look (dicke Outlines, harte Schatten, runde Formen) |
| `js/app.js` | UI und Interaktion – enthält bewusst keine Auswertungslogik |
| `js/db.js` | IndexedDB (Ereignisse + Einstellungen) |
| `js/model.js` | Begriffe: was / wohin / Initiative, Erfolg-Definition, Defaults |
| `js/stats.js` | Wilson, Theil-Sen, Mann-Kendall, EWMA, zirkuläre KDE |
| `js/features.js` | FeatureStore: Rohereignisse → Kennzahlen |
| `js/engine.js` | Regel-Interpreter (Bool-Baum, Cooldowns, Priorisierung) |
| `js/rules.data.js` | generiert aus `docs/rules.seed.json` – **nicht direkt editieren** |
| `js/charts.js` | SVG-Charts von Hand |
| `js/icons.js`, `js/mascot.js`, `js/confetti.js` | Icon-Set, Maskottchen „Quaki“, Konfetti |
| `js/csv.js` | Import (mit Spalten-Mapping) und Export |
| `sw.js`, `manifest.webmanifest` | PWA: offline-fähig, installierbar |
| `docs/` | Evidenzbasis, Regelwerk, Engine-Architektur |

Datenfluss: `IndexedDB → features.js → engine.js → UI`. Die drei Schichten sind
getrennt, damit die Mathematik ohne Browser testbar bleibt und die Regeln reine Daten sind.

## Warum diese Technik

- **Kein Next.js:** Die App hat keinen Server-Anteil – alle Daten liegen lokal. Next.js
  brächte Build-Schritt, Node-Abhängigkeit und Update-Zyklen, ohne dass irgendetwas
  serverseitig gerendert würde.
- **IndexedDB statt SQLite (WASM) oder Dateiablage:** SQLite über WASM lädt ~1 MB nach und
  braucht eigene Persistenzlogik (OPFS), Dateiablage über die File System Access API scheitert
  auf iOS. IndexedDB ist überall vorhanden, transaktional, groß genug und async.
  Das Backup läuft über CSV/JSON-Export – damit sind die Daten trotzdem portabel.
- **Kein Tailwind, keine Chart-Library:** Der Comic-Look lebt von wenigen sehr eigenen Regeln,
  und Recharts hätte man für diesen Stil überschreiben statt nutzen müssen.

## Regeln erweitern

1. Neue Regel in `docs/rules.seed.json` ergänzen (Trigger-Baum, Text, Schwellen, Evidenz-Referenz).
2. `node tools/build-rules.mjs` – prüft Pflichtfelder und doppelte IDs, schreibt `js/rules.data.js`.
3. Fehlt ein Feature, kommt es in `js/features.js` dazu; die Regel referenziert es über den Namen.

Schwellenwerte stehen in `config` und lassen sich über `settings.configOverrides` pro Nutzer
überschreiben, ohne die Regeln anzufassen.

## Datenmodell

```js
{
  id: 'uuid',
  ts: 1788436804283,        // Epoch ms
  what: 'pee' | 'poop' | 'both',
  where: 'potty' | 'toilet' | 'outside' | 'pants' | 'floor' | 'bed',
  initiative: 'self' | 'onRequest' | 'onPrompt' | 'none',
  duringSleep: true,        // trennt Nacht von Tag - Nachtereignisse zählen in keine Tagesquote
  note: 'nach dem Trinken'  // Freitext, wird gegen Keyword-Listen gematcht
}
```

## CSV-Import

„Daten → CSV importieren“ liest auch fremde Tracker-Exporte: Trennzeichen wird erraten,
Spalten werden vorgeschlagen und lassen sich im Dialog korrigieren, deutsche Datumsformate
(`01.09.2026 08:15`) werden korrekt gelesen. Zeilen ohne lesbaren Zeitpunkt werden übersprungen
und gezählt.

## Grenzen

- Die Tipps sind Heuristiken, kein medizinischer Rat – das steht auch an jedem Tipp.
- „Trocken nach dem Mittagsschlaf“ wird geschätzt: die App weiß nicht, ob überhaupt geschlafen wurde.
  Deshalb ist die Regel an die Einstellung „Macht Mittagsschlaf“ gekoppelt.
- Notiz-Keywords (Schmerz, Haltemanöver, Verweigerung) sind schwache Signale und lösen nie
  allein einen Tipp aus.
