import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './RiskAnalysisSection.css';
import { fetchLatestAssessmentReport } from '../../../services/reportService';
import { buildBloodParametersGroupsForAssessment } from '../../../utils/assessmentBloodMarkerSupplements';
import {
  normalizeBloodParametersReportPayload,
  pickBloodParameterGroupName,
  resolveBloodParameterNumericValue,
} from '../../../utils/bloodParametersReportNormalize';
import ObesityIcon from '../../../images/Obesity-RA.svg';
import { formatOrdinal } from '../../../utils/formatOrdinal';
import { orderHomeBloodMarkersByHierarchy } from '../../../utils/homeBloodMarkerOrder';
import { classifyReportGroupName, isCancerMarkerTest } from '../../../utils/reportScreenMarkers';
import ThyroidHealthIcon from '../../../images/Thyroid-RA.svg';
import NAFLDIcon from '../../../images/NAFLD-RA.svg';
import Type2Icon from '../../../images/Type2-RA.svg';
import PCOSIcon from '../../../images/PCOS-RA.svg';
import HyperTensionIcon from '../../../images/Hypertension-RA.svg';
import MetabolicIcon from '../../../images/Metabolic-RA.svg';
import CardiacHealthIcon from '../../../images/Cardiac-RA.svg';
import DyslipidemiaIcon from '../../../images/Dyslipidemia-RA.svg';
import OxidativeIcon from '../../../images/Oxidative-RA.svg';
import HealthRankSpark from '../../../images/HealthRankSpark.svg';
import BloodDropHighIcon from '../../../images/blood-drop-high.svg';
import BloodDropLowIcon from '../../../images/blood-drop-low.svg';
import BloodDropOptimalIcon from '../../../images/blood-drop-optimal.svg';
import BloodMarkerGlowHigh from '../../../images/blood-marker-glow-high.svg';
import BloodMarkerGlowLow from '../../../images/blood-marker-glow-low.svg';
import BloodMarkerGlowOptimal from '../../../images/blood-marker-glow-optimal.svg';

const PositiveWinsHeaderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true">
    <path d="M4.5 3.5V14.5C4.5 15.0304 4.71071 15.5391 5.08579 15.9142C5.46086 16.2893 5.96957 16.5 6.5 16.5H17.5" stroke="#E95D5C" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.5 12.5L9.5 9.5L11.5 11.5L16.5 6.5" stroke="#E95D5C" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 9.5V6.5H13.5" stroke="#E95D5C" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SwipeArrow = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 11.3334L7.33333 8.00008L4 4.66675M8.66667 11.3334L12 8.00008L8.66667 4.66675" stroke="#9A9A9A" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DISEASES_DATA = [
  { id: 1, name: 'Obesity', icon: ObesityIcon, score: 55 },
  { id: 2, name: 'Oxidative Stress', icon: OxidativeIcon, score: 85 },
  { id: 3, name: 'Metabolic Syndrome', icon: MetabolicIcon, score: 78 },
  { id: 4, name: 'Hypertension', icon: HyperTensionIcon, score: 45 },
  { id: 5, name: 'PCOS/PCOD', icon: PCOSIcon, score: 30 },
  { id: 6, name: 'Type 2 Diabetes', icon: Type2Icon, score: 24 },
  { id: 7, name: 'Dyslipidemia', icon: DyslipidemiaIcon, score: 55 },
  { id: 8, name: 'Cardiac Health', icon: CardiacHealthIcon, score: 65 },
  { id: 9, name: 'NAFLD', icon: NAFLDIcon, score: 38 },
  { id: 10, name: 'Thyroid Health', icon: ThyroidHealthIcon, score: 20 },
];

/** Single action line per disease (home Risk Analysis cards); not varied by risk band. */
const ACTION_COPY_BY_DISEASE = {
  metabolic:
    'Cut refined carbs and processed foods, exercise regularly, manage weight, improve sleep quality, and reduce stress consistently; noticeable improvements can be seen within 8 - 12 weeks.',
  'metabolic syndrome':
    'Cut refined carbs and processed foods, exercise regularly, manage weight, improve sleep quality, and reduce stress consistently; noticeable improvements can be seen within 8 - 12 weeks.',
  'type 2 diabetes':
    'Reduce refined carbs and sugars, stay physically active daily, maintain a healthy weight, improve sleep quality, manage stress, and consult a doctor for a comprehensive diabetes prevention plan.',
  hypertension:
    'Reduce salt and processed food intake, prioritize aerobic exercise, manage body weight, limit alcohol, quit smoking, improve sleep quality, and consult a doctor for blood pressure management.',
  obesity:
    'Create a sustainable calorie deficit using whole foods and regular exercise, improve sleep, manage stress effectively, and consult a doctor or nutritionist for structured weight management support.',
  'pcos/pcod':
    'Reduce refined carbs and sugars, exercise consistently, manage weight and stress levels, and consult a doctor for hormonal evaluation and personalized treatment guidance.',
  pcos:
    'Reduce refined carbs and sugars, exercise consistently, manage weight and stress levels, and consult a doctor for hormonal evaluation and personalized treatment guidance.',
  pcod:
    'Reduce refined carbs and sugars, exercise consistently, manage weight and stress levels, and consult a doctor for hormonal evaluation and personalized treatment guidance.',
  nafld:
    'Reduce refined carbs, sugars, fructose, and processed foods, stay physically active, focus on healthy weight management, and consult a doctor for liver health evaluation and guidance.',
  'cardiac health':
    'Reduce saturated fats, sodium, and refined carbs, perform regular aerobic exercise, quit smoking, limit alcohol intake, manage stress, and consult a doctor for cardiovascular risk assessment.',
  'thyroid health':
    'Consult a doctor for a comprehensive thyroid evaluation while improving sleep quality, reducing stress, and addressing potential nutritional deficiencies alongside prescribed treatment if needed.',
  dyslipidemia:
    'Reduce saturated fats, refined carbs, sugars, and processed foods, exercise regularly, quit smoking, and consult a doctor for a detailed lipid profile evaluation and management plan.',
  'oxidative stress':
    'Increase intake of antioxidant-rich whole foods, reduce processed foods and sugar, quit smoking, limit alcohol intake, engage in moderate exercise, and prioritize restorative sleep.',
};

const DISEASE_ACTION_ALIASES = {
  'pcos / pcod': 'pcos/pcod',
  'pcos-pcod': 'pcos/pcod',
  'type ii diabetes': 'type 2 diabetes',
  diabetes: 'type 2 diabetes',
};

const normalizeDiseaseKey = (name = '') => name.replace(/\s+/g, ' ').trim().toLowerCase();

const toActionCopy = (diseaseName) => {
  const diseaseKey = normalizeDiseaseKey(diseaseName);
  const canonicalDiseaseKey = DISEASE_ACTION_ALIASES[diseaseKey] || diseaseKey;
  return ACTION_COPY_BY_DISEASE[canonicalDiseaseKey] || '-';
};

const toClampedPercentile = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const defaultCards = DISEASES_DATA
  .slice()
  .sort((a, b) => b.score - a.score)
  .slice(0, 3)
  .map((disease) => ({
    ...disease,
    code: normalizeDiseaseKey(disease.name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    action: toActionCopy(disease.name),
    healthRankLabel: '-',
  }));

const DISEASE_ICON_BY_CODE = {
  obesity: ObesityIcon,
  oxidative_stress: OxidativeIcon,
  metabolic_syndrome: MetabolicIcon,
  hypertension: HyperTensionIcon,
  pcos_pcod: PCOSIcon,
  diabetes: Type2Icon,
  type_2_diabetes: Type2Icon,
  dyslipidemia: DyslipidemiaIcon,
  cardiac_health: CardiacHealthIcon,
  nafld: NAFLDIcon,
  thyroid_health: ThyroidHealthIcon,
};

const normalizeCodeFromName = (name = '') => normalizeDiseaseKey(name)
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const toRiskAnalysisCardsFromApi = (riskAnalysis) => {
  const rows = Array.isArray(riskAnalysis) ? riskAnalysis : [];

  const mapped = rows.map((item, index) => {
    const code = String(item?.code || '').trim().toLowerCase() || normalizeCodeFromName(item?.name);
    const name = String(item?.name || '').trim() || '-';
    const scoreNumeric = Number(item?.risk_score_scaled);
    const hasScore = Number.isFinite(scoreNumeric);
    const score = hasScore ? Math.max(0, Math.min(100, Math.round(scoreNumeric))) : 0;
    // Disease detail screen computes health rank from disease_percentile.
    const percentile = toClampedPercentile(item?.disease_percentile ?? item?.healthy_percentile);
    const hasHealthRank = percentile !== null;
    return {
      id: `api-risk-${index}-${code || 'row'}`,
      code,
      name,
      icon: DISEASE_ICON_BY_CODE[code] || MetabolicIcon,
      score,
      scoreDisplay: hasScore ? String(score) : '-',
      action: toActionCopy(name),
      healthRankLabel: hasHealthRank ? formatOrdinal(percentile) : '-',
      isPlaceholder: false,
    };
  });

  if (mapped.length > 0) {
    return mapped.slice(0, 3);
  }

  return [
    {
      id: 'api-risk-placeholder',
      code: '',
      name: '-',
      icon: MetabolicIcon,
      score: 0,
      scoreDisplay: '-',
      action: '-',
      healthRankLabel: '-',
      isPlaceholder: true,
    },
  ];
};

const BLOOD_MARKER_RISK_PRIORITY = {
  'high risk': 0,
  'critical': 0,
  high: 0,
  'low risk': 1,
  'marginal': 1,
  low: 1,
  optimal: 2,
};

const getBloodMarkerRiskPriority = (risk = '') => {
  const key = String(risk).trim().toLowerCase();
  return BLOOD_MARKER_RISK_PRIORITY[key] ?? Number.MAX_SAFE_INTEGER;
};

const BLOOD_MARKER_DROP_BY_RISK = {
  high: BloodDropHighIcon,
  low: BloodDropLowIcon,
  optimal: BloodDropOptimalIcon,
};

const BLOOD_MARKER_GLOW_BY_RISK = {
  high: BloodMarkerGlowHigh,
  low: BloodMarkerGlowLow,
  optimal: BloodMarkerGlowOptimal,
};

const getRiskTypeFromBounds = (value, lowerRange, upperRange) => {
  const numericValue = Number(value);
  const lower = Number(lowerRange);
  const upper = Number(upperRange);

  if (!Number.isFinite(numericValue) || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return 'optimal';
  }

  if (numericValue >= lower && numericValue <= upper) {
    return 'optimal';
  }

  const isBelowRange = numericValue < lower;
  const boundary = isBelowRange ? lower : upper;
  const deviation = isBelowRange ? (lower - numericValue) : (numericValue - upper);
  const deviationPercent = (deviation / Math.max(Math.abs(boundary), 1e-6)) * 100;

  if (deviationPercent <= 15) {
    return 'low';
  }

  return 'high';
};

const formatValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '--');
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.00$/, '');
};

const toDiseaseName = (groupName = '') => {
  const raw = String(groupName).trim();
  return raw.replace(/\s*profile\s*$/i, '').trim() || 'General';
};

const toRiskLabel = (riskKey) => {
  if (riskKey === 'high') return 'High Risk';
  if (riskKey === 'low') return 'Low Risk';
  return 'Optimal';
};

const buildBloodMarkersFromGroups = (groups) => {
  const rows = [];

  (Array.isArray(groups) ? groups : []).forEach((group, groupIndex) => {
    if (classifyReportGroupName(pickBloodParameterGroupName(group) || group?.group_name)) {
      return;
    }
    const disease = toDiseaseName(group?.group_name);
    const tests = Array.isArray(group?.tests) ? group.tests : [];

    tests.forEach((test, testIndex) => {
      if (isCancerMarkerTest(test)) {
        return;
      }
      const n = test && typeof test === 'object' ? test : {};
      const resolvedNumeric = resolveBloodParameterNumericValue(n, test);
      if (resolvedNumeric === undefined || resolvedNumeric === null) {
        return;
      }

      const value = Number(resolvedNumeric);
      const lower = Number(n.lower_range);
      const upper = Number(n.higher_range);
      const hasClassifiableData = Number.isFinite(value) && Number.isFinite(lower) && Number.isFinite(upper);

      // Homepage list should only show actual report parameters with usable ranges.
      if (!hasClassifiableData) {
        return;
      }

      const unit = String(n.unit || '').trim();
      const riskKey = getRiskTypeFromBounds(value, lower, upper);
      const displayName = String(n.test_name || 'Test');

      rows.push({
        id: `api-bm-${groupIndex}-${testIndex}`,
        displayName,
        name: displayName,
        value: `${formatValue(value)}${unit ? ` ${unit}` : ''}`,
        numericValue: value,
        unit,
        normalMin: n.lower_range,
        normalMax: n.higher_range,
        diagnosticTestId: n.diagnostic_test_id ?? null,
        profile: String(group?.group_name || 'Blood Marker'),
        disease,
        risk: toRiskLabel(riskKey),
        riskKey,
      });
    });
  });

  return rows;
};

export const buildHomeBloodMarkersFromBloodParametersResponse = (response, assessmentId = null) => {
  const id = Number(assessmentId);
  const groups = Number.isFinite(id) && id > 0
    ? buildBloodParametersGroupsForAssessment(id, response)
    : normalizeBloodParametersReportPayload(response);
  return buildBloodMarkersFromGroups(groups);
};

const STACK_FRONT_X_PX = -14;
const STACK_FRONT_Y_PX = 0;

/** Same bands as Disease Detail / Disease Risk Analysis (0–25 / 26–50 / 51–75 / 76–100). */
const getRiskScoreDialColor = (score) => {
  if (score <= 25) return '#90DF9E';
  if (score <= 50) return '#DAC15A';
  if (score <= 75) return '#EE8B48';
  return '#E95D5C';
};

const GaugeDial = React.memo(function GaugeDial({ score, scoreDisplay }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const dialColor = getRiskScoreDialColor(safeScore);
  const pathD = 'M4 40 A36 36 0 0 1 76 40';
  const approxLength = 113.1;
  const dashOffset = approxLength * (1 - safeScore / 100);

  return (
    <div className="risk-analysis-wins__dial-wrap" aria-label={`Risk score ${safeScore} out of 100`}>
      <svg className="risk-analysis-wins__dial-dots" xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <path d="M0.707031 35.7063C0.707031 55.0233 16.39 70.7063 35.707 70.7063C55.0241 70.7063 70.707 55.0233 70.707 35.7063C70.707 16.3893 55.0241 0.706299 35.707 0.706299C16.39 0.706299 0.707031 16.3893 0.707031 35.7063Z" stroke="url(#paint0_linear_1860_15381)" strokeOpacity="0.2" strokeWidth="1.4125" strokeDasharray="1.88 3.77"/>
        <defs>
          <linearGradient id="paint0_linear_1860_15381" x1="35.707" y1="0.706299" x2="35.707" y2="70.7063" gradientUnits="userSpaceOnUse">
            <stop stopColor="white"/>
            <stop offset="0.554351" stopColor="white" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
      <svg className="risk-analysis-wins__dial" width="80" height="44" viewBox="0 0 80 44" fill="none" aria-hidden="true">
        <path d={pathD} className="risk-analysis-wins__dial-track" style={{ stroke: dialColor, strokeOpacity: 0.2 }} />
        <path
          d={pathD}
          className="risk-analysis-wins__dial-progress"
          style={{ stroke: dialColor, strokeDasharray: approxLength, strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="risk-analysis-wins__dial-score">
        <span className="risk-analysis-wins__dial-score-value">{scoreDisplay ?? safeScore}</span>
        <span className="risk-analysis-wins__dial-score-max">/100</span>
      </div>
    </div>
  );
});

const RiskAnalysisSection = ({
  cards = defaultCards,
  apiRiskAnalysis,
  onDiseaseSelect,
  onSeeMore,
  onBloodMarkersSeeMore,
  onHomeBloodMarkerSelect,
  prefetchedHomeBloodMarkers,
}) => {
  const stackCards = useMemo(() => {
    const raw = apiRiskAnalysis !== undefined
      ? toRiskAnalysisCardsFromApi(apiRiskAnalysis)
      : (Array.isArray(cards) ? cards : defaultCards).slice(0, 3);

    return raw.map((card, index) => ({
      ...card,
      id: card.id != null ? String(card.id) : `risk-slot-${index}`,
    }));
  }, [apiRiskAnalysis, cards]);
  const [apiBloodMarkers, setApiBloodMarkers] = useState([]);
  const bloodMarkers = useMemo(() => {
    const normalized = apiBloodMarkers.map((item) => {
      const normalizedRiskKey = item.riskKey
        || (getBloodMarkerRiskPriority(item.risk) === 0 ? 'high' : getBloodMarkerRiskPriority(item.risk) === 1 ? 'low' : 'optimal');

      return {
        ...item,
        riskKey: normalizedRiskKey,
      };
    });

    return orderHomeBloodMarkersByHierarchy(normalized, 3);
  }, [apiBloodMarkers]);
  const cardCount = stackCards.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 481px)').matches : false
  ));
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
  const didMoveRef = useRef(false);
  /** True after startAnimation until we settle once (transform fires on the front card). */
  const stackSwapAwaitingSettleRef = useRef(false);

  const setStackDragging = (dragging) => {
    if (stackRef.current) {
      stackRef.current.dataset.dragging = dragging ? 'true' : 'false';
    }
  };

  const setStackResetting = (resetting) => {
    if (stackRef.current) {
      stackRef.current.dataset.resetting = resetting ? 'true' : 'false';
    }
  };

  const getFrontStackCard = () => (
    stackRef.current?.querySelector('.risk-analysis-wins__stack-card--front') ?? null
  );

  const isStackMotionLocked = () => {
    const stack = stackRef.current;
    if (!stack) return false;
    return stack.classList.contains('risk-analysis-wins__stack--moving-next')
      || stack.classList.contains('risk-analysis-wins__stack--moving-prev');
  };

  const clearStackMotionClasses = () => {
    stackRef.current?.classList.remove('risk-analysis-wins__stack--moving-next', 'risk-analysis-wins__stack--moving-prev');
  };

  const commitDragOffset = (value) => {
    latestDragXRef.current = value;
    const frontCard = getFrontStackCard();
    if (!frontCard) return;
    const x = STACK_FRONT_X_PX + value;
    frontCard.style.transform = `translate3d(${x.toFixed(2)}px, ${STACK_FRONT_Y_PX}px, 0)`;
  };

  const resetDragOffset = () => {
    pendingDragXRef.current = 0;
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    latestDragXRef.current = 0;
    getFrontStackCard()?.style.removeProperty('transform');
  };

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
      stackSwapAwaitingSettleRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const media = window.matchMedia('(min-width: 481px)');
    const handleChange = (event) => setIsDesktop(event.matches);
    setIsDesktop(media.matches);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [cardCount]);

  const startAnimation = (direction) => {
    if (cardCount <= 1 || !stackRef.current) return;
    stackSwapAwaitingSettleRef.current = true;
    setStackDragging(false);
    resetDragOffset();
    clearStackMotionClasses();
    requestAnimationFrame(() => {
      stackRef.current?.classList.add(`risk-analysis-wins__stack--moving-${direction}`);
    });
  };

  const goPrev = () => {
    if (isStackMotionLocked() || cardCount <= 1) return;
    startAnimation('prev');
  };

  const goNext = () => {
    if (isStackMotionLocked() || cardCount <= 1) return;
    startAnimation('next');
  };

  const handleTouchStart = (event) => {
    if (isStackMotionLocked()) {
      return;
    }

    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
    isHorizontalSwipeRef.current = false;
    didMoveRef.current = false;
    setStackDragging(false);
    resetDragOffset();
  };

  const handleTouchMove = (event) => {
    if (touchStartXRef.current == null || touchStartYRef.current == null || isStackMotionLocked()) {
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

      setStackDragging(true);
    }

    didMoveRef.current = true;
    event.preventDefault();

    const stackWidth = stackRef.current?.clientWidth || 260;
    const softLimit = Math.max(120, stackWidth * 0.55);
    const absDelta = Math.abs(deltaX);
    const direction = deltaX < 0 ? -1 : 1;

    // Apply soft resistance after the primary drag range to avoid abrupt edge sticking.
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
      setStackDragging(false);
      resetDragOffset();
      didMoveRef.current = false;
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
      setStackDragging(false);
      resetDragOffset();
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
    didMoveRef.current = false;
    setStackDragging(false);
  };

  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = false;
    setStackDragging(false);
    resetDragOffset();
    didMoveRef.current = false;
  };

  const handlePointerDown = (event) => {
    if (isStackMotionLocked()) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    pointerStartYRef.current = event.clientY;
    pointerIsHorizontalSwipeRef.current = false;
    activePointerIdRef.current = event.pointerId;
    didMoveRef.current = false;
    setStackDragging(false);
    resetDragOffset();

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (
      pointerStartXRef.current == null
      || pointerStartYRef.current == null
      || activePointerIdRef.current !== event.pointerId
      || isStackMotionLocked()
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

      setStackDragging(true);
    }

    didMoveRef.current = true;
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
      setStackDragging(false);
      resetDragOffset();
      didMoveRef.current = false;
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
      setStackDragging(false);
      resetDragOffset();
    }

    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    pointerIsHorizontalSwipeRef.current = false;
    activePointerIdRef.current = null;
    didMoveRef.current = false;
    setStackDragging(false);

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
    setStackDragging(false);
    resetDragOffset();
    didMoveRef.current = false;

    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleStackTransitionEnd = (event) => {
    if (!stackSwapAwaitingSettleRef.current) return;
    if (!event.target.classList.contains('risk-analysis-wins__stack-card--front')) return;
    if (event.propertyName !== 'transform') return;

    stackSwapAwaitingSettleRef.current = false;

    flushSync(() => {
      setStackResetting(true);
      setActiveIndex((prev) => (prev + 1) % cardCount);
    });

    clearStackMotionClasses();
    resetDragOffset();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStackResetting(false);
      });
    });
  };

  const handleCardClick = (card) => {
    if (didMoveRef.current) {
      return;
    }

    if (card?.isPlaceholder) {
      return;
    }

    if (onDiseaseSelect) {
      onDiseaseSelect(card);
    }
  };

  useEffect(() => {
    if (prefetchedHomeBloodMarkers == null) {
      return;
    }
    setApiBloodMarkers(Array.isArray(prefetchedHomeBloodMarkers) ? prefetchedHomeBloodMarkers : []);
  }, [prefetchedHomeBloodMarkers]);

  useEffect(() => {
    if (prefetchedHomeBloodMarkers != null) {
      return undefined;
    }

    let isActive = true;

    const loadHomepageBloodMarkers = async () => {
      try {
        const { assessmentId, response } = await fetchLatestAssessmentReport(
          (assessmentId) => `/reports/${assessmentId}/blood-parameters`,
        );
        if (isActive) {
          setApiBloodMarkers(buildHomeBloodMarkersFromBloodParametersResponse(response, assessmentId));
        }
      } catch (error) {
        console.error('Failed to load homepage blood markers:', error);
        if (isActive) {
          setApiBloodMarkers([]);
        }
      }
    };

    void loadHomepageBloodMarkers();

    return () => {
      isActive = false;
    };
  }, [prefetchedHomeBloodMarkers]);

  return (
    <section className="risk-analysis-wins">
      <div className="risk-analysis-wins__header">
        <div className="risk-analysis-wins__header-icon-box">
          <PositiveWinsHeaderIcon />
        </div>
        <div className="risk-analysis-wins__header-copy">
          <h2 className="risk-analysis-wins__title">Risk Analysis</h2>
          <p className="risk-analysis-wins__subtitle">Tap the card to know more</p>
        </div>
        <button
          type="button"
          className="risk-analysis-wins__see-more"
          onClick={onSeeMore}
          data-tour="home-risk-see-more"
        >
          See more
        </button>
      </div>

      <div
        ref={stackRef}
        className="risk-analysis-wins__stack"
        style={cardCount === 2 ? {
          '--risk-analysis-wins-back-two-x': 'var(--risk-analysis-wins-back-one-x)',
          '--risk-analysis-wins-back-two-y': 'var(--risk-analysis-wins-back-one-y)',
          '--risk-analysis-wins-back-two-fade': 'var(--risk-analysis-wins-back-one-fade)',
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
        data-dragging="false"
        data-resetting="false"
        data-card-count={cardCount}
      >
        {stackCards.map((card, index) => {
          const CardIcon = card.icon;
          const distance = (index - activeIndex + cardCount) % cardCount;
          const role = distance === 0
            ? 'front'
            : distance === 1
              ? 'back-one'
              : distance === 2
                ? 'back-two'
                : 'hidden';

          return (
            <article
              key={card.id}
              className={`risk-analysis-wins__stack-card risk-analysis-wins__stack-card--${role}`}
              onClick={() => handleCardClick(card)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleCardClick(card);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="risk-analysis-wins__card-top-row">
                <div className="risk-analysis-wins__badge-icon">
                  <img src={CardIcon} alt="" aria-hidden="true" />
                </div>
                <h3 className="risk-analysis-wins__risk-title">{card.name}</h3>
                <span className="risk-analysis-wins__status-pill">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                    <path d="M8.41504 0.492188L9.2627 1.33984L6.41895 4.18359L4.50488 2.26953C4.28613 2.02344 3.90332 2.02344 3.68457 2.26953L0.18457 5.76953C-0.0615234 5.98828 -0.0615234 6.37109 0.18457 6.58984C0.40332 6.80859 0.786133 6.80859 1.00488 6.58984L4.09473 3.5L6.00879 5.41406C6.22754 5.66016 6.61035 5.66016 6.8291 5.41406L10.083 2.16016L10.9307 3.00781C11.1221 3.17188 11.4229 3.0625 11.4229 2.78906V0.300781C11.4229 0.136719 11.3135 0 11.1494 0H8.63379C8.3877 0 8.25098 0.328125 8.41504 0.492188Z" fill="#EF4444"/>
                  </svg>
                </span>
              </div>

              <div className="risk-analysis-wins__card-content">
                <div className="risk-analysis-wins__left-column">
                  <div className="risk-analysis-wins__gauge-rank-row">
                    <GaugeDial score={card.score} scoreDisplay={card.scoreDisplay} />
                    <div className="risk-analysis-wins__health-rank-box" aria-hidden="true">
                      <span className="risk-analysis-wins__health-rank-text">Health Rank</span>
                      <span className="risk-analysis-wins__health-rank-value">{card.healthRankLabel}</span>
                      <img className="risk-analysis-wins__health-rank-spark" src={HealthRankSpark} alt="" />
                    </div>
                  </div>
                </div>

                <div className="risk-analysis-wins__action-box">
                  <span className="risk-analysis-wins__action-title">Action</span>
                  <p className="risk-analysis-wins__action-text">{card.action}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="risk-analysis-wins__swipe-hint" aria-hidden="true">
        <button
          type="button"
          className="risk-analysis-wins__swipe-arrow-btn"
          onClick={() => {
            if (isDesktop) {
              goPrev();
            }
          }}
          aria-label="Show previous risk card"
        >
          <span className="risk-analysis-wins__swipe-arrow risk-analysis-wins__swipe-arrow--left"><SwipeArrow /></span>
        </button>
        <span className="risk-analysis-wins__swipe-text">Swipe to explore</span>
        <button
          type="button"
          className="risk-analysis-wins__swipe-arrow-btn"
          onClick={() => {
            if (isDesktop) {
              goNext();
            }
          }}
          aria-label="Show next risk card"
        >
          <span className="risk-analysis-wins__swipe-arrow"><SwipeArrow /></span>
        </button>
      </div>

      <section className="risk-analysis-wins__blood-markers" aria-label="Blood Markers">
        <div className="risk-analysis-wins__blood-markers-header">
          <div className="risk-analysis-wins__blood-markers-copy">
            <h3 className="risk-analysis-wins__blood-markers-title">Blood Markers</h3>
            <p className="risk-analysis-wins__blood-markers-subtitle">Tap the card to know more</p>
          </div>
          <button
            type="button"
            className="risk-analysis-wins__blood-markers-see-more"
            onClick={onBloodMarkersSeeMore}
            data-tour="home-blood-markers-see-more"
          >
            See more
          </button>
        </div>

        <div className="risk-analysis-wins__blood-markers-list">
          {bloodMarkers.map((marker) => {
            const riskKey = marker.riskKey || 'optimal';
            const dropIcon = BLOOD_MARKER_DROP_BY_RISK[riskKey] || BloodDropOptimalIcon;
            const glowAsset = BLOOD_MARKER_GLOW_BY_RISK[riskKey] || BloodMarkerGlowOptimal;
            const valueText = Number.isFinite(Number(marker.numericValue))
              ? formatValue(marker.numericValue)
              : String(marker.value ?? '--');
            const unitText = String(marker.unit || '').trim();
            const profileText = marker.profile || marker.disease || 'Blood Marker';

            return (
              <article
                className={`risk-analysis-wins__blood-marker-card risk-analysis-wins__blood-marker-card--${riskKey}`}
                key={marker.id}
                role="button"
                tabIndex={0}
                onClick={() => onHomeBloodMarkerSelect?.(marker)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onHomeBloodMarkerSelect?.(marker);
                  }
                }}
              >
                <img
                  className="risk-analysis-wins__blood-marker-glow"
                  src={glowAsset}
                  alt=""
                  aria-hidden="true"
                />
                <div className="risk-analysis-wins__blood-marker-body">
                  <div className="risk-analysis-wins__blood-marker-top">
                    <div className="risk-analysis-wins__blood-marker-reading">
                      <span className="risk-analysis-wins__blood-marker-value">{valueText}</span>
                      {unitText ? (
                        <span className="risk-analysis-wins__blood-marker-unit">{unitText}</span>
                      ) : null}
                    </div>
                    <span className="risk-analysis-wins__blood-marker-drop-wrap" aria-hidden="true">
                      <img
                        className="risk-analysis-wins__blood-marker-drop"
                        src={dropIcon}
                        alt=""
                      />
                    </span>
                  </div>
                  <div className="risk-analysis-wins__blood-marker-meta">
                    <span className="risk-analysis-wins__blood-marker-name" title={String(marker.name ?? '')}>
                      {marker.name}
                    </span>
                    <span className="risk-analysis-wins__blood-marker-profile" title={profileText}>
                      {profileText}
                    </span>
                  </div>
                </div>
                <span className="risk-analysis-wins__blood-marker-inset-glow" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default RiskAnalysisSection;
