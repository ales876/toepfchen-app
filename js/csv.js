// CSV-Import/Export. Der Import ist bewusst nachsichtig: Trennzeichen wird erraten,
// Spalten werden vorgeschlagen und lassen sich im Dialog korrigieren.
// Bestehende Tracker-Exporte haben selten dieselben Spaltennamen.

import { newId } from './db.js';

const HEADER_HINTS = {
  ts: ['zeit', 'datum', 'timestamp', 'date', 'time', 'zeitpunkt', 'wann'],
  what: ['was', 'art', 'typ', 'type', 'what', 'ereignis'],
  where: ['wohin', 'wo', 'ort', 'where', 'place'],
  initiative: ['initiative', 'wer', 'ausloeser', 'auslöser', 'anlass'],
  duringSleep: ['schlaf', 'nacht', 'sleep', 'night'],
  note: ['notiz', 'note', 'kommentar', 'bemerkung', 'comment'],
};

const VALUE_MAPS = {
  what: {
    pee: ['pipi', 'pee', 'urin', 'wee', 'nass', 'klein', 'wasser'],
    poop: ['kaka', 'poop', 'stuhl', 'kacka', 'gross', 'groß', 'aa', 'kot'],
    both: ['beides', 'both', 'beide'],
  },
  where: {
    potty: ['töpfchen', 'toepfchen', 'potty', 'topf'],
    toilet: ['toilette', 'toilet', 'wc', 'klo'],
    outside: ['draußen', 'draussen', 'outside', 'garten'],
    pants: ['hose', 'pants', 'windel', 'diaper', 'unterhose'],
    floor: ['boden', 'floor', 'teppich'],
    bed: ['bett', 'bed', 'matratze'],
  },
  initiative: {
    self: ['alleine', 'allein', 'self', 'selbst', 'eigen'],
    onRequest: ['anfrage', 'gefragt', 'request', 'nachfrage'],
    onPrompt: ['ansage', 'prompt', 'aufforderung', 'gesagt'],
    none: ['unfall', 'keine', 'none', 'accident', 'ohne'],
  },
};

export function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = [',', ';', '\t', '|'].map((d) => [d, line.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

export function parseCSV(text, delimiter = null) {
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const cleaned = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!cleaned.length) return { headers: [], rows: [] };
  return { headers: cleaned[0].map((h) => h.trim()), rows: cleaned.slice(1) };
}

export function autoMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const low = h.toLowerCase();
    for (const [field, hints] of Object.entries(HEADER_HINTS)) {
      if (map[field] !== undefined) continue;
      if (hints.some((hint) => low.includes(hint))) map[field] = i;
    }
  });
  // Datum und Uhrzeit getrennt? Zweite Zeitspalte merken.
  const timeIdx = headers.findIndex((h, i) => i !== map.ts && /uhrzeit|zeit|time/i.test(h));
  if (map.ts !== undefined && timeIdx >= 0) map.time = timeIdx;
  return map;
}

function normalizeValue(raw, field, fallback) {
  const v = (raw || '').toString().trim().toLowerCase();
  if (!v) return fallback;
  const maps = VALUE_MAPS[field];
  if (!maps) return v;
  for (const [key, words] of Object.entries(maps)) {
    if (key.toLowerCase() === v) return key;
    if (words.some((w) => v.includes(w))) return key;
  }
  return fallback;
}

export function parseTimestamp(dateStr, timeStr) {
  const date = (dateStr || '').trim();
  const time = (timeStr || '').trim();
  const raw = `${date} ${time}`.trim();
  if (!raw) return null;

  // Deutsches Format zuerst: Chrome liest "01.09.2026" sonst als 9. Januar.
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})[ ,T]*(?:(\d{1,2}):(\d{2}))?/);
  if (de) {
    const year = de[3].length === 2 ? 2000 + Number(de[3]) : Number(de[3]);
    return new Date(year, Number(de[2]) - 1, Number(de[1]), Number(de[4] ?? 12), Number(de[5] ?? 0)).getTime();
  }
  // ISO mit oder ohne T
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(?:(\d{1,2}):(\d{2}))?/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] ?? 12), Number(iso[5] ?? 0)).getTime();
  }
  const fallback = Date.parse(raw);
  return Number.isNaN(fallback) ? null : fallback;
}

export function rowsToEvents(rows, map) {
  const events = [];
  const skipped = [];
  rows.forEach((r, idx) => {
    const ts = parseTimestamp(r[map.ts], map.time !== undefined ? r[map.time] : '');
    if (!ts) { skipped.push({ line: idx + 2, reason: 'Zeitpunkt nicht lesbar' }); return; }
    const sleepRaw = map.duringSleep !== undefined ? (r[map.duringSleep] || '').toLowerCase() : '';
    const where = normalizeValue(r[map.where], 'where', 'potty');
    events.push({
      id: newId(),
      ts,
      what: normalizeValue(r[map.what], 'what', 'pee'),
      where,
      initiative: normalizeValue(r[map.initiative], 'initiative', where === 'pants' || where === 'floor' || where === 'bed' ? 'none' : 'onPrompt'),
      duringSleep: sleepRaw ? ['1', 'ja', 'true', 'x', 'yes'].includes(sleepRaw.trim()) : undefined,
      note: map.note !== undefined ? (r[map.note] || '').trim() : '',
      importedAt: Date.now(),
    });
  });
  return { events, skipped };
}

const q = (v) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(events) {
  const head = ['id', 'zeitpunkt', 'datum', 'uhrzeit', 'was', 'wohin', 'initiative', 'im_schlaf', 'notiz'];
  const lines = [head.join(';')];
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    const d = new Date(e.ts);
    const pad = (n) => String(n).padStart(2, '0');
    lines.push(
      [
        e.id,
        new Date(e.ts - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        e.what,
        e.where,
        e.initiative,
        e.duringSleep ? 'ja' : 'nein',
        e.note || '',
      ].map(q).join(';')
    );
  }
  return lines.join('\n');
}

export function toJSON(events, settings) {
  return JSON.stringify({ app: 'potty-quest', version: 1, exportedAt: new Date().toISOString(), settings, events }, null, 2);
}
