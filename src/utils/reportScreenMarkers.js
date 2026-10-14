/**
 * Cancer and allergy groups inside GET /reports/:id/blood-parameters.
 * Other groups are left on the existing blood-marker path.
 */
import {
  extractBloodParameterHistoryPoints,
  getBloodParameterTestsFromGroup,
  normalizeBloodParametersReportPayload,
  normalizeBloodParameterTestRow,
  pickBloodParameterGroupName,
  resolveBloodParameterNumericValue,
} from './bloodParametersReportNormalize';
import { formatBloodMarkerHistoryDate } from './trendsChartUtils';

const CANCER_TEST_PATTERN = /\b(afp|cea|psa|ca[\s.-]?125|ca[\s.-]?15[\s.-]?3|ca[\s.-]?19[\s.-]?9|ca[\s.-]?72[\s.-]?4|ca[\s.-]?50)\b|alpha[\s-]?fetoprotein|carcino(?:embryonic|\s*embryonic)|prostate[\s-]?specific/i;

export const classifyReportGroupName = (name) => {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (/allerg|allergen|\bige\b/.test(normalized)) {
    return 'allergy';
  }
  if (/cancer|tumou?r|oncol/.test(normalized)) {
    return 'cancer';
  }
  return null;
};

/** Tumor-marker tests stay on the Cancer screen even when their group is named something else. */
export const isCancerMarkerTest = (test) => {
  if (!test || typeof test !== 'object') {
    return false;
  }
  const normalized = test.name != null || test.key != null
    ? { test_name: test.name, parameter_key: test.key }
    : normalizeBloodParameterTestRow(test);
  return CANCER_TEST_PATTERN.test(`${normalized.test_name || ''} ${normalized.parameter_key || ''}`);
};

const riskFromBounds = (value, lower, upper) => {
  if (!Number.isFinite(value) || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return null;
  }
  let low = lower;
  let high = upper;
  if (low > high) {
    const swap = low;
    low = high;
    high = swap;
  }
  if (value >= low && value <= high) {
    return 'low';
  }
  const boundary = value < low ? low : high;
  const deviation = value < low ? (low - value) : (value - high);
  const deviationPercent = (deviation / Math.max(Math.abs(boundary), 1e-6)) * 100;
  if (deviationPercent <= 15) {
    return 'moderate';
  }
  return 'high';
};

const formatReading = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? '');
  }
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.00$/, '');
};

const readGroups = (response) => normalizeBloodParametersReportPayload(response);

const mapTest = (test) => {
  const normalized = normalizeBloodParameterTestRow(test);
  const numeric = resolveBloodParameterNumericValue(normalized, test);
  const value = Number(numeric);
  const hasValue = numeric !== undefined && numeric !== null && Number.isFinite(value);
  let lower = Number(normalized.lower_range);
  let upper = Number(normalized.higher_range);
  const hasRanges = Number.isFinite(lower) && Number.isFinite(upper);
  if (hasRanges && lower > upper) {
    const swap = lower;
    lower = upper;
    upper = swap;
  }
  const history = extractBloodParameterHistoryPoints(test);
  return {
    name: String(normalized.test_name || 'Test').trim(),
    key: String(normalized.parameter_key || '').trim(),
    unit: String(normalized.unit || '').trim(),
    value: hasValue ? value : null,
    lower: hasRanges ? lower : null,
    upper: hasRanges ? upper : null,
    risk: hasValue && hasRanges ? riskFromBounds(value, lower, upper) : null,
    history,
  };
};

const isIgeTest = (test) => /total\s*ige|\bige\b/i.test(`${test.name} ${test.key}`);

const cancerCardStatus = (risk) => {
  if (risk === 'high') {
    return { status: 'high', statusLabel: 'HIGH RISK', accent: '#e95d5c' };
  }
  if (risk === 'moderate') {
    return { status: 'low', statusLabel: 'LOW RISK', accent: '#dac15a' };
  }
  return { status: 'optimal', statusLabel: 'OPTIMAL', accent: '#90df9e' };
};

const readingColor = (risk) => {
  if (risk === 'high') return '#e95d5c';
  if (risk === 'moderate') return '#f7ec33';
  return '#66ff81';
};

const dashFor = (risk) => {
  if (risk === 'high') {
    return { color: '#e95d5c', opacity: 1, shadow: '0 0 12px rgba(233, 93, 92, 0.4)' };
  }
  if (risk === 'moderate') {
    return { color: '#dac15a', opacity: 1, shadow: '0 0 12px rgba(218, 193, 90, 0.4)' };
  }
  return { color: '#66ff82', opacity: 1, shadow: '0 0 12px rgba(102, 255, 130, 0.4)' };
};

const buildReadings = (test) => {
  const points = (Array.isArray(test.history) ? test.history : [])
    .map((point) => {
      const value = Number(point?.value);
      if (!Number.isFinite(value)) {
        return null;
      }
      const risk = test.lower !== null ? riskFromBounds(value, test.lower, test.upper) : test.risk;
      return {
        value: formatReading(value),
        color: readingColor(risk),
        date: formatBloodMarkerHistoryDate(point.date) || '',
        risk,
      };
    })
    .filter(Boolean)
    .slice(-3);

  if (points.length === 0 && test.value !== null) {
    points.push({
      value: formatReading(test.value),
      color: readingColor(test.risk),
      date: '',
      risk: test.risk,
    });
  }

  return points.map((point, index) => ({
    ...point,
    latest: index === points.length - 1,
    glow: index === points.length - 1 ? `0 0 4px ${point.color}` : undefined,
  }));
};

export const buildReportScreenMarkers = (response, assessmentId = null) => {
  const groups = readGroups(response, assessmentId);
  const cancerGroups = [];
  const allergyGroups = [];

  (Array.isArray(groups) ? groups : []).forEach((group) => {
    const kind = classifyReportGroupName(pickBloodParameterGroupName(group));
    if (kind === 'cancer') {
      cancerGroups.push(group);
      return;
    }
    if (kind === 'allergy') {
      allergyGroups.push(group);
      return;
    }
    const cancerTests = getBloodParameterTestsFromGroup(group).filter(isCancerMarkerTest);
    if (cancerTests.length > 0) {
      cancerGroups.push({
        ...group,
        group_name: 'Tumor markers',
        tests: cancerTests,
      });
    }
  });

  const cancerCards = cancerGroups.flatMap((group, groupIndex) => {
    const title = pickBloodParameterGroupName(group) || 'Cancer';
    return getBloodParameterTestsFromGroup(group).map(mapTest).filter((test) => test.value !== null).map((test, index) => {
      const tone = cancerCardStatus(test.risk);
      const readings = buildReadings(test);
      return {
        id: `cancer-${groupIndex}-${index}`,
        title,
        marker: test.name,
        unit: test.unit ? `(${test.unit})` : '',
        ...tone,
        readings,
        dashes: Array.from({ length: 9 }, () => dashFor(test.risk)),
      };
    });
  });

  const allergyTests = allergyGroups.flatMap((group) => (
    getBloodParameterTestsFromGroup(group).map(mapTest).map((test) => ({
      ...test,
      groupName: pickBloodParameterGroupName(group) || 'Allergy',
    }))
  ));

  const ige = allergyTests.find(isIgeTest) || null;
  const screened = allergyTests.filter((test) => !isIgeTest(test));
  const sensitiveTests = screened.filter((test) => test.value !== null && test.risk && test.risk !== 'low');
  const clearCount = screened.filter((test) => test.value !== null && test.risk === 'low').length;

  const allergySummary = allergyTests.length === 0 ? null : {
    value: ige ? formatReading(ige.value) : null,
    unit: ige?.unit || 'IU/ml',
    badge: !ige || ige.risk === 'low' || ige.risk === null ? 'Low Sensitivity' : 'Moderate',
    variant: !ige || ige.risk === 'low' || ige.risk === null ? 'low' : 'moderate',
    sensitivities: String(sensitiveTests.length),
    tested: String(screened.length),
    sensitive: String(sensitiveTests.length),
    clear: String(clearCount),
    levelLabel: !ige || ige.risk === 'low' || ige.risk === null
      ? 'Low Allergy Sensitivity'
      : 'Moderate Allergy Sensitivity',
    note: !ige || ige.risk === 'low' || ige.risk === null
      ? 'Your overall IgE level is within the expected range.'
      : 'Your overall IgE level is outside the expected range.',
  };

  const allergySections = allergyGroups.map((group, groupIndex) => {
    const name = pickBloodParameterGroupName(group) || 'Allergy';
    const tests = getBloodParameterTestsFromGroup(group).map(mapTest);
    const valued = tests.filter((test) => test.value !== null);
    const worst = valued.some((test) => test.risk === 'high')
      ? 'high'
      : valued.some((test) => test.risk === 'moderate')
        ? 'moderate'
        : valued.length > 0
          ? 'low'
          : 'pending';
    return {
      id: `allergy-api-${groupIndex}`,
      organ: name,
      parameters: `${tests.length} parameter${tests.length === 1 ? '' : 's'}`,
      theme: worst === 'high' ? 'high' : worst === 'moderate' ? 'moderate' : worst === 'pending' ? 'pending' : 'low',
      category: 'Allergies',
      tests: tests.map((test, index) => ({
        id: `allergy-api-${groupIndex}-${index}`,
        marker: test.name.toUpperCase(),
        value: test.value === null ? '--' : formatReading(test.value),
        unit: test.unit,
        riskType: test.value === null ? 'pending' : (test.risk || 'low'),
        allergy: true,
        historyPoints: (test.history || []).map((point) => ({
          value: point.value,
          date: point.date,
        })),
        normalMin: test.lower,
        normalMax: test.upper,
        causes: [],
        effects: [],
        title: test.name,
        parameter_key: test.key || null,
      })),
    };
  }).filter((section) => section.tests.length > 0);

  const profiles = allergyGroups.map((group, index) => {
    const tests = getBloodParameterTestsFromGroup(group).map(mapTest).filter((test) => !isIgeTest(test));
    const valued = tests.filter((test) => test.value !== null);
    const worst = valued.some((test) => test.risk === 'high')
      ? 'high'
      : valued.some((test) => test.risk === 'moderate')
        ? 'moderate'
        : valued.length > 0
          ? 'low'
          : 'pending';
    const status = worst === 'high' ? 'High Risk' : worst === 'moderate' ? 'Low Risk' : worst === 'pending' ? 'Pending' : 'Optimal';
    const tone = worst === 'high' ? 'high' : worst === 'moderate' ? 'low' : worst === 'pending' ? 'pending' : 'optimal';
    return {
      id: `allergy-profile-${index}`,
      name: (pickBloodParameterGroupName(group) || 'Allergy').toUpperCase(),
      count: `${tests.length} parameter${tests.length === 1 ? '' : 's'}`,
      status,
      tone,
    };
  }).filter((row) => row.count !== '0 parameters');

  const cancerAreas = cancerCards.map((card) => ({
    id: card.id,
    name: card.marker || card.title,
    status: card.status === 'high' ? 'high' : card.status === 'optimal' ? 'optimal' : 'attention',
  }));

  return {
    hasCancer: cancerCards.length > 0,
    hasAllergy: allergySections.length > 0 || Boolean(allergySummary),
    cancerCards,
    cancerCount: cancerCards.length,
    cancerAreas,
    allergySummary,
    allergySections,
    profiles,
  };
};
