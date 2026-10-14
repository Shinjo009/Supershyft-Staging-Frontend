import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import './HomePage.css';
import Header from '../../components/HomePage/Header';
import MetabolicAgeOrb from '../../metabolic-age-orb/MetabolicAgeOrb.jsx';
import HealthParametersSection from '../../components/HomePage/HealthParametersSection';
import HomeReassessmentBottomSheet from '../../components/HomePage/HomeReassessmentBottomSheet/HomeReassessmentBottomSheet';
import PositiveWinsSection from '../../components/HomePage/PositiveWinsSection/PositiveWinsSection';
import AllergySensitivitySection from '../../components/HomePage/AllergySensitivitySection';
import CancerScreeningSection from '../../components/HomePage/CancerScreeningSection';
import RiskAnalysisSection, {
  buildHomeBloodMarkersFromBloodParametersResponse,
} from '../../components/HomePage/RiskAnalysisSection';
import NavBar from '../../components/NavBar';
import {
  SlotDetailsCard,
  PrepStepsDeck,
  StatusTimelineCard,
  WhatHappensNextCard,
} from '../../components/HomePage/ScheduledStatusUI';
import { BACKEND_BASE_URL, BACKEND_ENABLED } from '../../config/appConfig';
import { buildReportScreenMarkers } from '../../utils/reportScreenMarkers';
import { getAccessToken } from '../../utils/authStorage';
import {
  fetchLatestAssessmentReport,
  getLatestMetsightsBasicOrProAssessmentIdCached,
  peekMyAssessmentsRowsCached,
  resolveEngagementIdFromAssessmentId,
  resolveHealthSpanIndexSourcesFromRows,
} from '../../services/reportService';
import { getMyUpcomingSlot } from '../../services/usersService';
import {
  hasNutritionLogQuestionnaireDraft,
  hasFamilyHistoryQuestionnaireDraft,
  peekNutritionLogQuestionnaireDraftCache,
  peekFamilyHistoryQuestionnaireDraftCache,
  invalidateNutritionLogQuestionnaireDraftCache,
  invalidateFamilyHistoryQuestionnaireDraftCache,
  invalidateHealthQuestionnaireSubmittedCache,
  hasSubmittedHealthQuestionnaire,
  hasIncompleteNonVitalsQuestionnaireSection,
  peekHealthQuestionnaireSubmittedCache,
  peekHealthQuestionnaireSubmittedForEngagement,
  clearLegacyHealthQuestionnaireSubmittedMarker,
  clearFitprintGapQuestionnaireSubmittedFlag,
} from '../../services/questionnaireService';
import { hasRenderableOverviewData, HOME_PRELOAD_COMPLETE_KEY } from '../../utils/homeOverviewPreload';
import {
  areHealthSpanScoresPending,
  HEALTH_SPAN_PHASE,
  loadFitprintHealthSpanIndexState,
} from '../../utils/fitprintHealthSpanFlow';
import {
  getFixedBioAiReportPdfUrl,
  getFixedBloodReportPdfUrl,
} from '../../utils/assessmentBloodMarkerSupplements';
import { loadReassessmentBannerState } from '../../utils/reassessmentBanner';
import clockCircleSrc from '../../images/clock_circle.svg';
import clockHandsSrc from '../../images/clock_hands.svg';
import slotPassedWarningSrc from '../../images/slot-passed/warning-badge.svg';

const hasDisplayableHealthSpanScores = (scores) => (
  Boolean(scores) && !areHealthSpanScoresPending(scores)
);

const resolveFitprintGapCheckDoneFromPreload = (data) => {
  if (!data?.fitprintGapLockPreloaded) {
    return false;
  }
  if (data.healthSpanPhase === HEALTH_SPAN_PHASE.SHOW_SCORES
    || data.healthSpanPhase === HEALTH_SPAN_PHASE.HIDDEN_NO_FITPRINT
    || data.healthSpanPhase === HEALTH_SPAN_PHASE.NO_BASIC_PRO) {
    return true;
  }
  if (data.healthSpanPhase === HEALTH_SPAN_PHASE.LOCKED_QUESTIONNAIRE
    || data.healthSpanPhase === HEALTH_SPAN_PHASE.LOCKED_SUBMITTED) {
    return true;
  }
  if (data.healthSpanLockedNoFitprint) {
    return true;
  }
  return hasDisplayableHealthSpanScores(data.healthSpanScores);
};

const AvatarGlyph = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42" fill="none" aria-hidden="true">
    <foreignObject x="-6.90083" y="16.9698" width="49.579" height="31.7743">
      <div
        style={{
          backdropFilter: 'blur(3.45px)',
          clipPath: 'url(#bgblur_0_2189_15612_clip_path)',
          height: '100%',
          width: '100%',
        }}
      />
    </foreignObject>
    <path d="M17.8906 24.2544C26.4156 24.2544 33.5346 30.1843 35.2725 38.0933L35.3477 38.4741C35.6503 40.0137 34.4237 41.4595 32.8086 41.4595H2.96875C1.35365 41.4595 0.127063 40.0137 0.429688 38.4741C2.01951 30.3755 9.2294 24.2545 17.8906 24.2544Z" fill="url(#avatar-base-fill)" stroke="url(#avatar-base-stroke)" strokeWidth="0.766759" />
    <foreignObject x="1.9644" y="-5.09224" width="31.8388" height="31.6459">
      <div
        style={{
          backdropFilter: 'blur(3.45px)',
          clipPath: 'url(#bgblur_1_2189_15612_clip_path)',
          height: '100%',
          width: '100%',
        }}
      />
    </foreignObject>
    <path d="M15.9019 2.42248C20.5457 1.33821 25.1928 4.18326 26.2869 8.76837C27.3809 13.3537 24.5104 17.9548 19.8664 19.0391C15.2224 20.1233 10.576 17.2773 9.48205 12.692C8.3883 8.10688 11.2581 3.50681 15.9019 2.42248Z" fill="url(#avatar-head-fill)" stroke="url(#avatar-head-stroke)" strokeWidth="0.766759" />
    <defs>
      <clipPath id="bgblur_0_2189_15612_clip_path" transform="translate(6.90083 -16.9698)">
        <path d="M17.8906 24.2544C26.4156 24.2544 33.5346 30.1843 35.2725 38.0933L35.3477 38.4741C35.6503 40.0137 34.4237 41.4595 32.8086 41.4595H2.96875C1.35365 41.4595 0.127063 40.0137 0.429688 38.4741C2.01951 30.3755 9.2294 24.2545 17.8906 24.2544Z" />
      </clipPath>
      <clipPath id="bgblur_1_2189_15612_clip_path" transform="translate(-1.9644 5.09224)">
        <path d="M15.9019 2.42248C20.5457 1.33821 25.1928 4.18326 26.2869 8.76837C27.3809 13.3537 24.5104 17.9548 19.8664 19.0391C15.2224 20.1233 10.576 17.2773 9.48205 12.692C8.3883 8.10688 11.2581 3.50681 15.9019 2.42248Z" />
      </clipPath>
      <linearGradient id="avatar-base-fill" x1="2.01984" y1="40.8286" x2="14.8103" y2="15.3672" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" stopOpacity="0.2" />
        <stop offset="1" stopColor="white" stopOpacity="0.49" />
      </linearGradient>
      <linearGradient id="avatar-base-stroke" x1="2.52548" y1="25.2841" x2="14.1155" y2="49.9531" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="avatar-head-fill" x1="11.9367" y1="20.2495" x2="23.6466" y2="1.09847" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" stopOpacity="0.2" />
        <stop offset="1" stopColor="white" stopOpacity="0.49" />
      </linearGradient>
      <linearGradient id="avatar-head-stroke" x1="8.60187" y1="5.17443" x2="26.8536" y2="17.4495" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

const PreventiveCareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <g clipPath="url(#preventive-care-clip)">
      <path d="M11.8007 6.11998C11.8586 6.04939 11.9017 5.9679 11.9276 5.88035C11.9534 5.7928 11.9614 5.70096 11.9512 5.61025C11.9409 5.51955 11.9126 5.43181 11.8679 5.35224C11.8231 5.27267 11.7629 5.20288 11.6907 5.14698C11.5439 5.03213 11.3581 4.97915 11.1728 4.99932C10.9875 5.01949 10.8174 5.11123 10.6987 5.25498L7.38871 9.31498L5.61871 7.95498C5.47412 7.83731 5.28929 7.78076 5.10361 7.79738C4.91794 7.81401 4.74609 7.90249 4.62471 8.04398C4.56541 8.11337 4.52062 8.19395 4.49299 8.28095C4.46535 8.36794 4.45544 8.45959 4.46383 8.55049C4.47222 8.64138 4.49874 8.72967 4.54183 8.81014C4.58493 8.8906 4.64371 8.96162 4.71471 9.01898L7.03471 10.829C7.18121 10.9482 7.36891 11.0045 7.55683 10.9858C7.74475 10.9671 7.91762 10.8747 8.03771 10.729L11.7977 6.10898L11.8007 6.11998Z" fill="#358678" />
      <path fillRule="evenodd" clipRule="evenodd" d="M6.50914 0.714119C7.04314 0.322119 7.31014 0.126119 7.59914 0.0501195C7.85738 -0.0154044 8.1279 -0.0154044 8.38614 0.0501195C8.67814 0.126119 8.94614 0.322119 9.47614 0.714119L10.1531 1.21112C10.3381 1.34712 10.4311 1.41512 10.5311 1.46812C10.6205 1.51479 10.7135 1.55345 10.8101 1.58412C10.9191 1.61712 11.0321 1.63412 11.2591 1.66912L12.0891 1.79612C12.7441 1.89612 13.0711 1.94712 13.3291 2.10012C13.5591 2.23512 13.7511 2.42712 13.8861 2.65712C14.0391 2.91712 14.0891 3.24512 14.1901 3.89712L14.3171 4.72712C14.3521 4.95412 14.3691 5.06812 14.4021 5.17712C14.4321 5.27379 14.4708 5.36645 14.5181 5.45512C14.5721 5.55512 14.6391 5.64812 14.7751 5.83312L15.2721 6.51012C15.6641 7.04412 15.8601 7.31112 15.9361 7.60012C16.0017 7.85836 16.0017 8.12888 15.9361 8.38712C15.8611 8.67912 15.6641 8.94712 15.2721 9.47712L14.7751 10.1541C14.68 10.2734 14.5941 10.3998 14.5181 10.5321C14.4707 10.6216 14.4319 10.7153 14.4021 10.8121C14.3691 10.9201 14.3521 11.0331 14.3171 11.2601L14.1901 12.0901C14.0901 12.7451 14.0391 13.0721 13.8861 13.3301C13.7511 13.5601 13.5591 13.7521 13.3291 13.8871C13.0691 14.0401 12.7411 14.0901 12.0891 14.1911L11.2591 14.3181C11.1075 14.3353 10.9574 14.3641 10.8101 14.4041C10.7135 14.4335 10.6205 14.4721 10.5311 14.5201C10.4311 14.5731 10.3381 14.6401 10.1531 14.7771L9.47614 15.2741C8.94214 15.6661 8.67514 15.8621 8.38614 15.9381C8.1279 16.0036 7.85738 16.0036 7.59914 15.9381C7.30714 15.8621 7.03914 15.6661 6.50914 15.2741L5.83214 14.7771C5.71286 14.682 5.5865 14.596 5.45414 14.5201C5.36501 14.4727 5.27159 14.4339 5.17514 14.4041C5.02788 14.3641 4.87778 14.3353 4.72614 14.3181L3.89614 14.1911C3.24114 14.0911 2.91314 14.0411 2.65614 13.8871C2.42696 13.7508 2.23549 13.5593 2.09914 13.3301C1.94614 13.0701 1.89614 12.7421 1.79514 12.0901L1.66814 11.2601C1.63314 11.0331 1.61614 10.9201 1.58314 10.8111C1.55397 10.7145 1.5151 10.621 1.46714 10.5321C1.39121 10.3998 1.3053 10.2734 1.21014 10.1541L0.713143 9.47712C0.321143 8.94312 0.125143 8.67712 0.0491429 8.38712C-0.016381 8.12888 -0.016381 7.85836 0.0491429 7.60012C0.124143 7.30812 0.321143 7.04012 0.713143 6.51012L1.21014 5.83312C1.34614 5.64812 1.41414 5.55512 1.46714 5.45512C1.51381 5.36645 1.55248 5.27345 1.58314 5.17612C1.61614 5.06712 1.63314 4.95412 1.66814 4.72712L1.79514 3.89712C1.89514 3.24212 1.94614 2.91412 2.09914 2.65712C2.23414 2.42712 2.42614 2.23712 2.65614 2.10012C2.91614 1.94712 3.24414 1.89712 3.89614 1.79612L4.72614 1.66912C4.95314 1.63512 5.06714 1.61712 5.17514 1.58412C5.27181 1.55412 5.36481 1.51545 5.45414 1.46812C5.55414 1.41512 5.64714 1.34712 5.83214 1.21112L6.50914 0.714119ZM8.88914 1.52012L9.60014 2.04212C9.75114 2.15312 9.90014 2.26312 10.0661 2.35112C10.2128 2.42912 10.3648 2.49212 10.5221 2.54012C10.702 2.58986 10.8851 2.62695 11.0701 2.65112L11.9421 2.78512C12.6831 2.89912 12.7751 2.93012 12.8291 2.96212C12.9138 3.01279 12.9811 3.08012 13.0311 3.16412C13.0631 3.21812 13.0951 3.31012 13.2081 4.05112L13.3421 4.92312C13.3663 5.10815 13.4034 5.29127 13.4531 5.47112C13.5018 5.62979 13.5648 5.78179 13.6421 5.92712C13.7301 6.09312 13.8401 6.24212 13.9511 6.39312L14.4731 7.10412C14.9171 7.70812 14.9591 7.79512 14.9751 7.85712C14.9982 7.95106 14.9982 8.04918 14.9751 8.14312C14.9591 8.20412 14.9171 8.29112 14.4731 8.89612L13.9511 9.60712C13.8401 9.75812 13.7301 9.90712 13.6421 10.0731C13.5648 10.2188 13.5015 10.3715 13.4531 10.5291C13.4034 10.709 13.3663 10.8921 13.3421 11.0771L13.2081 11.9491C13.0941 12.6901 13.0631 12.7821 13.0311 12.8361C12.9811 12.9187 12.9118 12.988 12.8291 13.0381C12.7751 13.0701 12.6831 13.1021 11.9421 13.2151L11.0701 13.3491C10.8851 13.3733 10.702 13.4104 10.5221 13.4601C10.3645 13.5085 10.2118 13.5718 10.0661 13.6491C9.90014 13.7371 9.75114 13.8471 9.60014 13.9581L8.88914 14.4801C8.28514 14.9241 8.19814 14.9661 8.13614 14.9821C8.0422 15.0052 7.94408 15.0052 7.85014 14.9821C7.78914 14.9661 7.70214 14.9241 7.09714 14.4801L6.38614 13.9581C6.23821 13.8444 6.08249 13.7411 5.92014 13.6491C5.77448 13.5718 5.62179 13.5085 5.46414 13.4601C5.28429 13.4104 5.10118 13.3733 4.91614 13.3491L4.04414 13.2151C3.30314 13.1011 3.21114 13.0701 3.15714 13.0381C3.07453 12.988 3.00523 12.9187 2.95514 12.8361C2.92314 12.7821 2.89114 12.6901 2.77814 11.9491L2.64414 11.0771C2.61997 10.8921 2.58288 10.709 2.53314 10.5291C2.48475 10.3715 2.42146 10.2188 2.34414 10.0731C2.25614 9.90712 2.14614 9.75812 2.03514 9.60712L1.51314 8.89612C1.06914 8.29212 1.02714 8.20512 1.01114 8.14312C0.98809 8.04918 0.98809 7.95106 1.01114 7.85712C1.02714 7.79612 1.06914 7.70912 1.51314 7.10412L2.03514 6.39312C2.14614 6.24212 2.25614 6.09312 2.34414 5.92712C2.42148 5.78045 2.48448 5.62845 2.53314 5.47112C2.58288 5.29127 2.61997 5.10815 2.64414 4.92312L2.77814 4.05112C2.89214 3.31012 2.92314 3.21812 2.95514 3.16412C3.00523 3.08151 3.07453 3.01221 3.15714 2.96212C3.21114 2.93012 3.30314 2.89812 4.04414 2.78512L4.91614 2.65112C5.10118 2.62695 5.28429 2.58986 5.46414 2.54012C5.62281 2.49145 5.77481 2.42845 5.92014 2.35112C6.08614 2.26312 6.23514 2.15312 6.38614 2.04212L7.09714 1.52012C7.70114 1.07612 7.78814 1.03412 7.85014 1.01812C7.94408 0.995066 8.0422 0.995066 8.13614 1.01812C8.19714 1.03412 8.28414 1.07612 8.88914 1.52012Z" fill="#358678" />
    </g>
    <defs>
      <clipPath id="preventive-care-clip">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const CostEffectiveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <g clipPath="url(#cost-effective-clip)">
      <path d="M4.24935 10.2708V14.875C4.24935 15.0629 4.17472 15.243 4.04188 15.3759C3.90904 15.5087 3.72888 15.5833 3.54102 15.5833H2.12435C1.93649 15.5833 1.75632 15.5087 1.62348 15.3759C1.49064 15.243 1.41602 15.0629 1.41602 14.875V10.2708C1.41602 10.083 1.49064 9.9028 1.62348 9.76997C1.75632 9.63713 1.93649 9.5625 2.12435 9.5625H3.54102C3.72888 9.5625 3.90904 9.63713 4.04188 9.76997C4.17472 9.9028 4.24935 10.083 4.24935 10.2708ZM4.24935 10.2708H8.32227C8.55709 10.2708 8.7823 10.3641 8.94835 10.5302C9.1144 10.6962 9.20768 10.9214 9.20768 11.1563C9.20768 11.3911 9.1144 11.6163 8.94835 11.7823C8.7823 11.9484 8.55709 12.0417 8.32227 12.0417H6.72852" stroke="#358678" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.79167 12.0415H10.4068C11.0088 12.0414 11.595 11.8496 12.0806 11.494L13.9428 10.1304C14.1386 9.9789 14.3828 9.90375 14.6299 9.919C14.877 9.93425 15.1102 10.0388 15.2858 10.2133C15.3851 10.3124 15.4628 10.4311 15.5138 10.5618C15.5648 10.6925 15.5882 10.8323 15.5823 10.9725C15.5764 11.1127 15.5415 11.2501 15.4798 11.3761C15.418 11.5021 15.3307 11.6139 15.2235 11.7043L12.109 14.2388C11.6037 14.6501 10.972 14.8748 10.3204 14.8748H4.25M13.4583 4.95817C13.4583 5.89748 13.0852 6.79832 12.421 7.46251C11.7568 8.1267 10.856 8.49984 9.91667 8.49984C8.97736 8.49984 8.07652 8.1267 7.41233 7.46251C6.74814 6.79832 6.375 5.89748 6.375 4.95817C6.375 4.01886 6.74814 3.11803 7.41233 2.45383C8.07652 1.78964 8.97736 1.4165 9.91667 1.4165C10.856 1.4165 11.7568 1.78964 12.421 2.45383C13.0852 3.11803 13.4583 4.01886 13.4583 4.95817Z" stroke="#358678" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <defs>
      <clipPath id="cost-effective-clip">
        <rect width="17" height="17" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const DataPrivacyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <path d="M5.66602 7.08333V4.95833C5.66602 3.39292 6.93393 2.125 8.49935 2.125C10.0648 2.125 11.3327 3.39292 11.3327 4.95833V7.08333M8.49935 10.625C8.68721 10.625 8.86738 10.5504 9.00022 10.4175C9.13305 10.2847 9.20768 10.1045 9.20768 9.91667C9.20768 9.7288 9.13305 9.54864 9.00022 9.4158C8.86738 9.28296 8.68721 9.20833 8.49935 9.20833C8.31149 9.20833 8.13132 9.28296 7.99848 9.4158C7.86564 9.54864 7.79102 9.7288 7.79102 9.91667C7.79102 10.1045 7.86564 10.2847 7.99848 10.4175C8.13132 10.5504 8.31149 10.625 8.49935 10.625ZM8.49935 10.625V12.75M4.67435 7.08333H12.3243C12.9477 7.08333 13.4577 7.59333 13.4577 8.21667V13.175C13.4577 14.11 12.6927 14.875 11.7577 14.875H5.24102C4.30602 14.875 3.54102 14.11 3.54102 13.175V8.21667C3.54102 7.59333 4.05102 7.08333 4.67435 7.08333Z" stroke="#358678" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AnalysisHourglassIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="27" height="29" viewBox="0 0 27 29" fill="none" aria-hidden="true">
    <path d="M0 1H26.6667M4.84848 1V7.06061C4.84848 10.697 10.9091 10.9818 10.9091 14.3333C10.9091 17.6848 4.84848 17.9697 4.84848 21.6061V27.6667M21.8182 1V7.06061C21.8182 10.697 15.7576 10.9818 15.7576 14.3333C15.7576 17.6848 21.8182 17.9697 21.8182 21.6061V27.6667M0 27.6667H26.6667M10.9091 5.24242H15.7576V7.06061C15.7576 8.27273 13.3333 9.48485 13.3333 9.48485C13.3333 9.48485 10.9091 8.27273 10.9091 7.06061V5.24242ZM8.48485 25.2424C8.48485 22.8182 13.3333 20.3939 13.3333 20.3939C13.3333 20.3939 18.1818 22.8182 18.1818 25.2424V27.6667H8.48485V25.2424Z" stroke="white" strokeWidth="2" />
  </svg>
);

const HomeDownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M11.625 15.513C11.5083 15.471 11.4 15.4 11.3 15.3L7.7 11.7C7.5 11.5 7.404 11.2667 7.412 11C7.42 10.7333 7.516 10.5 7.7 10.3C7.9 10.1 8.13767 9.996 8.413 9.988C8.68833 9.98 8.92567 10.0757 9.125 10.275L11 12.15V5C11 4.71667 11.096 4.47934 11.288 4.288C11.48 4.09667 11.7173 4.00067 12 4C12.2827 3.99934 12.5203 4.09534 12.713 4.288C12.9057 4.48067 13.0013 4.718 13 5V12.15L14.875 10.275C15.075 10.075 15.3127 9.979 15.588 9.987C15.8633 9.995 16.1007 10.0993 16.3 10.3C16.4833 10.5 16.5793 10.7333 16.588 11C16.5967 11.2667 16.5007 11.5 16.3 11.7L12.7 15.3C12.6 15.4 12.4917 15.471 12.375 15.513C12.2583 15.555 12.1333 15.5757 12 15.575C11.8667 15.5743 11.7417 15.5537 11.625 15.513ZM6 20C5.45 20 4.97933 19.8043 4.588 19.413C4.19667 19.0217 4.00067 18.5507 4 18V16C4 15.7167 4.096 15.4793 4.288 15.288C4.48 15.0967 4.71733 15.0007 5 15C5.28267 14.9993 5.52033 15.0953 5.713 15.288C5.90567 15.4807 6.00133 15.718 6 16V18H18V16C18 15.7167 18.096 15.4793 18.288 15.288C18.48 15.0967 18.7173 15.0007 19 15C19.2827 14.9993 19.5203 15.0953 19.713 15.288C19.9057 15.4807 20.0013 15.718 20 16V18C20 18.55 19.8043 19.021 19.413 19.413C19.0217 19.805 18.5507 20.0007 18 20H6Z" fill="white" />
  </svg>
);

const HomeReportEyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22 12C22 12 17.522 18 12 18C6.478 18 2 12 2 12C2 12 6.478 6 12 6C17.522 6 22 12 22 12Z" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12C15 11.2044 14.6839 10.4413 14.1213 9.87868C13.5587 9.31607 12.7956 9 12 9C11.2044 9 10.4413 9.31607 9.87868 9.87868C9.31607 10.4413 9 11.2044 9 12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15Z" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const analyzingTimelineItems = [
  { id: 'sample-collected', label: 'Sample Collected', labelLines: ['Sample', 'Collected'], state: 'done' },
  { id: 'questionnaire-completed', label: 'Questionnaire Completion', labelLines: ['Questionnaire', 'Completion'], state: 'done' },
  { id: 'analysis-progress', label: 'Analysis in Progress', labelLines: ['Analysis in', 'Progress'], state: 'active' },
  { id: 'reports-generated', label: 'Reports Generated', labelLines: ['Reports', 'Generated'], state: 'pending' },
];

const analyzingQuestionnairePendingTimeline = [
  { id: 'sample-collected', label: 'Sample Collected', labelLines: ['Sample', 'Collected'], state: 'done' },
  { id: 'questionnaire-pending', label: 'Questionnaire Completion', labelLines: ['Questionnaire', 'Completion'], state: 'current' },
  { id: 'analysis-pending', label: 'Analysis in Progress', labelLines: ['Analysis in', 'Progress'], state: 'pending' },
  { id: 'reports-generated', label: 'Reports Generated', labelLines: ['Reports', 'Generated'], state: 'pending' },
];

const b2cSampleCollectedTimeline = [
  { id: 'sample-collected', label: 'Sample Collected', labelLines: ['Sample', 'Collected'], state: 'current' },
  { id: 'questionnaire-pending', label: 'Questionnaire Completion', labelLines: ['Questionnaire', 'Completion'], state: 'pending' },
  { id: 'analysis-pending', label: 'Analysis in Progress', labelLines: ['Analysis in', 'Progress'], state: 'pending' },
  { id: 'reports-generated', label: 'Reports Generated', labelLines: ['Reports', 'Generated'], state: 'pending' },
];

const resolveOverviewPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.data && typeof payload.data === 'object') return payload.data;
  if (payload.result && typeof payload.result === 'object') return payload.result;
  if (payload.item && typeof payload.item === 'object') return payload.item;
  return payload;
};

const resolvePositiveWinsPayload = (overview) => {
  if (!overview || typeof overview !== 'object') {
    return null;
  }

  if (overview.positive_wins && typeof overview.positive_wins === 'object') {
    return overview.positive_wins;
  }

  const hasTopLevelPositiveWinsFields = Object.prototype.hasOwnProperty.call(overview, 'healthy_habits')
    || Object.prototype.hasOwnProperty.call(overview, 'healthy_profiles')
    || Object.prototype.hasOwnProperty.call(overview, 'low_risk');

  if (!hasTopLevelPositiveWinsFields) {
    return null;
  }

  return {
    healthy_habits: Array.isArray(overview.healthy_habits) ? overview.healthy_habits : [],
    healthy_profiles: Array.isArray(overview.healthy_profiles) ? overview.healthy_profiles : [],
    low_risk: Array.isArray(overview.low_risk) ? overview.low_risk : [],
  };
};

const EMPTY_UPCOMING_SLOT = {
  hasScheduledSlot: false,
  isB2b: false,
  isB2c: false,
  organizationName: '',
  slotStart: '',
  slotEnd: '',
  engagementDateRaw: '',
  engagementId: 0,
  locationDisplay: '',
  locationType: '',
  locationName: '',
  locationAddress: '',
  cabin: '',
  engagementDayLabel: 'Day 1',
};

/** Local UI preview for B2C "Your Test is Scheduled" (Home Collection). */
const PREVIEW_B2C_SCHEDULED_SLOT = {
  hasScheduledSlot: true,
  isB2b: false,
  isB2c: true,
  organizationName: '',
  slotStart: '09:00:00',
  slotEnd: '10:00:00',
  engagementDateRaw: '2026-09-20',
  engagementId: 1,
  locationDisplay: '123 Marol Naka, Mumbai, Maharashtra',
  locationType: 'home',
  locationName: '',
  locationAddress: '123 Marol Naka, Mumbai, Maharashtra',
  engagementDayLabel: 'Day 1',
};

/** Local UI preview for B2B "Your Slot has Passed" (Collection Cabin walk-in). */
const PREVIEW_SLOT_PASSED_SLOT = {
  hasScheduledSlot: true,
  isB2b: true,
  isB2c: false,
  organizationName: 'ABC Tech Park',
  slotStart: '09:00:00',
  slotEnd: '10:00:00',
  engagementDateRaw: '2026-08-20',
  engagementId: 1,
  locationDisplay: 'Conference Room B – 4th Floor\nABC Tech Park, Andheri East',
  locationType: 'cabin',
  locationName: 'Conference Room B – 4th Floor',
  locationAddress: 'ABC Tech Park, Andheri East',
  engagementDayLabel: 'Day 1',
};

const normalizeUpcomingSlotPayload = (root) => {
  if (!root || typeof root !== 'object') {
    return { ...EMPTY_UPCOMING_SLOT };
  }

  const hasScheduled = Boolean(root.has_scheduled_slot);
  const slots = Array.isArray(root.slots) ? root.slots : [];
  const first = slots[0] || {};
  const engagement = first.engagement && typeof first.engagement === 'object' ? first.engagement : {};
  const slot = first.slot && typeof first.slot === 'object' ? first.slot : {};
  const location = first.location && typeof first.location === 'object' ? first.location : {};
  const engagementType = String(engagement.engagement_type || '').trim().toLowerCase();

  return {
    hasScheduledSlot: hasScheduled && slots.length > 0,
    isB2b: engagementType === 'b2b',
    isB2c: engagementType === 'b2c',
    organizationName: String(engagement.organization_name || '').trim(),
    slotStart: String(slot.slot_start_time || '').trim(),
    slotEnd: String(slot.slot_end_time || '').trim(),
    engagementDateRaw: String(slot.engagement_date || '').trim(),
    engagementId: Number(
      engagement.engagement_id
      || engagement.id
      || first.engagement_id
      || slot.engagement_id
      || 0,
    ) || 0,
    locationDisplay: String(location.display || '').trim(),
    locationType: String(location.type || '').trim(),
    locationName: String(location.name || location.venue_name || location.venue || '').trim(),
    locationAddress: String(
      location.address || location.address_line || location.full_address || location.subtitle || '',
    ).trim(),
    cabin: String(slot.cabin || slot.cabin_name || '').trim(),
    engagementDayLabel: (() => {
      const dayNumber = Number(engagement.day_number);
      if (Number.isFinite(dayNumber) && dayNumber > 0) {
        return `Day ${dayNumber}`;
      }
      const dayLabel = String(engagement.day_label || '').trim();
      return dayLabel || 'Day 1';
    })(),
  };
};


/** Blood-collection chip date, e.g. Mon, 12 Feb */
const formatBloodCollectionDateLabel = (raw) => {
  const ymd = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return '';
  }
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
};

const formatEngagementDateParts = (raw, dayLabel = 'Day 1') => {
  const ymd = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const fallback = raw ? String(raw) : '—';
    return { primary: fallback, secondary: dayLabel };
  }
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { primary: ymd, secondary: dayLabel };
  }
  const primary = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
  return { primary, secondary: dayLabel };
};

const formatSlotCabinLabel = (cabin) => {
  const value = String(cabin || '').trim();
  if (!value) {
    return '';
  }
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
};

/** Location lines from GET /users/me/upcoming-slot (cabin first, then venue / home address). */
const formatSlotLocationLines = (slotNorm) => {
  const cabinLabel = formatSlotCabinLabel(slotNorm?.cabin);
  if (cabinLabel) {
    return { primary: cabinLabel, secondary: '' };
  }

  const name = String(slotNorm?.locationName || '').trim();
  const address = String(slotNorm?.locationAddress || '').trim();
  if (name && address) {
    return { primary: name, secondary: address };
  }
  if (name) {
    return { primary: name, secondary: '' };
  }
  if (address) {
    return { primary: address, secondary: '' };
  }

  const display = String(slotNorm?.locationDisplay || '').trim();
  if (!display) {
    return { primary: '', secondary: '' };
  }

  const newlineParts = display.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  if (newlineParts.length >= 2) {
    return { primary: newlineParts[0], secondary: newlineParts.slice(1).join(', ') };
  }

  const commaParts = display.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      primary: commaParts.slice(0, -1).join(', '),
      secondary: commaParts[commaParts.length - 1],
    };
  }

  return { primary: display, secondary: '' };
};

const formatB2cEngagementDate = (raw) => {
  const ymd = String(raw || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd;
  }
  return String(raw || '').trim();
};

const formatSlotTimeLabel = (raw) => {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(parsed);
  }

  return value;
};

const formatB2cTestingWindowTitle = (slotNorm) => {
  const start = formatSlotTimeLabel(slotNorm?.slotStart);
  const end = formatSlotTimeLabel(slotNorm?.slotEnd);
  const date = formatB2cEngagementDate(slotNorm?.engagementDateRaw);
  const timePart = [start, end].filter(Boolean).join(' - ');

  if (timePart && date) {
    return `${timePart} | ${date}`;
  }

  return timePart || date || '—';
};

/** Show sample-collected UI 1 minute after the published slot end (e.g. 10–11 → at 11:01). */
const B2C_SLOT_END_GRACE_MS = 60 * 1000;
const B2C_SLOT_LAPSED_SESSION_KEY = 'ss_b2c_slot_lapsed';

const markB2cSlotLapsedInSession = () => {
  try {
    sessionStorage.setItem(B2C_SLOT_LAPSED_SESSION_KEY, '1');
  } catch {
    // ignore
  }
};

const isB2cSlotLapsedInSession = () => {
  try {
    return sessionStorage.getItem(B2C_SLOT_LAPSED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

const clearB2cSlotLapsedInSession = () => {
  try {
    sessionStorage.removeItem(B2C_SLOT_LAPSED_SESSION_KEY);
  } catch {
    // ignore
  }
};

const parseSlotBoundaryDate = (engagementDateRaw, timeRaw) => {
  const ymd = String(engagementDateRaw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return null;
  }

  const time = String(timeRaw || '').trim();
  if (!time) {
    return null;
  }

  const ampmMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = ampmMatch[2];
    const seconds = String(Number(ampmMatch[3] || 0)).padStart(2, '0');
    const meridiem = ampmMatch[4].toUpperCase();
    if (meridiem === 'AM') {
      if (hours === 12) {
        hours = 0;
      }
    } else if (hours !== 12) {
      hours += 12;
    }
    const hh = String(hours).padStart(2, '0');
    const parsed = new Date(`${ymd}T${hh}:${minutes}:${seconds}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = String(Number(timeMatch[1])).padStart(2, '0');
    const minutes = timeMatch[2];
    const seconds = String(Number(timeMatch[3] || 0)).padStart(2, '0');
    const parsed = new Date(`${ymd}T${hours}:${minutes}:${seconds}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(`${ymd}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** True once the assigned testing window end (+ grace) has passed (B2B camp and B2C home collection). */
const isScheduledSlotWindowEnded = (slotNorm, now = new Date()) => {
  if (!slotNorm?.hasScheduledSlot) {
    return false;
  }

  const endAt = parseSlotBoundaryDate(slotNorm.engagementDateRaw, slotNorm.slotEnd);
  if (!endAt) {
    return false;
  }

  return now.getTime() >= endAt.getTime() + B2C_SLOT_END_GRACE_MS;
};

const parseResponseBody = async (response) => {
  const contentType = response?.headers?.get?.('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
};

const HomePage = ({
  userName = 'User',
  userAge = null,
  employerOrganizerFallback = '',
  preloadedData = null,
  forceRefreshFromProfile = false,
  forceScheduledPreview = false,
  forceSlotPassedPreview = false,
  onNavigateToHealthScan,
  onNavigateToHealthScanTab,
  onNavigateToProfile,
  onNavigateToRiskAnalysis,
  onNavigateToDiseaseDetail,
  onOpenHealthAssessment,
  onOpenB2bHealthAssessment,
  onNavigateToBloodMarkers,
  onNavigateToCancerMarkers,
  onNavigateToAllergySensitivity,
  onNavigateToBloodMarkerDetail,
  onNavigateToPackages,
  onNavigateToDoctors,
  onNavigateToSuperClub,
  onOpenAllAppointments,
}) => {
  const homePreloadComplete = Boolean(preloadedData?.[HOME_PRELOAD_COMPLETE_KEY]);

  const [metabolicAgeValue, setMetabolicAgeValue] = useState(preloadedData?.metabolicAgeValue || '-');
  const [positiveWinsData, setPositiveWinsData] = useState(preloadedData?.positiveWinsData || null);
  const [riskAnalysisData, setRiskAnalysisData] = useState(preloadedData?.riskAnalysisData || []);
  const [healthSpanScores, setHealthSpanScores] = useState(() => (
    hasDisplayableHealthSpanScores(preloadedData?.healthSpanScores) ? preloadedData.healthSpanScores : null
  ));
  const [, setHealthSpanLockedNoFitprint] = useState(
    () => Boolean(preloadedData?.fitprintGapLockPreloaded && preloadedData?.healthSpanLockedNoFitprint),
  );
  const [, setHealthSpanGapBasicProAssessmentId] = useState(
    () => (preloadedData?.fitprintGapLockPreloaded ? preloadedData.healthSpanGapBasicProAssessmentId ?? null : null),
  );
  const [, setHealthSpanGapEngagementId] = useState(
    () => (preloadedData?.fitprintGapLockPreloaded ? preloadedData.healthSpanGapEngagementId ?? null : null),
  );
  const [, setHealthSpanPhase] = useState(
    () => (preloadedData?.fitprintGapLockPreloaded ? preloadedData.healthSpanPhase ?? null : null),
  );
  /** True only when FitPrint submit is confirmed (not merely Pro answers complete). */
  const [, setFitprintGapQCompleteFromServer] = useState(
    () => Boolean(
      preloadedData?.fitprintGapLockPreloaded
      && (
        preloadedData?.healthSpanPhase === HEALTH_SPAN_PHASE.LOCKED_SUBMITTED
        || preloadedData?.healthSpanPhase === HEALTH_SPAN_PHASE.SHOW_SCORES
        || preloadedData?.fitprintGapQCompleteFromServer
      )
      && preloadedData?.healthSpanPhase !== HEALTH_SPAN_PHASE.LOCKED_QUESTIONNAIRE
    ),
  );
  /** Resolved after FitPrint/HSI source check; kept to avoid duplicate in-flight work. */
  const [, setFitprintGapCheckDone] = useState(
    () => resolveFitprintGapCheckDoneFromPreload(preloadedData),
  );
  const [isNoDataHome, setIsNoDataHome] = useState(
    () => forceScheduledPreview
      || forceSlotPassedPreview
      || (homePreloadComplete && !hasRenderableOverviewData(preloadedData)),
  );
  const [isOverviewResolved, setIsOverviewResolved] = useState(
    () => forceScheduledPreview
      || forceSlotPassedPreview
      || homePreloadComplete
      || hasRenderableOverviewData(preloadedData),
  );
  const [noDataStage, setNoDataStage] = useState(() => {
    if (forceSlotPassedPreview) return 'slot_passed';
    if (forceScheduledPreview) return 'camp_scheduled';
    return 'welcome';
  });
  const [upcomingSlotNormalized, setUpcomingSlotNormalized] = useState(() => {
    if (forceSlotPassedPreview) return PREVIEW_SLOT_PASSED_SLOT;
    if (forceScheduledPreview) return PREVIEW_B2C_SCHEDULED_SLOT;
    return null;
  });
  const [upcomingSlotStatus, setUpcomingSlotStatus] = useState(
    () => ((forceScheduledPreview || forceSlotPassedPreview) ? 'ready' : 'idle'),
  );
  const [b2cSlotEnded, setB2cSlotEnded] = useState(() => Boolean(forceSlotPassedPreview));
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] = useState(false);
  /** POST /assessments/.../submit finalized — hide edit / complete questionnaire CTAs (B2B + B2C). */
  const [isQuestionnaireSubmitted, setIsQuestionnaireSubmitted] = useState(false);
  /** When camp B2B no-data UI needs nutrition-log draft check; false until that request finishes (avoids camp → analyzing flicker). */
  const [isB2bCampNoDataGateResolved, setIsB2bCampNoDataGateResolved] = useState(true);
  const [hasStableOverviewData, setHasStableOverviewData] = useState(() => hasRenderableOverviewData(preloadedData));
  /** null = overview pipeline has not returned blood markers yet; array = rows for RiskAnalysisSection (avoids a second request + idle delay). */
  const [homeBloodMarkersForSection, setHomeBloodMarkersForSection] = useState(null);
  const [reportAllergySummary, setReportAllergySummary] = useState(null);
  const [reportCancerHome, setReportCancerHome] = useState(null);

  useEffect(() => {
    let active = true;
    fetchLatestAssessmentReport((assessmentId) => `/reports/${assessmentId}/blood-parameters`)
      .then(({ assessmentId, response }) => {
        if (!active) {
          return;
        }
        const reportMarkers = buildReportScreenMarkers(response, assessmentId);
        setReportAllergySummary(reportMarkers.hasAllergy ? reportMarkers.allergySummary : null);
        setReportCancerHome({
          count: reportMarkers.cancerCount,
          areas: reportMarkers.cancerAreas,
        });
      })
      .catch(() => {
        if (active) {
          setReportCancerHome({ count: 0, areas: [] });
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  /** null | 'bio-ai' | 'blood' — only the active row shows "Downloading..." */
  const [downloadingReportKind, setDownloadingReportKind] = useState(null);
  const [showReassessmentBanner, setShowReassessmentBanner] = useState(false);
  const [showReassessmentUpdateCta, setShowReassessmentUpdateCta] = useState(false);
  /** B2B: true only when a non-Vitals questionnaire section is incomplete (status API). */
  const [b2bHasIncompleteNonVitals, setB2bHasIncompleteNonVitals] = useState(false);
  /** Returning user: View Details on reassessment sheet → same journey screens as new users. */
  const [isReturningUserJourneyView, setIsReturningUserJourneyView] = useState(false);
  const [overviewAnchorAssessmentId, setOverviewAnchorAssessmentId] = useState(
    () => preloadedData?.anchorAssessmentId ?? null,
  );
  const [overviewAnchorEngagementId, setOverviewAnchorEngagementId] = useState(
    () => preloadedData?.anchorEngagementId ?? null,
  );
  /** Basic/Pro (+ FitPrint) assigned on /assessments/me while overview report is not ready yet. */
  const [metsightsCycleAssigned, setMetsightsCycleAssigned] = useState(
    () => Boolean(preloadedData?.fitprintGapLockPreloaded),
  );

  const slotNorm = upcomingSlotNormalized || EMPTY_UPCOMING_SLOT;
  const b2cSlotLapsedSession = isB2cSlotLapsedInSession();
  const campFlowActive = Boolean(slotNorm.hasScheduledSlot)
    || process.env.REACT_APP_B2B_CAMP_FLOW === 'true'
    || b2cSlotLapsedSession;

  const showJourneyScreens = forceScheduledPreview
    || forceSlotPassedPreview
    || isNoDataHome
    || isReturningUserJourneyView;

  const organizerDisplayName = String(
    slotNorm.organizationName || employerOrganizerFallback || '',
  ).trim();

  const openB2bQuestionnaire = () => {
    if (onOpenB2bHealthAssessment) {
      onOpenB2bHealthAssessment();
      return;
    }
    if (onOpenHealthAssessment) {
      onOpenHealthAssessment();
    }
  };

  const showHealthQuestionnaireCta = !isQuestionnaireSubmitted
    && (!slotNorm.isB2b || b2bHasIncompleteNonVitals);

  const showHealthSpanScores = hasDisplayableHealthSpanScores(healthSpanScores);

  const applyFitprintHealthSpanState = useCallback((flowState) => {
    setHealthSpanPhase(flowState?.phase ?? null);
    setHealthSpanGapEngagementId(flowState?.engagementId ?? null);

    if (flowState?.phase === HEALTH_SPAN_PHASE.SHOW_SCORES) {
      clearFitprintGapQuestionnaireSubmittedFlag();
      setFitprintGapQCompleteFromServer(true);
      setHealthSpanLockedNoFitprint(false);
      setHealthSpanGapBasicProAssessmentId(flowState.basicProAssessmentId);
      setHealthSpanScores(
        hasDisplayableHealthSpanScores(flowState.scores) ? flowState.scores : null,
      );
      setFitprintGapCheckDone(true);
      return;
    }

    if (flowState?.phase === HEALTH_SPAN_PHASE.LOCKED_SUBMITTED
      || flowState?.phase === HEALTH_SPAN_PHASE.LOCKED_QUESTIONNAIRE
      || flowState?.phase === HEALTH_SPAN_PHASE.HIDDEN_NO_FITPRINT
      || flowState?.phase === HEALTH_SPAN_PHASE.NO_BASIC_PRO) {
      clearFitprintGapQuestionnaireSubmittedFlag();
      setFitprintGapQCompleteFromServer(false);
      setHealthSpanLockedNoFitprint(false);
      setHealthSpanGapBasicProAssessmentId(flowState?.basicProAssessmentId ?? null);
      setHealthSpanScores(null);
      setFitprintGapCheckDone(true);
      return;
    }

    clearFitprintGapQuestionnaireSubmittedFlag();
    setFitprintGapQCompleteFromServer(false);
    setHealthSpanLockedNoFitprint(false);
    setHealthSpanGapBasicProAssessmentId(null);
    setHealthSpanScores((prev) => {
      if (hasDisplayableHealthSpanScores(prev)) {
        return prev;
      }
      if (hasDisplayableHealthSpanScores(preloadedData?.healthSpanScores)) {
        return preloadedData.healthSpanScores;
      }
      return null;
    });
    setFitprintGapCheckDone(true);
  }, [preloadedData?.healthSpanScores]);

  useEffect(() => {
    let cancelled = false;

    if (!showJourneyScreens || !isOverviewResolved) {
      setMetsightsCycleAssigned(false);
      return undefined;
    }

    (async () => {
      try {
        const ttlMs = forceRefreshFromProfile ? 0 : 45000;
        const rows = await peekMyAssessmentsRowsCached(ttlMs);
        if (cancelled) {
          return;
        }
        const resolved = resolveHealthSpanIndexSourcesFromRows(rows);
        const assigned = resolved.status !== 'no_basic_or_pro'
          && resolved.status !== 'invalid_basic_or_pro'
          && resolved.status !== 'fetch_error';
        setMetsightsCycleAssigned(assigned);
      } catch {
        if (!cancelled) {
          setMetsightsCycleAssigned(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showJourneyScreens, isOverviewResolved, forceRefreshFromProfile]);

  useLayoutEffect(() => {
    if (forceSlotPassedPreview) {
      setNoDataStage('slot_passed');
      return;
    }
    if (forceScheduledPreview) {
      setNoDataStage('camp_scheduled');
      return;
    }
    if (!showJourneyScreens || upcomingSlotStatus !== 'ready') {
      return;
    }
    if (!isB2bCampNoDataGateResolved) {
      return;
    }

    const scheduledSlotEnded = slotNorm.hasScheduledSlot && b2cSlotEnded;
    const slotStillUpcoming = slotNorm.hasScheduledSlot && !scheduledSlotEnded;

    // Upcoming slot (B2B or B2C): stay on scheduled even if questionnaire was filled early; hide CTA only.
    if (slotStillUpcoming && campFlowActive) {
      setNoDataStage('camp_scheduled');
      return;
    }

    // Blood collected + Metsights assigned, but /upcoming-slot no longer returns yesterday's slot.
    if (metsightsCycleAssigned && !slotNorm.hasScheduledSlot) {
      if (isQuestionnaireCompleted) {
        setNoDataStage('analyzing');
        return;
      }
      setNoDataStage('b2c_sample_collected');
      return;
    }

    if (!campFlowActive) {
      return;
    }

    const b2cFlowActive = slotNorm.isB2c || b2cSlotLapsedSession;
    if (b2cFlowActive) {
      if (b2cSlotEnded || b2cSlotLapsedSession) {
        if (isQuestionnaireCompleted) {
          setNoDataStage('analyzing');
          return;
        }
        setNoDataStage('b2c_sample_collected');
        return;
      }
    }

    // B2B: assigned collection window ended — prompt walk-in at Collection Cabin.
    if (scheduledSlotEnded && slotNorm.isB2b) {
      try {
        if (isQuestionnaireCompleted) {
          setNoDataStage('analyzing');
          return;
        }
        if (sessionStorage.getItem('ss_b2b_opened_questionnaire') === '1') {
          setNoDataStage('analyzing_questionnaire_pending');
          return;
        }
      } catch {
        // ignore
      }
      setNoDataStage('slot_passed');
      return;
    }

    try {
      if (isQuestionnaireCompleted) {
        setNoDataStage('analyzing');
        return;
      }
      if (sessionStorage.getItem('ss_b2b_opened_questionnaire') === '1') {
        setNoDataStage('analyzing_questionnaire_pending');
        return;
      }
    } catch {
      // ignore
    }
    setNoDataStage('camp_scheduled');
  }, [
    showJourneyScreens,
    upcomingSlotStatus,
    campFlowActive,
    isB2bCampNoDataGateResolved,
    isQuestionnaireCompleted,
    forceRefreshFromProfile,
    forceScheduledPreview,
    forceSlotPassedPreview,
    slotNorm.hasScheduledSlot,
    slotNorm.isB2c,
    slotNorm.isB2b,
    b2cSlotEnded,
    b2cSlotLapsedSession,
    metsightsCycleAssigned,
  ]);

  useEffect(() => {
    if (forceSlotPassedPreview || forceScheduledPreview) {
      return undefined;
    }

    if (!slotNorm.hasScheduledSlot) {
      if (!b2cSlotLapsedSession) {
        setB2cSlotEnded(false);
      }
      return undefined;
    }

    const refreshSlotEnded = () => {
      const ended = isScheduledSlotWindowEnded(slotNorm);
      setB2cSlotEnded(ended);
      if (ended && slotNorm.isB2c) {
        markB2cSlotLapsedInSession();
      }
    };

    refreshSlotEnded();

    const endAt = parseSlotBoundaryDate(slotNorm.engagementDateRaw, slotNorm.slotEnd);
    let timeoutId;
    if (endAt) {
      const msUntilLapsed = endAt.getTime() + B2C_SLOT_END_GRACE_MS - Date.now();
      if (msUntilLapsed > 0 && msUntilLapsed < 48 * 60 * 60 * 1000) {
        timeoutId = window.setTimeout(refreshSlotEnded, msUntilLapsed);
      }
    }

    const intervalId = window.setInterval(refreshSlotEnded, 60000);
    return () => {
      window.clearInterval(intervalId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [slotNorm, b2cSlotLapsedSession, forceSlotPassedPreview, forceScheduledPreview]);

  useEffect(() => {
    if (isQuestionnaireCompleted) {
      clearB2cSlotLapsedInSession();
    }
  }, [isQuestionnaireCompleted]);

  useEffect(() => {
    let cancelled = false;

    if (!showJourneyScreens) {
      setIsQuestionnaireCompleted(false);
      setIsB2bCampNoDataGateResolved(true);
      return undefined;
    }

    const needsQuestionnaireGate = campFlowActive || metsightsCycleAssigned;
    if (!needsQuestionnaireGate || upcomingSlotStatus !== 'ready') {
      setIsQuestionnaireCompleted(false);
      setIsB2bCampNoDataGateResolved(true);
      return undefined;
    }

    if (forceRefreshFromProfile) {
      invalidateNutritionLogQuestionnaireDraftCache();
      invalidateFamilyHistoryQuestionnaireDraftCache();
      invalidateHealthQuestionnaireSubmittedCache();
    }

    const campEngagementId = Number(slotNorm.engagementId || 0);
    const submittedCheckOptions = {
      forceRefresh: Boolean(forceRefreshFromProfile) || campEngagementId > 0,
      engagementId: campEngagementId > 0 ? campEngagementId : undefined,
    };

    // After questionnaire submit, parent sets `forceRefreshFromProfile` — do not use stale
    // peek caches; re-fetch so the camp home can switch to “questionnaire submitted”.
    const nutritionCached = forceRefreshFromProfile ? null : peekNutritionLogQuestionnaireDraftCache();
    const familyCached = forceRefreshFromProfile ? null : peekFamilyHistoryQuestionnaireDraftCache();
    if (nutritionCached !== null && familyCached !== null) {
      if (!cancelled) {
        setIsQuestionnaireCompleted(Boolean(nutritionCached || familyCached));
        setIsB2bCampNoDataGateResolved(true);
      }
      return undefined;
    }

    const submittedCached = submittedCheckOptions.forceRefresh
      ? null
      : peekHealthQuestionnaireSubmittedCache();
    if (submittedCached !== null && !cancelled) {
      setIsQuestionnaireSubmitted(Boolean(submittedCached));
    }

    setIsB2bCampNoDataGateResolved(false);

    (async () => {
      try {
        const fr = Boolean(forceRefreshFromProfile);
        const [hasNutritionDraft, hasFamilyDraft, hasSubmitted] = await Promise.all([
          hasNutritionLogQuestionnaireDraft({ forceRefresh: fr }),
          hasFamilyHistoryQuestionnaireDraft({ forceRefresh: fr }),
          hasSubmittedHealthQuestionnaire(submittedCheckOptions),
        ]);
        if (!cancelled) {
          setIsQuestionnaireCompleted(Boolean(hasNutritionDraft || hasFamilyDraft));
          setIsQuestionnaireSubmitted(Boolean(hasSubmitted));
        }
      } catch {
        if (!cancelled) {
          setIsQuestionnaireCompleted(false);
          setIsQuestionnaireSubmitted(false);
        }
      } finally {
        if (!cancelled) {
          setIsB2bCampNoDataGateResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showJourneyScreens,
    upcomingSlotStatus,
    campFlowActive,
    metsightsCycleAssigned,
    forceRefreshFromProfile,
    slotNorm.engagementId,
  ]);

  useEffect(() => {
    let cancelled = false;
    const fr = Boolean(forceRefreshFromProfile);
    const campEngagementId = Number(slotNorm.engagementId || 0);
    if (fr) {
      invalidateHealthQuestionnaireSubmittedCache();
    }
    const submittedCached = (fr || campEngagementId > 0)
      ? null
      : peekHealthQuestionnaireSubmittedCache();
    if (submittedCached !== null && !cancelled) {
      setIsQuestionnaireSubmitted(Boolean(submittedCached));
    }

    (async () => {
      try {
        const submitted = await hasSubmittedHealthQuestionnaire({
          forceRefresh: fr || campEngagementId > 0,
          engagementId: campEngagementId > 0 ? campEngagementId : undefined,
        });
        if (!cancelled) {
          setIsQuestionnaireSubmitted(Boolean(submitted));
        }
      } catch {
        if (!cancelled) {
          setIsQuestionnaireSubmitted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forceRefreshFromProfile, slotNorm.engagementId, upcomingSlotStatus]);

  useLayoutEffect(() => {
    if (!forceRefreshFromProfile) {
      return;
    }
    const campEngagementId = Number(slotNorm.engagementId || 0);
    if (peekHealthQuestionnaireSubmittedForEngagement(campEngagementId)) {
      setIsQuestionnaireSubmitted(true);
    }
  }, [forceRefreshFromProfile, slotNorm.engagementId]);

  // Warm nutrition-log draft check in parallel with the upcoming-slot request so the camp gate often hits cache.
  useEffect(() => {
    if (!isOverviewResolved || !isNoDataHome) {
      return undefined;
    }
    void hasNutritionLogQuestionnaireDraft().catch(() => {});
    void hasFamilyHistoryQuestionnaireDraft().catch(() => {});
    void hasSubmittedHealthQuestionnaire().catch(() => {});
    return undefined;
  }, [isOverviewResolved, isNoDataHome, forceRefreshFromProfile]);

  useLayoutEffect(() => {
    if (preloadedData?.fitprintGapLockPreloaded !== true || forceRefreshFromProfile) {
      return;
    }
    setHealthSpanLockedNoFitprint(false);
    setHealthSpanGapBasicProAssessmentId(preloadedData.healthSpanGapBasicProAssessmentId ?? null);
    setHealthSpanGapEngagementId(preloadedData.healthSpanGapEngagementId ?? null);
    setHealthSpanPhase(preloadedData.healthSpanPhase ?? null);
    setFitprintGapQCompleteFromServer(preloadedData.healthSpanPhase === HEALTH_SPAN_PHASE.SHOW_SCORES);
    setHealthSpanScores(
      hasDisplayableHealthSpanScores(preloadedData.healthSpanScores) ? preloadedData.healthSpanScores : null,
    );
  }, [
    forceRefreshFromProfile,
    preloadedData?.fitprintGapLockPreloaded,
    preloadedData?.healthSpanLockedNoFitprint,
    preloadedData?.healthSpanGapBasicProAssessmentId,
    preloadedData?.healthSpanGapEngagementId,
    preloadedData?.healthSpanPhase,
    preloadedData?.fitprintGapQCompleteFromServer,
    preloadedData?.healthSpanScores,
  ]);

  useEffect(() => {
    if (preloadedData?.fitprintGapLockPreloaded && !forceRefreshFromProfile) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const ttlMs = forceRefreshFromProfile ? 0 : 45000;
      const flowState = await loadFitprintHealthSpanIndexState({
        ttlMs,
        assignFitprintIfMissing: false,
      });
      if (cancelled) {
        return;
      }
      applyFitprintHealthSpanState(flowState);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyFitprintHealthSpanState,
    forceRefreshFromProfile,
    preloadedData?.fitprintGapLockPreloaded,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!hasStableOverviewData || isNoDataHome || !isOverviewResolved) {
      setShowReassessmentBanner(false);
      setShowReassessmentUpdateCta(false);
      return undefined;
    }

    (async () => {
      const ttlMs = forceRefreshFromProfile ? 0 : 45000;
      const state = await loadReassessmentBannerState({
        ttlMs,
        reportAssessmentId: overviewAnchorAssessmentId,
        reportEngagementId: overviewAnchorEngagementId,
        isB2b: slotNorm.isB2b,
      });
      if (!cancelled) {
        setShowReassessmentBanner(Boolean(state.shouldShow));
        setShowReassessmentUpdateCta(Boolean(state.showUpdateCta));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasStableOverviewData,
    isNoDataHome,
    isOverviewResolved,
    forceRefreshFromProfile,
    overviewAnchorAssessmentId,
    overviewAnchorEngagementId,
    slotNorm.isB2b,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!slotNorm.isB2b) {
      setB2bHasIncompleteNonVitals(false);
      return undefined;
    }

    (async () => {
      let assessmentId = 0;
      try {
        assessmentId = Number(await getLatestMetsightsBasicOrProAssessmentIdCached(
          forceRefreshFromProfile ? 0 : 45000,
        ));
      } catch {
        assessmentId = 0;
      }
      if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
        if (!cancelled) {
          setB2bHasIncompleteNonVitals(false);
        }
        return;
      }
      const hasIncomplete = await hasIncompleteNonVitalsQuestionnaireSection(assessmentId);
      if (!cancelled) {
        setB2bHasIncompleteNonVitals(Boolean(hasIncomplete));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    slotNorm.isB2b,
    forceRefreshFromProfile,
  ]);

  const metabolicAgeDetail = useMemo(() => {
    const chronologicalAge = Number(userAge);
    const metabolicAge = Number(metabolicAgeValue);

    if (!Number.isFinite(chronologicalAge) || chronologicalAge <= 0 || !Number.isFinite(metabolicAge)) {
      return '-';
    }

    const delta = Math.round(metabolicAge - chronologicalAge);
    if (delta > 0) {
      return `${delta} year${delta === 1 ? '' : 's'} older`;
    }

    if (delta < 0) {
      const yearsYounger = Math.abs(delta);
      return `${yearsYounger} year${yearsYounger === 1 ? '' : 's'} younger`;
    }

    return 'Same as your age';
  }, [metabolicAgeValue, userAge]);

  /** MetabolicAgeOrb: delta + currentAge when both known; else absoluteMetabolicAge + detail; else demo defaults. */
  const metabolicOrbProps = useMemo(() => {
    const metabolic = Number(metabolicAgeValue);
    const chrono = Number(userAge);

    if (Number.isFinite(metabolic) && Number.isFinite(chrono) && chrono > 0) {
      return {
        value: String(Math.round(metabolic - chrono)),
        currentAge: chrono,
        label: 'Bio Age',
        detail: metabolicAgeDetail,
        absoluteMetabolicAge: undefined,
      };
    }

    if (Number.isFinite(metabolic)) {
      return {
        value: '0',
        currentAge: undefined,
        label: 'Bio Age',
        detail: metabolicAgeDetail,
        absoluteMetabolicAge: metabolic,
      };
    }

    return {
      value: '-',
      currentAge: undefined,
      label: 'Bio Age',
      detail: '-',
      absoluteMetabolicAge: undefined,
    };
  }, [metabolicAgeValue, userAge, metabolicAgeDetail]);

  const applyPreloadedSnapshot = useCallback((data) => {
    if (!data?.[HOME_PRELOAD_COMPLETE_KEY]) {
      return;
    }

    setMetabolicAgeValue(data.metabolicAgeValue || '-');
    setPositiveWinsData(data.positiveWinsData || null);
    setRiskAnalysisData(Array.isArray(data.riskAnalysisData) ? data.riskAnalysisData : []);

    if (data.fitprintGapLockPreloaded) {
      setHealthSpanLockedNoFitprint(false);
      setHealthSpanGapBasicProAssessmentId(data.healthSpanGapBasicProAssessmentId ?? null);
      setHealthSpanGapEngagementId(data.healthSpanGapEngagementId ?? null);
      setHealthSpanPhase(data.healthSpanPhase ?? null);
      setFitprintGapQCompleteFromServer(data.healthSpanPhase === HEALTH_SPAN_PHASE.SHOW_SCORES);
      setHealthSpanScores(
        hasDisplayableHealthSpanScores(data.healthSpanScores) ? data.healthSpanScores : null,
      );
      setFitprintGapCheckDone(resolveFitprintGapCheckDoneFromPreload(data));
    } else {
      setHealthSpanScores(
        hasDisplayableHealthSpanScores(data.healthSpanScores) ? data.healthSpanScores : null,
      );
      setFitprintGapCheckDone(false);
    }

    if (data.anchorAssessmentId) {
      setOverviewAnchorAssessmentId(data.anchorAssessmentId);
    }
    if (data.anchorEngagementId) {
      setOverviewAnchorEngagementId(data.anchorEngagementId);
    }

    const renderable = hasRenderableOverviewData(data);
    setHasStableOverviewData(renderable);
    setIsNoDataHome(!renderable);
    setIsOverviewResolved(true);
    setNoDataStage('welcome');
  }, []);

  useEffect(() => {
    if (forceScheduledPreview || forceSlotPassedPreview) {
      return;
    }
    if (!homePreloadComplete || forceRefreshFromProfile) {
      return;
    }
    applyPreloadedSnapshot(preloadedData);
  }, [
    preloadedData,
    homePreloadComplete,
    forceRefreshFromProfile,
    applyPreloadedSnapshot,
    forceScheduledPreview,
    forceSlotPassedPreview,
  ]);

  useLayoutEffect(() => {
    let isActive = true;

    if (forceScheduledPreview || forceSlotPassedPreview) {
      setIsNoDataHome(true);
      setIsOverviewResolved(true);
      setNoDataStage(forceSlotPassedPreview ? 'slot_passed' : 'camp_scheduled');
      return () => {
        isActive = false;
      };
    }

    if (homePreloadComplete && !forceRefreshFromProfile) {
      applyPreloadedSnapshot(preloadedData);
      return () => {
        isActive = false;
      };
    }

    const parseOverviewResponse = (response) => {
      const overview = resolveOverviewPayload(response);
      if (!overview || typeof overview !== 'object') {
        return null;
      }

      const hasOverviewFields = Object.prototype.hasOwnProperty.call(overview, 'metabolic_age')
        || Object.prototype.hasOwnProperty.call(overview, 'positive_wins')
        || Object.prototype.hasOwnProperty.call(overview, 'risk_analysis')
        || Object.prototype.hasOwnProperty.call(overview, 'healthy_habits')
        || Object.prototype.hasOwnProperty.call(overview, 'healthy_profiles')
        || Object.prototype.hasOwnProperty.call(overview, 'low_risk');

      if (!hasOverviewFields) {
        return null;
      }

      const metabolicAge = Number(overview?.metabolic_age);
      const metabolicAgeDisplay = Number.isFinite(metabolicAge) ? String(Math.round(metabolicAge)) : '-';
      return {
        metabolicAgeValue: metabolicAgeDisplay,
        positiveWinsData: resolvePositiveWinsPayload(overview),
        riskAnalysisData: Array.isArray(overview?.risk_analysis) ? overview.risk_analysis : [],
      };
    };

    const startBloodMarkersFetch = (ttlMs) => (
      fetchLatestAssessmentReport(
        (assessmentId) => `/reports/${assessmentId}/blood-parameters`,
        ttlMs,
      )
        .then(({ assessmentId, response }) => buildHomeBloodMarkersFromBloodParametersResponse(response, assessmentId))
        .catch(() => [])
    );

    const fetchOverviewParsed = async (ttlMs) => {
      try {
        const { assessmentId, response } = await fetchLatestAssessmentReport(
          (assessmentId) => `/reports/${assessmentId}/overview`,
          ttlMs,
        );
        const parsed = parseOverviewResponse(response);
        if (!parsed) {
          return null;
        }
        return { ...parsed, anchorAssessmentId: Number(assessmentId) > 0 ? Number(assessmentId) : null };
      } catch {
        return null;
      }
    };

    const loadOverviewData = async () => {
      const paintFromCache = hasStableOverviewData && !forceRefreshFromProfile;

      if (paintFromCache) {
        setIsOverviewResolved(true);
        try {
          const bloodPromise = startBloodMarkersFetch(45000);
          let parsed = await fetchOverviewParsed(45000);
          if (!parsed) {
            parsed = await fetchOverviewParsed(0);
          }
          if (!isActive) {
            return;
          }
          if (!parsed) {
            setHomeBloodMarkersForSection([]);
            return;
          }
          setMetabolicAgeValue(parsed.metabolicAgeValue);
          setPositiveWinsData(parsed.positiveWinsData);
          setRiskAnalysisData(parsed.riskAnalysisData);
          setIsNoDataHome(false);
          setHasStableOverviewData(true);
          setNoDataStage('welcome');
          if (parsed.anchorAssessmentId) {
            setOverviewAnchorAssessmentId(parsed.anchorAssessmentId);
            void peekMyAssessmentsRowsCached(45000).then((rows) => {
              if (!isActive) {
                return;
              }
              const engagementId = resolveEngagementIdFromAssessmentId(rows, parsed.anchorAssessmentId);
              if (engagementId) {
                setOverviewAnchorEngagementId(engagementId);
              }
            }).catch(() => {});
          }
          void bloodPromise.then((markers) => {
            if (isActive) {
              setHomeBloodMarkersForSection(markers);
            }
          });
        } catch {
          /* keep showing preloaded / last-good overview */
        }
        return;
      }

      try {
        const primaryTtl = forceRefreshFromProfile ? 0 : 45000;
        const bloodPromise = startBloodMarkersFetch(primaryTtl);

        let parsed = await fetchOverviewParsed(primaryTtl);
        if (!parsed) {
          parsed = await fetchOverviewParsed(0);
        }

        let committedB2c = false;
        if (isActive) {
          if (parsed) {
            committedB2c = true;
            setMetabolicAgeValue(parsed.metabolicAgeValue);
            setPositiveWinsData(parsed.positiveWinsData);
            setRiskAnalysisData(parsed.riskAnalysisData);
            setIsNoDataHome(false);
            setHasStableOverviewData(true);
            setNoDataStage('welcome');
            if (parsed.anchorAssessmentId) {
              setOverviewAnchorAssessmentId(parsed.anchorAssessmentId);
              void peekMyAssessmentsRowsCached(primaryTtl).then((rows) => {
                if (!isActive) {
                  return;
                }
                const engagementId = resolveEngagementIdFromAssessmentId(rows, parsed.anchorAssessmentId);
                if (engagementId) {
                  setOverviewAnchorEngagementId(engagementId);
                }
              }).catch(() => {});
            }
          } else if (!hasStableOverviewData) {
            setMetabolicAgeValue('-');
            setPositiveWinsData(null);
            setRiskAnalysisData([]);
            setHomeBloodMarkersForSection([]);
            setIsNoDataHome(true);
            setNoDataStage('welcome');
          }
          setIsOverviewResolved(true);
        }

        void bloodPromise.then((markers) => {
          if (isActive && committedB2c) {
            setHomeBloodMarkersForSection(markers);
          }
        });
      } catch {
        if (isActive) {
          if (!hasStableOverviewData) {
            setMetabolicAgeValue('-');
            setPositiveWinsData(null);
            setRiskAnalysisData([]);
            setHomeBloodMarkersForSection([]);
            setIsNoDataHome(true);
            setNoDataStage('welcome');
          }
          setIsOverviewResolved(true);
        }
      }
    };

    loadOverviewData();

    return () => {
      isActive = false;
    };
  }, [
    forceRefreshFromProfile,
    forceScheduledPreview,
    forceSlotPassedPreview,
    hasStableOverviewData,
    homePreloadComplete,
    preloadedData,
    applyPreloadedSnapshot,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (forceSlotPassedPreview) {
      setUpcomingSlotNormalized(PREVIEW_SLOT_PASSED_SLOT);
      setUpcomingSlotStatus('ready');
      setB2cSlotEnded(true);
      setIsNoDataHome(true);
      setNoDataStage('slot_passed');
      return undefined;
    }

    if (forceScheduledPreview) {
      setUpcomingSlotNormalized(PREVIEW_B2C_SCHEDULED_SLOT);
      setUpcomingSlotStatus('ready');
      setB2cSlotEnded(false);
      setIsNoDataHome(true);
      setNoDataStage('camp_scheduled');
      return undefined;
    }

    if (!isOverviewResolved) {
      return undefined;
    }

    setUpcomingSlotStatus('loading');
    setUpcomingSlotNormalized(null);

    (async () => {
      try {
        const data = await getMyUpcomingSlot();
        if (cancelled) {
          return;
        }
        setUpcomingSlotNormalized(normalizeUpcomingSlotPayload(data));
      } catch {
        if (cancelled) {
          return;
        }
        setUpcomingSlotNormalized({ ...EMPTY_UPCOMING_SLOT });
      } finally {
        if (!cancelled) {
          setUpcomingSlotStatus('ready');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOverviewResolved, isNoDataHome, forceRefreshFromProfile, forceScheduledPreview, forceSlotPassedPreview]);

  // New upcoming slot = new camp cycle; don't reuse stale questionnaire submitted/draft caches.
  useEffect(() => {
    if (upcomingSlotStatus !== 'ready' || !slotNorm.hasScheduledSlot) {
      return undefined;
    }

    invalidateHealthQuestionnaireSubmittedCache();
    invalidateNutritionLogQuestionnaireDraftCache();
    invalidateFamilyHistoryQuestionnaireDraftCache();
    clearLegacyHealthQuestionnaireSubmittedMarker();

    let cancelled = false;
    const campEngagementId = Number(slotNorm.engagementId || 0);
    if (peekHealthQuestionnaireSubmittedForEngagement(campEngagementId)) {
      setIsQuestionnaireSubmitted(true);
    }
    (async () => {
      try {
        const submitted = await hasSubmittedHealthQuestionnaire({
          forceRefresh: true,
          engagementId: campEngagementId > 0 ? campEngagementId : undefined,
        });
        if (!cancelled) {
          setIsQuestionnaireSubmitted(Boolean(submitted));
        }
      } catch {
        if (!cancelled) {
          setIsQuestionnaireSubmitted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    upcomingSlotStatus,
    slotNorm.hasScheduledSlot,
    slotNorm.engagementDateRaw,
    slotNorm.slotStart,
    slotNorm.engagementId,
    slotNorm.slotEnd,
    forceRefreshFromProfile,
  ]);

  const openReturningUserJourneyView = () => {
    setIsReturningUserJourneyView(true);
  };

  const handleBackFromReturningJourney = () => {
    setIsReturningUserJourneyView(false);
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
    if (onNavigateToProfile) {
      onNavigateToProfile();
    }
  };

  const handleNavigate = (itemId) => {
    console.log('Navigating to:', itemId);
    setIsDownloadMenuOpen(false);
    if (itemId !== 'home' && isReturningUserJourneyView) {
      setIsReturningUserJourneyView(false);
    }
    if (itemId === 'packages' && onNavigateToPackages) {
      onNavigateToPackages();
      return;
    }

    if (itemId === 'super-sync' && onNavigateToDoctors) {
      onNavigateToDoctors();
      return;
    }

    if (itemId === 'super-club' && onNavigateToSuperClub) {
      onNavigateToSuperClub();
      return;
    }

    if (itemId === 'home') {
      return;
    }
  };

  if (!isOverviewResolved) {
    return (
      <div className="home-page home-page--slot-loading" aria-busy="true" aria-label="Loading home">
        <NavBar defaultActive="home" onNavigate={handleNavigate} />
      </div>
    );
  }

  const handleHealthScanSeeMore = () => {
    if (onNavigateToHealthScan) {
      onNavigateToHealthScan();
    }
  };

  const handleDownloadMenuToggle = () => {
    setIsDownloadMenuOpen((prev) => !prev);
  };

  const handleCloseDownloadMenu = () => {
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadBioAiReport = async () => {
    if (downloadingReportKind !== null) {
      return;
    }

    setDownloadingReportKind('bio-ai');

    try {
      const assessmentId = await getLatestMetsightsBasicOrProAssessmentIdCached();
      if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
        throw new Error('No Metsights Basic or Pro report available yet.');
      }

      const fixedBioAiPdfUrl = getFixedBioAiReportPdfUrl(assessmentId);
      if (fixedBioAiPdfUrl) {
        const link = document.createElement('a');
        link.href = fixedBioAiPdfUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setIsDownloadMenuOpen(false);
        return;
      }

      if (!BACKEND_ENABLED) {
        throw new Error('Backend base URL is not configured.');
      }

      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error('You are not logged in.');
      }

      const response = await fetch(`${BACKEND_BASE_URL}/reports/${assessmentId}/bio-ai/pdf`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(body?.message || body?.detail || 'Failed to download report.');
      }

      const reportUrl = body?.data?.report_url || body?.report_url;
      if (!reportUrl || typeof reportUrl !== 'string') {
        throw new Error('Report URL is missing from API response.');
      }

      const link = document.createElement('a');
      link.href = reportUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setIsDownloadMenuOpen(false);
    } catch (error) {
      console.error('Failed to download Bio-AI report PDF:', error);
      window.alert(error?.message || 'Failed to download report. Please try again.');
    } finally {
      setDownloadingReportKind(null);
    }
  };

  const handleDownloadBloodReport = async () => {
    if (downloadingReportKind !== null) {
      return;
    }

    setDownloadingReportKind('blood');

    try {
      const assessmentId = await getLatestMetsightsBasicOrProAssessmentIdCached();
      if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
        throw new Error('No Metsights Basic or Pro report available yet.');
      }

      const fixedBloodPdfUrl = getFixedBloodReportPdfUrl(assessmentId);
      if (fixedBloodPdfUrl) {
        const link = document.createElement('a');
        link.href = fixedBloodPdfUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setIsDownloadMenuOpen(false);
        return;
      }

      const accessToken = getAccessToken();
      if (!accessToken) {
        throw new Error('You are not logged in.');
      }

      if (!BACKEND_ENABLED) {
        throw new Error('Backend base URL is not configured.');
      }

      const response = await fetch(`${BACKEND_BASE_URL}/reports/${assessmentId}/blood-parameters/pdf`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(body?.message || body?.detail || 'Failed to download report.');
      }

      const reportUrl = body?.data?.report_url || body?.report_url;
      if (!reportUrl || typeof reportUrl !== 'string') {
        throw new Error('Report URL is missing from API response.');
      }

      const link = document.createElement('a');
      link.href = reportUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setIsDownloadMenuOpen(false);
    } catch (error) {
      console.error('Failed to download Blood Parameters report PDF:', error);
      window.alert(error?.message || 'Failed to download report. Please try again.');
    } finally {
      setDownloadingReportKind(null);
    }
  };

  const handleHealthScanCircleClick = (item) => {
    const tabByLabel = {
      'Fitness score': 0,
      'Nutrition score': 1,
      'Lifestyle score': 2,
    };

    const tabIndex = tabByLabel[item?.label] ?? 0;

    if (onNavigateToHealthScanTab) {
      onNavigateToHealthScanTab(tabIndex);
      return;
    }

    if (onNavigateToHealthScan) {
      onNavigateToHealthScan();
    }
  };

  const handleRiskAnalysisSeeMore = () => {
    if (onNavigateToRiskAnalysis) {
      onNavigateToRiskAnalysis();
    }
  };

  const handleBloodMarkersSeeMore = () => {
    if (onNavigateToBloodMarkers) {
      onNavigateToBloodMarkers();
    }
  };

  const handleHomeBloodMarkerCardSelect = (markerRow) => {
    if (onNavigateToBloodMarkerDetail) {
      onNavigateToBloodMarkerDetail(markerRow);
    }
  };

  const handleBioMarkersClick = () => {
    if (onNavigateToPackages) {
      onNavigateToPackages();
    }
  };

  const healthSpanIndexSection = showHealthSpanScores ? (
    <HealthParametersSection
      data={[
        { percentage: healthSpanScores?.fitnessScore ?? null, label: 'Fitness score' },
        { percentage: healthSpanScores?.nutritionScore ?? null, label: 'Nutrition score' },
        { percentage: healthSpanScores?.lifestyleScore ?? null, label: 'Lifestyle score' },
      ]}
      onSeeMore={handleHealthScanSeeMore}
      onCardClick={handleHealthScanCircleClick}
    />
  ) : null;

  if (showJourneyScreens) {
    // Always wait for upcoming-slot resolution before choosing a no-data sub-screen.
    // This removes transient flashes (e.g. generic welcome) before final state is known.
    if (upcomingSlotStatus !== 'ready') {
      return (
        <div className="home-page home-page--slot-loading" aria-busy="true" aria-label="Loading schedule">
          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    // Camp flow: wait for nutrition-log draft check before picking analyzing vs scheduled (avoids UI jumping).
    if (campFlowActive && !isB2bCampNoDataGateResolved) {
      return (
        <div className="home-page home-page--slot-loading" aria-busy="true" aria-label="Loading health assessment status">
          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    if (noDataStage === 'welcome') {
      return (
        <div className="home-page home-page--no-data">
          <header className="home-page-no-data__topbar">
            <button
              className="home-page-no-data__icon-btn"
              type="button"
              onClick={isReturningUserJourneyView ? handleBackFromReturningJourney : handleMenuClick}
              aria-label={isReturningUserJourneyView ? 'Go back' : 'Menu'}
            >
              {isReturningUserJourneyView ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M24.5 14C24.5033 16.0846 23.8833 18.1225 22.7197 19.852C21.76 21.2835 20.4623 22.4565 18.9415 23.2672C17.4206 24.0779 15.7234 24.5013 14 24.5C12.2766 24.5013 10.5794 24.0779 9.05852 23.2672C7.53766 22.4565 6.24001 21.2835 5.28033 19.852C4.36652 18.4898 3.78455 16.9325 3.58109 15.3049C3.37763 13.6772 3.55833 12.0246 4.10871 10.4793C4.65908 8.93412 5.56383 7.53935 6.75041 6.40682C7.937 5.27429 9.37241 4.43552 10.9416 3.95774C12.5108 3.47995 14.1701 3.37645 15.7865 3.65553C17.4028 3.93461 18.9314 4.5885 20.2495 5.5648C21.5676 6.54109 22.6387 7.81262 23.3768 9.27746C24.1149 10.7423 24.4996 12.3597 24.5 14Z" stroke="white" strokeWidth="1.75" />
                  <path d="M15.4574 10.4998C15.4574 11.3048 14.8041 11.9582 13.9991 11.9582V13.7082C14.85 13.7082 15.6661 13.3702 16.2677 12.7685C16.8694 12.1668 17.2074 11.3507 17.2074 10.4998H15.4574ZM13.9991 11.9582C13.1941 11.9582 12.5408 11.3048 12.5408 10.4998H10.7908C10.7908 11.3507 11.1288 12.1668 11.7305 12.7685C12.3322 13.3702 13.1482 13.7082 13.9991 13.7082V11.9582ZM12.5408 10.4998C12.5408 9.69484 13.1941 9.0415 13.9991 9.0415V7.2915C13.1482 7.2915 12.3322 7.62952 11.7305 8.2312C11.1288 8.83288 10.7908 9.64893 10.7908 10.4998H12.5408ZM13.9991 9.0415C14.8041 9.0415 15.4574 9.69484 15.4574 10.4998H17.2074C17.2074 9.64893 16.8694 8.83288 16.2677 8.2312C15.6661 7.62952 14.85 7.2915 13.9991 7.2915V9.0415ZM6.02611 20.8318L5.18728 20.5822L5.05078 21.0395L5.36228 21.4012L6.02611 20.8318ZM21.9721 20.8318L22.6371 21.4023L22.9474 21.0407L22.8109 20.5822L21.9721 20.8318ZM10.4991 18.3748H17.4991V16.6248H10.4991V18.3748ZM10.4991 16.6248C9.30564 16.6245 8.14395 17.0095 7.18687 17.7225C6.2298 18.4356 5.52849 19.4385 5.18728 20.5822L6.86495 21.0815C7.09857 20.2992 7.57845 19.6132 8.23323 19.1256C8.888 18.6379 9.68269 18.3746 10.4991 18.3748V16.6248ZM13.9991 23.6248C12.6101 23.6264 11.2373 23.3266 9.97538 22.7461C8.71348 22.1657 7.59255 21.3183 6.68995 20.2625L5.36228 21.4012C6.42915 22.6483 7.75376 23.6504 9.24482 24.3363C10.7359 25.0221 12.3579 25.3764 13.9991 25.3748V23.6248ZM17.4991 18.3748C19.2141 18.3748 20.6666 19.5158 21.1333 21.0815L22.8109 20.5822C22.4697 19.4385 21.7684 18.4356 20.8114 17.7225C19.8543 17.0095 18.6926 16.6245 17.4991 16.6248V18.3748ZM21.3083 20.2625C20.4057 21.3183 19.2847 22.1657 18.0228 22.7461C16.761 23.3266 15.3881 23.6264 13.9991 23.6248V25.3748C15.6403 25.3764 17.2624 25.0221 18.7534 24.3363C20.2445 23.6504 21.5702 22.6495 22.6371 21.4023L21.3083 20.2625Z" fill="white" />
                </svg>
              )}
            </button>
            <span className="home-page-no-data__topbar-spacer" aria-hidden="true" />
          </header>

          <section className="home-page-no-data__top-section">
            <div className="home-page-no-data__avatar-circle">
              <AvatarGlyph />
            </div>
            <h1 className="home-page-no-data__hello">Hello {userName}!</h1>
          </section>

          <section className="home-page-no-data__welcome-box">
            <div className="home-page-no-data__welcome-copy">
              <h2 className="home-page-no-data__welcome-title">Welcome to Supershyft</h2>
              <p className="home-page-no-data__welcome-subtitle">Your personalized health playbook begins with a simple Bio-AI test.</p>
            </div>

            <button type="button" className="home-page-no-data__bio-btn" onClick={handleBioMarkersClick}>
              Check your Bio-markers Now
            </button>
          </section>

          <div className="home-page-no-data__benefits-row">
            <div className="home-page-no-data__benefit-box">
              <PreventiveCareIcon />
              <span>Preventive Care</span>
            </div>
            <div className="home-page-no-data__benefit-box">
              <CostEffectiveIcon />
              <span>Cost Effective</span>
            </div>
            <div className="home-page-no-data__benefit-box">
              <DataPrivacyIcon />
              <span>Data Privacy</span>
            </div>
          </div>

          {healthSpanIndexSection}

          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    if (noDataStage === 'b2c_sample_collected') {
      return (
        <div className="home-page home-page--no-data-analyzing home-page--b2c-sample-collected">
          <Header
            name={userName}
            onMenuClick={handleMenuClick}
            leadingMode={isReturningUserJourneyView ? 'back' : 'profile'}
            onBackClick={handleBackFromReturningJourney}
          />

          <section className="home-page-analyzing__hero">
            <div className="home-page-scheduled__clock-wrap" aria-hidden="true">
              <span className="home-page-scheduled__clock-glow" />
              <AnalysisHourglassIcon />
            </div>
            <div className="home-page-analyzing__copy">
              <h2>Sample Collected</h2>
              <p className="home-page-analyzing__subtitle">
                Your sample has been collected. Complete your health assessment while we prepare your report.
              </p>
            </div>
          </section>

          <div className="home-page-analyzing__card home-page-analyzing__card--status-wrap">
            <StatusTimelineCard steps={b2cSampleCollectedTimeline} />
          </div>

          {showHealthQuestionnaireCta ? (
            <div className="home-page-b2b__cta-wrap">
              <button type="button" className="home-page-b2b__cta" onClick={openB2bQuestionnaire}>
                Complete your Health Assessment
              </button>
            </div>
          ) : null}

          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    if (noDataStage === 'analyzing' || noDataStage === 'analyzing_questionnaire_pending') {
      const timelineItems = noDataStage === 'analyzing_questionnaire_pending'
        ? analyzingQuestionnairePendingTimeline
        : analyzingTimelineItems;
      const showQuestionnaireCta = noDataStage === 'analyzing_questionnaire_pending'
        && showHealthQuestionnaireCta;

      return (
        <div className="home-page home-page--no-data-analyzing">
          <Header
            name={userName}
            onMenuClick={handleMenuClick}
            leadingMode={isReturningUserJourneyView ? 'back' : 'profile'}
            onBackClick={handleBackFromReturningJourney}
          />

          <section className="home-page-analyzing__hero">
            <div className="home-page-scheduled__clock-wrap" aria-hidden="true">
              <span className="home-page-scheduled__clock-glow" />
              <AnalysisHourglassIcon />
            </div>
            <div className="home-page-analyzing__copy">
              <h2>Analyzing your Bio-Markers</h2>
              <p className="home-page-analyzing__subtitle">
                We&rsquo;re preparing your Health Playbook. Report ready in 48-72 hours.
              </p>
            </div>
          </section>

          <div className="home-page-analyzing__card home-page-analyzing__card--status-wrap">
            <StatusTimelineCard steps={timelineItems} />
          </div>

          <div className="home-page-analyzing__card home-page-analyzing__card--status-wrap">
            <WhatHappensNextCard />
          </div>

          {showQuestionnaireCta ? (
            <div className="home-page-b2b__cta-wrap">
              <button type="button" className="home-page-b2b__cta" onClick={openB2bQuestionnaire}>
                Complete your Health Assessment
              </button>
            </div>
          ) : null}

          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    if (noDataStage === 'camp_scheduled') {
      const isB2cScheduled = slotNorm.isB2c;
      const slotWindowTitle = isB2cScheduled
        ? formatB2cTestingWindowTitle(slotNorm)
        : [formatSlotTimeLabel(slotNorm.slotStart), formatSlotTimeLabel(slotNorm.slotEnd)]
          .filter(Boolean)
          .join(' – ') || '—';
      const engagementDateParts = formatEngagementDateParts(
        slotNorm.engagementDateRaw,
        slotNorm.engagementDayLabel,
      );
      const slotLocationLines = formatSlotLocationLines(slotNorm);
      const showSlotLocation = Boolean(slotLocationLines.primary);
      const showCampQuestionnaireCta = showHealthQuestionnaireCta;
      const campHeroTitle = slotNorm.isB2b ? 'Your Health Camp is Scheduled' : 'Your Test is Scheduled';
      const locationRow = showSlotLocation
        ? {
          id: 'location',
          icon: 'location',
          title: slotLocationLines.primary,
          sub: slotLocationLines.secondary,
        }
        : null;
      const slotCardRows = (isB2cScheduled
        ? [
          { id: 'window', icon: 'time', title: slotWindowTitle, sub: 'Collection Window' },
          locationRow,
        ]
        : [
          { id: 'window', icon: 'time', title: slotWindowTitle, sub: 'Testing Window' },
          {
            id: 'engagement-date',
            icon: 'calendar',
            title: engagementDateParts.primary,
            sub: engagementDateParts.secondary,
          },
          locationRow,
        ]).filter(Boolean);

      return (
        <div
          className={`home-page home-page--no-data-scheduled${
            slotNorm.isB2b ? ' home-page--b2b-camp' : ' home-page--b2c-scheduled'
          }${showCampQuestionnaireCta ? ' home-page--camp-scheduled-cta' : ''}`}
        >
          <Header
            name={userName}
            onMenuClick={handleMenuClick}
            leadingMode={isReturningUserJourneyView ? 'back' : 'profile'}
            onBackClick={handleBackFromReturningJourney}
          />

          <section className="home-page-scheduled__hero">
            <div className="home-page-scheduled__hero-inner">
              <div
                className="home-page-scheduled__clock-wrap home-page-scheduled__clock-wrap--camp-hero"
                aria-hidden="true"
              >
                <span className="home-page-scheduled__clock-glow" />
                <div className="home-page-scheduled__clock-stack">
                  <img
                    src={clockCircleSrc}
                    alt=""
                    className="home-page-scheduled__clock-circle"
                    width={105}
                    height={105}
                    decoding="async"
                  />
                  <img
                    src={clockHandsSrc}
                    alt=""
                    className="home-page-scheduled__clock-hands"
                    width={34}
                    height={46}
                    decoding="async"
                  />
                </div>
              </div>
              <div className="home-page-scheduled__hero-copy">
                <h2>{campHeroTitle}</h2>
                {slotNorm.isB2b && organizerDisplayName ? (
                  <div className="home-page-b2b__organizer-pill">
                    <p className="home-page-b2b__organizer">Organized for {organizerDisplayName}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="home-page-scheduled__card home-page-scheduled__card--home-collection-wrap">
            <SlotDetailsCard
              title={isB2cScheduled ? 'Home Collection' : 'Your Assigned Slot'}
              pill={slotNorm.isB2b ? 'Arrive 10 mins early' : null}
              rows={slotCardRows}
              statusText={isB2cScheduled ? 'Your Health Companion is on the way' : null}
            />
          </div>

          <PrepStepsDeck />

          {showCampQuestionnaireCta ? (
            <div className="home-page-b2b__cta-wrap home-page-b2b__cta-wrap--camp">
              <button type="button" className="home-page-b2b__cta" onClick={openB2bQuestionnaire}>
                Complete your Health Assessment
              </button>
            </div>
          ) : null}

          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    if (noDataStage === 'slot_passed') {
      const slotLocationLines = formatSlotLocationLines(slotNorm);
      const cabinTitle = slotLocationLines.primary || 'Collection Cabin';
      const cabinSub = slotLocationLines.secondary || '';
      const showCampQuestionnaireCta = showHealthQuestionnaireCta;

      return (
        <div
          className={`home-page home-page--no-data-scheduled home-page--b2b-camp home-page--slot-passed${
            showCampQuestionnaireCta ? ' home-page--camp-scheduled-cta' : ''
          }`}
        >
          <Header
            name={userName}
            onMenuClick={handleMenuClick}
            leadingMode={isReturningUserJourneyView ? 'back' : 'profile'}
            onBackClick={handleBackFromReturningJourney}
          />

          <section className="home-page-scheduled__hero">
            <div className="home-page-scheduled__hero-inner">
              <div
                className="home-page-scheduled__clock-wrap home-page-scheduled__clock-wrap--camp-hero home-page-scheduled__clock-wrap--passed"
                aria-hidden="true"
              >
                <span className="home-page-scheduled__clock-glow home-page-scheduled__clock-glow--passed" />
                <div className="home-page-scheduled__clock-stack">
                  <img
                    src={clockCircleSrc}
                    alt=""
                    className="home-page-scheduled__clock-circle"
                    width={105}
                    height={105}
                    decoding="async"
                  />
                  <img
                    src={clockHandsSrc}
                    alt=""
                    className="home-page-scheduled__clock-hands"
                    width={34}
                    height={46}
                    decoding="async"
                  />
                </div>
                <span className="home-page-scheduled__warning-badge">
                  <img src={slotPassedWarningSrc} alt="" width={26} height={24} decoding="async" />
                </span>
              </div>
              <div className="home-page-scheduled__hero-copy">
                <h2>Your Slot has Passed</h2>
              </div>
            </div>
          </section>

          <div className="home-page-scheduled__card home-page-scheduled__card--home-collection-wrap">
            <SlotDetailsCard
              title="Collection Cabin"
              rows={[
                {
                  id: 'cabin',
                  icon: 'cabin',
                  title: cabinTitle,
                  sub: cabinSub,
                },
              ]}
              walkInMessage={{
                prefix: 'Walk in & complete your health check ',
                highlight: 'now',
              }}
            />
          </div>

          <PrepStepsDeck />

          {showCampQuestionnaireCta ? (
            <div className="home-page-b2b__cta-wrap home-page-b2b__cta-wrap--camp">
              <button type="button" className="home-page-b2b__cta" onClick={openB2bQuestionnaire}>
                Complete your Health Assessment
              </button>
            </div>
          ) : null}

          <NavBar defaultActive="home" onNavigate={handleNavigate} />
        </div>
      );
    }

    return null;
  }

  return (
    <div className={`home-page${showReassessmentBanner && slotNorm.hasScheduledSlot ? ' home-page--reassessment-banner' : ''}${showReassessmentBanner && slotNorm.hasScheduledSlot && showReassessmentUpdateCta && showHealthQuestionnaireCta ? ' home-page--reassessment-banner-tall' : ''}`}>
      {isDownloadMenuOpen ? (
        <button
          type="button"
          className="home-page__download-overlay-backdrop"
          onClick={handleCloseDownloadMenu}
          aria-label="Close reports panel"
        />
      ) : null}

      {/* Header */}
      <Header 
        name={userName} 
        onMenuClick={handleMenuClick}
      />

      <MetabolicAgeOrb
        value={metabolicOrbProps.value}
        currentAge={metabolicOrbProps.currentAge}
        label={metabolicOrbProps.label}
        detail={metabolicOrbProps.detail}
        absoluteMetabolicAge={metabolicOrbProps.absoluteMetabolicAge}
      />

      {/* Health Span Index: only render when scores exist; otherwise Positive Wins sits under the orb */}
      {healthSpanIndexSection}

      <PositiveWinsSection apiPositiveWins={positiveWinsData} />

      {/* Risk Analysis Section */}
      <RiskAnalysisSection
        apiRiskAnalysis={riskAnalysisData}
        onSeeMore={handleRiskAnalysisSeeMore}
        onDiseaseSelect={onNavigateToDiseaseDetail}
        onBloodMarkersSeeMore={handleBloodMarkersSeeMore}
        onHomeBloodMarkerSelect={handleHomeBloodMarkerCardSelect}
        prefetchedHomeBloodMarkers={homeBloodMarkersForSection}
      />

      <AllergySensitivitySection
        onSeeMore={onNavigateToAllergySensitivity}
        summary={reportAllergySummary}
      />

      <CancerScreeningSection
        onSeeMore={onNavigateToCancerMarkers}
        areas={reportCancerHome?.areas}
        count={reportCancerHome?.count}
      />

      {isDownloadMenuOpen ? (
        <div className="home-page__download-panel" role="dialog" aria-label="Reports">
          <button
            type="button"
            className="home-page__download-panel-item"
            onClick={handleDownloadBioAiReport}
            disabled={downloadingReportKind !== null}
            aria-busy={downloadingReportKind === 'bio-ai'}
          >
            <span>{downloadingReportKind === 'bio-ai' ? 'Downloading report...' : 'Bio-AI Health Report'}</span>
            <HomeReportEyeIcon />
          </button>
          <button
            type="button"
            className="home-page__download-panel-item"
            onClick={handleDownloadBloodReport}
            disabled={downloadingReportKind !== null}
            aria-busy={downloadingReportKind === 'blood'}
          >
            <span>{downloadingReportKind === 'blood' ? 'Downloading report...' : 'Blood Report'}</span>
            <HomeReportEyeIcon />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="home-page__floating-download-btn"
        onClick={handleDownloadMenuToggle}
        aria-label={isDownloadMenuOpen ? 'Close report options' : 'Open report options'}
        aria-expanded={isDownloadMenuOpen}
      >
        <HomeDownloadIcon />
      </button>

      <HomeReassessmentBottomSheet
        visible={showReassessmentBanner && slotNorm.hasScheduledSlot && !isReturningUserJourneyView}
        collectionDateLabel={formatBloodCollectionDateLabel(slotNorm.engagementDateRaw)}
        showUpdateAssessment={showReassessmentUpdateCta && showHealthQuestionnaireCta}
        onUpdateAssessment={openB2bQuestionnaire}
        onViewDetails={openReturningUserJourneyView}
      />

      <NavBar defaultActive="home" onNavigate={handleNavigate} />
    </div>
  );
};

export default HomePage;
