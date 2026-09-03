// FeatureStore: rechnet aus den Rohereignissen einmalig alle Kennzahlen,
// auf die sich die Regeln in docs/rules.seed.json beziehen.
// Die Regeln kennen nur Feature-Namen - keine Events, kein Datum, keine Mathematik.

import { median, iqr, wilsonLower, theilSen, mannKendall, ewma, circadianHotspots } from './stats.js';
import {
  isSuccess, isAccident, isPee, isPoop, dayKey, minutesOfDay,
  timeLabel, percentLabel, durationLabel,
} from './model.js';

const DAY_MS = 86400000;

const daysAgo = (ts, now) => Math.floor((now - ts) / DAY_MS);
const within = (events, now, days) => events.filter((e) => e.ts <= now && now - e.ts <= days * DAY_MS);

function matchesKeywords(note, keywords) {
  if (!note) return false;
  const n = note.toLowerCase();
  return keywords.some((k) => n.includes(k.toLowerCase()));
}

// Ein Ereignis zaehlt als Nacht/Schlaf, wenn der Nutzer es so markiert hat.
// Fallback fuer Altdaten und CSV-Import: Uhrzeit im Nachtfenster.
export function isSleepEvent(ev, settings) {
  if (typeof ev.duringSleep === 'boolean') return ev.duringSleep;
  const h = new Date(ev.ts).getHours();
  return h >= settings.nightStartHour || h < settings.nightEndHour;
}

function groupByDay(events) {
  const map = new Map();
  for (const e of events) {
    const k = dayKey(e.ts);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

// Tagesquote nur aus Wach-Ereignissen - Nacht folgt einer eigenen Entwicklungslinie (E4).
function dailyRates(dayMap) {
  return [...dayMap.entries()]
    .map(([day, evs]) => {
      const hits = evs.filter(isSuccess).length;
      const total = evs.length;
      return { day, hits, total, rate: total ? hits / total : null };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function computeFeatures(allEvents, settings, config, now = Date.now()) {
  const events = [...allEvents].sort((a, b) => a.ts - b.ts);
  const kw = config.noteKeywords || {};
  const evidence = {};
  const note = (group, list) => {
    evidence[group] = list.map((e) => e.id);
  };

  const awake = events.filter((e) => !isSleepEvent(e, settings));
  const sleep = events.filter((e) => isSleepEvent(e, settings));

  const awake14 = within(awake, now, 14);
  const awake21 = within(awake, now, 21);
  const awake7 = within(awake, now, 7);

  const dayMap14 = groupByDay(awake14);
  const rates14 = dailyRates(dayMap14);
  const ratesAll = dailyRates(groupByDay(within(awake, now, 90)));

  // Erfassungsdichte: Tage ueber 90 Tage (sonst koennen Regeln mit langem Fenster
  // ihre minTrackedDays nie erreichen), Ereignisse pro Tag ueber die letzten 21.
  const trackedDays = new Set(within(events, now, 90).map((e) => dayKey(e.ts))).size;
  const recentDays = new Set(within(events, now, 21).map((e) => dayKey(e.ts))).size;
  const eventsPerDay = recentDays ? within(events, now, 21).length / recentDays : 0;

  // --- Erfolgsquoten (Wilson-Untergrenze statt Rohquote) ---
  const hits14 = awake14.filter(isSuccess).length;
  const hits7 = awake7.filter(isSuccess).length;
  const daytimeRate14 = awake14.length ? wilsonLower(hits14, awake14.length) : 0;
  const rate7 = awake7.length ? wilsonLower(hits7, awake7.length) : 0;

  // --- Regression: EWMA gegen Baseline der Vorwochen ---
  const baselineWindow = ratesAll.filter((d) => {
    const age = daysAgo(new Date(d.day + 'T12:00:00').getTime(), now);
    return age >= 8 && age <= 21;
  });
  const baseline = median(baselineWindow.map((d) => d.rate)) ?? null;
  const recent = ratesAll.slice(-3);
  const smoothed = ewma(ratesAll.map((d) => d.rate));
  const recentSmoothed = smoothed.length ? smoothed[smoothed.length - 1] : null;
  const drop = baseline != null && recentSmoothed != null ? Math.max(0, baseline - recentSmoothed) : 0;
  let dropDuration = 0;
  if (baseline != null) {
    for (let i = ratesAll.length - 1; i >= 0; i--) {
      if (ratesAll[i].rate < baseline - (config.regressionDropPoints ?? 0.25)) dropDuration++;
      else break;
    }
  }
  let stableDryDays = 0;
  let bestStable = 0;
  for (const d of ratesAll) {
    if (d.rate >= 0.8) {
      stableDryDays++;
      bestStable = Math.max(bestStable, stableDryDays);
    } else stableDryDays = 0;
  }

  // --- Eigeninitiative ---
  const selfShare = (list) => (list.length ? list.filter((e) => e.initiative === 'self').length / list.length : 0);
  const promptedShare = awake21.length
    ? awake21.filter((e) => e.initiative === 'onPrompt').length / awake21.length
    : 0;
  const selfByDay = [...groupByDay(awake21).entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, evs], i) => ({ x: i, y: selfShare(evs), day }));
  const selfSlope = theilSen(selfByDay);
  const selfTrend = mannKendall(selfByDay.map((p) => p.y));
  const selfDelta = selfTrend.p < 0.1 ? selfSlope * 21 : 0;

  // --- Abstaende zwischen Pipi-Gaengen (nur tagsueber, nur innerhalb eines Tages) ---
  const intervals = [];
  const intervalsByDay = new Map();
  for (const [day, evs] of groupByDay(within(awake, now, 21))) {
    const peeTimes = evs.filter(isPee).map((e) => e.ts).sort((a, b) => a - b);
    const perDay = [];
    for (let i = 1; i < peeTimes.length; i++) {
      const gapMin = (peeTimes[i] - peeTimes[i - 1]) / 60000;
      if (gapMin > 5 && gapMin < 600) {
        intervals.push(gapMin);
        perDay.push(gapMin);
      }
    }
    if (perDay.length) intervalsByDay.set(day, perDay);
  }
  const intervalMedian = median(intervals);
  const iqrPoints = [...intervalsByDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, v], i) => ({ x: i, y: iqr(v) ?? 0 }))
    .filter((p) => p.y > 0);
  const iqrTrendPerWeek = iqrPoints.length >= 4 ? theilSen(iqrPoints) * 7 : 0;

  // --- Miktionsfrequenz und Luecken (ICCS-Schwellen, E6) ---
  const peePerDay = [...groupByDay(within(events, now, 14)).values()].map(
    (evs) => evs.filter(isPee).length
  );
  const voidMedian = median(peePerDay) ?? 0;
  let maxGapMinutes = 0;
  for (const [, evs] of groupByDay(within(awake, now, 14))) {
    const t = evs.filter(isPee).map((e) => e.ts).sort((a, b) => a - b);
    for (let i = 1; i < t.length; i++) maxGapMinutes = Math.max(maxGapMinutes, (t[i] - t[i - 1]) / 60000);
  }

  // --- Hotspots im Tagesverlauf ---
  const accidents14 = awake14.filter(isAccident);
  const hotspots = circadianHotspots(
    accidents14.map((e) => minutesOfDay(e.ts)),
    accidents14.map((e) => dayKey(e.ts)),
    {
      sigma: (config.hotspotWindowMinutes ?? 60) / 2,
      minCount: config.hotspotMinAccidents ?? 2,
      minDays: config.hotspotMinDays ?? 3,
    }
  );
  const top = hotspots[0] || null;
  if (top) note('hotspot', top.memberIndexes.map((i) => accidents14[i]));

  // --- Unfaelle nach Essen/Trinken ---
  const intakeEvents = within(events, now, 14).filter(
    (e) => e.what === 'intake' || matchesKeywords(e.note, kw.intake || [])
  );
  const postIntakeWindow = (config.postIntakeWindowMinutes ?? 45) * 60000;
  const postIntakeAccidents = accidents14.filter((a) =>
    intakeEvents.some((i) => a.ts > i.ts && a.ts - i.ts <= postIntakeWindow) ||
    matchesKeywords(a.note, kw.intake || [])
  );
  note('postIntake', postIntakeAccidents);

  // --- Ohne Vorwarnung / Haltemanoever / Schmerz / Verweigerung ---
  const noWarning = accidents14.filter((e) => e.initiative === 'none');
  note('noWarning', noWarning);
  const holding = within(events, now, 14).filter((e) => matchesKeywords(e.note, kw.holding || []));
  const pain = within(events, now, 7).filter((e) => matchesKeywords(e.note, kw.pain || []));
  note('pain', pain);
  const refusal = within(events, now, 10).filter((e) => matchesKeywords(e.note, kw.refusal || []));

  // --- Nacht / Schlaf ---
  const sleep14 = within(sleep, now, 14);
  note('night', sleep14);
  const sleep90 = within(sleep, now, 90).filter(isAccident);
  const monthsWithNight = new Set(sleep90.map((e) => dayKey(e.ts).slice(0, 7))).size;

  // Mittagsschlaf: ein Tag gilt als trocken, wenn im Nap-Fenster kein Schlaf-Unfall liegt.
  // Bewusst konservativ - die App weiss nicht, ob ueberhaupt geschlafen wurde.
  // Genau die letzten 7 Kalendertage - ein 7x24h-Fenster erwischt sonst 8 Tage.
  const last7 = within(events, now, 7);
  const trackedDays7 = [...groupByDay(last7).keys()].sort().slice(-7);
  const napDry = trackedDays7.filter((day) => {
    const dayEvents = last7.filter((e) => dayKey(e.ts) === day);
    return !dayEvents.some(
      (e) =>
        isSleepEvent(e, settings) &&
        isAccident(e) &&
        minutesOfDay(e.ts) >= settings.napWindow.start &&
        minutesOfDay(e.ts) <= settings.napWindow.end
    );
  }).length;

  // --- Stuhl ---
  const stool21 = within(events, now, 21).filter(isPoop);
  const stoolDays = [...new Set(within(events, now, 21).filter(isPoop).map((e) => dayKey(e.ts)))].sort();
  let maxStoolGap = 0;
  if (stoolDays.length) {
    const times = stoolDays.map((d) => new Date(d + 'T12:00:00').getTime());
    for (let i = 1; i < times.length; i++)
      maxStoolGap = Math.max(maxStoolGap, Math.round((times[i] - times[i - 1]) / DAY_MS));
    maxStoolGap = Math.max(maxStoolGap, Math.floor((now - times[times.length - 1]) / DAY_MS));
  }
  const hardStool = within(events, now, 14).filter(
    (e) => isPoop(e) && matchesKeywords(e.note, kw.hardStool || [])
  );
  note('stool', [...hardStool, ...stool21.slice(-3)]);

  // --- Unfall-Trend ---
  const accidentPoints = ratesAll.map((d, i) => ({ x: i, y: d.total - d.hits }));
  const accidentsSlope = accidentPoints.length >= 4 ? theilSen(accidentPoints) * 7 : 0;

  // --- Serie ---
  let streak = 0;
  for (let i = awake.length - 1; i >= 0; i--) {
    if (isSuccess(awake[i])) streak++;
    else break;
  }
  const milestones = config.streakMilestones || [];

  // --- Alter ---
  let ageMonths = null;
  if (settings.birthMonth) {
    const [y, m] = settings.birthMonth.split('-').map(Number);
    const d = new Date(now);
    ageMonths = (d.getFullYear() - y) * 12 + (d.getMonth() + 1 - m);
  }

  const peeAwake21 = awake21.filter(isPee);

  return {
    features: {
      'tracking.daysWithData': trackedDays,
      'tracking.recentDays': recentDays,
      'tracking.eventsPerDay': eventsPerDay,
      'tracking.totalEvents': events.length,

      'daytime.successRate14d': daytimeRate14,
      'daytime.successPercentLabel': percentLabel(daytimeRate14),
      'successRate.last7d': rate7,
      'successRate.dropVsBaseline': drop,
      'successRate.dropDurationDays': dropDuration,
      'successRate.dropPercentLabel': percentLabel(drop),
      'baseline.stableDryDays': bestStable,

      'initiative.selfShare21d': selfShare(awake21),
      'initiative.selfShareDelta21d': selfDelta,
      'initiative.deltaPercentLabel': percentLabel(Math.abs(selfDelta)),
      'initiative.promptedShare21d': promptedShare,
      'initiative.promptedPercentLabel': percentLabel(promptedShare),

      'intervals.medianMinutes': intervalMedian ?? 0,
      'intervals.medianLabel': durationLabel(intervalMedian),
      'intervals.iqrTrendPerWeek': iqrTrendPerWeek,

      'voidFrequency.median': voidMedian,
      'voidFrequency.medianLabel': String(Math.round(voidMedian)),
      'gaps.maxDaytimeHours': maxGapMinutes / 60,
      'gaps.maxDaytimeLabel': durationLabel(maxGapMinutes),

      'hotspot.accidentCount': top ? top.accidentCount : 0,
      'hotspot.distinctDays': top ? top.distinctDays : 0,
      'hotspot.timeLabel': top ? timeLabel(top.centreMinutes) : '–',
      'hotspot.offerTimeLabel': top
        ? timeLabel(top.centreMinutes - (config.preventiveLeadMinutes ?? 20))
        : '–',

      'postIntake.accidentCount': postIntakeAccidents.length,
      'postIntake.share': accidents14.length ? postIntakeAccidents.length / accidents14.length : 0,
      'postIntake.percentLabel': percentLabel(
        accidents14.length ? postIntakeAccidents.length / accidents14.length : 0
      ),

      'noWarning.share': accidents14.length ? noWarning.length / accidents14.length : 0,
      'noWarning.percentLabel': percentLabel(accidents14.length ? noWarning.length / accidents14.length : 0),
      'holdingManeuvers.count14d': holding.length,
      'notes.painMatches7d': pain.length,
      'refusal.notes10d': refusal.length,

      'night.eventCount14d': sleep14.filter(isAccident).length,
      'night.monthsWithEventIn90d': monthsWithNight,
      'nap.dryDaysOf7': settings.hasNap ? napDry : 0,
      'nap.enabled': !!settings.hasNap,

      'stool.maxGapDays': maxStoolGap,
      'stool.eventCount21d': stool21.length,
      'stool.pottyShare21d': stool21.length ? stool21.filter(isSuccess).length / stool21.length : 1,
      'stool.hardStoolNotes14d': hardStool.length,

      'pee.successRate21d': peeAwake21.length
        ? wilsonLower(peeAwake21.filter(isSuccess).length, peeAwake21.length)
        : 0,
      'accidents.trendSlopePerWeek': accidentsSlope,

      'streak.current': streak,
      'streak.currentHitsMilestone': milestones.includes(streak),

      'child.ageMonths': ageMonths ?? 36,
    },
    evidence,
    // Fuer die Charts, nicht fuer die Regeln:
    series: { rates: ratesAll, selfByDay, intervals, hotspots, dayMap14 },
  };
}
