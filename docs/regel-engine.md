# Regel-Engine: Mustererkennung & Auswertung

Dreistufig, strikt getrennt – das hält die Regeln als reine Daten (`rules.seed.json`) und die Mathematik testbar:

```
Events (IndexedDB)
   └─► FeatureStore.compute(events, child, config)   → flaches Feature-Objekt
          └─► RuleEngine.evaluate(features, rules)   → Kandidaten-Tipps
                 └─► TipSelector.rank(candidates)    → max. 3 sichtbare Tipps
```

Kein Machine Learning, keine LLM-Anfrage. Alles offline, deterministisch, im Zweifel nachvollziehbar –
zu jedem Tipp lässt sich anzeigen, welche Ereignisse ihn ausgelöst haben.

---

## 1. Datenmodell (Ergänzungsvorschläge zum Briefing)

```ts
type Event = {
  id: string
  ts: number                                   // Epoch ms
  what: 'pee' | 'poop' | 'both'
  where: 'potty' | 'toilet' | 'pants' | 'floor' | 'bed' | 'outside'
  initiative: 'self' | 'onRequest' | 'onPrompt' | 'none'
  duringSleep?: boolean                        // NEU – siehe unten
  note?: string
}
```

Drei Ergänzungen, die die Auswertung überproportional besser machen:

1. **`duringSleep: boolean`** – ein Toggle, kein zusätzlicher Screen. `where: 'bed'` allein reicht nicht:
   Bett ≠ Schlaf (Mittagsschlaf im Kinderwagen, nasse Hose auf dem Sofa). Und die Trennung ist
   fachlich zwingend, weil Nacht-Ereignisse einer völlig anderen Entwicklungslinie folgen (E4) und
   die Tagesquote nicht verfälschen dürfen. Default aus Uhrzeit vorbelegen, editierbar lassen.
2. **Optionaler Zusatz-Tap „Getrunken/Gegessen"** als eigener Event-Typ. Damit wird aus der
   Post-Mahlzeit-Regel eine echte Messung statt Keyword-Raterei in Notizen.
3. **`note` bleibt Freitext**, wird aber gegen `noteKeywords` gematcht (Schmerz, Haltemanöver,
   Ablenkung, Übergänge). Keyword-Treffer sind schwache Signale – sie triggern nie allein, sondern
   nur in Kombination (siehe Regeln).

**Erfolg/Unfall:** `potty | toilet | outside` = Erfolg, `pants | floor | bed` = Unfall.
Nacht-/Schlaf-Ereignisse zählen in **keine** Tagesmetrik.

---

## 2. Features

Alle Features werden einmal pro Auswertung berechnet und flach benannt (`gruppe.name`), damit die
Regeln sie referenzieren können, ohne Code zu kennen.

| Feature | Berechnung |
|---|---|
| `daytime.successRate14d` | Erfolge / (Erfolge + Unfälle), nur `!duringSleep`, letzte 14 Tage, **Wilson-Untergrenze** statt Rohquote |
| `successRate.last7d` | dito, 7 Tage |
| `successRate.dropVsBaseline` | Baseline = Median der Tagesquoten Tag −21…−8; Drop = Baseline − Mittel der letzten 3 Tage |
| `successRate.dropDurationDays` | Anzahl aufeinanderfolgender Tage unterhalb Baseline − Schwelle |
| `baseline.stableDryDays` | längste Strecke mit Tagesquote ≥ 0,8 vor dem Drop |
| `initiative.selfShare*`, `promptedShare*` | Anteile je `initiative`, 21-Tage-Fenster |
| `initiative.selfShareDelta21d` | Theil-Sen-Steigung des Tages-Selbstanteils × 21 Tage |
| `intervals.medianMinutes` / `.iqr` | Differenzen aufeinanderfolgender Pipi-Events **innerhalb eines Tages, tagsüber**; Median + IQR |
| `intervals.iqrTrendPerWeek` | Theil-Sen auf rollierendem 7-Tage-IQR (negativ = Streuung sinkt = Kontrolle) |
| `voidFrequency.median` | Median der Pipi-Events pro Tracking-Tag |
| `gaps.maxDaytimeHours` | größte Lücke zwischen zwei Tages-Events (Nacht ausgenommen) |
| `hotspot.*` | siehe 3.1 – Zeitpunkt, Anzahl Unfälle, Anzahl distinkter Tage |
| `postIntake.share` | Anteil Unfälle mit Intake-Event/Keyword in den 45 Min davor |
| `noWarning.share` | Anteil Unfälle mit `initiative: 'none'` an allen Unfällen |
| `holdingManeuvers.count14d` | Notiz-Keyword-Treffer `holding` |
| `notes.painMatches7d` | Notiz-Keyword-Treffer `pain` |
| `night.eventCount14d` | Ereignisse mit `duringSleep` |
| `night.monthsWithEventIn90d` | Anzahl Kalendermonate mit ≥1 Schlaf-Einnässen |
| `nap.dryDaysOf7` | Tage mit Mittagsschlaf ohne Schlaf-Ereignis |
| `stool.maxGapDays`, `.potteyShare21d`, `.hardStoolNotes14d` | Kaka-Metriken |
| `streak.current`, `.currentHitsMilestone` | aktuelle Erfolgsserie; Meilenstein aus `config.streakMilestones` |
| `child.ageMonths` | aus Geburtsmonat im Onboarding |
| `tracking.daysWithData`, `.eventsPerDay` | Datendichte – Grundlage aller Guard-Rails |

### Warum Wilson statt Rohquote
Bei 3 erfassten Ereignissen an einem Tag ist „67 % Erfolg" statistisch nichts. Die untere Grenze des
Wilson-Konfidenzintervalls (95 %) verhindert, dass die App bei dünner Datenlage jubelt oder warnt.

---

## 3. Die drei nicht-trivialen Erkennungen

### 3.1 Zeitfenster-Clustering (Hotspots)

Unfälle auf „Minuten seit Mitternacht" abbilden und **zirkuläre Kernel Density Estimation** rechnen
(Gauß-Kernel, σ = 30 Min, Wrap-around bei 1440) – kein k-Means: Die Clusterzahl ist unbekannt, und
21:50 und 00:10 müssen benachbart sein.

```
density(t) = Σ_i exp(−0.5 · (circDist(t, t_i)/σ)²)
```
Lokale Maxima der Dichte = Hotspot-Kandidaten. Ein Kandidat zählt erst, wenn er von **mindestens
3 verschiedenen Tagen** getragen wird – sonst ist ein einzelner schlechter Nachmittag ein „Muster".
Zusätzlich Wochentag-Achse (Kita vs. Wochenende) als zweite, getrennte Auswertung.

### 3.2 Trend-Erkennung

**Theil-Sen-Schätzer** (Median aller paarweisen Steigungen) statt linearer Regression: robust gegen
Ausreißer, funktioniert ab ~7 Punkten, und ein einzelner Krankheitstag kippt keinen Trend.
Signifikanz über den Mann-Kendall-Test (τ), Trend gilt erst ab p < 0,1 als real.

### 3.3 Regressionserkennung

Rollierender **EWMA** (α = 0,3) der Tagesquote gegen die Baseline der Vorwochen. Ein Alarm braucht
drei Bedingungen gleichzeitig: Abfall ≥ 25 Prozentpunkte, Dauer ≥ 3 Tage, und vorher ≥ 14 stabile Tage.
Damit unterscheidet die App echte Regression von normaler Tagesschwankung – die bei Kleinkindern
enorm ist und ausdrücklich **nicht** kommentiert werden soll.

---

## 4. Regel-Auswertung

`when` ist ein kleiner Bool-Baum (`all` / `any` / `not` + Blätter `{feature, op, value}`) – interpretiert,
nicht `eval`. Schwellen können über `{"$config": "key"}` auf die konfigurierbare Config zeigen,
Texte über `{{feature.pfad}}` interpolieren.

### Guard-Rails (verhindern nervige oder falsche Tipps)

| Mechanismus | Zweck |
|---|---|
| `requires.minTrackedDays` / `minEventsPerDay` | keine Tipps aus 4 Einträgen |
| `cooldownDays` (Default 7) | dieselbe Regel nicht jeden Tag |
| `maxActiveTips: 3` | Auswertung bleibt lesbar |
| Priorität + Kategorie-Dedup | max. ein Tipp je Kategorie; `red_flag` verdrängt `lob` |
| „Warum sehe ich das?" | jeder Tipp listet die auslösenden Ereignisse auf |
| Feedback-Daumen | „hilfreich / nicht hilfreich" setzt Cooldown auf 30 Tage – lokal, ohne Telemetrie |

### Tonalitäts-Regeln (aus E10, nicht verhandelbar)

- Nie „Streak verloren", nie Rot für das Kind – Rot markiert nur Datenkategorien.
- Kein Tipp fordert „mehr üben" bei Nacht-Ereignissen.
- Red-Flag-Tipps sind ruhig formuliert und enden immer bei „mit dem Kinderarzt besprechen",
  nie bei einer Verdachtsdiagnose.
- Jeder Tipp trägt sichtbar: *Heuristik auf Basis allgemeiner Entwicklungsprinzipien – kein
  medizinischer Rat.*

---

## 5. Sinnvolle Defaults für den Start

Alle in `config` von `rules.seed.json`; die wichtigsten:

- Präventiv-Intervall **150 Min** (Korridor 2–3 h aus der Standard-Urotherapie, E6)
- Angebot **20 Min** nach Mahlzeiten (E11)
- Hotspot: **≥2 Unfälle an ≥3 Tagen** im 60-Min-Fenster
- Regression: **−25 Prozentpunkte über ≥3 Tage** nach ≥14 stabilen Tagen
- Frequenz-Flags: **≥8/Tag** bzw. **≤3/Tag**, Lücke **≥7 h** (E6)
- Stuhl-Lücke: **3 Tage** (E7)
- Meilensteine bei **5 / 10 / 25 / 50** Erfolgen in Folge

Erste Woche: nur erfassen, keine Tipps außer den Red Flags. Das verhindert, dass die App aus
Startrauschen Muster halluziniert.
