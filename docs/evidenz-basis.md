# Evidenz-Basis für das Tipp-System ("Potty Quest")

Stand der Recherche: 2026-09-03. Alle Aussagen stammen aus Fachliteratur/Leitlinien (Quellen unten).
Dieses Dokument ist die **fachliche Grundlage** für `rules.seed.json` – jede Regel dort referenziert
über `evidence.ref` einen der Blöcke E1–E12.

> **Grundhaltung der App:** Die Tipps sind *Heuristiken auf Basis allgemein anerkannter
> Entwicklungsprinzipien*, kein medizinischer Rat. Jeder Tipp trägt einen Disclaimer.
> Die App diagnostiziert nichts – sie sagt maximal „das ist ein Muster, das man mit dem
> Kinderarzt besprechen kann".

---

## E1 – Zeitfenster der Sauberkeitsentwicklung

- Physiologische, kognitive und emotionale Reife für das Töpfchentraining liegt bei den meisten
  Kindern zwischen **18 und 30 Monaten**; Mädchen im Schnitt früher (24–26 Mon.) als Jungen (~29 Mon.).
- Reihenfolge des Erwerbs: **Darmkontrolle vor Blasenkontrolle tagsüber vor Blasenkontrolle nachts.**
  Darmkontrolle typisch 2–3 Jahre, Tages-Blasenkontrolle 3–4 Jahre.
- 97 % der Kinder haben mit 4 Jahren Darmkontrolle; ca. **25 % der Vierjährigen nässen noch ein**.
- Die neurogene Grundreife ist genetisch getaktet und **durch Training nicht beschleunigbar**.

**App-Konsequenz:** Alterskontext im Onboarding erfassen (Geburtsmonat). Kein Tipp darf implizieren,
dass mehr Üben die Reifung beschleunigt. Fortschrittskurven immer relativ zum Kind, nie gegen eine Norm.

## E2 – Trainingsmethoden

- **Kindorientiert (Brazelton):** an Bereitschaftszeichen ausgerichtet, schrittweise, ohne Druck.
  Prospektive Kohorte (n=482): 61 % trocken mit 36 Monaten, 98 % mit 48 Monaten.
- **Strukturiert-verhaltensbasiert (Azrin & Foxx):** ab ~20 Monaten möglich, wenn 8 von 10
  Bereitschaftsaufgaben erfüllt sind; intensiver, arbeitet mit positiver Verstärkung und Wiederholung.

**App-Konsequenz:** Die Regel-Engine ist im Kern kindorientiert (Signalwahrnehmung, Rhythmus,
Übergänge), borgt sich von Azrin/Foxx nur die positive Verstärkung (Serien, Meilensteine, Konfetti).

## E3 – Bereitschaftszeichen (Readiness)

Motorik (laufen, Hose aus-/anziehen), Sprache/Instruktionsverständnis, Wahrnehmung der vollen
Blase/des vollen Darms, Unbehagen bei voller Windel, Nachahmen, **Trockenbleiben über den Mittagsschlaf**
(bei ~75 % der Kinder mit 24–26 Monaten).

**App-Konsequenz:** Trocken-nach-Schlaf ist ein *messbares* Reifezeichen → eigene Regel (`nap_dry_streak`).

## E4 – Nachttrockenheit ist ein eigener, späterer Schritt

- **40 %** der Kinder nässen nachts noch ein, nachdem die Tageskontrolle sitzt.
- Nachttrockenheit hängt an **ADH/Vasopressin-Rhythmus, Blasenkapazität und Weckschwelle** –
  nicht am Training. Tiefschläfer wachen beim Blasensignal schlicht nicht auf.
- Einnässen im Schlaf gilt bis **5 Jahre** als entwicklungsgemäß. Erst danach spricht man
  (AWMF-S2k 028-026) von Enuresis nocturna: ≥1×/Monat über 3 Monate ab dem 5. Geburtstag.
- Prävalenz mit 7 Jahren ~10 % (7–13 %), Jungen ~2× häufiger; mit 10 Jahren ~5 %.

**App-Konsequenz:** Nacht-Ereignisse **dürfen die Tages-Erfolgsquote nicht verschlechtern**
(getrennte Metrik!). Der Tipp bei Nacht-Häufung ist *einordnend und entlastend*, nie „mehr üben".
Explizit: nachts Windel/Höschenwindel ist keine Niederlage.

## E5 – „Ohne Vorwarnung" – zwei verschiedene Ursachen

1. **Unreife Signalwahrnehmung / Ablenkung:** Kinder im Spiel vertieft registrieren den Drang zu spät;
   Unfälle häufen sich typischerweise **später am Tag** (Müdigkeit, nachlassende Konzentration).
   → Antwort: Rhythmus (Zeit-getriggerte Angebote) statt Warten auf das Kindsignal.
2. **Überaktive Blase (OAB):** Blasenmuskulatur kontrahiert „ohne Vorwarnung", plötzlicher starker
   Drang, hohe Frequenz (**≥8 Miktionen/Tag** = erhöht nach ICCS), typische **Haltemanöver**
   (Beine kreuzen, hocken, „Pipi-Tanz"). Viele Kinder wachsen heraus; Erstlinie ist verhaltensbasiert.

Gegenpol: **Unteraktive Blase** – <3 Miktionen/Tag oder >6–8 h ohne Miktion, Pressen beim Wasserlassen.

**App-Konsequenz:** Zwei getrennte Regeln (`no_warning_low_awareness` vs. `urgency_pattern`), die sich
über Frequenz + Haltemanöver-Notizen unterscheiden. Nur die zweite enthält einen Arzt-Hinweis.

## E6 – Blasen-Kennzahlen (ICCS)

- Erwartete Blasenkapazität: **(Alter in Jahren + 1) × 30 ml**.
- Erhöhte Frequenz: **≥ 8 Miktionen/Tag**. Verringerte Frequenz: **≤ 3/Tag**.
- Standard-Urotherapie: regelmäßige Entleerung ca. **alle 2–3 Stunden** und bei Drang;
  **Haltemanöver vermeiden** – wenn sie auftreten, soll das Kind gehen.

**App-Konsequenz:** Default-Präventiv-Intervall = 2,5 h, konfigurierbar. Frequenz-Regeln nutzen 8 / 3
als Schwellen, aber nur bei ausreichender Erfassungsdichte (sonst Fehlalarm durch Lücken im Tracking).

## E7 – Verstopfung ist der häufigste versteckte Treiber

- Bis zu **80 %** der Kinder mit Blasenkontrollproblemen haben gleichzeitig Verstopfung.
- Mechanismus: gemeinsamer Beckenboden – Schmerz beim Stuhlgang → Zurückhalten → auch der
  Blasenschließmuskel wird angespannt → Restharn, Dranginkontinenz, Einnässen.
- Klinisch: Behandlung der Verstopfung beendet häufig das Einnässen.

**App-Konsequenz:** Kaka-Daten sind kein Nebenschauplatz. Regel `stool_gap`: ≥3 Tage ohne Stuhl,
oder harter/schmerzhafter Stuhl in Notizen + steigende Pipi-Unfälle → gezielter Hinweis.
Das ist der wertvollste Tipp der ganzen Engine, weil er sonst übersehen wird.

## E8 – Stuhl-Verweigerung (Stool Toileting Refusal)

- Betrifft ~**20 %** der Kinder; ~25 % davon brauchen Unterstützung.
- Ursachen: Schmerz, Angst, psychosozialer Stress. Zwei Drittel der Kleinkinder verstecken sich
  zeitweise zum Stuhlgang – geht meist von allein vorbei.
- Wirksam: **Druck rausnehmen**, keine negativen Begriffe für Stuhl, Auslöser identifizieren,
  positiv formulieren. Bei anhaltender Verweigerung: Training **mehrere Wochen pausieren**.

## E9 – Regression

- Auslöser: Krankheit, emotionale Belastung, Aufmerksamkeitsbedürfnis (z. B. Geschwisterkind),
  Umbrüche (Kita-Start, Umzug, Urlaub).
- Regression kann aber auch **Infekt oder andere Erkrankung** signalisieren → bei plötzlichem
  Rückfall nach stabiler Trockenphase, Schmerzen/Brennen, Fieber, Blut: Kinderarzt.

## E10 – Was schadet

- Ärger, Strafe, Beschämen sind **kontraproduktiv**: erhöhen Angst, verzögern Fortschritt,
  provozieren Regression und belasten die Eltern-Kind-Beziehung. Machtkämpfe sind zu vermeiden.
- Nur positive Verstärkung; Unfälle wertfrei behandeln.

**App-Konsequenz:** Tonalität ist keine Design-Frage, sondern evidenzbasiert. Das Maskottchen darf
bei Unfällen **nie** traurig/tadelnd reagieren. Kein „Streak verloren"-Framing – Serien brechen still.

## E11 – Timing im Alltag

- Nach Mahlzeiten anbieten (gastrokolischer Reflex); Sitzdauer **max. 5–10 Minuten**.
- Bei Widerstand über mehrere Tage: Training für **mehrere Wochen** aussetzen ist die beste Strategie.

## E12 – Trainingsstart und späteres Risiko

- Beginn **vor 24 Monaten** ist mit ~3-fachem Risiko für Verstopfung und dysfunktionelles
  Miktionsverhalten/Tagesnässen assoziiert; auch ein Start **nach 36 Monaten** ist mit erhöhtem
  Enuresis-Risiko assoziiert. Das 18–30-Monate-Fenster ist der Korridor mit der besten Datenlage.

**App-Konsequenz:** Nur als sanfter Kontext-Hinweis im Onboarding, nicht als laufender Tipp –
sonst beschämt die App Eltern für eine Entscheidung, die längst getroffen ist.

---

## Red Flags → „bitte mit dem Kinderarzt besprechen"

Die App stellt keine Diagnose. Sie zeigt einen ruhigen, nicht alarmierenden Hinweis bei:

| Muster | Hintergrund |
|---|---|
| Plötzlicher Rückfall nach ≥2 Wochen stabiler Trockenheit | ggf. Harnwegsinfekt / Erkrankung (E9) |
| Notizen mit Schmerz/Brennen/Blut/Fieber | Harnwegsinfekt (E9) |
| ≥8 Miktionen/Tag über mehrere Tage, kleine Mengen | erhöhte Frequenz / OAB (E5, E6) |
| ≤3 Miktionen/Tag oder Lücken >6–8 h, Pressen | unteraktive Blase / Retention (E5) |
| ≥3 Tage ohne Stuhl bzw. schmerzhafter Stuhl + steigende Nässe-Ereignisse | Verstopfung als Treiber (E7) |
| Tagesnässen bei Kind >4 Jahre, >6 Monate nach Trainingsende | Definition Miktionsstörung (E5) |
| Einnässen im Schlaf ab 5. Geburtstag, ≥1×/Monat über 3 Monate | Definition Enuresis nocturna (E4) |

---

## Quellen

- AAFP – Toilet Training: Common Questions and Answers (2019): https://www.aafp.org/pubs/afp/issues/2019/1015/p468.html
- Merck Manual Professional – Toilet Training: https://www.merckmanuals.com/professional/pediatrics/health-supervision-of-the-well-child/toilet-training
- AWMF S2k-Leitlinie 028-026 – Enuresis und nicht-organische (funktionelle) Harninkontinenz (2021): https://register.awmf.org/assets/guidelines/028-026l_S2k_Enuresis-und-nicht-organische-funktionelle-Harninkontinenz_2021-12.pdf
- Haug-Schnabel – Physiologische und psychologische Aspekte der Sauberkeitsentwicklung (KiTa Fachtexte): https://www.kita-fachtexte.de/fileadmin/Redaktion/Publikationen/FT_haug_schnabel_2011.pdf
- ICCS-Standardisierung der Terminologie des unteren Harntrakts bei Kindern: https://onlinelibrary.wiley.com/doi/10.1002/nau.20370
- Rakowska-Silska et al. – Voiding Disorders in Pediatrician's Practice (2020): https://pmc.ncbi.nlm.nih.gov/articles/PMC7705800/
- Nationwide Children's – 6 Signs Your Child May Have Bladder Dysfunction: https://www.nationwidechildrens.org/family-resources-education/700childrens/2016/06/6-signs-your-child-may-have-bladder-dysfunction
- UNC Urology – Daytime Wetness, Nighttime Bedwetting, and Constipation: https://www.med.unc.edu/urology/pediatrics/pediatric-conditions/daytime-wetness/
- HealthyChildren.org (AAP) – Daytime Accidents & Bladder Control Problems: https://www.healthychildren.org/English/health-issues/conditions/genitourinary-tract/Pages/Daytime-Accidents-Bladder-Control-Problems-Voiding-Dysfunction-.aspx
- HealthyChildren.org (AAP) – Potty Training Regression: https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/Regression.aspx
- Stool toileting refusal: a prospective intervention targeting parental behavior (PubMed): https://pubmed.ncbi.nlm.nih.gov/14662573/
- Nocturnal enuresis in children: The role of arginine-vasopressin (PubMed): https://pubmed.ncbi.nlm.nih.gov/34238464/
- Toilet training before age two and later wetting problems (ScienceDaily zur Studie): https://www.sciencedaily.com/releases/2014/10/141007091657.htm
