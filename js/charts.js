// Handgemachte SVG-Charts. Bewusst keine Chart-Library:
// der Comic-Look (dicke Outlines, harte Schatten, runde Kappen) waere in Recharts
// mehr Gegenarbeit als Eigenbau, und so bleibt die App abhaengigkeitsfrei und offline.

import { dayKey, isSuccess, isAccident, minutesOfDay, timeLabel, durationLabel } from './model.js';
import { median, quantile } from './stats.js';

const INK = '#22223b';
const COLORS = { green: '#3ec96a', yellow: '#ffc93c', red: '#ff6b6b', blue: '#4dabf7' };

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function shell(w, h, inner, label) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

function emptyState(w, h, text) {
  return shell(w, h, `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" class="chart-empty">${esc(text)}</text>`, text);
}

function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`;
  }
  return d;
}

const shortDay = (key) => {
  const d = new Date(key + 'T12:00:00');
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};

// --- 1. Erfolgsquote pro Tag ---------------------------------------------
export function successTrendChart(rates, days = 21) {
  const W = 640;
  const H = 240;
  const pad = { l: 46, r: 16, t: 20, b: 34 };
  const data = rates.slice(-days);
  if (data.length < 2) return emptyState(W, H, 'Noch zu wenig Daten – ab 2 Tagen wird hier eine Kurve.');

  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.rate), d }));

  let grid = '';
  for (const v of [0, 0.5, 1]) {
    grid += `<line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" class="grid"/>
      <text x="${pad.l - 10}" y="${y(v) + 5}" text-anchor="end" class="tick">${v * 100}%</text>`;
  }
  const area = `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${y(0)} L ${pts[0].x} ${y(0)} Z`;
  const dots = pts
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${
          p.d.rate >= 0.8 ? COLORS.green : p.d.rate >= 0.5 ? COLORS.yellow : COLORS.red
        }" stroke="${INK}" stroke-width="3"><title>${shortDay(p.d.day)}: ${Math.round(p.d.rate * 100)} % (${p.d.hits}/${p.d.total})</title></circle>`
    )
    .join('');
  const labels = pts
    .map((p, i) =>
      i % Math.ceil(data.length / 6) === 0
        ? `<text x="${p.x}" y="${H - 10}" text-anchor="middle" class="tick">${shortDay(p.d.day)}</text>`
        : ''
    )
    .join('');

  return shell(
    W, H,
    `${grid}<path d="${area}" fill="${COLORS.green}" opacity="0.18"/>
     <path d="${smoothPath(pts)}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
     <path d="${smoothPath(pts)}" fill="none" stroke="${COLORS.green}" stroke-width="4" stroke-linecap="round"/>
     ${dots}${labels}`,
    'Erfolgsquote pro Tag'
  );
}

// --- 2. Eigeninitiative ---------------------------------------------------
export function initiativeChart(selfByDay) {
  const W = 640;
  const H = 220;
  const pad = { l: 46, r: 16, t: 20, b: 34 };
  if (selfByDay.length < 2) return emptyState(W, H, 'Die wichtigste Kurve – sie startet ab 2 Tagen.');
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, selfByDay.length - 1);
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const pts = selfByDay.map((p, i) => ({ x: x(i), y: y(p.y), d: p }));
  const grid = [0, 0.5, 1]
    .map(
      (v) =>
        `<line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" class="grid"/><text x="${pad.l - 10}" y="${y(v) + 5}" text-anchor="end" class="tick">${v * 100}%</text>`
    )
    .join('');
  const bars = pts
    .map(
      (p) =>
        `<rect x="${p.x - 8}" y="${p.y}" width="16" height="${Math.max(2, y(0) - p.y)}" rx="6" fill="${COLORS.blue}" stroke="${INK}" stroke-width="3"><title>${shortDay(p.d.day)}: ${Math.round(p.d.y * 100)} % alleine</title></rect>`
    )
    .join('');
  return shell(W, H, `${grid}${bars}<path d="${smoothPath(pts)}" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="10 8" stroke-linecap="round"/>`, 'Anteil selbst initiierter Gänge');
}

// --- 3. Heatmap Wochentag x Uhrzeit --------------------------------------
export function heatmapChart(events) {
  const W = 640;
  const H = 260;
  const pad = { l: 44, r: 12, t: 24, b: 28 };
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const buckets = 12; // 2-Stunden-Raster
  const cells = Array.from({ length: 7 }, () => Array.from({ length: buckets }, () => ({ hit: 0, acc: 0 })));
  for (const e of events) {
    const d = new Date(e.ts);
    const row = (d.getDay() + 6) % 7;
    const col = Math.floor(minutesOfDay(e.ts) / (1440 / buckets));
    if (isSuccess(e)) cells[row][col].hit++;
    else cells[row][col].acc++;
  }
  const cw = (W - pad.l - pad.r) / buckets;
  const ch = (H - pad.t - pad.b) / 7;
  let out = '';
  for (let r = 0; r < 7; r++) {
    out += `<text x="${pad.l - 8}" y="${pad.t + r * ch + ch / 2 + 4}" text-anchor="end" class="tick">${dayNames[r]}</text>`;
    for (let c = 0; c < buckets; c++) {
      const { hit, acc } = cells[r][c];
      const total = hit + acc;
      const fill = total === 0 ? '#f1ece2' : acc > hit ? COLORS.red : acc === 0 ? COLORS.green : COLORS.yellow;
      const opacity = total === 0 ? 1 : Math.min(1, 0.35 + total * 0.2);
      out += `<rect x="${pad.l + c * cw + 2}" y="${pad.t + r * ch + 2}" width="${cw - 4}" height="${ch - 4}" rx="7"
        fill="${fill}" opacity="${opacity}" stroke="${INK}" stroke-width="${total ? 3 : 1.5}">
        <title>${dayNames[r]} ${String(c * 2).padStart(2, '0')}–${String(c * 2 + 2).padStart(2, '0')} Uhr: ${hit} Treffer, ${acc} Unfälle</title></rect>`;
    }
  }
  for (let c = 0; c < buckets; c += 2) {
    out += `<text x="${pad.l + c * cw + cw / 2}" y="${H - 8}" text-anchor="middle" class="tick">${String(c * 2).padStart(2, '0')}</text>`;
  }
  const legend = [
    [COLORS.green, 'nur Treffer'],
    [COLORS.yellow, 'gemischt'],
    [COLORS.red, 'mehr Unfälle'],
  ]
    .map(
      ([c, t], i) =>
        `<rect x="${pad.l + i * 150}" y="6" width="14" height="14" rx="5" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
         <text x="${pad.l + i * 150 + 20}" y="18" class="tick">${t}</text>`
    )
    .join('');
  return shell(W, H, legend + out, 'Heatmap Wochentag mal Uhrzeit');
}

// --- 4. Abstand zwischen Gängen ------------------------------------------
export function intervalChart(events) {
  const W = 640;
  const H = 220;
  const pad = { l: 52, r: 16, t: 20, b: 34 };
  const byDay = new Map();
  const sorted = [...events].filter((e) => e.what !== 'poop').sort((a, b) => a.ts - b.ts);
  for (let i = 1; i < sorted.length; i++) {
    if (dayKey(sorted[i].ts) !== dayKey(sorted[i - 1].ts)) continue;
    const gap = (sorted[i].ts - sorted[i - 1].ts) / 60000;
    if (gap < 5 || gap > 600) continue;
    const k = dayKey(sorted[i].ts);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(gap);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-14);
  if (days.length < 2) return emptyState(W, H, 'Ab ein paar Tagen mit mehreren Einträgen sichtbar.');
  const all = days.flatMap(([, v]) => v);
  const maxY = Math.max(240, quantile(all, 0.95) || 240);
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, days.length - 1);
  const y = (v) => pad.t + (1 - Math.min(1, v / maxY)) * (H - pad.t - pad.b);

  let out = '';
  for (const v of [60, 120, 180]) {
    if (v < maxY)
      out += `<line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" class="grid"/><text x="${pad.l - 10}" y="${y(v) + 5}" text-anchor="end" class="tick">${v} Min</text>`;
  }
  const meds = [];
  days.forEach(([day, gaps], i) => {
    const lo = quantile(gaps, 0.25);
    const hi = quantile(gaps, 0.75);
    const m = median(gaps);
    meds.push({ x: x(i), y: y(m), day, m, lo, hi });
    if (gaps.length > 1) {
      out += `<rect x="${x(i) - 9}" y="${y(hi)}" width="18" height="${Math.max(3, y(lo) - y(hi))}" rx="6" fill="${COLORS.blue}" opacity="0.35" stroke="${INK}" stroke-width="2.5"/>`;
    }
  });
  out += `<path d="${smoothPath(meds)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  out += `<path d="${smoothPath(meds)}" fill="none" stroke="${COLORS.blue}" stroke-width="3.5" stroke-linecap="round"/>`;
  out += meds
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="${INK}" stroke-width="3"><title>${shortDay(p.day)}: Median ${durationLabel(p.m)}, Streuung ${durationLabel(p.hi - p.lo)}</title></circle>`
    )
    .join('');
  days.forEach(([day], i) => {
    if (i % Math.ceil(days.length / 6) === 0)
      out += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="tick">${shortDay(day)}</text>`;
  });
  return shell(W, H, out, 'Abstand zwischen den Gängen');
}

// --- 5. Tages-Timeline für "Warum sehe ich das?" --------------------------
export function dayTimeline(events, highlightIds = []) {
  const W = 640;
  const H = 96;
  const pad = { l: 12, r: 12, t: 58 };
  const x = (min) => pad.l + (min / 1440) * (W - pad.l - pad.r);
  let out = `<line x1="${pad.l}" y1="${pad.t + 10}" x2="${W - pad.r}" y2="${pad.t + 10}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  for (let h = 0; h <= 24; h += 6)
    out += `<text x="${x(h * 60)}" y="${H - 8}" text-anchor="middle" class="tick">${String(h).padStart(2, '0')}</text>`;
  // Ereignisse zur gleichen Uhrzeit stapeln, sonst liegen 9 Punkte uebereinander
  const stack = new Map();
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    const px = Math.round(x(minutesOfDay(e.ts)));
    const level = stack.get(px) || 0;
    stack.set(px, level + 1);
    const hl = highlightIds.includes(e.id);
    out += `<circle cx="${px}" cy="${pad.t + 10 - level * 9}" r="${hl ? 7 : 5}" fill="${
      isAccident(e) ? COLORS.red : COLORS.green
    }" stroke="${INK}" stroke-width="3" opacity="${hl || !highlightIds.length ? 1 : 0.35}"><title>${new Date(e.ts).toLocaleDateString('de-DE')} ${timeLabel(minutesOfDay(e.ts))}</title></circle>`;
  }
  return shell(W, H, out, 'Tagesverlauf');
}
