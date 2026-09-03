// Maskottchen "Quaki", eine kleine mutige Ente. Drei Stimmungen - nie tadelnd (E10):
// bei Unfaellen ist sie aufmunternd, nicht traurig oder vorwurfsvoll.

export function mascot(mood = 'idle', size = 120) {
  const cheer = mood === 'cheer';
  const comfort = mood === 'comfort';

  const eyes = cheer
    ? `<path d="M72 74 q8 -10 16 0" class="m-line"/><path d="M104 74 q8 -10 16 0" class="m-line"/>`
    : `<circle cx="80" cy="76" r="7" class="m-eye"/><circle cx="112" cy="76" r="7" class="m-eye"/>
       <circle cx="83" cy="73" r="2.5" fill="#fff"/><circle cx="115" cy="73" r="2.5" fill="#fff"/>`;

  const brows = comfort
    ? `<path d="M68 60 q12 -6 22 -1" class="m-line"/><path d="M124 60 q-12 -6 -22 -1" class="m-line"/>`
    : '';

  // Schnabel: breit, orange, leicht geoeffnet beim Jubeln.
  const beak = cheer
    ? `<path d="M78 92 q18 4 36 0 q-4 20 -18 20 q-14 0 -18 -20 Z" fill="#ff9f43" class="m-out"/>
       <path d="M80 96 q16 6 32 0" fill="none" stroke="#22223b" stroke-width="3.5" stroke-linecap="round"/>`
    : `<path d="M76 90 q20 -5 40 0 q-6 16 -20 16 q-14 0 -20 -16 Z" fill="#ff9f43" class="m-out"/>`;

  const wings = cheer
    ? `<path d="M44 116 q-18 -18 -10 -34 q12 6 20 20 Z" fill="#ffd43b" class="m-out"/>
       <path d="M148 116 q18 -18 10 -34 q-12 6 -20 20 Z" fill="#ffd43b" class="m-out"/>`
    : `<path d="M46 118 q-16 6 -14 26 q14 -2 22 -14 Z" fill="#ffd43b" class="m-out"/>
       <path d="M146 118 q16 6 14 26 q-14 -2 -22 -14 Z" fill="#ffd43b" class="m-out"/>`;

  const sparkle = cheer
    ? `<g class="m-spark"><path d="M30 44 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" fill="#ffc93c" class="m-out"/>
       <path d="M162 58 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" fill="#4dabf7" class="m-out"/></g>`
    : '';

  return `<svg viewBox="0 0 192 192" width="${size}" height="${size}" class="mascot mascot-${mood}" aria-hidden="true">
    ${sparkle}
    <ellipse cx="96" cy="176" rx="42" ry="7" fill="#22223b" opacity="0.12"/>
    <path d="M74 168 q-12 4 -14 10 M118 168 q12 4 14 10" class="m-line" stroke="#ff9f43"/>
    ${wings}
    <path d="M56 122 q0 50 40 50 q40 0 40 -50 q0 -28 -40 -28 q-40 0 -40 28 Z" fill="#ffe066" class="m-out"/>
    <ellipse cx="96" cy="76" rx="44" ry="42" fill="#ffe066" class="m-out"/>
    <path d="M96 34 q-4 -18 10 -20 q-6 10 0 16" fill="#ffd43b" class="m-out"/>
    ${brows}
    ${eyes}
    ${beak}
    <circle cx="60" cy="94" r="7" fill="#ff9f43" opacity="${comfort ? 0.55 : 0.3}"/>
    <circle cx="132" cy="94" r="7" fill="#ff9f43" opacity="${comfort ? 0.55 : 0.3}"/>
  </svg>`;
}
