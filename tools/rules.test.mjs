// Szenario-Tests der Regel-Engine. Alle Daten sind erfunden.
// Aufruf: node tools/rules.test.mjs
import { computeFeatures } from '../js/features.js';
import { evaluateRules } from '../js/engine.js';
import { RULESET } from '../js/rules.data.js';
import { DEFAULT_SETTINGS } from '../js/model.js';

const DAY = 86400000;
const NOW = new Date('2026-09-03T19:00:00').getTime();
let seq = 0;
const ev = (d, h, m, what, where, initiative, extra = {}) => ({
  id: 'e' + ++seq,
  ts: new Date(new Date(NOW - d * DAY).setHours(h, m, 0, 0)).getTime(),
  what, where, initiative, ...extra,
});

function run(name, events, settingsOverride = {}, expect = []) {
  const settings = { ...DEFAULT_SETTINGS, birthMonth: '2023-03', ...settingsOverride };
  const config = { ...RULESET.config, noteKeywords: RULESET.noteKeywords };
  const computed = computeFeatures(events, settings, config, NOW);
  const { allCandidates } = evaluateRules(RULESET, computed, {}, NOW, settings);
  const fired = allCandidates.map((c) => c.id);
  const missing = expect.filter((id) => !fired.includes(id));
  const ok = missing.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      gefeuert: ${fired.join(', ') || '–'}`);
  if (!ok) console.log(`      ERWARTET, ABER NICHT GEFEUERT: ${missing.join(', ')}`);
  return ok;
}

const results = [];

// A: Tagsüber stabil, nachts nass -> einordnender Nacht-Tipp, keine Abwertung der Quote
{
  const e = [];
  for (let d = 20; d >= 0; d--) {
    e.push(ev(d, 7, 30, 'pee', 'toilet', 'self'), ev(d, 10, 30, 'pee', 'potty', 'self'),
           ev(d, 13, 0, 'poop', 'toilet', 'self'), ev(d, 16, 0, 'pee', 'potty', 'self'),
           ev(d, 19, 0, 'pee', 'toilet', 'self'));
    if (d % 2 === 0) e.push(ev(d, 3, 0, 'pee', 'bed', 'none', { duringSleep: true }));
  }
  results.push(run('A  Nachts nass trotz guter Tagesquote', e, {}, ['night_wetting_despite_good_days']));
}

// B: Hohe Frequenz + Haltemanöver -> Drang-Muster mit Arzt-Hinweis
{
  const e = [];
  for (let d = 13; d >= 0; d--) {
    for (let i = 0; i < 9; i++) {
      const accident = i % 3 === 0;
      e.push(ev(d, 7 + i, 15, 'pee', accident ? 'pants' : 'potty', accident ? 'none' : 'onRequest',
        i % 4 === 0 ? { note: 'hat gehockt und die Beine gekreuzt' } : {}));
    }
  }
  results.push(run('B  Plötzlicher Drang, hohe Frequenz', e, {}, ['urgency_pattern']));
}

// C: Stuhllücke + steigende Unfälle -> Verstopfungs-Hinweis
{
  const e = [];
  for (let d = 20; d >= 0; d--) {
    e.push(ev(d, 8, 0, 'pee', 'potty', 'self'), ev(d, 12, 0, 'pee', 'potty', 'onRequest'));
    if (d < 6) e.push(ev(d, 15, 0, 'pee', 'pants', 'none'), ev(d, 17, 30, 'pee', 'pants', 'none'));
    if (d > 5 && d % 2 === 0) e.push(ev(d, 13, 0, 'poop', 'toilet', 'onRequest'));
  }
  results.push(run('C  Verstopfung als Treiber', e, {}, ['stool_gap']));
}

// D: Stabil, dann Einbruch -> Regressions-Einordnung
{
  const e = [];
  for (let d = 20; d >= 4; d--)
    e.push(ev(d, 8, 0, 'pee', 'potty', 'self'), ev(d, 12, 0, 'pee', 'toilet', 'self'),
           ev(d, 16, 0, 'pee', 'potty', 'self'), ev(d, 19, 0, 'poop', 'toilet', 'self'));
  for (let d = 3; d >= 0; d--)
    e.push(ev(d, 8, 0, 'pee', 'pants', 'none'), ev(d, 12, 0, 'pee', 'pants', 'none'),
           ev(d, 16, 0, 'pee', 'floor', 'none'), ev(d, 19, 0, 'pee', 'potty', 'onPrompt'));
  results.push(run('D  Rückschritt nach stabiler Phase', e, {}, ['regression_drop']));
}

// E: Schmerz-Notizen -> Red Flag, auch bei wenigen Daten
{
  const e = [
    ev(2, 9, 0, 'pee', 'potty', 'self', { note: 'hat geweint, sagt es brennt' }),
    ev(1, 11, 0, 'pee', 'toilet', 'onRequest', { note: 'Schmerzen beim Pipi' }),
    ev(0, 9, 0, 'pee', 'potty', 'self'),
  ];
  results.push(run('E  Schmerz-Hinweise in Notizen', e, {}, ['pain_notes_red_flag']));
}

// F: Kind über 5, nachts nass -> Abklärungs-Hinweis
{
  const e = [];
  for (let d = 80; d >= 0; d -= 2) {
    e.push(ev(d, 8, 0, 'pee', 'toilet', 'self'), ev(d, 15, 0, 'pee', 'toilet', 'self'));
    if (d % 10 === 0) e.push(ev(d, 2, 30, 'pee', 'bed', 'none', { duringSleep: true }));
  }
  results.push(run('F  Einnässen im Schlaf ab 5 Jahren', e, { birthMonth: '2021-01' }, ['night_wetting_age5']));
}

// G: Zu wenig Daten -> ausser Red Flags feuert nichts
{
  const e = [ev(1, 9, 0, 'pee', 'pants', 'none'), ev(0, 10, 0, 'pee', 'pants', 'none')];
  const settings = { ...DEFAULT_SETTINGS, birthMonth: '2023-03' };
  const computed = computeFeatures(e, settings, { ...RULESET.config, noteKeywords: RULESET.noteKeywords }, NOW);
  const { allCandidates } = evaluateRules(RULESET, computed, {}, NOW, settings);
  const ok = allCandidates.every((c) => c.category === 'red_flag');
  console.log(`${ok ? 'PASS' : 'FAIL'}  G  Startphase bleibt still`);
  console.log(`      gefeuert: ${allCandidates.map((c) => c.id).join(', ') || '–'}`);
  results.push(ok);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} Szenarien bestanden`);
process.exit(failed ? 1 : 0);
