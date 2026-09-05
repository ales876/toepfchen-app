// Gemeinsame Begriffe und kleine Helfer rund um ein Ereignis.

export const WHAT = {
  pee: { label: 'Pipi', icon: 'drop' },
  poop: { label: 'Kaka', icon: 'poop' },
  both: { label: 'Beides', icon: 'both' },
};

export const WHERE = {
  potty: { label: 'Töpfchen', icon: 'potty', success: true },
  toilet: { label: 'Toilette', icon: 'toilet', success: true },
  outside: { label: 'Draußen', icon: 'tree', success: true },
  pants: { label: 'Hose', icon: 'pants', success: false },
  floor: { label: 'Boden', icon: 'floor', success: false },
  bed: { label: 'Bett', icon: 'bed', success: false },
};

export const INITIATIVE = {
  self: { label: 'Alleine', icon: 'star', tone: 'green', rank: 3 },
  onRequest: { label: 'Auf Frage', icon: 'hand', tone: 'green', rank: 2 },
  onPrompt: { label: 'Auf Ansage', icon: 'megaphone', tone: 'yellow', rank: 1 },
  none: { label: 'Unfall', icon: 'cloud', tone: 'red', rank: 0 },
};

export const isSuccess = (ev) => !!WHERE[ev.where]?.success;
export const isAccident = (ev) => !isSuccess(ev);
export const isPee = (ev) => ev.what === 'pee' || ev.what === 'both';
export const isPoop = (ev) => ev.what === 'poop' || ev.what === 'both';

export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const minutesOfDay = (ts) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};

export const timeLabel = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const percentLabel = (share) => `${Math.round((share || 0) * 100)} %`;

export function durationLabel(minutes) {
  if (minutes == null) return '–';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} h` : `${h} h ${m} Min`;
}

// Standard-Einstellungen. Alles ueberschreibbar - die Schwellen aus dem Regelwerk
// liegen bewusst in der Config, nicht im Code.
export const DEFAULT_SETTINGS = {
  childName: '',
  birthMonth: '', // 'YYYY-MM'
  hasNap: true, // Mittagsschlaf-Regeln nur auswerten, wenn es einen gibt
  napWindow: { start: 12 * 60, end: 15 * 60 },
  nightStartHour: 20,
  nightEndHour: 6,
  tipsEnabled: true,
  statsWindow: 14, // Zeitraum der Erfolgsquote in Tagen (7 oder 14)
  configOverrides: {},
};
