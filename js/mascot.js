// Maskottchen: das Toepfchen aus dem App-Icon, mit Gesicht und Begleitstern.
// Drei Stimmungen - nie tadelnd (E10): bei Unfaellen schaut es aufmunternd,
// nicht traurig oder vorwurfsvoll.

export function mascot(mood = 'idle', size = 120) {
  const cheer = mood === 'cheer';
  const comfort = mood === 'comfort';

  // Der Stern sitzt beim Jubeln hoeher und groesser, beim Troesten kommt er
  // naeher heran - wie jemand, der sich zu einem herunterbeugt.
  const star = cheer
    ? `<g transform="translate(96,34)"><path d="M0 -26 l10 21 23 3 -17 16 4 23 -20 -12 -20 12 4 -23 -17 -16 23 -3 Z"
         fill="#ffe066" class="m-out"/></g>`
    : comfort
    ? `<g transform="translate(118,52) rotate(16)"><path d="M0 -18 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2 Z"
         fill="#ffe066" class="m-out"/></g>`
    : `<g transform="translate(96,46)"><path d="M0 -20 l8 17 18 2 -13 12 3 18 -16 -9 -16 9 3 -18 -13 -12 18 -2 Z"
         fill="#ffe066" class="m-out"/></g>`;

  const sparkle = cheer
    ? `<g class="m-spark">
         <path d="M34 62 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" fill="#ffc93c" class="m-out"/>
         <path d="M158 78 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#4dabf7" class="m-out"/>
       </g>`
    : '';

  const eyes = cheer
    ? `<path d="M70 116 q9 -11 18 0" class="m-line"/><path d="M106 116 q9 -11 18 0" class="m-line"/>`
    : `<circle cx="79" cy="118" r="8" class="m-eye"/><circle cx="115" cy="118" r="8" class="m-eye"/>
       <circle cx="82" cy="115" r="2.8" fill="#ffffff"/><circle cx="118" cy="115" r="2.8" fill="#ffffff"/>`;

  const brows = comfort
    ? `<path d="M68 104 q11 -6 20 -1" class="m-line"/><path d="M126 104 q-11 -6 -20 -1" class="m-line"/>`
    : '';

  const mouth = cheer
    ? `<path d="M82 132 q14 18 28 0 q-14 7 -28 0 Z" fill="#ff9f43" class="m-out"/>`
    : `<path d="M84 132 q12 11 24 0" fill="none" stroke="#22223b" stroke-width="5" stroke-linecap="round"/>`;

  return `<svg viewBox="0 0 192 192" width="${size}" height="${size}" class="mascot mascot-${mood}" aria-hidden="true">
    ${sparkle}
    ${star}
    <ellipse cx="96" cy="172" rx="46" ry="7" fill="#22223b" opacity="0.12"/>
    <path d="M32 96 h128 v22 a64 40 0 0 1 -128 0 Z" fill="#4dabf7" class="m-out"/>
    <path d="M160 108 a20 20 0 0 1 16 20" fill="none" stroke="#22223b" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="96" cy="96" rx="64" ry="18" fill="#a5d8ff" class="m-out"/>
    ${brows}
    ${eyes}
    ${mouth}
    <ellipse cx="58" cy="132" rx="9" ry="6" fill="#ff8787" opacity="${comfort ? 0.6 : 0.4}"/>
    <ellipse cx="136" cy="132" rx="9" ry="6" fill="#ff8787" opacity="${comfort ? 0.6 : 0.4}"/>
  </svg>`;
}
