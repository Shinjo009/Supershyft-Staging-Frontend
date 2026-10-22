/** Figma trends widget: 4 equal bands, top = 100 → bottom = 0. */
const BAND_COUNT = 4;
export const TRENDS_BAND_HEIGHT = 22.5;
export const TRENDS_CHART_HEIGHT = BAND_COUNT * TRENDS_BAND_HEIGHT;

export const getTrendsBandCenterY = (bandIndex) => (
  (bandIndex * TRENDS_BAND_HEIGHT) + (TRENDS_BAND_HEIGHT / 2)
);

export const getTrendsZoneCenterY = (startBandIndex, endBandIndex) => {
  const startY = startBandIndex * TRENDS_BAND_HEIGHT;
  const endY = (endBandIndex + 1) * TRENDS_BAND_HEIGHT;
  return (startY + endY) / 2;
};

/** Y-axis labels on horizontal grid lines (100 → 0). */
export const TRENDS_Y_AXIS_LABELS = [
  { label: '100', centerY: 0 },
  { label: '75', centerY: TRENDS_BAND_HEIGHT },
  { label: '50', centerY: TRENDS_BAND_HEIGHT * 2 },
  { label: '25', centerY: TRENDS_BAND_HEIGHT * 3 },
  { label: '0', centerY: TRENDS_CHART_HEIGHT },
];

/** Top → bottom: high risk red → optimal green (Figma 8001:99707). */
export const TRENDS_BAND_BACKGROUNDS = [
  'rgba(204, 32, 59, 0.20)',
  'rgba(238, 139, 72, 0.20)',
  'rgba(218, 193, 90, 0.20)',
  'rgba(144, 223, 158, 0.20)',
];

export const TRENDS_BAND_DOT_COLORS = [
  '#CC203B',
  '#EE8B48',
  '#DAC15A',
  '#90DF9E',
];

/** Highlight / mid / edge stops for spherical dots. */
export const TRENDS_DOT_SPHERE_STOPS = {
  '#CC203B': { highlight: '#FF7A8A', mid: '#CC203B', edge: '#7A1022' },
  '#EE8B48': { highlight: '#FFC08A', mid: '#EE8B48', edge: '#8A4A1E' },
  '#DAC15A': { highlight: '#F5E39A', mid: '#DAC15A', edge: '#7A6A28' },
  '#90DF9E': { highlight: '#D4F7DA', mid: '#90DF9E', edge: '#3E7A48' },
};

const DETAIL_HIGH_RISK_DISPLAY_PADDING = 30;

/** Legacy risk-zone mapping (kept for summary / callers that still need it). */
export const getMarkerPercentForValue = (value, normalMin, normalMax) => {
  if (value >= normalMin && value <= normalMax) {
    const normalSpan = Math.max(1e-6, normalMax - normalMin);
    const ratio = (value - normalMin) / normalSpan;
    return 40 + (ratio * 20);
  }

  if (value < normalMin) {
    const deviation = normalMin - value;
    const deviationPercent = (deviation / Math.max(Math.abs(normalMin), 1e-6)) * 100;

    if (deviationPercent <= 15) {
      const ratio = deviationPercent / 15;
      return 40 - (ratio * 20);
    }

    const ratio = Math.min((deviationPercent - 15) / 35, 1);
    return 20 - (ratio * 20);
  }

  const deviation = value - normalMax;
  const deviationPercent = (deviation / Math.max(Math.abs(normalMax), 1e-6)) * 100;

  if (deviationPercent <= 15) {
    const ratio = deviationPercent / 15;
    return 60 + (ratio * 20);
  }

  const ratio = Math.min((deviationPercent - 15) / 35, 1);
  return 80 + (ratio * 20);
};

/** Disease risk score on a linear 0–100 axis (top = 100). */
export const getDiseaseMarkerPercent = (score) => (
  Math.max(0, Math.min(100, Number(score) || 0))
);

const formatTrendsAxisTick = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const abs = Math.abs(numeric);
  if (abs >= 100) {
    return String(Math.round(numeric));
  }

  const rounded = abs >= 10
    ? Math.round(numeric * 10) / 10
    : Math.round(numeric * 100) / 100;

  return String(rounded)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
};

/**
 * Y-axis domain for linear plotting.
 * Uses 0–100 when values fit (Figma); otherwise expands to the data (+ normal range).
 */
export const resolveTrendsValueDomain = ({
  points = [],
  variant = 'blood',
  normalMin = null,
  normalMax = null,
} = {}) => {
  if (variant === 'disease') {
    return { min: 0, max: 100 };
  }

  const values = (Array.isArray(points) ? points : [])
    .map((point) => Number(point?.value))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return { min: 0, max: 100 };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (Number.isFinite(Number(normalMin))) {
    min = Math.min(min, Number(normalMin));
  }
  if (Number.isFinite(Number(normalMax))) {
    max = Math.max(max, Number(normalMax));
  }

  if (min >= 0 && max <= 100) {
    return { min: 0, max: 100 };
  }

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    return { min: min - pad, max: max + pad };
  }

  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
};

/** Map a raw value onto 0–100 chart percent for the given domain (100 = top). */
export const valueToMarkerPercent = (value, domainMin, domainMax) => {
  const min = Number(domainMin);
  const max = Number(domainMax);
  const span = Math.max(max - min, 1e-6);
  const ratio = (Number(value) - min) / span;
  return Math.max(0, Math.min(100, ratio * 100));
};

export const buildTrendsYAxisLabels = (
  domainMin,
  domainMax,
  chartHeight = TRENDS_CHART_HEIGHT,
) => {
  const min = Number(domainMin);
  const max = Number(domainMax);
  const span = Math.max(max - min, 1e-6);

  return [0, 0.25, 0.5, 0.75, 1].map((tick) => {
    const value = max - (span * tick);
    return {
      label: formatTrendsAxisTick(value),
      centerY: tick * chartHeight,
    };
  });
};

export const getBandIndexForMarkerPercent = (markerPercent) => {
  const clamped = Math.max(0, Math.min(100, markerPercent));
  const inverted = 100 - clamped;
  const index = Math.floor((inverted / 100) * BAND_COUNT);
  return Math.max(0, Math.min(BAND_COUNT - 1, index));
};

export const getDotColorForMarkerPercent = (markerPercent) => {
  const bandIndex = getBandIndexForMarkerPercent(markerPercent);
  return TRENDS_BAND_DOT_COLORS[bandIndex];
};

export const markerPercentToChartY = (markerPercent, chartHeight = TRENDS_CHART_HEIGHT) => {
  const clamped = Math.max(0, Math.min(100, markerPercent));
  return ((100 - clamped) / 100) * chartHeight;
};

export const clampBloodValueForTrends = (value, normalMin, normalMax) => {
  const minScale = normalMin - DETAIL_HIGH_RISK_DISPLAY_PADDING;
  const maxScale = normalMax + DETAIL_HIGH_RISK_DISPLAY_PADDING;
  return Math.max(minScale, Math.min(maxScale, value));
};

export const formatTrendDateLabel = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return String(isoDate || '');
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} '${year}`;
};

/** Compact card timeline label, e.g. Sep'24 */
export const formatBloodMarkerHistoryDate = (isoDate) => {
  const raw = String(isoDate || '').trim();
  if (!raw) {
    return '';
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    return `${month}'${year}`;
  }

  // Already-compact labels from backend (Sep'24 / Sep 24).
  const compact = raw.match(/^([A-Za-z]{3})[^\d]*'?(\d{2})$/);
  if (compact) {
    return `${compact[1]}'${compact[2]}`;
  }

  return raw;
};

/**
 * Build timeline points for blood-marker stack cards.
 * Prefers embedded history; otherwise uses trends points.
 */
export const buildBloodMarkerHistoryTimeline = ({
  historyPoints = [],
  currentValue = null,
  currentDate = '',
  maxPoints = 3,
  minPoints = 2,
} = {}) => {
  const merged = [];

  (Array.isArray(historyPoints) ? historyPoints : []).forEach((point) => {
    const value = Number(point?.value);
    if (!Number.isFinite(value)) {
      return;
    }
    merged.push({
      date: String(point?.date || '').trim(),
      value,
    });
  });

  const current = Number(currentValue);
  if (Number.isFinite(current)) {
    const currentKey = String(currentDate || '').trim();
    const last = merged[merged.length - 1];
    const sameAsLast = last
      && last.value === current
      && (!currentKey || !last.date || last.date === currentKey);
    if (!sameAsLast) {
      merged.push({ date: currentKey, value: current });
    } else if (currentKey && !last.date) {
      last.date = currentKey;
    }
  }

  const dated = merged
    .map((point, index) => ({ ...point, index }))
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : NaN;
      const bTime = b.date ? new Date(b.date).getTime() : NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
        return aTime - bTime;
      }
      return a.index - b.index;
    });

  const required = Math.max(1, Number(minPoints) || 1);
  if (dated.length < required) {
    return [];
  }

  return dated.slice(-Math.max(required, maxPoints)).map(({ date, value }) => ({ date, value }));
};

export const normalizeTrendsPayload = (payload, variant = 'blood') => {
  const root = payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload;

  const rawPoints = Array.isArray(root?.data_points) ? root.data_points : [];

  const points = rawPoints
    .map((point) => {
      const value = variant === 'disease'
        ? Number(point?.risk_score_scaled)
        : Number(point?.value);

      return {
        date: String(point?.date || '').trim(),
        value,
        engagementId: point?.engagement_id ?? null,
      };
    })
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    parameter: String(root?.parameter || '').trim(),
    unit: String(root?.unit || '').trim(),
    points,
  };
};

export const slugBloodParameterName = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

const extractBloodParameterTrendSnapshots = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.data?.data)) {
    return payload.data.data;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
};

const pushTrendAlias = (byKey, key, entry) => {
  const normalizedKey = String(key || '').trim().toLowerCase();
  if (!normalizedKey || !entry) {
    return;
  }
  byKey[normalizedKey] = entry;
};

/**
 * Invert GET /reports/trends/blood-parameters (date → all params)
 * into a lookup of parameter_key / slugged name → { parameter, unit, points }.
 */
export const normalizeBloodParameterTrendsByKey = (payload) => {
  const byKey = {};

  extractBloodParameterTrendSnapshots(payload).forEach((snapshot) => {
    const date = String(snapshot?.date || '').trim();
    const engagementId = snapshot?.engagement_id ?? snapshot?.engagementId ?? null;
    const rows = Array.isArray(snapshot?.data_points) ? snapshot.data_points : [];

    rows.forEach((item) => {
      const value = Number(item?.value);
      if (!date || !Number.isFinite(value)) {
        return;
      }

      const parameter = String(item?.parameter_name || item?.parameterName || '').trim();
      const unit = String(item?.unit || '').trim();
      const parameterKey = String(item?.parameter_key || item?.parameterKey || '').trim().toLowerCase();
      const nameKey = slugBloodParameterName(parameter);
      const point = { date, value, engagementId };

      const existing = (parameterKey && byKey[parameterKey])
        || (nameKey && byKey[nameKey])
        || {
          parameter,
          unit,
          points: [],
        };

      if (!existing.parameter && parameter) {
        existing.parameter = parameter;
      }
      if (!existing.unit && unit) {
        existing.unit = unit;
      }

      const alreadyHas = existing.points.some((entry) => (
        entry.date === date && entry.value === value
      ));
      if (!alreadyHas) {
        existing.points.push(point);
      }

      if (parameterKey) {
        pushTrendAlias(byKey, parameterKey, existing);
      }
      if (nameKey) {
        pushTrendAlias(byKey, nameKey, existing);
      }
    });
  });

  Object.values(byKey).forEach((entry) => {
    entry.points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  return byKey;
};

export const flattenBloodParameterTrendPoints = (trendsByKey = {}) => (
  Object.entries(trendsByKey).reduce((acc, [key, entry]) => {
    const points = Array.isArray(entry?.points) ? entry.points : (Array.isArray(entry) ? entry : []);
    if (points.length === 0) {
      return acc;
    }
    acc[key] = points;
    const canonical = canonicalizeBloodParameterKey(key);
    if (canonical) {
      acc[canonical] = points;
    }
    return acc;
  }, {})
);

const BLOOD_PARAMETER_KEY_ALIAS_GROUPS = [
  ['glucose_fasting', 'fasting_sugar', 'fasting_blood_sugar', 'fasting_glucose', 'fbs'],
  ['glycated_haemoglobin', 'glycated_hemoglobin', 'hba1c', 'hb_a1c', 'hemoglobin_a1c'],
  ['direct_bilirubin', 'bilirubin_direct'],
  ['bilirubin_indirect', 'indirect_bilirubin'],
  ['total_bilirubin', 'bilirubin_total'],
  ['haemoglobin', 'hemoglobin'],
  ['hdlc', 'hdlc_value', 'hdl_cholesterol', 'hdl'],
  ['ldlc', 'ldlc_value', 'ldl_cholesterol', 'ldl'],
  ['wbc', 'wbc_value', 'wbc_count'],
  ['rbc', 'rbc_count'],
  ['tsh', 'tsh_value'],
  ['alt', 'alt_value', 'sgpt'],
  ['ast', 'ast_value', 'sgot'],
  ['ggt', 'ggt_value', 'ggtp'],
  ['bun', 'bun_value'],
  ['egfr', 'egfr_value'],
  ['hscrp', 'hscrp_value', 'hs_crp'],
  ['esr', 'esr_value', 'esr_automated'],
  ['mpv', 'mpv_value'],
  ['fsh', 'fsh_value'],
  ['lh', 'lh_value'],
];

export const canonicalizeBloodParameterKey = (value) => {
  const slug = slugBloodParameterName(value);
  if (!slug) {
    return '';
  }

  const stripped = slug.replace(/_value$/, '');
  for (const group of BLOOD_PARAMETER_KEY_ALIAS_GROUPS) {
    if (group.includes(slug) || group.includes(stripped)) {
      return group[0];
    }
  }

  return stripped || slug;
};

export const humanizeBloodParameterName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'Test';
  }

  if (/\s/.test(raw) && !raw.includes('_')) {
    return raw.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return raw
    .replace(/_value$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const listBloodParameterLookupKeys = (marker = {}) => (
  [
    marker.parameter_key,
    marker.parameterKey,
    toBloodParameterKey(marker),
    slugBloodParameterName(marker.title),
    slugBloodParameterName(marker.marker),
    slugBloodParameterName(marker.parameter),
  ]
    .map((key) => canonicalizeBloodParameterKey(key))
    .filter(Boolean)
);

export const getTrendEntryForMarker = (marker = {}, trendsByParameterKey = {}) => {
  if (!trendsByParameterKey || typeof trendsByParameterKey !== 'object') {
    return null;
  }

  const markerKeys = new Set(listBloodParameterLookupKeys(marker));
  if (markerKeys.size === 0) {
    return null;
  }

  for (const [key, entry] of Object.entries(trendsByParameterKey)) {
    if (!markerKeys.has(canonicalizeBloodParameterKey(key))) {
      continue;
    }
    if (Array.isArray(entry) && entry.length > 0) {
      return { points: entry };
    }
    if (entry && typeof entry === 'object') {
      return entry;
    }
  }

  return null;
};

export const getTrendPointsForMarker = (marker = {}, trendsByParameterKey = {}) => {
  const entry = getTrendEntryForMarker(marker, trendsByParameterKey);
  if (Array.isArray(entry?.points) && entry.points.length > 0) {
    return entry.points;
  }
  if (Array.isArray(entry) && entry.length > 0) {
    return entry;
  }
  return [];
};

export const mergeBloodMarkerHistorySources = (...sources) => {
  const merged = [];

  sources.forEach((source) => {
    (Array.isArray(source) ? source : []).forEach((point) => {
      const value = Number(point?.value);
      if (!Number.isFinite(value)) {
        return;
      }
      const date = String(point?.date || '').trim();
      const alreadyHas = merged.some((entry) => (
        entry.value === value && (!date || !entry.date || entry.date === date)
      ));
      if (!alreadyHas) {
        merged.push({
          date,
          value,
          engagementId: point?.engagementId ?? point?.engagement_id ?? null,
        });
      }
    });
  });

  return merged.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : NaN;
    const bTime = b.date ? new Date(b.date).getTime() : NaN;
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return aTime - bTime;
    }
    if (Number.isFinite(aTime)) {
      return -1;
    }
    if (Number.isFinite(bTime)) {
      return 1;
    }
    return 0;
  });
};

const deviationFromNormalCenter = (value, normalMin, normalMax) => {
  const center = (normalMin + normalMax) / 2;
  const halfSpan = Math.max((normalMax - normalMin) / 2, 1e-6);
  return Math.abs(value - center) / halfSpan;
};

export const buildTrendSummaryText = ({
  points,
  variant = 'blood',
  normalMin,
  normalMax,
}) => {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  if (variant === 'disease') {
    const diff = latest.value - previous.value;
    if (diff === 0) {
      return 'No change from last result';
    }

    const pct = previous.value !== 0
      ? Math.round(Math.abs((diff / previous.value) * 100))
      : Math.round(Math.abs(diff));

    return diff > 0
      ? `${pct} % Worse than last result`
      : `${pct} % Better than last result`;
  }

  const latestDeviation = deviationFromNormalCenter(latest.value, normalMin, normalMax);
  const previousDeviation = deviationFromNormalCenter(previous.value, normalMin, normalMax);

  if (latestDeviation === previousDeviation) {
    return 'No change from last result';
  }

  const pct = previousDeviation !== 0
    ? Math.round(Math.abs(((latestDeviation - previousDeviation) / previousDeviation) * 100))
    : Math.round(Math.abs(latestDeviation - previousDeviation) * 100);

  return latestDeviation > previousDeviation
    ? `${pct} % Worse than last result`
    : `${pct} % Better than last result`;
};

export const buildSmoothTrendPath = (plotPoints) => {
  if (!Array.isArray(plotPoints) || plotPoints.length < 2) {
    return '';
  }

  if (plotPoints.length === 2) {
    const [start, end] = plotPoints;
    const dx = (end.x - start.x) / 3;
    return [
      `M ${start.x} ${start.y}`,
      `C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`,
    ].join(' ');
  }

  const path = [`M ${plotPoints[0].x} ${plotPoints[0].y}`];

  for (let index = 0; index < plotPoints.length - 1; index += 1) {
    const p0 = plotPoints[index - 1] || plotPoints[index];
    const p1 = plotPoints[index];
    const p2 = plotPoints[index + 1];
    const p3 = plotPoints[index + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return path.join(' ');
};

export const toBloodParameterKey = (marker = {}) => {
  const explicit = String(marker.parameter_key || marker.parameterKey || '').trim();
  if (explicit) {
    return explicit.toLowerCase();
  }

  return String(marker.title || marker.marker || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};
