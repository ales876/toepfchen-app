// Regel-Engine: interpretiert den Bool-Baum einer Regel gegen den FeatureStore.
// Kein eval, kein Code in den Regeln - nur Daten. Neue Regel = neuer Eintrag in rules.seed.json.

const OPS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

function resolveValue(value, config) {
  if (value && typeof value === 'object' && '$config' in value) return config[value.$config];
  return value;
}

function evalNode(node, features, config) {
  if (!node) return true;
  if (node.all) return node.all.every((n) => evalNode(n, features, config));
  if (node.any) return node.any.some((n) => evalNode(n, features, config));
  if (node.not) return !evalNode(node.not, features, config);
  const actual = features[node.feature];
  const expected = resolveValue(node.value, config);
  if (actual === undefined || actual === null) return false;
  const op = OPS[node.op];
  return op ? op(actual, expected) : false;
}

function collectFeatureNames(node, acc = []) {
  if (!node) return acc;
  if (node.all) node.all.forEach((n) => collectFeatureNames(n, acc));
  else if (node.any) node.any.forEach((n) => collectFeatureNames(n, acc));
  else if (node.not) collectFeatureNames(node.not, acc);
  else if (node.feature) acc.push(node.feature);
  return acc;
}

export function interpolate(text, features, config) {
  if (!text) return '';
  return text.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    if (path.startsWith('config.')) {
      const v = config[path.slice(7)];
      return v === undefined ? match : String(v);
    }
    const v = features[path];
    if (v === undefined || v === null) return match;
    return typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
  });
}

function meetsRequirements(rule, features) {
  const r = rule.requires || {};
  if (r.minTrackedDays && features['tracking.daysWithData'] < r.minTrackedDays) return false;
  if (r.minEventsPerDay && features['tracking.eventsPerDay'] < r.minEventsPerDay) return false;
  if (r.minEventsTotal && features['tracking.totalEvents'] < r.minEventsTotal) return false;
  return true;
}

// state: { [ruleId]: { lastShown: ts, snoozedUntil: ts } }
export function evaluateRules(ruleset, computed, state = {}, now = Date.now(), settings = {}) {
  const config = { ...ruleset.config, ...(settings.configOverrides || {}), noteKeywords: ruleset.noteKeywords };
  const { features, evidence } = computed;
  const globalMin = config.minTrackedDays ?? 5;
  const candidates = [];

  for (const rule of ruleset.rules) {
    const isRedFlag = rule.category === 'red_flag';
    // Erste Tage: nur Red Flags. Verhindert Muster-Halluzination aus Startrauschen.
    if (!isRedFlag && features['tracking.daysWithData'] < globalMin) continue;
    if (!meetsRequirements(rule, features)) continue;

    const st = state[rule.id] || {};
    if (st.snoozedUntil && st.snoozedUntil > now) continue;
    const cooldownDays = rule.cooldownDays ?? config.cooldownDefaultDays ?? 7;
    if (st.lastShown && now - st.lastShown < cooldownDays * 86400000 && !isRedFlag) continue;

    if (!evalNode(rule.when, features, config)) continue;

    const groups = [...new Set(collectFeatureNames(rule.when).map((f) => f.split('.')[0]))];
    const evidenceIds = groups.flatMap((g) => evidence[g] || []);

    candidates.push({
      id: rule.id,
      category: rule.category,
      severity: rule.severity,
      priority: rule.priority,
      headline: interpolate(rule.text.headline, features, config),
      body: interpolate(rule.text.body, features, config),
      action: interpolate(rule.text.action, features, config),
      evidence: rule.evidence,
      evidenceIds: [...new Set(evidenceIds)],
      disclaimer: rule.disclaimer !== false,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);

  // Max ein Tipp je Kategorie, Red Flags haben immer Vorrang, insgesamt gedeckelt.
  const seenCategory = new Set();
  const selected = [];
  for (const c of candidates) {
    if (seenCategory.has(c.category)) continue;
    seenCategory.add(c.category);
    selected.push(c);
    if (selected.length >= (config.maxActiveTips ?? 3)) break;
  }
  return { tips: selected, allCandidates: candidates, config };
}
