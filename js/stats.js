// Statistik-Bausteine der Mustererkennung. Bewusst robuste Verfahren:
// bei Kleinkind-Daten ist ein einzelner schlechter Tag die Regel, nicht der Ausreisser.

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs, q) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function iqr(xs) {
  if (xs.length < 4) return null;
  return quantile(xs, 0.75) - quantile(xs, 0.25);
}

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Untere Grenze des Wilson-Konfidenzintervalls (95%).
// Verhindert, dass "2 von 3 Treffern" als 67%-Erfolgsquote gefeiert wird.
export function wilsonLower(successes, total, z = 1.96) {
  if (!total) return 0;
  const p = successes / total;
  const d = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return Math.max(0, (centre - spread) / d);
}

// Theil-Sen: Median aller paarweisen Steigungen. Ab ~7 Punkten brauchbar,
// kippt nicht durch einen Krankheitstag. points = [{x, y}]
export function theilSen(points) {
  if (points.length < 3) return 0;
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx !== 0) slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  return median(slopes) ?? 0;
}

// Mann-Kendall tau als Signifikanz-Wächter für Trends.
// Liefert {tau, p}; p ist eine Normalapproximation, für n>=8 ausreichend.
export function mannKendall(ys) {
  const n = ys.length;
  if (n < 4) return { tau: 0, p: 1 };
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) s += Math.sign(ys[j] - ys[i]);
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(varS);
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { tau: (2 * s) / (n * (n - 1)), p };
}

function normalCdf(z) {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}

// Exponentiell gewichteter gleitender Mittelwert (Regressionserkennung).
export function ewma(xs, alpha = 0.3) {
  const out = [];
  let acc = null;
  for (const x of xs) {
    acc = acc === null ? x : alpha * x + (1 - alpha) * acc;
    out.push(acc);
  }
  return out;
}

const DAY_MINUTES = 1440;

export function circularDistance(a, b) {
  const d = Math.abs(a - b) % DAY_MINUTES;
  return Math.min(d, DAY_MINUTES - d);
}

// Zirkulaere Kernel-Density-Estimation ueber die Tageszeit.
// Kein k-Means: Clusterzahl ist unbekannt, und 23:50 muss neben 00:10 liegen.
// samples = Minuten seit Mitternacht, days = zugehoeriger Tagesschluessel.
export function circadianHotspots(samples, days, { sigma = 30, step = 10, minCount = 2, minDays = 3 } = {}) {
  if (samples.length < minCount) return [];
  const grid = [];
  for (let t = 0; t < DAY_MINUTES; t += step) {
    let dens = 0;
    for (const s of samples) {
      const d = circularDistance(t, s) / sigma;
      dens += Math.exp(-0.5 * d * d);
    }
    grid.push({ t, dens });
  }
  const peaks = [];
  for (let i = 0; i < grid.length; i++) {
    const prev = grid[(i - 1 + grid.length) % grid.length];
    const next = grid[(i + 1) % grid.length];
    if (grid[i].dens > prev.dens && grid[i].dens >= next.dens && grid[i].dens > 0.8) {
      peaks.push(grid[i]);
    }
  }
  const results = [];
  for (const peak of peaks) {
    const memberIdx = [];
    samples.forEach((s, idx) => {
      if (circularDistance(peak.t, s) <= sigma) memberIdx.push(idx);
    });
    const distinctDays = new Set(memberIdx.map((i) => days[i])).size;
    if (memberIdx.length >= minCount && distinctDays >= minDays) {
      const centre = circularMean(memberIdx.map((i) => samples[i]));
      results.push({
        centreMinutes: Math.round(centre),
        accidentCount: memberIdx.length,
        distinctDays,
        density: peak.dens,
        memberIndexes: memberIdx,
      });
    }
  }
  // Ueberlappende Peaks zusammenfassen, staerkster gewinnt.
  results.sort((a, b) => b.density - a.density);
  const kept = [];
  for (const r of results) {
    if (!kept.some((k) => circularDistance(k.centreMinutes, r.centreMinutes) < sigma)) kept.push(r);
  }
  return kept;
}

export function circularMean(minutes) {
  let x = 0;
  let y = 0;
  for (const m of minutes) {
    const a = (m / DAY_MINUTES) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  const ang = Math.atan2(y / minutes.length, x / minutes.length);
  const norm = ((ang / (2 * Math.PI)) * DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  return norm;
}
