import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './BloodMarkersPage.css';
import { BACKEND_BASE_URL, BACKEND_ENABLED } from '../../config/appConfig';
import { getAccessToken } from '../../utils/authStorage';
import { formatApiContentDisplay } from '../../utils/formatApiContentDisplay';
import { fetchLatestAssessmentReport, fetchReportTrends } from '../../services/reportService';
import { buildBloodParametersGroupsForAssessment } from '../../utils/assessmentBloodMarkerSupplements';
import TrendsChart from '../../components/TrendsChart';
import {
  buildBloodMarkerHistoryTimeline,
  formatBloodMarkerHistoryDate,
  normalizeTrendsPayload,
  toBloodParameterKey,
} from '../../utils/trendsChartUtils';
import {
  extractBloodParameterGroupsArray,
  extractBloodParameterHistoryPoints,
  getBloodParameterTestsFromGroup,
  normalizeBloodParameterTestRow,
  normalizeBloodParametersReportPayload,
  pickBloodParameterGroupName,
  resolveBloodParameterNumericValue,
} from '../../utils/bloodParametersReportNormalize';
import haematologyIcon from '../../images/Haemotology.svg';
import liverIcon from '../../images/Liver.svg';
import kidneyIcon from '../../images/Kidney.svg';
import vitaminsIcon from '../../images/Vitamins.svg';
import lipidIcon from '../../images/Lipid.svg';
import ironIcon from '../../images/Iron.svg';
import thyroidIcon from '../../images/Thyroid.svg';
import diabetesIcon from '../../images/Diabetes.svg';
import inflammationIcon from '../../images/Inflammation.svg';
import sleepIcon from '../../images/Sleep.svg';
import hormonesIcon from '../../images/Hormones.svg';
import allergyFoodIcon from '../../images/allergy-icon-food.svg';
import allergyEnvironmentIcon from '../../images/allergy-icon-environment.svg';
import allergyWorkplaceIcon from '../../images/allergy-icon-workplace.svg';
import CancerMarkersView from './CancerMarkersView';
import { buildReportScreenMarkers, classifyReportGroupName, isCancerMarkerTest } from '../../utils/reportScreenMarkers';

const FILTERS = ['Optimal', 'Marginal', 'Critical', 'Allergies', 'Cancer'];

/** Set to `true` to show history timelines on blood marker stack cards. */
const BLOOD_MARKER_CARD_HISTORY_ENABLED = true;

const EMPTY_FILTER_MESSAGE = {
  Critical: 'No Critical Markers Detected',
  Marginal: 'No Marginal Markers Detected',
  Optimal: 'No Optimal Markers Detected',
  Allergies: 'No Allergy Markers Detected',
};

/** Same limit as homepage Blood Markers list (`RiskAnalysisSection`). */
const BLOOD_MARKERS_STACK_CARD_NAME_MAX = 14;

const truncateBloodMarkersStackCardName = (name) => {
  const s = String(name ?? '');
  if (s.length <= BLOOD_MARKERS_STACK_CARD_NAME_MAX) {
    return s;
  }
  return `${s.slice(0, BLOOD_MARKERS_STACK_CARD_NAME_MAX)}...`;
};

const OPTIMAL_AGGREGATE_RANGE_TITLE = 'OPTIMAL RANGE';

const formatOptimalAggregatePrefix = (count) => {
  const n = Math.max(0, Number(count) || 0);
  const parameterWord = n === 1 ? 'PARAMETER' : 'PARAMETERS';
  const verb = n === 1 ? 'IS' : 'ARE';
  return `${n} OTHER ${parameterWord} ${verb} IN`;
};

const getOptimalAggregateParameterCount = (card) => {
  if (Array.isArray(card?.aggregateTests) && card.aggregateTests.length > 0) {
    return card.aggregateTests.length;
  }
  return Number(card?.value) || 0;
};

const ORGAN_ICON_BY_NAME = {
  haematology: haematologyIcon,
  liver: liverIcon,
  kidney: kidneyIcon,
  vitamins: vitaminsIcon,
  lipid: lipidIcon,
  iron: ironIcon,
  thyroid: thyroidIcon,
  diabetes: diabetesIcon,
  inflammation: inflammationIcon,
  sleep: sleepIcon,
  hormones: hormonesIcon,
};

const RISK_META = {
  low: {
    label: 'OPTIMAL',
    color: '#90DF9E',
  },
  moderate: {
    label: 'LOW RISK',
    color: '#DAC15A',
  },
  increased: {
    label: 'MODERATE RISK',
    color: '#EE8B48',
  },
  high: {
    label: 'HIGH RISK',
    color: '#E95D5C',
  },
  pending: {
    label: 'PENDING',
    color: '#9A9A9A',
  },
};

const HISTORY_POINT_COLORS = {
  low: '#4ADE80',
  moderate: '#DAC15A',
  increased: '#EE8B48',
  high: '#E95D5C',
};

const RISK_DOT_BACKGROUND = {
  low: 'linear-gradient(180deg, #90DF9E 0%, #4E7956 100%), #90DF9E',
  moderate: 'linear-gradient(180deg, #DAC15A 0%, #746730 100%), linear-gradient(90deg, #EE8B48 0%, #884F29 100%), #90DF9E',
  high: 'linear-gradient(180deg, #E95D5C 0%, #833434 100%)',
};

const METER_SEGMENTS = {
  low: [
    { background: '#4ADE80', boxShadow: '0 0 12px 0 rgba(144, 223, 158, 0.40)' },
    { background: '#4ADE80', boxShadow: '0 0 12px 0 rgba(144, 223, 158, 0.40)' },
    { background: 'rgba(74, 222, 128, 0.75)', boxShadow: '0 0 12px 0 rgba(144, 223, 158, 0.40)' },
    { background: 'rgba(74, 222, 128, 0.50)' },
    { background: 'rgba(74, 222, 128, 0.40)' },
    { background: 'rgba(74, 222, 128, 0.30)' },
    { background: 'rgba(74, 222, 128, 0.25)' },
    { background: 'rgba(74, 222, 128, 0.20)' },
    { background: 'rgba(74, 222, 128, 0.15)' },
    { background: 'rgba(74, 222, 128, 0.10)' },
  ],
  moderate: [
    { background: 'rgba(218, 193, 90, 0.10)' },
    { background: 'rgba(218, 193, 90, 0.25)' },
    { background: 'rgba(218, 193, 90, 0.30)' },
    { background: '#DAC15A', boxShadow: '0 0 12px 0 rgba(218, 193, 90, 0.40)' },
    { background: '#DAC15A', boxShadow: '0 0 12px 0 rgba(218, 193, 90, 0.40)' },
    { background: 'rgba(218, 193, 90, 0.75)', boxShadow: '0 0 12px 0 rgba(218, 193, 90, 0.40)' },
    { background: 'rgba(218, 193, 90, 0.50)' },
    { background: 'rgba(218, 193, 90, 0.40)' },
    { background: 'rgba(218, 193, 90, 0.20)' },
    { background: 'rgba(218, 193, 90, 0.15)' },
  ],
  increased: [
    { background: 'rgba(239, 68, 68, 0.10)' },
    { background: 'rgba(239, 68, 68, 0.15)' },
    { background: 'rgba(239, 68, 68, 0.20)' },
    { background: 'rgba(239, 68, 68, 0.25)' },
    { background: 'rgba(239, 68, 68, 0.30)' },
    { background: 'rgba(239, 68, 68, 0.40)' },
    { background: 'rgba(239, 68, 68, 0.50)' },
    { background: 'rgba(239, 68, 68, 0.75)', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
    { background: '#EF4444', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
    { background: '#EF4444', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
  ],
  high: [
    { background: 'rgba(239, 68, 68, 0.10)' },
    { background: 'rgba(239, 68, 68, 0.15)' },
    { background: 'rgba(239, 68, 68, 0.20)' },
    { background: 'rgba(239, 68, 68, 0.25)' },
    { background: 'rgba(239, 68, 68, 0.30)' },
    { background: 'rgba(239, 68, 68, 0.40)' },
    { background: 'rgba(239, 68, 68, 0.50)' },
    { background: 'rgba(239, 68, 68, 0.75)', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
    { background: '#EF4444', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
    { background: '#EF4444', boxShadow: '0 0 12px 0 rgba(239, 68, 68, 0.40)' },
  ],
  pending: [
    { background: 'rgba(154, 154, 154, 0.35)' },
    { background: 'rgba(154, 154, 154, 0.28)' },
    { background: 'rgba(154, 154, 154, 0.22)' },
    { background: 'rgba(154, 154, 154, 0.16)' },
    { background: 'rgba(154, 154, 154, 0.12)' },
    { background: 'rgba(154, 154, 154, 0.10)' },
    { background: 'rgba(154, 154, 154, 0.08)' },
    { background: 'rgba(154, 154, 154, 0.06)' },
    { background: 'rgba(154, 154, 154, 0.05)' },
  ],
};

const getRiskTypeFromBounds = (value, lowerRange, upperRange) => {
  const numericValue = Number(value);
  let lower = Number(lowerRange);
  let upper = Number(upperRange);

  if (!Number.isFinite(numericValue) || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return 'low';
  }

  if (lower > upper) {
    const swap = lower;
    lower = upper;
    upper = swap;
  }

  if (numericValue >= lower && numericValue <= upper) {
    return 'low';
  }

  const isBelowRange = numericValue < lower;
  const boundary = isBelowRange ? lower : upper;
  const deviation = isBelowRange ? (lower - numericValue) : (numericValue - upper);
  const deviationPercent = (deviation / Math.max(Math.abs(boundary), 1e-6)) * 100;

  if (deviationPercent <= 15) {
    return 'moderate';
  }

  return 'high';
};

const DETAIL_HIGH_RISK_DISPLAY_PADDING = 30;

const getDisplayRiskType = (type) => {
  if (type === 'increased') {
    return 'high';
  }

  return type;
};

const getRiskColorByType = (type) => {
  const displayType = getDisplayRiskType(type);
  return RISK_META[displayType]?.color || RISK_META.low.color;
};

const getHistoryPointColor = (type) => {
  if (HISTORY_POINT_COLORS[type]) {
    return HISTORY_POINT_COLORS[type];
  }
  return HISTORY_POINT_COLORS[getDisplayRiskType(type)] || HISTORY_POINT_COLORS.low;
};

const resolveCardHistoryPoints = (card, trendsByParameterKey = {}) => {
  if (card?.cardRole === 'optimal-aggregate') {
    return [];
  }

  const embedded = Array.isArray(card?.historyPoints) ? card.historyPoints : [];
  const paramKey = toBloodParameterKey(card);
  const fromTrends = paramKey && Array.isArray(trendsByParameterKey[paramKey])
    ? trendsByParameterKey[paramKey]
    : [];

  // Prefer the richer history (trends often has prior readings when the card
  // only carried the current value). Fall back to a single reading when that
  // is all either source has.
  let source = [];
  if (embedded.length >= 2) {
    source = embedded;
  } else if (fromTrends.length >= 2) {
    source = fromTrends;
  } else if (fromTrends.length >= 1) {
    source = fromTrends;
  } else if (embedded.length >= 1) {
    source = embedded;
  }

  if (source.length === 0) {
    return [];
  }

  return buildBloodMarkerHistoryTimeline({
    historyPoints: source,
    currentValue: card?.rawValue ?? card?.value,
    maxPoints: 3,
    minPoints: 1,
  });
};

const getOrganIcon = (organName) => {
  const key = String(organName || '').trim().toLowerCase();
  if (key.includes('allerg')) {
    if (/grass|mould|mold|yeast|weed|tree/.test(key)) {
      return allergyEnvironmentIcon;
    }
    if (key.includes('occupational') || key.includes('work')) {
      return allergyWorkplaceIcon;
    }
    return allergyFoodIcon;
  }
  if (key.includes('hemogram')) {
    return haematologyIcon;
  }
  if (key === 'food') {
    return allergyFoodIcon;
  }
  if (key === 'environment') {
    return allergyEnvironmentIcon;
  }
  return ORGAN_ICON_BY_NAME[key] || liverIcon;
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const authorizedGet = async (path) => {
  if (!BACKEND_ENABLED) {
    throw new Error('Backend base URL is not configured.');
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('You are not logged in.');
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.message || body?.detail || 'Request failed.');
  }

  return body;
};

const toOrganName = (groupName) => {
  const raw = String(groupName || '').trim();
  const normalized = raw.toLowerCase();

  const byKeyword = [
    ['haematology', 'Haematology'],
    ['hematology', 'Haematology'],
    ['liver', 'Liver'],
    ['kidney', 'Kidney'],
    ['vitamin', 'Vitamins'],
    ['lipid', 'Lipid'],
    ['iron', 'Iron'],
    ['thyroid', 'Thyroid'],
    ['diabetes', 'Diabetes'],
    ['inflammation', 'Inflammation'],
    ['sleep', 'Sleep'],
    ['hormone', 'Hormones'],
    ['tumor', 'Tumor markers'],
  ];

  for (const [keyword, label] of byKeyword) {
    if (normalized.includes(keyword)) {
      return label;
    }
  }

  const cleaned = raw.replace(/\s*profile\s*$/i, '').trim();
  return cleaned || 'Liver';
};

const formatValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? '');
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.00$/, '');
};

const formatOptimalPillValueLabel = (test) => {
  const value = String(test?.value ?? '').trim();
  const unit = String(test?.unit ?? '').trim();
  const hasValue = value && value !== '--';
  if (hasValue && unit) {
    return `${value} ${unit}`;
  }
  if (hasValue) {
    return value;
  }
  if (unit) {
    return unit;
  }
  return '';
};

/** Row from homepage `RiskAnalysisSection` blood markers → `BloodMarkerDetailView` marker shape */
const mapHomeBloodMarkerRowToDetailMarker = (row) => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const name = String(row.displayName || row.name || 'Test').trim();
  const markerUpper = name.toUpperCase();
  const numeric = Number(row.numericValue);
  const hasVal = Number.isFinite(numeric);
  const unit = String(row.unit || '').trim();
  const rk = row.riskKey;
  const riskType = rk === 'high' ? 'high' : rk === 'low' ? 'moderate' : 'low';
  const lower = row.normalMin;
  const higher = row.normalMax;

  return {
    id: String(row.id || `home-${markerUpper}`),
    marker: markerUpper,
    title: name,
    parameter_key: row.parameter_key || row.parameterKey || null,
    value: hasVal ? formatValue(numeric) : '--',
    unit,
    diagnosticTestId: row.diagnosticTestId ?? null,
    normalMin: Number.isFinite(Number(lower)) ? Number(lower) : null,
    normalMax: Number.isFinite(Number(higher)) ? Number(higher) : null,
    riskType,
    causes: [],
    effects: [],
  };
};

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (item && typeof item === 'object') {
          const text = item.text || item.label || item.title || item.description || item.value;
          return typeof text === 'string' ? text.trim() : '';
        }

        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
};

const pickApiList = (obj, keys) => {
  for (const key of keys) {
    const values = toStringArray(obj?.[key]);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
};

const pickFirstText = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const extractDiagnosticTestPayload = (payload) => {
  if (!payload) {
    return null;
  }

  if (payload.data && typeof payload.data === 'object') {
    return payload.data;
  }

  if (payload.result && typeof payload.result === 'object') {
    return payload.result;
  }

  if (payload.item && typeof payload.item === 'object') {
    return payload.item;
  }

  if (typeof payload === 'object') {
    return payload;
  }

  return null;
};

const getCategoryFromTests = (tests) => {
  const safeTests = Array.isArray(tests) ? tests : [];
  const riskReadyTests = safeTests.filter((test) => test.isClassifiable);

  const hasHigh = riskReadyTests.some((test) => test.riskType === 'high');
  if (hasHigh) {
    return 'Critical';
  }

  const hasMarginal = riskReadyTests.some((test) => test.riskType === 'moderate' || test.riskType === 'increased');
  if (hasMarginal) {
    return 'Marginal';
  }

  // Optimal section is strict: every parameter must be classifiable and in optimal range.
  if (safeTests.length > 0 && riskReadyTests.length === safeTests.length && riskReadyTests.every((test) => test.riskType === 'low')) {
    return 'Optimal';
  }

  // If we cannot prove high/marginal, keep it out of marginal/critical stacks.
  return 'Optimal';
};

const getPrimaryMarginalRiskType = (tests) => {
  const riskReadyTests = tests.filter((test) => test.isClassifiable);

  if (riskReadyTests.some((test) => test.riskType === 'increased')) {
    return 'increased';
  }

  return 'moderate';
};

const getRepresentativeTest = (tests, desiredType) => {
  const riskReadyTests = tests.filter((test) => test.isClassifiable);

  const direct = riskReadyTests.find((test) => test.riskType === desiredType);
  if (direct) {
    return direct;
  }

  if (desiredType === 'increased') {
    return riskReadyTests.find((test) => test.riskType === 'moderate') || null;
  }

  if (desiredType === 'moderate') {
    return riskReadyTests.find((test) => test.riskType === 'increased') || null;
  }

  if (desiredType === 'high') {
    return riskReadyTests.find((test) => test.riskType === 'moderate' || test.riskType === 'increased') || null;
  }

  return null;
};

const buildSectionsFromApi = (payloadOrGroups) => {
  const rawGroups = extractBloodParameterGroupsArray(payloadOrGroups)
    .filter((group) => !classifyReportGroupName(pickBloodParameterGroupName(group)));

  return rawGroups
    .map((group, groupIndex) => {
      const organ = toOrganName(pickBloodParameterGroupName(group));
      const key = organ.toLowerCase();
      const tests = getBloodParameterTestsFromGroup(group).filter((test) => !isCancerMarkerTest(test));

      const mappedTests = tests.map((test, index) => {
        const n = normalizeBloodParameterTestRow(test);
        const resolvedNumeric = resolveBloodParameterNumericValue(n, test);
        const valueRaw = resolvedNumeric !== undefined ? resolvedNumeric : null;
        const value = Number(valueRaw);
        const hasValue = valueRaw !== null && valueRaw !== undefined && Number.isFinite(value);

        const lowerRaw = n.lower_range;
        const higherRaw = n.higher_range;
        let lower = Number(lowerRaw);
        let higher = Number(higherRaw);
        const numericRangesOk = lowerRaw !== null && lowerRaw !== undefined
          && higherRaw !== null && higherRaw !== undefined
          && Number.isFinite(lower)
          && Number.isFinite(higher);
        if (numericRangesOk && lower > higher) {
          const swap = lower;
          lower = higher;
          higher = swap;
        }
        const hasRanges = numericRangesOk && lower <= higher;
        const isClassifiable = hasValue && hasRanges;

        return {
          id: `${key}-test-${groupIndex}-${index}`,
          marker: String(n.test_name || 'TEST').toUpperCase(),
          title: String(n.test_name || 'Test'),
          parameter_key: n.parameter_key || null,
          diagnosticTestId: n.diagnostic_test_id
            || n.test_id
            || test?.diagnostic_test_id
            || test?.diagnosticTestId
            || test?.test_id
            || test?.testId
            || test?.id
            || test?.diagnostic_test?.test_id
            || test?.diagnostic_test?.id
            || null,
          value: hasValue ? formatValue(value) : '--',
          unit: String(n.unit || '').trim(),
          rawValue: hasValue ? value : null,
          normalMin: hasRanges ? lower : null,
          normalMax: hasRanges ? higher : null,
          isClassifiable,
          riskType: isClassifiable ? getRiskTypeFromBounds(value, lower, higher) : null,
          historyPoints: (() => {
            const embedded = Array.isArray(n.history_points) && n.history_points.length > 0
              ? n.history_points
              : extractBloodParameterHistoryPoints(test);
            return buildBloodMarkerHistoryTimeline({
              historyPoints: embedded,
              currentValue: hasValue ? value : null,
              maxPoints: 8,
              minPoints: 1,
            });
          })(),
          causes: pickApiList(test, ['causes', 'cause', 'possible_causes', 'reason', 'reasons']),
          effects: pickApiList(test, ['effects', 'effect', 'possible_effects', 'impact', 'impacts']),
        };
      }).filter((test) => test.rawValue !== null && Number.isFinite(test.rawValue));

      const noReferenceRangeHiddenCount = mappedTests.filter((test) => !test.isClassifiable).length;
      const visibleTests = mappedTests.filter((test) => test.isClassifiable);

      const classifiableTests = visibleTests;
      const highTests = visibleTests.filter((test) => test.riskType === 'high');
      const lowRiskTests = visibleTests.filter((test) => test.riskType === 'moderate' || test.riskType === 'increased');
      const optimalTests = visibleTests.filter((test) => test.riskType === 'low');

      const initialCategory = getCategoryFromTests(mappedTests);
      const primaryMarginalRiskType = getPrimaryMarginalRiskType(mappedTests);
      const marginalTest = getRepresentativeTest(mappedTests, primaryMarginalRiskType);
      const criticalTest = getRepresentativeTest(mappedTests, 'high');

      const category = initialCategory === 'Critical' && highTests.length === 0
        ? 'Marginal'
        : initialCategory === 'Marginal' && lowRiskTests.length === 0
          ? 'Optimal'
          : initialCategory;

      const riskTypes = category === 'Critical'
        ? ['high', primaryMarginalRiskType, 'low']
        : category === 'Marginal'
          ? [primaryMarginalRiskType, 'low']
          : ['low'];

      const primaryTheme = category === 'Critical'
        ? 'high'
        : category === 'Marginal'
          ? primaryMarginalRiskType
          : 'low';

      const visibleCount = visibleTests.length;
      const totalWithNumericValue = visibleCount + noReferenceRangeHiddenCount;
      const parametersLabel = totalWithNumericValue > 0
        ? `${totalWithNumericValue} parameter${totalWithNumericValue === 1 ? '' : 's'}`
        : '0 parameters';

      return {
        id: `api-${key}-${groupIndex}`,
        organ,
        parameters: parametersLabel,
        theme: primaryTheme,
        category,
        riskTypes,
        tests: visibleTests,
        noReferenceRangeHiddenCount,
        classifiableTests,
        highTests,
        lowRiskTests,
        optimalTests,
        primaryMarginalRiskType,
        marginalTest,
        criticalTest,
      };
    })
    .filter((section) => section.tests.length > 0 || section.noReferenceRangeHiddenCount > 0)
    .sort((a, b) => a.organ.localeCompare(b.organ));
};

const SwipeArrow = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 11.3334L7.33333 8.00008L4 4.66675M8.66667 11.3334L12 8.00008L8.66667 4.66675" stroke="#9A9A9A" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CardChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
    <path d="M0.765298 10.7501L6.79252 5.74121L0.750564 0.750102" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DownChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
    <path d="M1 1.5L6 6.5L11 1.5" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DotBullet = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4" fill="none" aria-hidden="true">
    <circle cx="2" cy="2" r="2" fill="#90DF9E"/>
  </svg>
);

const RiskTrendIcon = ({ type, color: colorOverride }) => {
  const color = colorOverride || getRiskColorByType(type);

  if (type === 'pending') {
    return null;
  }

  if (type === 'low') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
        <path d="M8.41504 6.26172L9.2627 5.41406L6.41895 2.57031L4.50488 4.48438C4.28613 4.73047 3.90332 4.73047 3.68457 4.48438L0.18457 0.984375C-0.0615234 0.765625 -0.0615234 0.382812 0.18457 0.164062C0.40332 -0.0546875 0.786133 -0.0546875 1.00488 0.164062L4.09473 3.25391L6.00879 1.33984C6.22754 1.09375 6.61035 1.09375 6.8291 1.33984L10.083 4.59375L10.9307 3.74609C11.1221 3.58203 11.4229 3.69141 11.4229 3.96484V6.45312C11.4229 6.61719 11.2861 6.75391 11.1221 6.75391H8.63379C8.3877 6.75391 8.25098 6.42578 8.41504 6.26172Z" fill={color}/>
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
      <path d="M8.41504 0.492188L9.2627 1.33984L6.41895 4.18359L4.50488 2.26953C4.28613 2.02344 3.90332 2.02344 3.68457 2.26953L0.18457 5.76953C-0.0615234 5.98828 -0.0615234 6.37109 0.18457 6.58984C0.40332 6.80859 0.786133 6.80859 1.00488 6.58984L4.09473 3.5L6.00879 5.41406C6.22754 5.66016 6.61035 5.66016 6.8291 5.41406L10.083 2.16016L10.9307 3.00781C11.1221 3.17188 11.4229 3.0625 11.4229 2.78906V0.300781C11.4229 0.136719 11.3135 0 11.1494 0H8.63379C8.3877 0 8.25098 0.328125 8.41504 0.492188V0.492188" fill={color}/>
    </svg>
  );
};

const HISTORY_CAPSULE_TONES = {
  low: {
    value: '#4ADE80',
    valueShadow: '0 0 4px rgba(74, 222, 128, 0.25)',
    dim: '#66FF82',
    solid: '#66FF82',
    shadow: '0 0 12px 0 rgba(102, 255, 130, 0.4)',
  },
  moderate: {
    value: '#F7EC33',
    valueShadow: '0 0 4px rgba(247, 236, 51, 0.25)',
    dim: '#DAC15A',
    solid: '#F7EC33',
    shadow: '0 0 12px 0 rgba(218, 193, 90, 0.4)',
  },
  increased: {
    value: '#EE8B48',
    valueShadow: '0 0 4px rgba(238, 139, 72, 0.25)',
    dim: '#F79D1F',
    solid: '#F79D1F',
    shadow: '0 0 12px 0 rgba(247, 157, 31, 0.4)',
  },
  high: {
    value: '#E95D5C',
    valueShadow: '0 0 4px rgba(233, 93, 92, 0.25)',
    dim: '#FF6B6A',
    solid: '#FF6B6A',
    shadow: '0 0 12px 0 rgba(233, 93, 92, 0.4)',
  },
};

const historyCapsuleTone = (riskType) => (
  HISTORY_CAPSULE_TONES[riskType]
  || HISTORY_CAPSULE_TONES[getDisplayRiskType(riskType)]
  || HISTORY_CAPSULE_TONES.low
);

const capsuleIsSolid = (count, index) => {
  if (count === 9) return index >= 2 && index <= 6;
  if (count === 4) return index === 1 || index === 2;
  return index % 3 === 1;
};

/** Colored values over a dash track, dates underneath (1, 2, or 3 readings). */
const BloodMarkerHistoryTimeline = ({
  points = [],
  normalMin = null,
  normalMax = null,
  currentRiskType = 'low',
}) => {
  if (!Array.isArray(points) || points.length < 1) {
    return null;
  }

  const readingCount = points.length;
  const dashesPerPoint = readingCount <= 1 ? 9 : readingCount === 2 ? 4 : 3;
  const resolved = points.map((point, index) => {
    const isLatest = index === points.length - 1;
    const pointRisk = (
      Number.isFinite(Number(normalMin)) && Number.isFinite(Number(normalMax))
        ? getRiskTypeFromBounds(point.value, normalMin, normalMax)
        : currentRiskType
    );
    const tone = historyCapsuleTone(pointRisk);
    return {
      key: `history-${index}-${point.value}-${point.date || index}`,
      value: formatValue(point.value),
      date: formatBloodMarkerHistoryDate(point.date) || (isLatest ? 'Now' : '—'),
      isLatest,
      tone,
    };
  });

  return (
    <div
      className="blood-markers-page__history-bars"
      aria-label="Previous results"
    >
      {resolved.map((point) => (
        <div key={point.key} className="blood-markers-page__history-bars-col">
          <span
            className={`blood-markers-page__history-bars-value${point.isLatest ? ' is-latest' : ''}`}
            style={{
              color: point.tone.value,
              textShadow: point.isLatest ? point.tone.valueShadow : undefined,
            }}
          >
            {point.value}
          </span>
          <span className="blood-markers-page__history-bars-track" aria-hidden="true">
            {Array.from({ length: dashesPerPoint }, (_, dashIndex) => {
              const solid = capsuleIsSolid(dashesPerPoint, dashIndex);
              return (
                <span
                  key={`${point.key}-dash-${dashIndex}`}
                  className="blood-markers-page__history-bars-dash"
                  style={{
                    background: solid ? point.tone.solid : point.tone.dim,
                    opacity: solid ? 1 : 0.5,
                    boxShadow: point.tone.shadow,
                  }}
                />
              );
            })}
          </span>
          <span className={`blood-markers-page__history-bars-date${point.isLatest ? ' is-latest' : ''}`}>
            {point.date}
          </span>
        </div>
      ))}
    </div>
  );
};

const markerCards = (section) => {
  const cards = [];

  const pushTestCard = (test, riskType, indexKey) => {
    cards.push({
      id: `${section.id}-${riskType}-${indexKey}`,
      marker: test.marker,
      value: test.value,
      unit: test.unit,
      parameter_key: test.parameter_key,
      diagnosticTestId: test.diagnosticTestId,
      riskType,
      allergy: Boolean(test.allergy),
      normalMin: test.normalMin,
      normalMax: test.normalMax,
      rawValue: test.rawValue,
      historyPoints: Array.isArray(test.historyPoints) ? test.historyPoints : [],
      title: test.title,
      causes: test.causes,
      effects: test.effects,
    });
  };

  if (section.category === 'Allergies') {
    (section.tests || []).forEach((test, index) => pushTestCard(test, test.riskType || 'low', index));
    return cards;
  }

  if (section.category === 'Critical') {
    (section.highTests || []).forEach((test, index) => pushTestCard(test, 'high', index));
    (section.lowRiskTests || []).forEach((test, index) => pushTestCard(test, test.riskType || 'moderate', `l-${index}`));
  } else if (section.category === 'Marginal') {
    (section.lowRiskTests || []).forEach((test, index) => pushTestCard(test, test.riskType || 'moderate', index));
  }

  const optimalList = section.optimalTests || [];
  const optCount = optimalList.length;
  if (optCount > 0) {
    if (section.category === 'Critical' || section.category === 'Marginal') {
      cards.push({
        id: `${section.id}-low-optimal-summary`,
        riskType: 'low',
        cardRole: 'optimal-aggregate',
        marker: 'OPTIMAL',
        value: String(optCount),
        unit: optCount === 1 ? 'parameter' : 'parameters',
        aggregateTests: [...optimalList],
        diagnosticTestId: null,
        normalMin: null,
        normalMax: null,
        title: 'Parameters in optimal range',
        causes: [],
        effects: [],
      });
    } else if (section.category === 'Optimal') {
      if (optCount <= 3) {
        optimalList.forEach((test, index) => {
          pushTestCard(test, 'low', `opt-${index}`);
        });
      } else {
        pushTestCard(optimalList[0], 'low', 'opt-0');
        pushTestCard(optimalList[1], 'low', 'opt-1');
        cards.push({
          id: `${section.id}-low-optimal-aggregate`,
          riskType: 'low',
          cardRole: 'optimal-aggregate',
          marker: 'ADDITIONAL',
          value: String(optCount - 2),
          unit: 'parameters',
          aggregateTests: optimalList.slice(2),
          diagnosticTestId: null,
          normalMin: null,
          normalMax: null,
          title: 'Additional optimal parameters',
          causes: [],
          effects: [],
        });
      }
    }
  }

  return cards;
};

const flattenCardsForListView = (cards) => {
  const rows = [];

  cards.forEach((card) => {
    if (card.cardRole === 'optimal-aggregate' && Array.isArray(card.aggregateTests) && card.aggregateTests.length > 0) {
      card.aggregateTests.forEach((test, index) => {
        rows.push({
          id: `${card.id}-list-${index}`,
          marker: test.marker,
          value: test.value,
          unit: test.unit,
          parameter_key: test.parameter_key,
          riskType: test.riskType || 'low',
          diagnosticTestId: test.diagnosticTestId,
          normalMin: test.normalMin,
          normalMax: test.normalMax,
          rawValue: test.rawValue,
          historyPoints: Array.isArray(test.historyPoints) ? test.historyPoints : [],
          title: test.title,
          causes: test.causes,
          effects: test.effects,
        });
      });
      return;
    }

    if (card.cardRole === 'optimal-aggregate') {
      return;
    }

    rows.push(card);
  });

  return rows;
};

const ViewAllOverlayCloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect width="32" height="32" rx="16" fill="#063533" />
    <path d="M23.1992 8.75C23.2127 8.75003 23.2258 8.75513 23.2354 8.76465C23.2449 8.77417 23.25 8.78732 23.25 8.80078C23.25 8.81422 23.2448 8.82738 23.2354 8.83691L16.6006 15.4697L16.0703 16L16.6006 16.5303L23.2354 23.1631C23.2448 23.1726 23.25 23.1858 23.25 23.1992C23.25 23.2127 23.2449 23.2258 23.2354 23.2354C23.2258 23.2449 23.2127 23.25 23.1992 23.25C23.1858 23.25 23.1726 23.2448 23.1631 23.2354L16.5303 16.6006L16 16.0703L15.4697 16.6006L8.83691 23.2354C8.82738 23.2448 8.81422 23.25 8.80078 23.25C8.78732 23.25 8.77417 23.2449 8.76465 23.2354C8.75513 23.2258 8.75003 23.2127 8.75 23.1992C8.75 23.1858 8.75518 23.1726 8.76465 23.1631L15.3994 16.5303L15.9297 16L15.3994 15.4697L8.76465 8.83691C8.75998 8.83221 8.75644 8.82643 8.75391 8.82031C8.75136 8.81415 8.75 8.80745 8.75 8.80078C8.75002 8.79414 8.75136 8.78739 8.75391 8.78125C8.75646 8.77514 8.75996 8.76933 8.76465 8.76465C8.76933 8.75996 8.77514 8.75646 8.78125 8.75391C8.78739 8.75136 8.79414 8.75002 8.80078 8.75C8.80745 8.75 8.81415 8.75136 8.82031 8.75391C8.82643 8.75644 8.83221 8.75998 8.83691 8.76465L15.4697 15.3994L16 15.9297L16.5303 15.3994L23.1631 8.76465C23.1726 8.75518 23.1858 8.75 23.1992 8.75Z" fill="white" stroke="white" strokeWidth="1.5" />
  </svg>
);

const BloodMarkersViewAllPopup = ({
  rows,
  section,
  organIcon,
  trendsByParameterKey = {},
  onClose,
  onOpenDetail,
}) => {
  useEffect(() => {
    const page = document.querySelector('.blood-markers-page');
    const previousBodyOverflow = document.body.style.overflow;
    const previousPageOverflow = page ? page.style.overflow : '';
    document.body.style.overflow = 'hidden';
    if (page) {
      page.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (page) {
        page.style.overflow = previousPageOverflow;
      }
    };
  }, []);

  const theme = getDisplayRiskType(section.theme);

  return (
    <div
      className="blood-markers-page__view-all-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${section.organ} parameters`}
      onClick={onClose}
    >
      <button
        type="button"
        className="blood-markers-page__view-all-overlay-close"
        aria-label="Close"
        onClick={onClose}
      >
        <ViewAllOverlayCloseIcon />
      </button>

      <div
        className="blood-markers-page__view-all-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="blood-markers-page__view-all-sheet-header">
          <div className={`blood-markers-page__organ-icon-box blood-markers-page__organ-icon-box--${section.theme}`}>
            <img
              src={organIcon}
              alt=""
              aria-hidden="true"
              className={`blood-markers-page__organ-icon blood-markers-page__organ-icon--${theme}`}
            />
          </div>
          <div className="blood-markers-page__view-all-sheet-copy">
            <h2 className="blood-markers-page__view-all-sheet-title">{section.organ}</h2>
            <p className="blood-markers-page__view-all-sheet-subtitle">{section.parameters}</p>
          </div>
        </div>

        <div className="blood-markers-page__view-all-list">
          {rows.map((row, index) => {
            const markerName = String(row.marker || '').trim();
            const historyPoints = BLOOD_MARKER_CARD_HISTORY_ENABLED
              ? resolveCardHistoryPoints(row, trendsByParameterKey)
              : [];

            return (
              <React.Fragment key={row.id}>
                {index > 0 ? <div className="blood-markers-page__view-all-divider" aria-hidden="true" /> : null}
                <button
                  type="button"
                  className="blood-markers-page__view-all-row blood-markers-page__view-all-row--bars"
                  onClick={() => {
                    onClose();
                    onOpenDetail({ ...row, organ: section.organ, parameters: section.parameters });
                  }}
                >
                  {markerName ? (
                    <span className="blood-markers-page__view-all-marker">{markerName}</span>
                  ) : null}
                  <BloodMarkerHistoryTimeline
                    points={historyPoints.length ? historyPoints : [{
                      value: row.rawValue ?? row.value,
                      date: '',
                    }]}
                    normalMin={row.normalMin}
                    normalMax={row.normalMax}
                    currentRiskType={row.riskType}
                  />
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const BloodMarkersParameterRows = ({ rows, keyPrefix = '' }) => {
  const out = [];
  let detailQueue = [];
  let detailKeyBase = '';

  const flushDetails = () => {
    if (detailQueue.length === 0) {
      return;
    }
    out.push(
      <div
        key={`${keyPrefix}${detailKeyBase}-detail-grid`}
        className="blood-markers-page__optimal-params-detail-grid"
      >
        {detailQueue}
      </div>,
    );
    detailQueue = [];
    detailKeyBase = '';
  };

  rows.forEach((row, rowIndex) => {
    const compositeKey = `${keyPrefix}${row.key}-${rowIndex}`;
    if (row.type === 'heading') {
      flushDetails();
      out.push(
        <div key={compositeKey} className="blood-markers-page__optimal-params-heading">
          {row.label}
        </div>,
      );
      return;
    }
    if (row.type === 'pill-group') {
      flushDetails();
      const morePillCount = row.morePillCount ?? 0;
      out.push(
        <div
          key={compositeKey}
          className="blood-markers-page__optimal-pills"
          role="list"
          aria-label="Parameters in optimal range"
        >
          {row.tests.map((test, pillIndex) => {
            const valueLabel = formatOptimalPillValueLabel(test);
            return (
              <span key={`${compositeKey}-${test.id}-${pillIndex}`} className="blood-markers-page__optimal-pill" role="listitem">
                <span className="blood-markers-page__optimal-pill-name">{test.title}</span>
                {valueLabel ? (
                  <>
                    <span className="blood-markers-page__optimal-pill-divider" aria-hidden="true" />
                    <span className="blood-markers-page__optimal-pill-value">{valueLabel}</span>
                  </>
                ) : null}
              </span>
            );
          })}
          {morePillCount > 0 ? (
            <span
              key={`${compositeKey}-more`}
              className="blood-markers-page__optimal-more-text"
              role="listitem"
              aria-label={`${morePillCount} additional parameter${morePillCount === 1 ? '' : 's'} not listed here`}
            >
              +more
            </span>
          ) : null}
        </div>,
      );
      return;
    }
    if (row.type === 'more-trailing') {
      flushDetails();
      out.push(
        <div key={compositeKey} className="blood-markers-page__optimal-params-more-trail">
          <span className="blood-markers-page__optimal-more-text">+more</span>
        </div>,
      );
      return;
    }
    if (!detailKeyBase) {
      detailKeyBase = row.key || `row-${rowIndex}`;
    }
    detailQueue.push(
      <span key={compositeKey} className="blood-markers-page__optimal-param-chunk">
        <span className="blood-markers-page__optimal-param-dot" aria-hidden="true">
          <DotBullet />
        </span>
        <span className="blood-markers-page__optimal-param-item">{row.text}</span>
      </span>,
    );
  });

  flushDetails();

  return <>{out}</>;
};

const buildAggregateOptimalRows = (tests) => {
  const list = tests || [];
  if (list.length === 0) {
    return [];
  }

  return [
    {
      type: 'pill-group',
      key: 'optimal-params',
      tests: list.map((t) => ({
        id: t.id,
        title: t.title,
        value: t.value,
        unit: t.unit,
      })),
    },
  ];
};

const BLOOD_MARKER_DETAIL_CONTENT = {
  ALBUMIN: {
    title: 'Albumin',
    description: 'Measure of the main protein in blood that maintains fluid balance and transports substances.',
    defaultValue: 23.5,
    unit: 'mg/dL',
    normalMin: 7,
    normalMax: 12,
  }
};

const BLOOD_DOT_GAP = 2;
const BLOOD_ZONE_COUNT = 3;
const BLOOD_MIN_DOTS_PER_ZONE = 12;
const getDotSizeForMarker = (index, markerIndex) => {
  const distanceFromMarker = Math.abs(index - markerIndex);
  if (distanceFromMarker === 0) return 12;
  return Math.max(4, 11 - distanceFromMarker);
};

const getDotBandByIndex = (index, totalDots) => {
  const safeTotal = Math.max(1, totalDots);
  const positionPercent = ((index + 0.5) / safeTotal) * 100;

  if (positionPercent >= 40 && positionPercent < 60) {
    return 'low';
  }

  if ((positionPercent >= 20 && positionPercent < 40) || (positionPercent >= 60 && positionPercent < 80)) {
    return 'moderate';
  }

  return 'high';
};

const getSymmetricDotBackground = (index, totalDots) => {
  const band = getDotBandByIndex(index, totalDots);
  return RISK_DOT_BACKGROUND[band] || RISK_DOT_BACKGROUND.low;
};

const getMarkerPercentForValue = (value, normalMin, normalMax) => {
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

const BloodMarkerDetailView = ({ marker, onBack }) => {
  const riskStripRef = useRef(null);
  const indicatorRef = useRef(null);
  const [diagnosticDetail, setDiagnosticDetail] = useState(null);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(Boolean(marker?.diagnosticTestId));
  const [expandedPill, setExpandedPill] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const descriptionRef = useRef(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadDiagnosticDetail = async () => {
      if (isActive) {
        setDiagnosticDetail(null);
      }

      if (!marker?.diagnosticTestId) {
        if (isActive) {
          setIsDiagnosticLoading(false);
          setDiagnosticDetail(null);
        }
        return;
      }

      if (isActive) {
        setIsDiagnosticLoading(true);
      }

      try {
        const response = await authorizedGet(`/diagnostics/health-parameters/${marker.diagnosticTestId}`);
        const detailPayload = extractDiagnosticTestPayload(response);

        if (isActive) {
          setDiagnosticDetail(detailPayload);
          setIsDiagnosticLoading(false);
        }
      } catch (error) {
        if (isActive) {
          setDiagnosticDetail(null);
          setIsDiagnosticLoading(false);
        }
      }
    };

    loadDiagnosticDetail();

    return () => {
      isActive = false;
    };
  }, [marker?.diagnosticTestId]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [marker?.marker, marker?.diagnosticTestId]);

  const baseDetail = BLOOD_MARKER_DETAIL_CONTENT[marker?.marker] || BLOOD_MARKER_DETAIL_CONTENT.ALBUMIN;
  const shouldWaitForDiagnosticData = Boolean(marker?.diagnosticTestId);
  const diagnosticDescription = pickFirstText(diagnosticDetail, [
    'meaning',
    'top_one_liner',
    'topOneLiner',
    'one_liner',
    'oneLiner',
    'description',
    'summary',
    'overview',
  ]);
  const diagnosticCauses = pickApiList(diagnosticDetail, ['causes', 'cause', 'possible_causes', 'reason', 'reasons']);
  const diagnosticEffects = pickApiList(diagnosticDetail, ['effects', 'effect', 'possible_effects', 'impact', 'impacts']);

  const detail = {
    ...baseDetail,
    title: String(marker?.title || marker?.marker || baseDetail.title).trim() || baseDetail.title,
    description: shouldWaitForDiagnosticData
      ? (isDiagnosticLoading ? '' : (diagnosticDescription || 'No details provided in report.'))
      : baseDetail.description,
    normalMin: Number.isFinite(Number(marker?.normalMin)) ? Number(marker.normalMin) : baseDetail.normalMin,
    normalMax: Number.isFinite(Number(marker?.normalMax)) ? Number(marker.normalMax) : baseDetail.normalMax,
    causes: [],
    effects: [],
  };

  const markerValue = Number.parseFloat(marker?.value);
  const activeValue = Number.isFinite(markerValue) ? markerValue : detail.defaultValue;
  const deviationSide = activeValue < detail.normalMin
    ? 'low'
    : activeValue > detail.normalMax
      ? 'high'
      : 'normal';

  const sideCauses = deviationSide === 'high'
    ? toStringArray(diagnosticDetail?.causes_when_high)
    : deviationSide === 'low'
      ? toStringArray(diagnosticDetail?.causes_when_low)
      : [];

  const sideEffects = deviationSide === 'high'
    ? toStringArray(diagnosticDetail?.effects_when_high)
    : deviationSide === 'low'
      ? toStringArray(diagnosticDetail?.effects_when_low)
      : [];

  detail.causes = sideCauses.length > 0
    ? sideCauses
    : diagnosticCauses;

  detail.effects = sideEffects.length > 0
    ? sideEffects
    : diagnosticEffects;

  const [riskStripWidth, setRiskStripWidth] = useState(0);
  const [dotsAnimated, setDotsAnimated] = useState(false);
  const [animatedMarkerLeftPercent, setAnimatedMarkerLeftPercent] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(0);

  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (!element || isDescriptionExpanded) {
      setIsDescriptionTruncated(false);
      return;
    }

    setIsDescriptionTruncated(element.scrollHeight > element.clientHeight + 1);
  }, [detail.description, isDescriptionExpanded, shouldWaitForDiagnosticData, isDiagnosticLoading]);

  const minScale = detail.normalMin - DETAIL_HIGH_RISK_DISPLAY_PADDING;
  const maxScale = detail.normalMax + DETAIL_HIGH_RISK_DISPLAY_PADDING;
  const clampedValue = Math.max(minScale, Math.min(maxScale, activeValue));
  const markerPercent = getMarkerPercentForValue(clampedValue, detail.normalMin, detail.normalMax);
  const dotsPerZone = useMemo(() => {
    if (!riskStripWidth) return BLOOD_MIN_DOTS_PER_ZONE;
    return Math.max(BLOOD_MIN_DOTS_PER_ZONE, Math.round((riskStripWidth / BLOOD_ZONE_COUNT) / 7.4));
  }, [riskStripWidth]);
  const bloodTotalDots = dotsPerZone * BLOOD_ZONE_COUNT;
  const selectedIndex = Math.round((markerPercent / 100) * (bloodTotalDots - 1));
  const currentRiskType = getRiskTypeFromBounds(clampedValue, detail.normalMin, detail.normalMax);
  const isOptimalMarker = currentRiskType === 'low';
  const riskText = RISK_META[getDisplayRiskType(currentRiskType)]?.label || RISK_META.low.label;
  const riskColor = getRiskColorByType(currentRiskType);

  const riskLayout = useMemo(() => {
    const buildLayoutForMarker = (candidateMarkerIndex) => {
      const rawDotSizes = Array.from({ length: bloodTotalDots }, (_, index) =>
        getDotSizeForMarker(index, candidateMarkerIndex)
      );

      const totalRawDotWidth = rawDotSizes.reduce((sum, size) => sum + size, 0);
      const totalGapWidth = BLOOD_DOT_GAP * (bloodTotalDots - 1);
      const availableDotWidth = riskStripWidth ? Math.max(0, riskStripWidth - totalGapWidth) : totalRawDotWidth;
      const dotSizeScale = totalRawDotWidth > 0 ? (availableDotWidth / totalRawDotWidth) : 1;
      const adjustedDotSizes = rawDotSizes.map((size) => size * dotSizeScale);
      const dotsTrackWidth = adjustedDotSizes.reduce((sum, size) => sum + size, 0) + totalGapWidth;

      const dotCenterPercents = [];
      let runningX = 0;
      for (let index = 0; index < bloodTotalDots; index += 1) {
        const dotSize = adjustedDotSizes[index];
        const centerPx = runningX + dotSize / 2;
        dotCenterPercents.push(dotsTrackWidth > 0 ? (centerPx / dotsTrackWidth) * 100 : 0);
        runningX += dotSize + BLOOD_DOT_GAP;
      }

      return { adjustedDotSizes, dotsTrackWidth, dotCenterPercents };
    };

    let candidateMarkerIndex = selectedIndex;
    let layout = buildLayoutForMarker(candidateMarkerIndex);

    const nearestIndex = layout.dotCenterPercents.reduce((closestIndex, _, index) => {
      const currentDistance = Math.abs(layout.dotCenterPercents[index] - markerPercent);
      const closestDistance = Math.abs(layout.dotCenterPercents[closestIndex] - markerPercent);
      return currentDistance < closestDistance ? index : closestIndex;
    }, 0);

    if (nearestIndex !== candidateMarkerIndex) {
      candidateMarkerIndex = nearestIndex;
      layout = buildLayoutForMarker(candidateMarkerIndex);
    }

    return {
      markerIndex: candidateMarkerIndex,
      markerLeftPercent: layout.dotCenterPercents[candidateMarkerIndex] ?? markerPercent,
      adjustedDotSizes: layout.adjustedDotSizes,
      dotsTrackWidth: layout.dotsTrackWidth,
      dotCenterPercents: layout.dotCenterPercents
    };
  }, [markerPercent, riskStripWidth, selectedIndex, bloodTotalDots]);

  const { markerLeftPercent, adjustedDotSizes, dotsTrackWidth, dotCenterPercents } = riskLayout;
  const dividerPercents = useMemo(() => {
    const greenIndexes = [];

    for (let index = 0; index < bloodTotalDots; index += 1) {
      if (getDotBandByIndex(index, bloodTotalDots) === 'low') {
        greenIndexes.push(index);
      }
    }

    if (greenIndexes.length === 0) {
      return [40, 60];
    }

    const firstGreen = greenIndexes[0];
    const lastGreen = greenIndexes[greenIndexes.length - 1];
    const leftNeighbor = Math.max(0, firstGreen - 1);
    const rightNeighbor = Math.min(bloodTotalDots - 1, lastGreen + 1);

    const firstGreenCenter = dotCenterPercents[firstGreen] ?? 40;
    const lastGreenCenter = dotCenterPercents[lastGreen] ?? 60;
    const leftNeighborCenter = dotCenterPercents[leftNeighbor] ?? firstGreenCenter;
    const rightNeighborCenter = dotCenterPercents[rightNeighbor] ?? lastGreenCenter;

    const leftDivider = firstGreen === 0
      ? firstGreenCenter
      : (leftNeighborCenter + firstGreenCenter) / 2;
    const rightDivider = lastGreen === bloodTotalDots - 1
      ? lastGreenCenter
      : (lastGreenCenter + rightNeighborCenter) / 2;

    return [leftDivider, rightDivider];
  }, [bloodTotalDots, dotCenterPercents]);
  const zoneCenterPercents = useMemo(() => {
    const leftDivider = dividerPercents[0] ?? 40;
    const rightDivider = dividerPercents[1] ?? 60;
    return [
      leftDivider / 2,
      (leftDivider + rightDivider) / 2,
      (rightDivider + 100) / 2,
    ];
  }, [dividerPercents]);
  const markerDotSize = adjustedDotSizes[riskLayout.markerIndex] || 0;
  const markerLineTop = 11 + (12 + markerDotSize) / 2;

  const markerLeftPx = riskStripWidth > 0 ? (animatedMarkerLeftPercent / 100) * riskStripWidth : 0;
  const indicatorSidePadding = 12;
  const indicatorHalfWidth = indicatorWidth / 2;
  const indicatorLeftPx = riskStripWidth > 0
    ? Math.min(
      Math.max(markerLeftPx, indicatorHalfWidth + indicatorSidePadding),
      Math.max(indicatorHalfWidth + indicatorSidePadding, riskStripWidth - indicatorHalfWidth - indicatorSidePadding)
    )
    : markerLeftPx;

  useEffect(() => {
    const element = riskStripRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setRiskStripWidth(element.clientWidth);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = indicatorRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setIndicatorWidth(element.clientWidth);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, [detail.value, detail.unit, riskText]);

  useEffect(() => {
    setDotsAnimated(false);
    setAnimatedMarkerLeftPercent(0);
    let markerTimeout;

    const animationFrame = requestAnimationFrame(() => {
      setDotsAnimated(true);
      markerTimeout = window.setTimeout(() => {
        setAnimatedMarkerLeftPercent(markerLeftPercent);
      }, 120);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      if (markerTimeout) {
        window.clearTimeout(markerTimeout);
      }
    };
  }, [markerLeftPercent]);

  return (
    <div className="blood-marker-detail">
      <header className="blood-marker-detail__header">
        <button type="button" className="blood-marker-detail__back-btn" onClick={onBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="blood-marker-detail__title">{detail.title}</h1>
      </header>

      <section className="blood-marker-detail__scale-section" aria-label="Blood marker range scale">
        <div className="blood-marker-detail__risk-strip" ref={riskStripRef}>
          <div className="blood-marker-detail__risk-scale-shell" style={{ width: `${dotsTrackWidth}px` }}>
            <div className="blood-marker-detail__labels-row">
              {[
                { title: 'Low', value: `<${detail.normalMin}` },
                { title: 'Normal', value: `${detail.normalMin}-${detail.normalMax}` },
                { title: 'High', value: `>${detail.normalMax}` },
              ].map((label, index) => (
                <div
                  key={`${label.title}-${label.value}`}
                  className={`blood-marker-detail__label-group ${index === 1 ? 'blood-marker-detail__label-group--normal' : ''}`}
                  style={{
                    left: `${zoneCenterPercents[index]}%`,
                    width: index === 1 ? `${Math.max(8, (dividerPercents[1] - dividerPercents[0]) - 2)}%` : undefined,
                  }}
                >
                  <span className="blood-marker-detail__label-title">{label.title}</span>
                  <span className="blood-marker-detail__label-value">{label.value}</span>
                </div>
              ))}
            </div>

            <div className="blood-marker-detail__risk-track-area">
              <span className="blood-marker-detail__zone-separator" style={{ left: `${dividerPercents[0]}%` }} />
              <span className="blood-marker-detail__zone-separator" style={{ left: `${dividerPercents[1]}%` }} />

              <div className="blood-marker-detail__risk-dots-track">
                {Array.from({ length: bloodTotalDots }, (_, index) => {
                  const dotBackground = getSymmetricDotBackground(index, bloodTotalDots);
                  const dotSize = adjustedDotSizes[index];

                  return (
                    <span
                      key={`detail-dot-${index}`}
                      className={`blood-marker-detail__risk-dot ${dotsAnimated ? 'animated' : ''}`}
                      style={{
                        background: dotBackground,
                        width: `${dotSize}px`,
                        height: `${dotSize}px`,
                        transitionDelay: `${index * 12}ms`
                      }}
                    />
                  );
                })}
              </div>

              <div className="blood-marker-detail__risk-marker-zone">
                <div
                  className="blood-marker-detail__risk-marker"
                  style={{
                    left: `${animatedMarkerLeftPercent}%`,
                    top: `${markerLineTop}px`
                  }}
                >
                  <span className="blood-marker-detail__risk-marker-line" style={{ borderLeftColor: riskColor }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={indicatorRef} className="blood-marker-detail__value-row" style={{ left: `${indicatorLeftPx}px` }}>
          <div className="blood-marker-detail__value-main" style={{ color: riskColor }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8.66792 5.21802V13.3327H7.33459V5.21802L3.75858 8.79401L2.81592 7.85135L8.00125 2.66602L13.1866 7.85135L12.2439 8.79401L8.66792 5.21802Z" fill={riskColor} />
            </svg>
            <span className="blood-marker-detail__value-number">{activeValue}</span>
            {String(marker?.unit || detail.unit || '').trim() ? (
              <span className="blood-marker-detail__value-unit">
                {` ${String(marker?.unit || detail.unit).trim()}`}
              </span>
            ) : null}
          </div>
          <div className="blood-marker-detail__risk-main">
            <span className="blood-marker-detail__risk-badge-dot" style={{ background: riskColor }} />
            <span>{riskText}</span>
          </div>
        </div>
      </section>

      <section className="blood-marker-detail__description-section">
        {shouldWaitForDiagnosticData && isDiagnosticLoading ? (
        <p className="blood-marker-detail__description">Loading marker details...</p>
      ) : (
        <div className="blood-marker-detail__description-wrap">
          <p
            ref={descriptionRef}
            className={[
              'blood-marker-detail__description',
              !isDescriptionExpanded ? 'blood-marker-detail__description--clamped' : '',
            ].filter(Boolean).join(' ')}
          >
            {detail.description}
          </p>
          {!isDescriptionExpanded && isDescriptionTruncated ? (
            <button
              type="button"
              className="blood-marker-detail__description-dots"
              onClick={() => setIsDescriptionExpanded(true)}
              aria-label="Show full marker description"
            >
              ..
            </button>
          ) : null}
        </div>
      )}
      </section>

      <TrendsChart
        className="blood-marker-detail__trends-section"
        variant="blood"
        bloodParameter={toBloodParameterKey(marker)}
        normalMin={detail.normalMin}
        normalMax={detail.normalMax}
        unit={String(marker?.unit || detail.unit || '').trim()}
      />

      {!isOptimalMarker ? (
        <section className="blood-marker-detail__info-section">
          {[
            {
              key: 'causes',
              label: 'Causes',
              accentClass: 'blood-marker-detail__pill-accent--causes',
              items: shouldWaitForDiagnosticData && isDiagnosticLoading ? null : detail.causes,
              loading: shouldWaitForDiagnosticData && isDiagnosticLoading,
              emptyText: 'No causes provided in report.'
            },
            {
              key: 'effects',
              label: 'Effects',
              accentClass: 'blood-marker-detail__pill-accent--effects',
              items: shouldWaitForDiagnosticData && isDiagnosticLoading ? null : detail.effects,
              loading: shouldWaitForDiagnosticData && isDiagnosticLoading,
              emptyText: 'No effects provided in report.'
            }
          ].map(({ key, label, accentClass, items, loading, emptyText }) => {
            const bodyText = loading
              ? `Loading ${key}...`
              : items && items.length > 0
                ? formatApiContentDisplay(items)
                : emptyText;
            return (
              <button
                key={key}
                type="button"
                className="blood-marker-detail__pill"
                onClick={() => setExpandedPill(expandedPill === key ? null : key)}
                aria-expanded={expandedPill === key}
              >
                <div className="blood-marker-detail__pill-header">
                  <span className={`blood-marker-detail__pill-accent ${accentClass}`} />
                  <span className="blood-marker-detail__pill-title">{label}</span>
                  <svg
                    className={`blood-marker-detail__pill-chevron${expandedPill === key ? ' blood-marker-detail__pill-chevron--open' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {expandedPill === key && (
                  <p className="blood-marker-detail__pill-body">{bodyText}</p>
                )}
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
};

const BloodMarkerStackSection = ({ section, onOpenDetail, trendsByParameterKey = {} }) => {
  const [expandedLowCardIds, setExpandedLowCardIds] = useState({});
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const cards = markerCards(section);
  const cardCount = cards.length;
  const isSingleCardStack = cardCount <= 1;
  const showViewAllToggle = cardCount > 1;
  const listRows = useMemo(() => flattenCardsForListView(cards), [cards]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState('next');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const stackRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const isHorizontalSwipeRef = useRef(false);
  const pointerStartXRef = useRef(null);
  const pointerStartYRef = useRef(null);
  const pointerIsHorizontalSwipeRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const latestDragXRef = useRef(0);
  const pendingDragXRef = useRef(0);
  const dragFrameRef = useRef(null);
  /** True after startAnimation until we settle once (left and/or transform both fire on the front card). */
  const stackSwapAwaitingSettleRef = useRef(false);
  const frontStackCardRef = useRef(null);
  const swappingExpandedCardIdRef = useRef(null);
  const [isSwappingFromExpanded, setIsSwappingFromExpanded] = useState(false);

  const commitDragOffset = (value) => {
    latestDragXRef.current = value;
    if (stackRef.current) {
      stackRef.current.style.setProperty('--blood-markers-drag-x', `${value}px`);
    }
  };

  const resetDragOffset = useCallback(() => {
    pendingDragXRef.current = 0;
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    latestDragXRef.current = 0;
    if (stackRef.current) {
      stackRef.current.style.setProperty('--blood-markers-drag-x', '0px');
    }
  }, []);

  const applyDragOffset = (value) => {
    pendingDragXRef.current = value;
    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      commitDragOffset(pendingDragXRef.current);
    });
  };

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
      swappingExpandedCardIdRef.current = null;
      stackSwapAwaitingSettleRef.current = false;
    };
  }, []);

  const isFrontAggregateExpanded = (index = activeIndex) => {
    const frontCard = cards[index];
    return Boolean(
      frontCard?.cardRole === 'optimal-aggregate' && expandedLowCardIds[frontCard.id],
    );
  };

  const beginStackSwapAnimation = (direction) => {
    if (cardCount <= 1) return;
    stackSwapAwaitingSettleRef.current = true;
    setIsDragging(false);
    resetDragOffset();
    setSwipeDirection(direction);

    const startMotion = () => setIsAnimating(true);
    if (swappingExpandedCardIdRef.current) {
      startMotion();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(startMotion);
    });
  };

  const requestStackSwap = (direction) => {
    if (isAnimating || cardCount <= 1) {
      return;
    }

    if (isFrontAggregateExpanded()) {
      swappingExpandedCardIdRef.current = cards[activeIndex]?.id ?? null;
      setIsSwappingFromExpanded(true);
    }

    beginStackSwapAnimation(direction);
  };

  const goPrev = () => {
    requestStackSwap('prev');
  };

  const goNext = () => {
    requestStackSwap('next');
  };

  const handleTouchStart = (event) => {
    if (isSingleCardStack || isAnimating) {
      return;
    }
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
    isHorizontalSwipeRef.current = false;
    setIsDragging(false);
    resetDragOffset();
  };

  const handleTouchMove = (event) => {
    if (touchStartXRef.current == null || touchStartYRef.current == null || isAnimating) {
      return;
    }

    const deltaX = event.touches[0].clientX - touchStartXRef.current;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;

    if (!isHorizontalSwipeRef.current) {
      const hasEnoughMovement = Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6;
      if (!hasEnoughMovement) {
        return;
      }

      isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!isHorizontalSwipeRef.current) {
        return;
      }

      setIsDragging(true);
    }

    event.preventDefault();

    const stackWidth = stackRef.current?.clientWidth || 260;
    const softLimit = Math.max(120, stackWidth * 0.55);
    const absDelta = Math.abs(deltaX);
    const direction = deltaX < 0 ? -1 : 1;

    const dragValue = absDelta <= softLimit
      ? deltaX
      : direction * (softLimit + (absDelta - softLimit) * 0.18);

    applyDragOffset(dragValue);
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current == null) {
      return;
    }

    if (!isHorizontalSwipeRef.current) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      setIsDragging(false);
      resetDragOffset();
      return;
    }

    const stackWidth = stackRef.current?.clientWidth || 260;
    const swipeThreshold = Math.max(30, stackWidth * 0.14);
    const deltaX = event.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    } else {
      setIsDragging(false);
      resetDragOffset();
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
  };

  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
    setIsDragging(false);
    resetDragOffset();
  };

  const handlePointerDown = (event) => {
    if (isSingleCardStack || isAnimating) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    pointerStartYRef.current = event.clientY;
    pointerIsHorizontalSwipeRef.current = false;
    activePointerIdRef.current = event.pointerId;
    setIsDragging(false);
    resetDragOffset();

    /* Do not setPointerCapture here — capturing on pointerdown breaks mouse "click"
       on child cards (front article). Capture only once a horizontal swipe is confirmed in handlePointerMove. */
  };

  const handlePointerMove = (event) => {
    if (
      pointerStartXRef.current == null
      || pointerStartYRef.current == null
      || activePointerIdRef.current !== event.pointerId
      || isAnimating
    ) {
      return;
    }

    const deltaX = event.clientX - pointerStartXRef.current;
    const deltaY = event.clientY - pointerStartYRef.current;

    if (!pointerIsHorizontalSwipeRef.current) {
      const hasEnoughMovement = Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6;
      if (!hasEnoughMovement) {
        return;
      }

      pointerIsHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      if (!pointerIsHorizontalSwipeRef.current) {
        return;
      }

      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();

    const stackWidth = stackRef.current?.clientWidth || 260;
    const softLimit = Math.max(120, stackWidth * 0.55);
    const absDelta = Math.abs(deltaX);
    const direction = deltaX < 0 ? -1 : 1;
    const dragValue = absDelta <= softLimit
      ? deltaX
      : direction * (softLimit + (absDelta - softLimit) * 0.18);

    applyDragOffset(dragValue);
  };

  const finishPointerDrag = (event) => {
    if (pointerStartXRef.current == null || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (!pointerIsHorizontalSwipeRef.current) {
      pointerStartXRef.current = null;
      pointerStartYRef.current = null;
      pointerIsHorizontalSwipeRef.current = false;
      activePointerIdRef.current = null;
      setIsDragging(false);
      resetDragOffset();

      if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const stackWidth = stackRef.current?.clientWidth || 260;
    const swipeThreshold = Math.max(30, stackWidth * 0.14);
    const deltaX = event.clientX - pointerStartXRef.current;
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    } else {
      setIsDragging(false);
      resetDragOffset();
    }

    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    pointerIsHorizontalSwipeRef.current = false;
    activePointerIdRef.current = null;

    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = (event) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    pointerIsHorizontalSwipeRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
    resetDragOffset();

    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleStackTransitionEnd = (event) => {
    if (!stackSwapAwaitingSettleRef.current) return;
    if (!event.target.classList.contains('blood-markers-page__stack-card--front')) return;
    if (event.propertyName !== 'left') return;

    stackSwapAwaitingSettleRef.current = false;

    const collapsingCardId = swappingExpandedCardIdRef.current;

    flushSync(() => {
      if (collapsingCardId) {
        setExpandedLowCardIds((prev) => {
          if (!prev[collapsingCardId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[collapsingCardId];
          return next;
        });
        setIsSwappingFromExpanded(false);
        swappingExpandedCardIdRef.current = null;
      }
      setIsResetting(true);
      setActiveIndex((prev) => (prev + 1) % cardCount);
      setIsAnimating(false);
    });
    resetDragOffset();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsResetting(false);
      });
    });
  };

  const organIcon = getOrganIcon(section.organ);

  useEffect(() => {
    setActiveIndex(0);
    setIsAnimating(false);
    setIsDragging(false);
    setIsResetting(false);
    setIsSwappingFromExpanded(false);
    setIsViewAllOpen(false);
    swappingExpandedCardIdRef.current = null;
    stackSwapAwaitingSettleRef.current = false;
    resetDragOffset();
  }, [cards.length, section.id, resetDragOffset]);

  const activeFrontCard = cards[activeIndex];
  const isAggregateFrontExpanded = Boolean(
    activeFrontCard?.cardRole === 'optimal-aggregate' && expandedLowCardIds[activeFrontCard?.id],
  );

  useLayoutEffect(() => {
    const stack = stackRef.current;
    const card = frontStackCardRef.current;
    if (!stack) {
      return undefined;
    }

    const BASE_CARD_PX = 156;

    const syncStackHeight = () => {
      if (isSwappingFromExpanded || !isAggregateFrontExpanded || !card) {
        stack.style.removeProperty('--blood-markers-stack-front-height');
        return;
      }
      const measured = Math.ceil(card.getBoundingClientRect().height);
      const h = Math.max(measured, BASE_CARD_PX);
      stack.style.setProperty('--blood-markers-stack-front-height', `${h}px`);
    };

    syncStackHeight();
    const rafId = requestAnimationFrame(() => syncStackHeight());

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && card) {
      ro = new ResizeObserver(() => syncStackHeight());
      ro.observe(card);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) {
        ro.disconnect();
      }
    };
  }, [isAggregateFrontExpanded, isSwappingFromExpanded, activeIndex, cardCount, section.id]);

  return (
    <section className="blood-markers-page__section">
      <div className="blood-markers-page__organ-header">
        <div className={`blood-markers-page__organ-icon-box blood-markers-page__organ-icon-box--${section.theme}`}>
          <img
            src={organIcon}
            alt=""
            aria-hidden="true"
            className={`blood-markers-page__organ-icon blood-markers-page__organ-icon--${getDisplayRiskType(section.theme)}`}
          />
        </div>
        <div className="blood-markers-page__organ-copy">
          <div className="blood-markers-page__organ-title-row">
            <h2 className="blood-markers-page__organ-title">{section.organ}</h2>
            {showViewAllToggle ? (
              <button
                type="button"
                className="blood-markers-page__view-all-btn"
                onClick={() => setIsViewAllOpen(true)}
                aria-expanded={isViewAllOpen}
              >
                View All
              </button>
            ) : null}
          </div>
          <p className="blood-markers-page__organ-subtitle">{section.parameters}</p>
        </div>
      </div>

      <div
        ref={stackRef}
        className={`blood-markers-page__stack${isSingleCardStack ? ' blood-markers-page__stack--single' : ''}${isAnimating ? ` blood-markers-page__stack--moving-${swipeDirection}` : ''}`}
        style={cardCount === 2 ? {
          '--blood-markers-back-two-left': 'var(--blood-markers-back-one-left)',
          '--blood-markers-back-two-top': 'var(--blood-markers-back-one-top)',
          '--blood-markers-back-two-fade': 'var(--blood-markers-back-one-fade)',
        } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onTransitionEnd={handleStackTransitionEnd}
        data-dragging={isDragging ? 'true' : 'false'}
        data-resetting={isResetting ? 'true' : 'false'}
        data-card-count={cardCount}
        data-front-optimal-expanded={isAggregateFrontExpanded ? 'true' : 'false'}
        data-swapping-from-expanded={isSwappingFromExpanded ? 'true' : 'false'}
      >
        {cards.map((card, index) => {
          const distance = (index - activeIndex + cards.length) % cards.length;
          const role = distance === 0
            ? 'front'
            : distance === 1
              ? 'back-one'
              : distance === 2
                ? 'back-two'
                : 'hidden';

          const riskMeta = RISK_META[getDisplayRiskType(card.riskType)] || RISK_META.low;
          const segments = METER_SEGMENTS[card.riskType] || METER_SEGMENTS.pending;
          const isAggregateOptimalCard = card.cardRole === 'optimal-aggregate';
          const isSingleOptimalPeerCard = card.riskType === 'low' && !isAggregateOptimalCard;
          const isOptimalPeerCard = isSingleOptimalPeerCard || isAggregateOptimalCard;
          const isLowCardExpanded = Boolean(expandedLowCardIds[card.id]);
          const aggregateDetailRows = isAggregateOptimalCard
            ? buildAggregateOptimalRows(card.aggregateTests)
            : [];
          const historyPoints = BLOOD_MARKER_CARD_HISTORY_ENABLED
            ? resolveCardHistoryPoints(card, trendsByParameterKey)
            : [];
          const showHistoryTimeline = BLOOD_MARKER_CARD_HISTORY_ENABLED
            && historyPoints.length >= 1
            && !isAggregateOptimalCard;
          const unitLabel = String(card.unit || '').trim();
          const unitDisplay = unitLabel
            ? (unitLabel.startsWith('(') ? unitLabel : `(${unitLabel})`)
            : '';

          return (
            <article
              key={card.id}
              ref={(node) => {
                if (role === 'front') {
                  frontStackCardRef.current = node;
                }
              }}
              className={`blood-markers-page__stack-card blood-markers-page__stack-card--${role} blood-markers-page__stack-card--theme-${card.riskType}${isOptimalPeerCard ? ' blood-markers-page__stack-card--optimal-peer' : ''}${isAggregateOptimalCard ? ' blood-markers-page__stack-card--optimal-aggregate' : ''}${isAggregateOptimalCard && isLowCardExpanded && role === 'front' ? ' blood-markers-page__stack-card--optimal-expanded' : ''}${showHistoryTimeline ? ' blood-markers-page__stack-card--history' : ''}${card.allergy ? ' blood-markers-page__stack-card--allergy' : ''}`}
              onClick={() => {
                if (isAggregateOptimalCard) {
                  setExpandedLowCardIds((prev) => ({ ...prev, [card.id]: !prev[card.id] }));
                  return;
                }
                onOpenDetail({ ...card, organ: section.organ, parameters: section.parameters });
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isAggregateOptimalCard ? isLowCardExpanded : undefined}
              aria-label={
                isAggregateOptimalCard
                  ? (
                    isLowCardExpanded
                      ? `Hide ${formatOptimalAggregatePrefix(getOptimalAggregateParameterCount(card))} ${OPTIMAL_AGGREGATE_RANGE_TITLE}`
                      : `Show ${formatOptimalAggregatePrefix(getOptimalAggregateParameterCount(card))} ${OPTIMAL_AGGREGATE_RANGE_TITLE}`
                  )
                  : undefined
              }
              onKeyDown={(event) => {
                if (isAggregateOptimalCard) {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setExpandedLowCardIds((prev) => ({ ...prev, [card.id]: !prev[card.id] }));
                  }
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenDetail({ ...card, organ: section.organ, parameters: section.parameters });
                }
              }}
            >
              <div className="blood-markers-page__card-top-row">
                <div className="blood-markers-page__marker-block">
                  <span className={`blood-markers-page__marker-line blood-markers-page__marker-line--${card.riskType === 'low' ? 'low' : card.riskType}`} />
                  <div className="blood-markers-page__marker-copy">
                    {isAggregateOptimalCard ? (
                      <>
                        <span className="blood-markers-page__optimal-prefix">
                          {formatOptimalAggregatePrefix(getOptimalAggregateParameterCount(card))}
                        </span>
                        <span className="blood-markers-page__optimal-title">{OPTIMAL_AGGREGATE_RANGE_TITLE}</span>
                      </>
                    ) : showHistoryTimeline ? (
                      <>
                        <span
                          className="blood-markers-page__marker-label"
                          title={
                            String(card.marker ?? '').length > BLOOD_MARKERS_STACK_CARD_NAME_MAX
                              ? String(card.marker)
                              : undefined
                          }
                        >
                          {truncateBloodMarkersStackCardName(card.marker)}
                        </span>
                        {unitDisplay ? (
                          <span className="blood-markers-page__marker-unit blood-markers-page__marker-unit--history">
                            {unitDisplay}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span
                          className="blood-markers-page__marker-label"
                          title={
                            String(card.marker ?? '').length > BLOOD_MARKERS_STACK_CARD_NAME_MAX
                              ? String(card.marker)
                              : undefined
                          }
                        >
                          {truncateBloodMarkersStackCardName(card.marker)}
                        </span>
                        {card.value || card.unit ? (
                          <div className="blood-markers-page__marker-value-row">
                            <span className="blood-markers-page__marker-value">{card.value}</span>
                            <span className="blood-markers-page__marker-unit">{card.unit}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                {!isOptimalPeerCard || showHistoryTimeline || card.allergy ? (
                  <span className="blood-markers-page__risk-chip">
                    <span className="blood-markers-page__risk-chip-text" style={{ color: riskMeta.color }}>{riskMeta.label}</span>
                    <RiskTrendIcon type={card.riskType} />
                  </span>
                ) : null}
              </div>

              {showHistoryTimeline ? (
                <div className="blood-markers-page__card-bottom-row blood-markers-page__card-bottom-row--history">
                  <BloodMarkerHistoryTimeline
                    points={historyPoints}
                    normalMin={card.normalMin}
                    normalMax={card.normalMax}
                    currentRiskType={card.riskType}
                  />
                </div>
              ) : (
                <div className="blood-markers-page__card-bottom-row">
                  <div className="blood-markers-page__meter" aria-hidden="true">
                    {segments.map((segment, segmentIndex) => (
                      <span
                        key={`${card.id}-seg-${segmentIndex}`}
                        className="blood-markers-page__meter-pill"
                        style={{ background: segment.background, boxShadow: segment.boxShadow || 'none' }}
                      />
                    ))}
                  </div>
                  {isAggregateOptimalCard ? (
                    <span
                      className={`blood-markers-page__optimal-chevron ${isLowCardExpanded ? 'blood-markers-page__optimal-chevron--expanded' : ''}`}
                      aria-hidden="true"
                    >
                      <DownChevron />
                    </span>
                  ) : card.allergy ? null : (
                    <span className="blood-markers-page__card-chevron" aria-hidden="true">
                      <CardChevron />
                    </span>
                  )}
                </div>
              )}

              {isAggregateOptimalCard ? (
                <div
                  className={`blood-markers-page__optimal-params ${isLowCardExpanded ? 'blood-markers-page__optimal-params--expanded' : 'blood-markers-page__optimal-params--collapsed'}`}
                  aria-label="Additional optimal parameters"
                  aria-hidden={!isLowCardExpanded}
                >
                  <BloodMarkersParameterRows rows={aggregateDetailRows} keyPrefix={`${card.id}-agg-`} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!isSingleCardStack ? (
        <div className="blood-markers-page__swipe-hint" aria-hidden="true">
          <span className="blood-markers-page__swipe-arrow blood-markers-page__swipe-arrow--left"><SwipeArrow /></span>
          <span className="blood-markers-page__swipe-text">Swipe to explore</span>
          <span className="blood-markers-page__swipe-arrow"><SwipeArrow /></span>
        </div>
      ) : null}

      {isViewAllOpen && showViewAllToggle ? (
        <BloodMarkersViewAllPopup
          rows={listRows}
          section={section}
          organIcon={organIcon}
          trendsByParameterKey={trendsByParameterKey}
          onClose={() => setIsViewAllOpen(false)}
          onOpenDetail={onOpenDetail}
        />
      ) : null}
    </section>
  );
};

const BloodMarkersPage = ({
  onBack,
  initialDetailMarker = null,
  onInitialDetailConsumed,
  initialFilter = null,
}) => {
  const [activeFilter, setActiveFilter] = useState(
    initialFilter === 'Cancer' || initialFilter === 'Allergies' ? initialFilter : 'Optimal',
  );
  const accentFilterRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [apiSections, setApiSections] = useState([]);
  const [reportCancerGroups, setReportCancerGroups] = useState(null);
  const [reportAllergySections, setReportAllergySections] = useState(null);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const [trendsByParameterKey, setTrendsByParameterKey] = useState({});

  useLayoutEffect(() => {
    if (activeFilter !== 'Cancer' && activeFilter !== 'Allergies') {
      return;
    }
    accentFilterRef.current?.scrollIntoView({ inline: 'end', block: 'nearest' });
  }, [activeFilter]);

  useEffect(() => {
    if (!initialDetailMarker) {
      return;
    }
    const mapped = mapHomeBloodMarkerRowToDetailMarker(initialDetailMarker);
    if (mapped) {
      const rk = initialDetailMarker.riskKey;
      if (rk === 'high') {
        setActiveFilter('Critical');
      } else if (rk === 'low') {
        setActiveFilter('Marginal');
      } else {
        setActiveFilter('Optimal');
      }
      setSelectedMarker(mapped);
    }
    if (typeof onInitialDetailConsumed === 'function') {
      onInitialDetailConsumed();
    }
  }, [initialDetailMarker, onInitialDetailConsumed]);

  useEffect(() => {
    let isActive = true;

    const loadBloodMarkers = async () => {
      try {
        const { assessmentId, response } = await fetchLatestAssessmentReport(
          (assessmentId) => `/reports/${assessmentId}/blood-parameters`
        );
        if (isActive) {
          const groups = Number(assessmentId) > 0
            ? buildBloodParametersGroupsForAssessment(assessmentId, response)
            : normalizeBloodParametersReportPayload(response);
          setApiSections(buildSectionsFromApi(groups));
          const reportMarkers = buildReportScreenMarkers(response, assessmentId);
          setReportCancerGroups(reportMarkers.cancerCards);
          setReportAllergySections(reportMarkers.hasAllergy ? reportMarkers.allergySections : null);
          setHasLoadedReport(true);
        }
      } catch (error) {
        console.error('Failed to load blood marker report:', error);
        if (isActive) {
          setApiSections([]);
          setReportCancerGroups([]);
          setHasLoadedReport(true);
        }
      }
    };

    loadBloodMarkers();

    return () => {
      isActive = false;
    };
  }, []);

  // When list payload has no embedded history, load GET /reports/trends per parameter.
  useEffect(() => {
    if (!hasLoadedReport || apiSections.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const keysNeedingTrends = [];
    const seen = new Set();

    apiSections.forEach((section) => {
      (section.tests || []).forEach((test) => {
        const key = toBloodParameterKey(test);
        if (!key || seen.has(key)) {
          return;
        }
        const embeddedCount = Array.isArray(test.historyPoints) ? test.historyPoints.length : 0;
        // Still fetch trends when the card only has a single reading so prior
        // values can fill in the multi-capsule timeline.
        if (embeddedCount >= 2) {
          return;
        }
        seen.add(key);
        keysNeedingTrends.push(key);
      });
    });

    if (keysNeedingTrends.length === 0) {
      return undefined;
    }

    const loadTrends = async () => {
      const next = {};
      const batchSize = 4;

      for (let i = 0; i < keysNeedingTrends.length; i += batchSize) {
        if (cancelled) {
          return;
        }
        const batch = keysNeedingTrends.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((bloodParameter) => fetchReportTrends({ bloodParameter, ttlMs: 60000 })),
        );

        results.forEach((result, index) => {
          const key = batch[index];
          if (result.status !== 'fulfilled') {
            return;
          }
          const normalized = normalizeTrendsPayload(result.value, 'blood');
          if (normalized.points.length >= 1) {
            next[key] = normalized.points;
          }
        });

        if (!cancelled && Object.keys(next).length > 0) {
          setTrendsByParameterKey((prev) => ({ ...prev, ...next }));
        }
      }
    };

    loadTrends().catch((error) => {
      console.warn('Failed to load blood marker history trends:', error?.message || error);
    });

    return () => {
      cancelled = true;
    };
  }, [apiSections, hasLoadedReport]);

  const sections = useMemo(() => {
    if (activeFilter === 'Allergies') {
      return reportAllergySections || [];
    }
    return apiSections.filter((section) => section.category === activeFilter);
  }, [activeFilter, apiSections, reportAllergySections]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSections = normalizedQuery
    ? sections.filter((section) => {
        const markerText = section.tests.map((test) => test.marker.toLowerCase()).join(' ');
        return section.organ.toLowerCase().includes(normalizedQuery)
          || section.parameters.toLowerCase().includes(normalizedQuery)
          || markerText.includes(normalizedQuery);
      })
    : sections;
  const showFilterEmptyState = hasLoadedReport && sections.length === 0;

  if (selectedMarker) {
    return (
      <div className="blood-markers-page">
        <BloodMarkerDetailView marker={selectedMarker} onBack={() => setSelectedMarker(null)} />
      </div>
    );
  }

  return (
    <div className="blood-markers-page">
      <header className="blood-markers-page__header">
        <button
          type="button"
          className="blood-markers-page__back-btn"
          onClick={onBack}
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="blood-markers-page__title">Blood Markers</h1>

        <button
          type="button"
          className="blood-markers-page__search-btn"
          onClick={() => setIsSearchOpen((prev) => !prev)}
          aria-label="Search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 21L16.65 16.65" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      {isSearchOpen ? (
        <div className="blood-markers-page__search-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="rgba(255, 255, 255, 0.72)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 21L16.65 16.65" stroke="rgba(255, 255, 255, 0.72)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="blood-markers-page__search-input"
            placeholder="Search blood markers"
            aria-label="Search blood markers"
          />
        </div>
      ) : null}

      <div className="blood-markers-page__filters" role="tablist" aria-label="Risk filters">
        {FILTERS.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              ref={isActive && (filter === 'Cancer' || filter === 'Allergies') ? accentFilterRef : undefined}
              className={`blood-markers-page__filter-pill${filter === 'Cancer' || filter === 'Allergies' ? ' blood-markers-page__filter-pill--cancer' : ''}${isActive ? ' blood-markers-page__filter-pill--active' : ''}`}
              onClick={() => setActiveFilter(filter)}
              role="tab"
              aria-selected={isActive}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div
        className={`blood-markers-page__sections${showFilterEmptyState ? ' blood-markers-page__sections--empty' : ''}`}
      >
        {activeFilter === 'Cancer' ? (
          <CancerMarkersView query={searchQuery} groups={reportCancerGroups} />
        ) : showFilterEmptyState ? (
          <p className="blood-markers-page__empty" role="status">
            {EMPTY_FILTER_MESSAGE[activeFilter]}
          </p>
        ) : (
          filteredSections.map((section) => (
            <BloodMarkerStackSection
              key={section.id}
              section={section}
              onOpenDetail={section.category === 'Allergies' ? () => {} : setSelectedMarker}
              trendsByParameterKey={trendsByParameterKey}
            />
          ))
        )}
      </div>

    </div>
  );
};

export default BloodMarkersPage;
