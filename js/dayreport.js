// Tagesbewertung: fasst einen einzelnen Tag zusammen.
//
// Bewusst mit Rohquoten statt Wilson-Untergrenze: Hier wird ein einzelner Tag
// BESCHRIEBEN, nicht auf die Zukunft geschlossen. Wilson wuerde 8 von 11 auf
// unter 50 % druecken - fuer einen Tagesrueckblick waere das schlicht falsch.
//
// Zwei Zahlen statt einer: die Trefferquote sagt, ob es ins Toepfchen ging,
// die Selbststaendigkeit, wie viel dafuer von aussen kommen musste.

import { INITIATIVE, isSuccess, isPee, isPoop, dayKey, minutesOfDay, timeLabel, durationLabel } from './model.js';
import { isSleepEvent } from './features.js';

const DAY_MS = 86400000;
const MIN_EVENTS = 5; // darunter ist eine Tagesbewertung Rauschen

const pct = (v) => Math.round(v * 100);

function analyseDay(dayEvents, settings) {
  const wach = dayEvents.filter((e) => !isSleepEvent(e, settings));
  const schlaf = dayEvents.filter((e) => isSleepEvent(e, settings));
  const treffer = wach.filter(isSuccess);
  const unfaelle = wach.filter((e) => !isSuccess(e));

  // Gewichtung: alleine 3, auf Frage 2, auf Ansage 1, Unfall 0.
  const maxScore = wach.length * 3;
  const score = wach.reduce((a, e) => a + (INITIATIVE[e.initiative]?.rank ?? 0), 0);

  const zaehl = (k) => wach.filter((e) => e.initiative === k).length;

  // Laengste Strecke am Stueck ohne Unfall, zwischen erstem und letztem Eintrag.
  let longestDry = 0;
  if (wach.length) {
    const marks = [wach[0].ts, ...unfaelle.map((e) => e.ts), wach[wach.length - 1].ts].sort((a, b) => a - b);
    for (let i = 1; i < marks.length; i++) longestDry = Math.max(longestDry, marks[i] - marks[i - 1]);
  }

  return {
    events: wach.length,
    hits: treffer.length,
    accidents: unfaelle.length,
    // Unfaelle, bei denen das Kind den Drang trotzdem gemerkt hat - das ist Fortschritt,
    // kein Rueckschritt, und darf nicht in einem Topf mit "kam einfach" landen.
    accidentsNoticed: unfaelle.filter((e) => e.initiative !== 'none').length,
    rate: wach.length ? treffer.length / wach.length : null,
    autonomy: maxScore ? score / maxScore : null,
    self: zaehl('self'),
    onRequest: zaehl('onRequest'),
    onPrompt: zaehl('onPrompt'),
    none: zaehl('none'),
    peeCount: wach.filter(isPee).length,
    hasStool: dayEvents.some(isPoop),
    nightEvents: schlaf.filter((e) => !isSuccess(e)).length,
    longestDryMinutes: Math.round(longestDry / 60000),
    accidentTimes: unfaelle.map((e) => minutesOfDay(e.ts)).sort((a, b) => a - b),
    firstTs: wach.length ? wach[0].ts : null,
  };
}

function label(day, baseline) {
  const value = (day.rate + day.autonomy) / 2;
  if (baseline == null) {
    if (value >= 0.75) return 'Starker Tag';
    if (value >= 0.55) return 'Guter Tag';
    if (value >= 0.35) return 'Solider Tag';
    return 'Zäher Tag – gehört dazu';
  }
  const diff = value - baseline;
  if (diff >= 0.08) return 'Starker Tag';
  if (diff >= -0.02) return 'Guter Tag';
  if (diff >= -0.12) return 'Solider Tag';
  return 'Zäher Tag – gehört dazu';
}

// Beobachtungen zum Tag. Regelbasiert wie die Tipps, immer hoechstens zwei,
// und nie wertend gegenueber dem Kind.
function observations(day, history, dayKeyStr) {
  const out = [];
  const past = history.filter((d) => d.key !== dayKeyStr && d.stats.events >= MIN_EVENTS);

  const bestSelf = Math.max(0, ...past.map((d) => d.stats.self));
  if (day.self > 0 && day.self > bestSelf && past.length >= 2)
    out.push(`${day.self}× von allein gemeldet – ihr bisheriger Bestwert.`);
  else if (day.self > 0 && day.self >= bestSelf && past.length >= 2)
    out.push(`${day.self}× von allein gemeldet, so oft wie an ihrem besten Tag.`);

  if (day.accidents === 0 && day.events >= MIN_EVENTS)
    out.push('Kein einziger Unfall heute.');

  // Haeufen sich die Unfaelle in einem engen Fenster?
  if (day.accidentTimes.length >= 2) {
    const span = day.accidentTimes[day.accidentTimes.length - 1] - day.accidentTimes[0];
    if (span <= 150)
      out.push(`Die ${day.accidentTimes.length} Unfälle lagen alle zwischen ${timeLabel(day.accidentTimes[0])} und ${timeLabel(day.accidentTimes[day.accidentTimes.length - 1])}.`);
  }

  if (day.accidentsNoticed > 0)
    out.push(`${day.accidentsNoticed} der Unfälle hat sie selbst bemerkt – das zählt als Fortschritt.`);

  // Viele Ansagen tragen die Quote: ehrlich benennen, ohne zu tadeln.
  if (day.events >= 6 && day.onPrompt / day.events >= 0.6 && day.self <= 1)
    out.push('Die Quote kam heute vor allem über eure Ansagen zustande.');

  const gestern = past.find((d) => d.key === dayKey(new Date(dayKeyStr + 'T12:00:00').getTime() - DAY_MS));
  if (!day.hasStool && gestern && !gestern.stats.hasStool)
    out.push('Zweiter Tag ohne Kaka – Verstopfung ist der häufigste stille Treiber hinter Unfällen.');

  return out.slice(0, 2);
}

export function buildDayReports(allEvents, settings, count = 4, now = Date.now()) {
  const byDay = new Map();
  for (const e of allEvents) {
    const k = dayKey(e.ts);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const history = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, evs]) => ({ key, stats: analyseDay(evs, settings) }));

  const reports = [];
  for (let i = 0; i < count; i++) {
    const key = dayKey(now - i * DAY_MS);
    const entry = history.find((d) => d.key === key);
    const stats = entry ? entry.stats : analyseDay([], settings);

    // Vergleichsmassstab: die eigenen letzten 7 Tage vor diesem Tag.
    const before = history.filter((d) => d.key < key && d.stats.events >= MIN_EVENTS).slice(-7);
    const baseline = before.length
      ? before.reduce((a, d) => a + (d.stats.rate + d.stats.autonomy) / 2, 0) / before.length
      : null;
    const baseRate = before.length ? before.reduce((a, d) => a + d.stats.rate, 0) / before.length : null;
    const baseAut = before.length ? before.reduce((a, d) => a + d.stats.autonomy, 0) / before.length : null;

    reports.push({
      key,
      isToday: i === 0,
      enough: stats.events >= MIN_EVENTS,
      stats,
      ratePct: stats.rate == null ? null : pct(stats.rate),
      autonomyPct: stats.autonomy == null ? null : pct(stats.autonomy),
      rateDelta: baseRate == null || stats.rate == null ? null : pct(stats.rate - baseRate),
      autonomyDelta: baseAut == null || stats.autonomy == null ? null : pct(stats.autonomy - baseAut),
      label: stats.events >= MIN_EVENTS ? label(stats, baseline) : null,
      observations: stats.events >= MIN_EVENTS ? observations(stats, history, key) : [],
      dryLabel: durationLabel(stats.longestDryMinutes),
    });
  }
  return reports;
}
