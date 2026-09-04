// UI-Schicht. Haelt bewusst keine Logik: rechnen macht features.js, entscheiden engine.js.

import * as db from './db.js';
import {
  WHAT, WHERE, INITIATIVE, DEFAULT_SETTINGS, isSuccess, isAccident,
  dayKey, minutesOfDay, timeLabel, percentLabel, durationLabel,
} from './model.js';
import { computeFeatures, isSleepEvent } from './features.js';
import { evaluateRules } from './engine.js';
import { RULESET } from './rules.data.js';
import { EVIDENCE } from './evidence.data.js';
import { successTrendChart, initiativeChart, heatmapChart, intervalChart, dayTimeline } from './charts.js';
import { mascot } from './mascot.js';
import { icon } from './icons.js';
import { burst } from './confetti.js';
import { toCSV, toJSON, parseCSV, autoMap, rowsToEvents } from './csv.js';

const $ = (sel) => document.querySelector(sel);
const el = (id) => document.getElementById(id);

const state = {
  settings: { ...DEFAULT_SETTINGS },
  events: [],
  computed: null,
  tips: [],
  tipState: {},
  draft: { what: 'pee', where: null, initiative: null, duringSleep: false, ts: null, note: '' },
  view: 'track',
  lastSaved: null,
  importDraft: null,
};

// --------------------------------------------------------------- Auswahlfelder
function renderChoices() {
  el('pick-what').innerHTML = Object.entries(WHAT)
    .map(
      ([k, v]) =>
        `<button class="choice" data-group="what" data-value="${k}" aria-pressed="${state.draft.what === k}">
           <span class="ico">${icon(v.icon)}</span><span class="txt">${v.label}</span></button>`
    )
    .join('');
  el('pick-where').innerHTML = Object.entries(WHERE)
    .map(
      ([k, v]) =>
        `<button class="choice ${v.success ? 'tone-green' : 'tone-red'}" data-group="where" data-value="${k}"
           aria-pressed="${state.draft.where === k}"><span class="ico">${icon(v.icon)}</span><span class="txt">${v.label}</span></button>`
    )
    .join('');
  el('pick-initiative').innerHTML = Object.entries(INITIATIVE)
    .map(
      ([k, v]) =>
        `<button class="choice tone-${v.tone}" data-group="initiative" data-value="${k}"
           aria-pressed="${state.draft.initiative === k}"><span class="ico">${icon(v.icon)}</span><span class="txt">${v.label}</span></button>`
    )
    .join('');
}

document.addEventListener('click', (e) => {
  const choice = e.target.closest('.choice');
  if (!choice) return;
  const { group, value } = choice.dataset;
  state.draft[group] = value;
  // Unfallorte implizieren "keine Initiative" - spart einen Tap, bleibt aenderbar.
  if (group === 'where' && !WHERE[value].success && !state.draft.initiative) state.draft.initiative = 'none';
  if (group === 'where' && WHERE[value].success && state.draft.initiative === 'none') state.draft.initiative = null;
  if (group === 'where' && (value === 'bed') && !el('during-sleep').checked) el('during-sleep').checked = true;
  renderChoices();
});

// --------------------------------------------------------------- Speichern
async function saveEvent() {
  if (!state.draft.where) {
    flash('Wohin ist es gegangen?');
    return;
  }
  const tsInput = el('ev-time').value;
  // Ein vertipptes Datum in der Zukunft wuerde Serie und Quote still verfaelschen.
  const wanted = tsInput ? new Date(tsInput).getTime() : Date.now();
  const inFuture = wanted > Date.now() + 60000;
  const ev = {
    ts: inFuture ? Date.now() : wanted,
    what: state.draft.what || 'pee',
    where: state.draft.where,
    initiative: state.draft.initiative || (WHERE[state.draft.where].success ? 'onPrompt' : 'none'),
    duringSleep: el('during-sleep').checked,
    note: el('ev-note').value.trim(),
  };
  const saved = await db.putEvent(ev);
  state.lastSaved = saved;
  resetDraft();
  await refresh();

  if (inFuture) {
    setMascot('idle');
    flash('Zeitpunkt lag in der Zukunft – auf jetzt gesetzt.', 'Rückgängig');
    return;
  }

  if (isSuccess(saved)) {
    setMascot('cheer');
    burst(el('save-event'));
    flash(streakLine(), 'Rückgängig');
  } else {
    setMascot('comfort');
    flash('Passiert. Steht drin, weiter geht’s.', 'Rückgängig');
  }
}

function streakLine() {
  const s = state.computed?.features['streak.current'] || 0;
  return s > 1 ? `Eingetragen – ${s} in Folge!` : 'Eingetragen!';
}

function resetDraft() {
  state.draft = { what: 'pee', where: null, initiative: null, duringSleep: false, ts: null, note: '' };
  el('during-sleep').checked = false;
  el('ev-note').value = '';
  el('ev-time').value = '';
  el('details-box').classList.add('hidden');
  renderChoices();
}

// --------------------------------------------------------------- Snackbar
let snackTimer = null;
function flash(text, actionLabel = null) {
  document.querySelector('.snackbar')?.remove();
  const bar = document.createElement('div');
  bar.className = 'snackbar';
  bar.innerHTML = `<span>${text}</span>${actionLabel ? `<button type="button">${actionLabel}</button>` : ''}`;
  bar.querySelector('button')?.addEventListener('click', async () => {
    if (state.lastSaved) {
      await db.deleteEvent(state.lastSaved.id);
      state.lastSaved = null;
      await refresh();
      setMascot('idle');
    }
    bar.remove();
  });
  document.body.appendChild(bar);
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => bar.remove(), 5000);
}

function setMascot(mood) {
  el('mascot-slot').innerHTML = mascot(mood, 64);
  if (mood !== 'idle') setTimeout(() => el('mascot-slot').innerHTML = mascot('idle', 64), 3200);
}

// --------------------------------------------------------------- Render
async function refresh() {
  state.events = await db.allEvents();
  const config = { ...RULESET.config, ...(state.settings.configOverrides || {}), noteKeywords: RULESET.noteKeywords };
  state.computed = computeFeatures(state.events, state.settings, config);
  const { tips } = evaluateRules(RULESET, state.computed, state.tipState, Date.now(), state.settings);
  state.tips = state.settings.tipsEnabled ? tips : [];
  renderToday();
  renderOnboarding();
  renderStats();
  renderTips();
  renderDataView();
  const streak = state.computed.features['streak.current'];
  el('streak-badge').innerHTML = `${icon('fire', 18)} ${streak}`;
  const badge = el('tips-badge');
  const urgent = state.tips.filter((t) => t.severity === 'medical' || t.severity === 'attention').length;
  badge.textContent = urgent;
  badge.classList.toggle('hidden', urgent === 0);
  el('subline').textContent = state.settings.childName
    ? `Unterwegs mit ${state.settings.childName}`
    : 'Bereit, wenn du es bist.';
}

function renderToday() {
  const today = dayKey(Date.now());
  const evs = state.events.filter((e) => dayKey(e.ts) === today).sort((a, b) => b.ts - a.ts);
  const hits = evs.filter(isSuccess).length;
  el('today-summary').textContent = evs.length
    ? `${evs.length} Einträge · ${hits} im Töpfchen/WC · ${evs.length - hits} daneben`
    : 'Noch nichts erfasst.';
  el('today-log').innerHTML = evs
    .map(
      (e) => `<li>
        <span class="dot ${INITIATIVE[e.initiative]?.tone || 'yellow'}"></span>
        <span class="when">${timeLabel(minutesOfDay(e.ts))}</span>
        <span>${icon(WHAT[e.what]?.icon, 18)} ${WHERE[e.where]?.label || e.where}${e.duringSleep ? ' · <span class="mini">Schlaf</span>' : ''}
          ${e.note ? `<br><span class="mini">${escapeHtml(e.note)}</span>` : ''}</span>
        <button class="del" data-del="${e.id}" aria-label="Eintrag löschen">✕</button></li>`
    )
    .join('');
}

const escapeHtml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function renderStats() {
  const f = state.computed.features;
  const s = state.computed.series;
  // 7 oder 14 Tage - beide Werte liegen im FeatureStore schon vor.
  const win = Number(state.settings.statsWindow) === 7 ? 7 : 14;
  const rate = win === 7 ? f['successRate.last7d'] : f['daytime.successRate14d'];
  el('stats-window').value = String(win);
  el('kpis').innerHTML = [
    [`Erfolgsquote ${win} Tage`, percentLabel(rate)],
    ['Alleine gegangen', percentLabel(f['initiative.selfShare21d'])],
    ['Typischer Abstand', f['intervals.medianLabel']],
    ['Gänge pro Tag', String(Math.round(f['voidFrequency.median']))],
    ['Serie', `${f['streak.current']}`],
    ['Im Schlaf (14 T.)', String(f['night.eventCount14d'])],
  ]
    .map(([k, v]) => `<div class="kpi"><div class="v">${v}</div><div class="k">${k}</div></div>`)
    .join('');
  const awake = state.events.filter((e) => !isSleepEvent(e, state.settings));
  el('chart-success').innerHTML = successTrendChart(s.rates);
  el('chart-initiative').innerHTML = initiativeChart(s.selfByDay);
  el('chart-heatmap').innerHTML = heatmapChart(awake);
  el('chart-intervals').innerHTML = intervalChart(awake);
}

function renderTips() {
  const list = el('tips-list');
  if (!state.settings.tipsEnabled) {
    list.innerHTML = `<div class="card"><h2>Tipps sind aus</h2><p class="hint">Unter „Daten“ wieder einschalten.</p></div>`;
    return;
  }
  if (!state.tips.length) {
    const days = state.computed.features['tracking.daysWithData'];
    // Kleinste Datenanforderung aller Muster-Regeln - damit der leere Zustand
    // sagt, wann es losgeht, statt nur "nichts da".
    const firstThreshold = Math.min(
      ...RULESET.rules
        .filter((r) => r.category !== 'red_flag' && r.requires?.minTrackedDays)
        .map((r) => r.requires.minTrackedDays)
    );
    const missing = firstThreshold - days;
    list.innerHTML = `<div class="card center">${mascot('idle', 96)}
      <h2>Noch keine Muster</h2>
      <p class="hint">${
        missing > 0
          ? `${days} Tag(e) erfasst. Die ersten Muster-Regeln greifen ab ${firstThreshold} Tagen – noch ${missing} Tag(e). Aus weniger Daten geratene Tipps helfen niemandem.`
          : 'Die Daten zeigen gerade nichts Auffälliges. Das ist eine gute Nachricht.'
      }</p></div>`;
    return;
  }
  list.innerHTML = state.tips
    .map((t) => {
      const evs = state.events.filter((e) => t.evidenceIds.includes(e.id));
      const refs = (t.evidence?.ref || []).map((r) => `<li><b>${r}:</b> ${EVIDENCE[r] || ''}</li>`).join('');
      return `<div class="card tip sev-${t.severity}" data-tip="${t.id}">
        <h3>${escapeHtml(t.headline)}</h3>
        <p>${escapeHtml(t.body)}</p>
        ${t.action ? `<div class="action">${escapeHtml(t.action)}</div>` : ''}
        <details>
          <summary>${evs.length ? `Warum sehe ich das? (${evs.length} Ereignisse)` : 'Worauf beruht das?'}</summary>
          <div style="margin-top:8px">${evs.length ? dayTimeline(evs, t.evidenceIds) : ''}
          <ul style="padding-left:18px;margin:8px 0">${refs}</ul>
          <span class="mini">Vertrauen in die Regel: ${t.evidence?.confidence || '–'}</span></div>
        </details>
        ${t.disclaimer ? `<div class="disclaimer">Heuristik auf Basis allgemeiner Entwicklungsprinzipien – kein medizinischer Rat. Bei Sorgen: Kinderarzt.</div>` : ''}
        <div class="feedback">
          <button data-feedback="ok" data-tip="${t.id}">Hilfreich</button>
          <button data-feedback="no" data-tip="${t.id}">Nicht hilfreich</button>
        </div>
      </div>`;
    })
    .join('');
}

function renderDataView() {
  const f = state.computed.features;
  el('data-summary').textContent = `${state.events.length} Ereignisse · ${f['tracking.daysWithData']} Tage mit Daten · alles lokal gespeichert.`;
}

// --------------------------------------------------------------- Navigation
const TAB_ICONS = { track: 'pencil', stats: 'chart', tips: 'bulb', data: 'gear' };
document.querySelectorAll('.tabbar button').forEach((btn) => {
  btn.querySelector('.ico').innerHTML = icon(TAB_ICONS[btn.dataset.view], 24);
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    ['track', 'stats', 'tips', 'data'].forEach((v) => el(`view-${v}`).classList.toggle('hidden', v !== state.view));
    window.scrollTo({ top: 0 });
  });
});

// --------------------------------------------------------------- Interaktionen
document.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    await db.deleteEvent(del.dataset.del);
    await refresh();
    return;
  }
  const fb = e.target.closest('[data-feedback]');
  if (fb) {
    const id = fb.dataset.tip;
    state.tipState[id] = {
      lastShown: Date.now(),
      snoozedUntil: fb.dataset.feedback === 'no' ? Date.now() + 30 * 86400000 : Date.now() + 7 * 86400000,
    };
    await db.setMeta('tipState', state.tipState);
    await refresh();
    flash(fb.dataset.feedback === 'no' ? 'Alles klar – der Tipp pausiert 30 Tage.' : 'Notiert, danke!');
  }
});

el('toggle-details').addEventListener('click', () => {
  const box = el('details-box');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden') && !el('ev-time').value) {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    el('ev-time').value = d.toISOString().slice(0, 16);
  }
});
el('save-event').addEventListener('click', saveEvent);

// --------------------------------------------------------------- Einstellungen
el('stats-window').addEventListener('change', async (e) => {
  state.settings = { ...state.settings, statsWindow: Number(e.target.value) };
  await db.setMeta('settings', state.settings);
  renderStats();
});

el('save-settings').addEventListener('click', async () => {
  state.settings = {
    ...state.settings,
    childName: el('set-name').value.trim(),
    birthMonth: el('set-birth').value,
    hasNap: el('set-nap').checked,
    tipsEnabled: el('set-tips').checked,
  };
  await db.setMeta('settings', state.settings);
  await refresh();
  flash('Gespeichert.');
});

function fillSettings() {
  el('set-name').value = state.settings.childName || '';
  el('set-birth').value = state.settings.birthMonth || '';
  el('set-nap').checked = !!state.settings.hasNap;
  el('set-tips').checked = state.settings.tipsEnabled !== false;
}

// --------------------------------------------------------------- Onboarding
function renderOnboarding() {
  const needed = !state.settings.onboarded && !state.settings.birthMonth && state.events.length === 0;
  el('onboarding').classList.toggle('hidden', !needed);
}

el('onb-save').addEventListener('click', async () => {
  state.settings = {
    ...state.settings,
    birthMonth: el('onb-birth').value,
    hasNap: el('onb-nap').checked,
    onboarded: true,
  };
  await db.setMeta('settings', state.settings);
  fillSettings();
  await refresh();
  flash('Fertig – einfach loslegen.');
});
el('onb-skip').addEventListener('click', async () => {
  state.settings = { ...state.settings, onboarded: true };
  await db.setMeta('settings', state.settings);
  await refresh();
});

// --------------------------------------------------------------- Export / Import
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

el('export-csv').addEventListener('click', () =>
  download(`potquest-${dayKey(Date.now())}.csv`, toCSV(state.events), 'text/csv;charset=utf-8')
);
el('export-json').addEventListener('click', () =>
  download(`potquest-backup-${dayKey(Date.now())}.json`, toJSON(state.events, state.settings), 'application/json')
);
el('import-btn').addEventListener('click', () => el('import-file').click());
el('import-json-btn').addEventListener('click', () => el('import-json-file').click());

// Eigener Weg fuer JSON: Backups der App und uebertragene Bestandsdaten.
// Ereignisse behalten ihre id, ein zweiter Import legt also keine Dubletten an.
el('import-json-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.events;
    if (!Array.isArray(list)) throw new Error('keine Ereignisse gefunden');
    const cutoff = Date.now() + 60000;
    const valid = list.filter((ev) => Number.isFinite(ev?.ts) && ev.ts <= cutoff && WHERE[ev.where] && WHAT[ev.what]);
    const dropped = list.length - valid.length;
    await db.putEvents(valid);
    if (data.settings) {
      state.settings = { ...state.settings, ...data.settings };
      await db.setMeta('settings', state.settings);
      fillSettings();
    }
    await refresh();
    flash(`${valid.length} Ereignisse importiert${dropped ? `, ${dropped} übersprungen` : ''}.`);
  } catch (err) {
    flash('Datei konnte nicht gelesen werden.');
  }
});

el('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  e.target.value = '';
  if (file.name.endsWith('.json')) {
    try {
      const data = JSON.parse(text);
      const n = await db.putEvents(data.events || []);
      await refresh();
      flash(`${n} Ereignisse aus dem Backup übernommen.`);
    } catch {
      flash('Backup konnte nicht gelesen werden.');
    }
    return;
  }
  const parsed = parseCSV(text);
  if (!parsed.headers.length) {
    flash('Die CSV ließ sich nicht lesen.');
    return;
  }
  state.importDraft = { ...parsed, map: autoMap(parsed.headers) };
  renderImportBox();
});

function renderImportBox() {
  const box = el('import-box');
  const { headers, rows, map } = state.importDraft;
  const fields = [
    ['ts', 'Datum/Zeit *'],
    ['time', 'Uhrzeit (falls getrennt)'],
    ['what', 'Was'],
    ['where', 'Wohin'],
    ['initiative', 'Initiative'],
    ['duringSleep', 'Im Schlaf'],
    ['note', 'Notiz'],
  ];
  const options = (sel) =>
    `<option value="">– keine –</option>` +
    headers.map((h, i) => `<option value="${i}" ${String(sel) === String(i) ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
  const { events, skipped } = rowsToEvents(rows.slice(0, 5), map);
  box.classList.remove('hidden');
  box.innerHTML = `
    <h2 style="font-size:1rem">Spalten zuordnen</h2>
    <p class="hint">${rows.length} Zeilen erkannt. Was nicht passt, hier korrigieren.</p>
    ${fields
      .map(
        ([key, label]) =>
          `<label class="field">${label}</label><select data-map="${key}">${options(map[key])}</select>`
      )
      .join('')}
    <p class="hint" style="margin-top:14px">Vorschau der ersten Zeilen:</p>
    <table class="preview"><tr><th>Zeit</th><th>Was</th><th>Wohin</th><th>Initiative</th></tr>
    ${events
      .map(
        (ev) =>
          `<tr><td>${new Date(ev.ts).toLocaleString('de-DE')}</td><td>${WHAT[ev.what]?.label}</td><td>${WHERE[ev.where]?.label}</td><td>${INITIATIVE[ev.initiative]?.label}</td></tr>`
      )
      .join('')}</table>
    ${skipped.length ? `<p class="mini">${skipped.length} der ersten 5 Zeilen ohne lesbaren Zeitpunkt.</p>` : ''}
    <div class="btn-row" style="margin-top:14px">
      <button class="btn" id="import-commit">Importieren</button>
      <button class="btn secondary" id="import-cancel">Abbrechen</button>
    </div>`;
  box.querySelectorAll('[data-map]').forEach((sel) =>
    sel.addEventListener('change', () => {
      const v = sel.value;
      if (v === '') delete state.importDraft.map[sel.dataset.map];
      else state.importDraft.map[sel.dataset.map] = Number(v);
      renderImportBox();
    })
  );
  el('import-cancel').addEventListener('click', () => {
    state.importDraft = null;
    box.classList.add('hidden');
  });
  el('import-commit').addEventListener('click', async () => {
    const { events: all, skipped: bad } = rowsToEvents(state.importDraft.rows, state.importDraft.map);
    await db.putEvents(all);
    state.importDraft = null;
    box.classList.add('hidden');
    await refresh();
    flash(`${all.length} Ereignisse importiert${bad.length ? `, ${bad.length} übersprungen` : ''}.`);
  });
}

el('wipe-btn').addEventListener('click', async () => {
  if (!confirm('Wirklich alle Ereignisse löschen? Das lässt sich nicht rückgängig machen.')) return;
  await db.clearEvents();
  await refresh();
  flash('Alles gelöscht.');
});

// Demo-Daten: erfundene Fixtures zum Ausprobieren der Auswertung.
el('demo-btn').addEventListener('click', async () => {
  if (!confirm('21 Tage Beispieldaten anlegen? (Erfundene Werte zum Ausprobieren)')) return;
  const DAY = 86400000;
  const now = Date.now();
  const mk = (d, h, m, what, where, initiative, extra = {}) => ({
    ts: new Date(new Date(now - d * DAY).setHours(h, m, 0, 0)).getTime(),
    what, where, initiative, ...extra,
  });
  const list = [];
  for (let d = 20; d >= 0; d--) {
    const better = d < 8;
    list.push(mk(d, 7, 30, 'pee', 'toilet', 'onPrompt'));
    list.push(mk(d, 10, 5, 'pee', 'potty', better ? 'self' : 'onRequest'));
    list.push(mk(d, 12, 40, 'poop', d % 3 === 0 ? 'potty' : 'pants', 'onRequest'));
    list.push(mk(d, 14, 50, 'pee', 'potty', 'self'));
    list.push(mk(d, 18, 20, 'pee', 'toilet', better ? 'self' : 'onRequest'));
    if (d % 2 === 0 && !better)
      list.push(mk(d, 16, 25, 'pee', 'pants', 'none', { note: 'abgelenkt, hat gespielt' }));
    if (d % 3 === 0) list.push(mk(d, 2, 15, 'pee', 'bed', 'none', { duringSleep: true }));
    if (d % 5 === 0) list.push(mk(d, 9, 25, 'pee', 'floor', 'none', { note: 'kurz nach dem Trinken' }));
  }
  const past = list.filter((e) => e.ts <= Date.now());
  await db.putEvents(past);
  await refresh();
  flash(`${past.length} Beispiel-Ereignisse angelegt.`);
});

// --------------------------------------------------------------- Start
(async function init() {
  state.settings = { ...DEFAULT_SETTINGS, ...(await db.getMeta('settings', {})) };
  state.tipState = (await db.getMeta('tipState', {})) || {};
  el('mascot-slot').innerHTML = mascot('idle', 64);
  renderChoices();
  fillSettings();
  await refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
