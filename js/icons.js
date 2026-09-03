// Handgezeichnetes Icon-Set. Emoji waeren billiger, sehen aber auf jeder Plattform
// anders aus (und auf iOS fotorealistisch) - das bricht den Comic-Look sofort.
// Alle Icons teilen dieselbe Sprache: 4px Outline, runde Enden, kraeftige Flaechen.

const S = 'stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

const PATHS = {
  drop: `<path d="M24 6 C24 6 40 24 40 33 a16 16 0 0 1 -32 0 C8 24 24 6 24 6 Z" fill="#4dabf7" ${S}/>
         <path d="M17 32 a7 7 0 0 0 5 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  poop: `<path d="M14 42 h20 a7 7 0 0 0 0 -13 h-2 a6 6 0 0 0 -3 -10 a6 6 0 0 0 -9 -6 a6 6 0 0 0 -5 9 a7 7 0 0 0 -1 20 Z" fill="#a9703f" ${S}/>
         <circle cx="20" cy="33" r="2" fill="#22223b"/><circle cx="29" cy="33" r="2" fill="#22223b"/>`,
  both: `<path d="M16 8 C16 8 26 20 26 26 a10 10 0 0 1 -20 0 C6 20 16 8 16 8 Z" fill="#4dabf7" ${S}/>
         <path d="M28 42 h12 a5 5 0 0 0 0 -10 a5 5 0 0 0 -4 -8 a5 5 0 0 0 -9 3 a5 5 0 0 0 1 15 Z" fill="#a9703f" ${S}/>`,
  potty: `<path d="M10 20 h28 v10 a14 14 0 0 1 -28 0 Z" fill="#4dabf7" ${S}/>
          <ellipse cx="24" cy="20" rx="16" ry="6" fill="#74c0fc" ${S}/>
          <path d="M38 24 a6 6 0 0 1 6 6" fill="none" ${S}/>`,
  toilet: `<path d="M13 10 h20 v12 h5 v6 a14 14 0 0 1 -14 12 h-4 a10 10 0 0 1 -10 -10 Z" fill="#e9ecef" ${S}/>
           <ellipse cx="24" cy="28" rx="9" ry="5" fill="#adb5bd" ${S}/>
           <path d="M18 40 h14 v4 h-14 Z" fill="#e9ecef" ${S}/>`,
  tree: `<path d="M24 6 l12 16 h-7 l9 13 h-28 l9 -13 h-7 Z" fill="#3ec96a" ${S}/>
         <path d="M24 35 v9" ${S} fill="none"/>`,
  pants: `<path d="M14 8 h20 l3 34 h-9 l-4 -18 l-4 18 h-9 Z" fill="#4dabf7" ${S}/>
          <path d="M14 16 h20" fill="none" ${S}/>`,
  floor: `<path d="M10 40 h28" fill="none" ${S}/>
          <path d="M14 34 c4 -8 16 -8 20 0 a10 6 0 0 1 -20 0 Z" fill="#74c0fc" ${S}/>
          <path d="M24 8 v14" fill="none" stroke="#4dabf7" stroke-width="4" stroke-linecap="round"/>`,
  bed: `<path d="M8 34 v-14 h32 a6 6 0 0 1 6 6 v8 Z" fill="#ffe066" ${S}/>
        <path d="M8 34 h38 M10 34 v8 M44 34 v8" fill="none" ${S}/>
        <rect x="12" y="14" width="12" height="8" rx="3" fill="#fff" ${S}/>`,
  star: `<path d="M24 6 l5.5 12 13 1.5 -9.5 9 2.5 13 -11.5 -6.5 -11.5 6.5 2.5 -13 -9.5 -9 13 -1.5 Z" fill="#ffc93c" ${S}/>`,
  hand: `<path d="M18 42 a10 10 0 0 1 -6 -9 v-9 a3 3 0 0 1 6 0 v-11 a3 3 0 0 1 6 0 v10 a3 3 0 0 1 6 0 v3 a3 3 0 0 1 6 0 v9 a12 12 0 0 1 -8 11 Z" fill="#ffd8a8" ${S}/>`,
  megaphone: `<path d="M10 20 h8 l18 -10 v28 l-18 -10 h-8 Z" fill="#ffc93c" ${S}/>
              <path d="M14 30 v8 a4 4 0 0 0 8 0 v-4" fill="#ffc93c" ${S}/>
              <path d="M40 20 a6 6 0 0 1 0 8" fill="none" ${S}/>`,
  cloud: `<path d="M14 30 a8 8 0 0 1 1 -16 a10 10 0 0 1 19 3 a7 7 0 0 1 -1 13 Z" fill="#ced4da" ${S}/>
          <path d="M17 36 l-2 6 M25 36 l-2 6 M33 36 l-2 6" fill="none" stroke="#4dabf7" stroke-width="4" stroke-linecap="round"/>`,
  pencil: `<path d="M10 38 l3 -9 20 -20 6 6 -20 20 Z" fill="#ffc93c" ${S}/><path d="M30 12 l6 6" fill="none" ${S}/>`,
  chart: `<path d="M10 38 v-26 M10 38 h28" fill="none" ${S}/>
          <path d="M14 32 l7 -9 6 5 9 -13" fill="none" stroke="#3ec96a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  bulb: `<path d="M24 6 a13 13 0 0 1 8 23 v4 h-16 v-4 a13 13 0 0 1 8 -23 Z" fill="#ffe066" ${S}/>
         <path d="M18 38 h12 M20 43 h8" fill="none" ${S}/>`,
  gear: `<path d="M20 6 h8 l1.5 6 5 2.5 5.5 -3 5.5 5.5 -3 5.5 2.5 5 6 1.5 v8 l-6 1.5 -2.5 5 3 5.5 -5.5 5.5 -5.5 -3 -5 2.5 -1.5 6 h-8 l-1.5 -6 -5 -2.5 -5.5 3 -5.5 -5.5 3 -5.5 -2.5 -5 -6 -1.5 v-8 l6 -1.5 2.5 -5 -3 -5.5 5.5 -5.5 5.5 3 5 -2.5 Z"
         fill="#adb5bd" ${S}/>
         <circle cx="24" cy="24" r="7" fill="none" ${S}/>`,
  fire: `<path d="M24 4 c8 10 14 12 14 22 a14 14 0 0 1 -28 0 c0 -6 4 -8 6 -13 c2 4 4 5 5 3 c1 -4 -1 -8 3 -12 Z" fill="#ff6b6b" ${S}/>
         <path d="M24 40 a6 6 0 0 1 -3 -10 c2 3 5 2 5 -2 c3 3 4 5 4 7 a6 6 0 0 1 -6 5 Z" fill="#ffc93c" stroke="none"/>`,
};

export function icon(name, size = 28) {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="icon" aria-hidden="true" focusable="false">${body}</svg>`;
}
