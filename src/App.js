import './App.css';
import { useState, useEffect, useRef, Suspense, lazy, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import SplashScreen from './pages/SplashScreen';
import LoginPage from './pages/LoginPage';
import { getSuperClubLikedSportIds } from './pages/SuperClubPage/superClubStorage';
import { getSuperClubSportsByIds } from './pages/SuperClubPage/superClubSportImages';
import {
  SUPERCLUB_PLAYLIST_FLOW_DEV_UNLOCK,
  SUPERCLUB_V1_SCREENS_ENABLED,
} from './utils/superclubPlaylistLock';
import { CAMP_DOCTOR_CONSULTATION_ENABLED } from './pages/CampDoctorConsultationPage/campDoctorConsultationConfig';
import {
  getUpcomingCampAppointment,
  readCampAppointments,
  reconcileCampAppointmentsWithApi,
  saveCampAppointment,
} from './utils/campAppointments';
import { fetchMyConsultationAppointments } from './utils/myConsultationsAppointments';
import ConsultationReminderBar from './pages/CampDoctorConsultationPage/ConsultationReminderBar';
import {
  fetchDoctorConsultationPopupEligibility,
  hasOptedOutOfConsultationPopup,
  optOutOfConsultationPopup,
} from './utils/campDoctorConsultationEligibility';
import { resendOtp, verifyOtp, refreshToken, logout } from './services/authService';
import { createUser, getMyProfiles, saveSuperclubMcqPreferences, getMyUpcomingSlot } from './services/usersService';
import { getMyProfile } from './services/profileService';
import { invalidateDiagnosticPackagesCache } from './services/diagnosticPackagesService';
import {
  loadQuestionnaireContext,
  submitQuestionnaireResponses,
  submitLatestEngagementAssessment,
  markFamilyHistoryQuestionnaireDraftKnown,
  invalidateFamilyHistoryQuestionnaireDraftCache,
  markNutritionLogQuestionnaireDraftKnown,
  invalidateNutritionLogQuestionnaireDraftCache,
  hasNutritionLogQuestionnaireDraft,
  hasFamilyHistoryQuestionnaireDraft,
  markFitprintGapQuestionnaireSubmitted,
  hasFinalizedHealthQuestionnaireForEngagement,
  invalidateHealthQuestionnaireSubmittedCache,
} from './services/questionnaireService';
import { setPackageOnboardingEligible } from './utils/packageRecommendationStorage';
import {
  fetchLatestAssessmentReport,
  getLatestAssessmentIdsCached,
  clearReportRequestCache,
  clearStoredLatestAssessmentId,
  peekMyAssessmentsRowsCached,
  resolveEngagementIdFromAssessmentId,
} from './services/reportService';
import {
  saveAuthTokens,
  getRefreshToken,
  clearAuthTokens,
  extractTokensFromResponse,
} from './utils/authStorage';
import { SESSION_EXPIRED_EVENT, logAuthError } from './utils/sessionAuth';
import { trackAppScreen } from './analytics/googleAnalytics';
import AppTooltipTour from './components/AppTooltipTour/AppTooltipTour';
import {
  prefetchNavbarRoutes,
  prefetchRouteChunk,
  prefetchSecondaryAppRouteChunks,
  prefetchLikelyNextRoutes,
} from './utils/routePrefetch';
import {
  installPwaHomeBackGuard,
  isStandalonePwa,
} from './utils/pwaHomeBackGuard';
import {
  createEmptyPreloadedHome,
  hasRenderableOverviewData,
  HOME_PRELOAD_COMPLETE_KEY,
} from './utils/homeOverviewPreload';
import {
  loadFitprintHealthSpanIndexState,
  fitprintHealthSpanPreloadExtras,
} from './utils/fitprintHealthSpanFlow';
import {
  clearSuperclubPlaylistLock,
  persistSuperclubPlaylistLock,
  readSuperclubPlaylistLock,
  resolvePageWithSuperclubLock,
} from './utils/superclubPlaylistLock';
// Route-level code splitting: every non-entry page loads its own JS/CSS chunk on demand.
// Splash + Login stay eager because they're the first paint; everything else is deferred
// so the initial main bundle stays small (~172 KiB of unused JS audit finding).
const OTPPage = lazy(() => import('./pages/OTPPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
// Camp Doctor consultation popup — comment this lazy import + the home render block to disable.
const CampDoctorConsultationPage = lazy(() => import('./pages/CampDoctorConsultationPage'));
const HealthScanIndexPage = lazy(() => import('./pages/HealthScanIndexPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AllAppointmentsPage = lazy(() => import('./pages/AllAppointmentsPage'));
const AppointmentDetailsPage = lazy(() => import('./pages/AppointmentDetailsPage'));
const AddressesPage = lazy(() => import('./pages/AddressesPage'));
const ConsultationNotesPage = lazy(() => import('./pages/ConsultationNotesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const CustomerSupportPage = lazy(() => import('./pages/CustomerSupportPage'));
const PermissionsPage = lazy(() => import('./pages/PermissionsPage'));
const AddAccountPage = lazy(() => import('./pages/AddAccountPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const RateExperiencePage = lazy(() => import('./pages/RateExperiencePage'));
const TermsConditionsPage = lazy(() => import('./pages/TermsConditionsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const HealthAssessmentPage = lazy(() => import('./pages/HealthAssessmentPage'));
const QuestionnaireNullCatchupPage = lazy(() => import('./pages/QuestionnaireNullCatchupPage/QuestionnaireNullCatchupPage'));
const QuestionnaireBlankPage = lazy(() => import('./pages/QuestionnaireBlankPage'));
const BloodMarkersPage = lazy(() => import('./pages/BloodMarkersPage/BloodMarkersPage'));
const AllergySensitivityPage = lazy(() => import('./pages/AllergySensitivityPage/AllergySensitivityPage'));
const PackagesPage = lazy(() => import('./pages/PackagesPage'));
const PackageDetailsPage = lazy(() => import('./pages/PackageDetailsPage'));
const CreateCustomPackagePage = lazy(() => import('./pages/CreateCustomPackagePage/CreateCustomPackagePage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));
const DoctorProfilePage = lazy(() => import('./pages/DoctorProfilePage'));
const IntegratedHealthProgramPage = lazy(() => import('./pages/IntegratedHealthProgramPage'));
const SuperClubPage = lazy(() => import('./pages/SuperClubPage/SuperClubPage'));
const SuperClubPlaylistPage = lazy(() => import('./pages/SuperClubPage/SuperClubPlaylistPage'));
const Superclub2Page = lazy(() => import('./pages/Superclub2/Superclub2Page'));
const SuperclubEarlyAccessPage = lazy(() => import('./pages/Superclub2/SuperclubEarlyAccessPage'));
const SuperclubPlaylistConfirmPage = lazy(() => import('./pages/Superclub2/SuperclubPlaylistConfirmPage'));
const SuperClubPage2 = lazy(() => import('./pages/SuperClubPage/SuperClubPage2'));
const DiseaseRiskAnalysisPage = lazy(() => import('./pages/DiseaseRiskAnalysisPage'));
const DiseaseDetailPage = lazy(() => import('./pages/DiseaseDetailPage'));

const SWIPE_BACK_BLOCKED_PAGES = new Set([
  'home',
  'login',
  'signup',
  'otp',
  'splash',
  'super-club-playlist-confirm',
]);

/** Placeholder route while restoring an existing session (never shows splash cube). */
const SESSION_RESTORE_PAGE = 'session-restore';

const getInitialAppPage = () => {
  if (typeof window === 'undefined') {
    return 'splash';
  }
  return getRefreshToken() ? SESSION_RESTORE_PAGE : 'splash';
};

const EDGE_SWIPE_TRIGGER_PX = 70;
const EDGE_SWIPE_VERTICAL_TOLERANCE_PX = 80;
const EDGE_SWIPE_START_ZONE_PX = 28;
/** Wider zone used to block the native OS/browser back-swipe peek on locked screens (e.g. home). */
const EDGE_SWIPE_BLOCK_ZONE_PX = 48;
/** Bottom-nav roots: switch via replaceState so iOS PWA never keeps a back stack entry to peek. */
const TAB_ROOT_PAGES = new Set(['home', 'packages', 'doctors', 'super-club']);

const buildPageHistoryState = (page) => ({
  appPage: page,
  ...(page === 'home' ? { homeTrap: true } : {}),
});

const buildPageHistoryUrl = (page) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const { origin, pathname, search } = window.location;
  const base = `${origin}${pathname || '/'}${search || ''}`;

  if (page === 'home') {
    return base;
  }

  return `${base}#${encodeURIComponent(page)}`;
};

const isTabRootPage = (page) => TAB_ROOT_PAGES.has(page);

const getEdgeSwipeBlockZonePx = (page) => {
  if (typeof window === 'undefined' || page !== 'home') {
    return EDGE_SWIPE_BLOCK_ZONE_PX;
  }

  return Math.min(
    Math.max(EDGE_SWIPE_BLOCK_ZONE_PX, Math.round(window.innerWidth * 0.28)),
    140,
  );
};

const replaceBrowserHistoryForPage = (page) => {
  if (typeof window === 'undefined' || !window.history) {
    return;
  }

  window.history.replaceState(
    buildPageHistoryState(page),
    '',
    buildPageHistoryUrl(page),
  );
};
const normalizeRedirectTarget = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  const compact = normalized
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');

  if (compact === 'blood-markers' || compact === 'bloodmarkers') {
    return 'blood-markers';
  }

  return '';
};

const resolvePostLoginRedirectPage = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const fromQuery = normalizeRedirectTarget(
      searchParams.get('redirect')
      || searchParams.get('target')
      || searchParams.get('goto')
    );

    if (fromQuery) {
      return fromQuery;
    }

    const path = String(window.location.pathname || '').toLowerCase();
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = normalizeRedirectTarget(pathSegments[pathSegments.length - 1] || '');

    if (lastSegment) {
      return lastSegment;
    }
  } catch (error) {
    console.error('Failed to resolve post-login redirect page:', error);
  }

  return '';
};

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

const deriveEmployerOrganizerName = (profile) => {
  const raw = profile?.referred_by
    || profile?.organization_name
    || profile?.employer_name
    || profile?.camp_organizer
    || profile?.corporate_partner_name;
  return String(raw || '').trim();
};

function App() {
  const PACKAGE_ONBOARDING_NEW_USER_SESSION_KEY = 'ss_package_onboarding_new_user';
  const [currentPage, setCurrentPage] = useState(getInitialAppPage);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(
    () => getInitialAppPage() === SESSION_RESTORE_PAGE,
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [employerOrganizerName, setEmployerOrganizerName] = useState('');
  const [userAge, setUserAge] = useState(null);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [questionnaireProgress, setQuestionnaireProgress] = useState(0);
  const [expandedQuestionnaireStep, setExpandedQuestionnaireStep] = useState(null);
  const [questionnaireSteps, setQuestionnaireSteps] = useState([]);
  const [, setQuestionnaireCurrentAssessment] = useState(null);
  const [, setQuestionnaireAssessments] = useState([]);
  const [questionnaireQuestionsByCategoryId, setQuestionnaireQuestionsByCategoryId] = useState({});
  const [questionnaireDraftResponsesByRoute, setQuestionnaireDraftResponsesByRoute] = useState({});
  const [questionnaireSuccessMessage, setQuestionnaireSuccessMessage] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIosInstallFlow, setIsIosInstallFlow] = useState(false);
  const [selectedHealthScanTab, setSelectedHealthScanTab] = useState(0);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [customPackageCard, setCustomPackageCard] = useState(null);
  const [pendingCustomPackagePayload, setPendingCustomPackagePayload] = useState(null);
  const [isSignupNewUserFlow, setIsSignupNewUserFlow] = useState(false);
  const [selectedPackageCard, setSelectedPackageCard] = useState(null);
  const [bloodMarkerDetailFromHome, setBloodMarkerDetailFromHome] = useState(null);
  const [bloodMarkersInitialFilter, setBloodMarkersInitialFilter] = useState(null);
  const [bloodMarkersReturnPage, setBloodMarkersReturnPage] = useState('home');
  const [canSwipeBack, setCanSwipeBack] = useState(false);
  const [preloadedHomeData, setPreloadedHomeData] = useState(null);
  const [forceHomeApiRefresh, setForceHomeApiRefresh] = useState(false);
  const [superClubLikedSportIds, setSuperClubLikedSportIds] = useState(() => getSuperClubLikedSportIds());
  const handleSuperClubOnboardingComplete = useCallback((likedIds) => {
    setSuperClubLikedSportIds(Array.isArray(likedIds) ? likedIds : []);
    setCurrentPage('super-club-2');
  }, []);
  const handleNavigateToBloodMarkerDetail = useCallback((row) => {
    setBloodMarkerDetailFromHome(row);
    setBloodMarkersInitialFilter(null);
    setBloodMarkersReturnPage('home');
    setCurrentPage('blood-markers');
  }, []);
  const bloodMarkersPageDetailProps = useMemo(
    () => ({
      initialDetailMarker: bloodMarkerDetailFromHome,
      onInitialDetailConsumed: () => setBloodMarkerDetailFromHome(null),
      initialFilter: bloodMarkersInitialFilter,
    }),
    [bloodMarkerDetailFromHome, bloodMarkersInitialFilter],
  );
  const [isB2bQuestionnaireFlow, setIsB2bQuestionnaireFlow] = useState(false);
  const [healthAssessmentBackPage, setHealthAssessmentBackPage] = useState('home');
  const [nullCatchupAssessmentInstanceId, setNullCatchupAssessmentInstanceId] = useState(null);
  const [superclubPlaylistPayload, setSuperclubPlaylistPayload] = useState(null);
  const [campAppointments, setCampAppointments] = useState(() => readCampAppointments());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedExpertKind, setSelectedExpertKind] = useState('doctor');
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [showCampDoctorConsultation, setShowCampDoctorConsultation] = useState(false);
  const campDoctorPopupDismissedRef = useRef(false);
  const [doctorConsultationContext, setDoctorConsultationContext] = useState(null);
  // const [superClubOnboardingDone, setSuperClubOnboardingDone] = useState(() =>
  //   isSuperClubOnboardingComplete(),
  // );
  const appScrollRef = useRef(null);
  const pageHistoryRef = useRef([]);
  const previousPageRef = useRef(null);
  const skipHistoryForNextPageRef = useRef(false);
  const postLoginRedirectPageRef = useRef(resolvePostLoginRedirectPage());
  const edgeSwipeStateRef = useRef({
    tracking: false,
    blockNativeBackGesture: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const hasInitializedBrowserHistoryRef = useRef(false);
  const skipBrowserHistoryPushRef = useRef(false);

  const applyLockedLanding = useCallback((targetPage, mode = 'default-auth') => {
    const next = resolvePageWithSuperclubLock(targetPage, mode);
    if (next.updatePayload && next.payload) {
      setSuperclubPlaylistPayload(next.payload);
    }
    setCurrentPage(next.page);
  }, []);

  const navigateToSuperClubFlow = useCallback(() => {
    applyLockedLanding('super-club', 'superclub-nav');
  }, [applyLockedLanding]);

  const navigateToEarlyAccessFlow = useCallback(() => {
    const { locked, payload } = readSuperclubPlaylistLock();
    if (locked && payload) {
      setSuperclubPlaylistPayload(payload);
      setCurrentPage('super-club-playlist-confirm');
      return;
    }
    setSuperclubPlaylistPayload(null);
    setCurrentPage('super-club-early-access');
  }, []);

  /* After MCQ → playlist confirm, keep user on confirm (skipped when DEV_UNLOCK). */
  useEffect(() => {
    if (SUPERCLUB_PLAYLIST_FLOW_DEV_UNLOCK) {
      return undefined;
    }
    const { locked, payload } = readSuperclubPlaylistLock();
    if (!locked || !payload) {
      return;
    }
    if (currentPage === 'super-club' || currentPage === 'super-club-early-access') {
      setSuperclubPlaylistPayload(payload);
      setCurrentPage('super-club-playlist-confirm');
    }
  }, [currentPage]);

  const isSwipeBackAllowedPage = useCallback((page) => !SWIPE_BACK_BLOCKED_PAGES.has(page), []);

  const pinHomeBrowserHistory = useCallback(() => {
    replaceBrowserHistoryForPage('home');
  }, []);
  const navigateToHome = useCallback(() => {
    setCurrentPage('home');
  }, []);

  useEffect(() => {
    if (appScrollRef.current) {
      appScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) {
      return;
    }

    const fromPage = previousPageRef.current;
    const state = buildPageHistoryState(currentPage);
    const url = buildPageHistoryUrl(currentPage);

    if (!hasInitializedBrowserHistoryRef.current) {
      window.history.replaceState(state, '', url);
      hasInitializedBrowserHistoryRef.current = true;
      return;
    }

    if (skipBrowserHistoryPushRef.current) {
      skipBrowserHistoryPushRef.current = false;
      window.history.replaceState(state, '', url);
      return;
    }

    // Bottom-nav tabs replace in place — never push packages/home onto a back stack.
    if (isTabRootPage(currentPage) && fromPage && isTabRootPage(fromPage)) {
      window.history.replaceState(state, '', url);
      return;
    }

    // Root/auth screens replace the current history entry instead of pushing,
    // so iOS edge-swipe cannot walk back through splash → login → otp.
    if (SWIPE_BACK_BLOCKED_PAGES.has(currentPage)) {
      window.history.replaceState(state, '', url);
      return;
    }

    window.history.pushState(state, '', url);
  }, [currentPage]);

  useEffect(() => {
    trackAppScreen(currentPage);

    const previousPage = previousPageRef.current;

    if (currentPage === 'home') {
      pageHistoryRef.current = [];
    } else if (previousPage && previousPage !== currentPage && !skipHistoryForNextPageRef.current) {
      pageHistoryRef.current.push(previousPage);
    }

    skipHistoryForNextPageRef.current = false;
    previousPageRef.current = currentPage;

    setCanSwipeBack(isSwipeBackAllowedPage(currentPage) && pageHistoryRef.current.length > 0);
  }, [currentPage, isSwipeBackAllowedPage]);

  useEffect(() => {
    if (currentPage !== 'home' || !forceHomeApiRefresh || preloadedHomeData == null) {
      return undefined;
    }

    setForceHomeApiRefresh(false);
    return undefined;
  }, [currentPage, forceHomeApiRefresh, preloadedHomeData]);

  const goBackBySwipe = useCallback(() => {
    if (!isSwipeBackAllowedPage(currentPage)) {
      return false;
    }

    while (pageHistoryRef.current.length > 0) {
      const targetPage = pageHistoryRef.current.pop();
      if (!targetPage || targetPage === currentPage) {
        continue;
      }

      const { locked, payload } = readSuperclubPlaylistLock();
      if (
        locked &&
        payload &&
        (targetPage === 'super-club' || targetPage === 'super-club-early-access')
      ) {
        skipHistoryForNextPageRef.current = true;
        setSuperclubPlaylistPayload(payload);
        setCurrentPage('super-club-playlist-confirm');
        return true;
      }

      skipHistoryForNextPageRef.current = true;
      setCurrentPage(targetPage);
      return true;
    }

    return false;
  }, [currentPage, isSwipeBackAllowedPage]);

  const handleEdgeSwipeStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }

    const blockZonePx = getEdgeSwipeBlockZonePx(currentPage);
    if (
      (currentPage === 'home' && touch.clientX <= blockZonePx)
      || (!isSwipeBackAllowedPage(currentPage) && touch.clientX <= blockZonePx)
    ) {
      edgeSwipeStateRef.current = {
        tracking: false,
        blockNativeBackGesture: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };
      return;
    }

    if (!canSwipeBack || !isSwipeBackAllowedPage(currentPage)) {
      return;
    }

    if (touch.clientX > EDGE_SWIPE_START_ZONE_PX) {
      return;
    }

    edgeSwipeStateRef.current = {
      tracking: true,
      blockNativeBackGesture: false,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
    };
  };

  const handleEdgeSwipeMove = (event) => {
    const swipeState = edgeSwipeStateRef.current;

    if (swipeState.blockNativeBackGesture) {
      const touch = event.touches?.[0];
      if (!touch) {
        return;
      }

      swipeState.lastX = touch.clientX;
      swipeState.lastY = touch.clientY;

      const deltaX = swipeState.lastX - swipeState.startX;
      const deltaY = swipeState.lastY - swipeState.startY;

      if (deltaX > 0 && Math.abs(deltaY) <= EDGE_SWIPE_VERTICAL_TOLERANCE_PX) {
        event.preventDefault();
      }

      return;
    }

    if (!swipeState.tracking) {
      return;
    }

    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }

    swipeState.lastX = touch.clientX;
    swipeState.lastY = touch.clientY;

    const deltaX = swipeState.lastX - swipeState.startX;
    const deltaY = swipeState.lastY - swipeState.startY;

    if (Math.abs(deltaY) > EDGE_SWIPE_VERTICAL_TOLERANCE_PX || deltaX < -10) {
      swipeState.tracking = false;
      return;
    }

    if (deltaX > 10) {
      event.preventDefault();
    }
  };

  const handleEdgeSwipeEnd = () => {
    const swipeState = edgeSwipeStateRef.current;
    if (swipeState.blockNativeBackGesture) {
      swipeState.blockNativeBackGesture = false;
      return;
    }

    if (!swipeState.tracking) {
      return;
    }

    const deltaX = swipeState.lastX - swipeState.startX;
    const deltaY = swipeState.lastY - swipeState.startY;
    swipeState.tracking = false;

    if (deltaX >= EDGE_SWIPE_TRIGGER_PX && Math.abs(deltaY) <= EDGE_SWIPE_VERTICAL_TOLERANCE_PX) {
      goBackBySwipe();
    }
  };

  const handleEdgeSwipeCancel = () => {
    edgeSwipeStateRef.current.tracking = false;
    edgeSwipeStateRef.current.blockNativeBackGesture = false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleBrowserBack = () => {
      const page = currentPageRef.current;

      if (page === 'home') {
        skipBrowserHistoryPushRef.current = true;
        replaceBrowserHistoryForPage('home');
        return;
      }

      if (!isSwipeBackAllowedPage(page)) {
        skipBrowserHistoryPushRef.current = true;
        replaceBrowserHistoryForPage(page);
        return;
      }

      const handledInApp = goBackBySwipe();

      if (handledInApp) {
        skipBrowserHistoryPushRef.current = true;
        return;
      }

      skipBrowserHistoryPushRef.current = true;
      replaceBrowserHistoryForPage(page);
    };

    window.addEventListener('popstate', handleBrowserBack, true);
    return () => {
      window.removeEventListener('popstate', handleBrowserBack, true);
    };
  }, [goBackBySwipe, isSwipeBackAllowedPage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePageShow = (event) => {
      if (!event.persisted || currentPageRef.current !== 'home') {
        return;
      }

      skipBrowserHistoryPushRef.current = true;
      replaceBrowserHistoryForPage('home');
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (currentPage !== 'home') {
      document.documentElement.classList.remove('app-swipe-back-locked');
      return undefined;
    }

    document.documentElement.classList.add('app-swipe-back-locked');
    pinHomeBrowserHistory();

    if (typeof window !== 'undefined' && window.location.hash) {
      replaceBrowserHistoryForPage('home');
    }

    const removePwaGuard = isStandalonePwa() ? installPwaHomeBackGuard() : null;

    return () => {
      document.documentElement.classList.remove('app-swipe-back-locked');
      if (removePwaGuard) {
        removePwaGuard();
      }
    };
  }, [currentPage, pinHomeBrowserHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleHashChange = () => {
      if (currentPageRef.current !== 'home') {
        return;
      }

      replaceBrowserHistoryForPage('home');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const onTouchStartCapture = (event) => {
      const touch = event.touches?.[0];
      if (!touch) {
        return;
      }

      const page = currentPageRef.current;
      const swipeState = edgeSwipeStateRef.current;

      swipeState.startX = touch.clientX;
      swipeState.startY = touch.clientY;
      swipeState.lastX = touch.clientX;
      swipeState.lastY = touch.clientY;

      const blockZonePx = getEdgeSwipeBlockZonePx(page);

      if (page === 'home' || SWIPE_BACK_BLOCKED_PAGES.has(page)) {
        if (touch.clientX <= blockZonePx) {
          swipeState.blockNativeBackGesture = true;
          swipeState.tracking = false;
        }
      }
    };

    const onTouchMoveCapture = (event) => {
      const swipeState = edgeSwipeStateRef.current;
      const touch = event.touches?.[0];

      if (!touch || !swipeState.blockNativeBackGesture) {
        return;
      }

      swipeState.lastX = touch.clientX;
      swipeState.lastY = touch.clientY;

      const deltaX = swipeState.lastX - swipeState.startX;
      const deltaY = swipeState.lastY - swipeState.startY;

      // Only suppress horizontal edge pans (back gesture), not vertical page scroll.
      if (deltaX > 10 && Math.abs(deltaY) <= EDGE_SWIPE_VERTICAL_TOLERANCE_PX) {
        event.preventDefault();
      }
    };

    const onTouchEndCapture = () => {
      edgeSwipeStateRef.current.blockNativeBackGesture = false;
      edgeSwipeStateRef.current.tracking = false;
    };

    document.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEndCapture, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEndCapture, { capture: true, passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStartCapture, { capture: true });
      document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true });
      document.removeEventListener('touchend', onTouchEndCapture, { capture: true });
      document.removeEventListener('touchcancel', onTouchEndCapture, { capture: true });
    };
  }, []);

  const isSwipeBackLockedPage = SWIPE_BACK_BLOCKED_PAGES.has(currentPage);

  const getProgressFromCategories = (categories) => {
    let completedCount = 0;

    for (const category of categories) {
      if ((category?.status || '').toLowerCase() === 'complete') {
        completedCount += 1;
      } else {
        break;
      }
    }

    return completedCount;
  };

  const getCategoryByRoute = (routeId) => {
    return questionnaireSteps.find((step) => step.routeId === routeId) || null;
  };

  const getAgeFromProfile = (profile) => {
    if (typeof profile?.age === 'number' && profile.age > 0) {
      return Math.floor(profile.age);
    }

    if (!profile?.date_of_birth) {
      return null;
    }

    const dob = new Date(profile.date_of_birth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }

    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      calculatedAge -= 1;
    }

    return calculatedAge > 0 ? calculatedAge : null;
  };

  const getQuestionsByRoute = (routeId) => {
    const category = getCategoryByRoute(routeId);
    if (!category) {
      return [];
    }

    return questionnaireQuestionsByCategoryId[String(category.category_id)] || [];
  };

  const getDraftResponsesByRouteFromContext = (categories = [], responsesByCategoryId = {}) => {
    if (!Array.isArray(categories) || !responsesByCategoryId || typeof responsesByCategoryId !== 'object') {
      return {};
    }

    return categories.reduce((acc, category) => {
      const routeId = String(category?.routeId || '');
      if (!routeId) {
        return acc;
      }

      const responses = responsesByCategoryId[String(category?.category_id)] || [];
      if (!Array.isArray(responses) || responses.length === 0) {
        return acc;
      }

      acc[routeId] = responses;
      return acc;
    }, {});
  };

  const handleStepComplete = async (routeId, responses = []) => {
    const routeProgressMap = {
      'anthropometry': 1,
      'family-history': 2,
      'lifestyle-habits': 3,
      'nutrition-log': 4,
      'vitals': 5,
    };

    const normalizedResponses = Array.isArray(responses) ? responses : [];
    const nextDraftResponses = {
      ...questionnaireDraftResponsesByRoute,
      [routeId]: normalizedResponses,
    };

    setQuestionnaireDraftResponsesByRoute(nextDraftResponses);

    const persistRoute = async (route) => {
      const targetCategory = getCategoryByRoute(route);
      const categoryId = Number(targetCategory?.category_id || 0);
      const assessmentInstanceId = Number(targetCategory?.assessment_instance_id || 0);
      const routeResponses = Array.isArray(nextDraftResponses[route]) ? nextDraftResponses[route] : [];

      if (categoryId <= 0 || assessmentInstanceId <= 0 || routeResponses.length === 0) {
        return;
      }

      try {
        await submitQuestionnaireResponses(assessmentInstanceId, categoryId, routeResponses);
      } catch (error) {
        console.error(`Failed to submit questionnaire responses for ${route}:`, error);
      }
    };

    // Persist this step immediately so answers are not lost if the user drops off before vitals
    // or if a later batch step fails silently.
    if (normalizedResponses.length > 0) {
      await persistRoute(routeId);
      if (routeId === 'family-history') {
        markFamilyHistoryQuestionnaireDraftKnown(true);
      }
      if (routeId === 'nutrition-log') {
        markNutritionLogQuestionnaireDraftKnown(true);
      }
    }

    if (routeId === 'vitals' || (isB2bQuestionnaireFlow && routeId === 'anthropometry')) {
      const submissionOrder = isB2bQuestionnaireFlow
        ? ['family-history', 'lifestyle-habits', 'nutrition-log', 'anthropometry']
        : ['family-history', 'lifestyle-habits', 'nutrition-log', 'anthropometry', 'vitals'];

      const submitPayloadPreview = submissionOrder.map((route) => {
        const targetCategory = getCategoryByRoute(route);
        const routeResponses = Array.isArray(nextDraftResponses[route]) ? nextDraftResponses[route] : [];
        return {
          route,
          assessmentInstanceId: Number(targetCategory?.assessment_instance_id || 0),
          categoryId: Number(targetCategory?.category_id || 0),
          body: { responses: routeResponses },
        };
      });
      console.log('[Health Assessment] Submit — questionnaire PUT payload(s)', submitPayloadPreview);

      for (const route of submissionOrder) {
        await persistRoute(route);
      }
    }

    const progressValue = routeProgressMap[routeId] || 0;
    setQuestionnaireProgress((prev) => Math.max(prev, progressValue));
    setExpandedQuestionnaireStep(null);
  };

  const handleStepDraftSave = async (routeId, responses = []) => {
    const normalizedResponses = Array.isArray(responses) ? responses : [];

    setQuestionnaireDraftResponsesByRoute((prev) => ({
      ...prev,
      [routeId]: normalizedResponses,
    }));

    const targetCategory = getCategoryByRoute(routeId);
    const categoryId = Number(targetCategory?.category_id || 0);
    const assessmentInstanceId = Number(targetCategory?.assessment_instance_id || 0);

    if (categoryId <= 0 || assessmentInstanceId <= 0 || normalizedResponses.length === 0) {
      return;
    }

    try {
      await submitQuestionnaireResponses(assessmentInstanceId, categoryId, normalizedResponses);
      if (routeId === 'family-history') {
        markFamilyHistoryQuestionnaireDraftKnown(true);
      }
      if (routeId === 'nutrition-log') {
        markNutritionLogQuestionnaireDraftKnown(true);
      }
    } catch (error) {
      console.error(`Failed to autosave questionnaire responses for ${routeId}:`, error);
    }
  };

  const initializeQuestionnaire = async ({ excludeVitals = false } = {}) => {
    invalidateFamilyHistoryQuestionnaireDraftCache();
    invalidateNutritionLogQuestionnaireDraftCache();
    try {
      const context = await loadQuestionnaireContext();
      const allCategories = context?.categories || [];
      const categories = excludeVitals
        ? allCategories.filter((category) => category?.routeId !== 'vitals')
        : allCategories;
      const draftResponsesByRoute = getDraftResponsesByRouteFromContext(
        categories,
        context?.responsesByCategoryId || {}
      );

      setQuestionnaireCurrentAssessment(context?.assessment || null);
      setQuestionnaireAssessments(Array.isArray(context?.assessments) ? context.assessments : []);
      setQuestionnaireSteps(categories);
      setQuestionnaireQuestionsByCategoryId(context?.questionsByCategoryId || {});
      setQuestionnaireDraftResponsesByRoute(draftResponsesByRoute);

      const completedProgress = getProgressFromCategories(categories);
      setQuestionnaireProgress(completedProgress);
      setExpandedQuestionnaireStep(null);
    } catch (error) {
      setQuestionnaireSteps([]);
      setQuestionnaireCurrentAssessment(null);
      setQuestionnaireAssessments([]);
      setQuestionnaireQuestionsByCategoryId({});
      setQuestionnaireProgress(0);
      setQuestionnaireDraftResponsesByRoute({});
      console.error('Failed to load questionnaire context:', error);
    }
  };

  const openHealthAssessmentIfNotFinalizedForUpcomingBooking = async () => {
    try {
      const slotRoot = await getMyUpcomingSlot();
      const engagementId = Number(
        slotRoot?.slots?.[0]?.engagement?.engagement_id
        || slotRoot?.slots?.[0]?.engagement?.id
        || slotRoot?.slots?.[0]?.engagement_id
        || slotRoot?.slots?.[0]?.slot?.engagement_id
        || 0,
      ) || 0;
      if (engagementId > 0 && await hasFinalizedHealthQuestionnaireForEngagement(engagementId)) {
        return false;
      }
    } catch {
      // allow open when slot / submit state cannot be resolved
    }
    return true;
  };

  const handleOpenHealthAssessmentFromHome = () => {
    void (async () => {
      if (!(await openHealthAssessmentIfNotFinalizedForUpcomingBooking())) {
        return;
      }

      setIsB2bQuestionnaireFlow(false);
      setHealthAssessmentBackPage('home');
      setCurrentPage('health-assessment');
      initializeQuestionnaire({ excludeVitals: false });
    })();
  };

  const handleOpenB2bHealthAssessment = () => {
    void (async () => {
      if (!(await openHealthAssessmentIfNotFinalizedForUpcomingBooking())) {
        return;
      }

      try {
        sessionStorage.setItem('ss_b2b_opened_questionnaire', '1');
      } catch {
        // private mode / disabled storage
      }
      setHealthAssessmentBackPage('home');
      setCurrentPage('health-assessment');
      setIsB2bQuestionnaireFlow(true);
      initializeQuestionnaire({ excludeVitals: true });
    })();
  };

  const handleOpenFitprintGapQuestionnaire = useCallback((assessmentInstanceId) => {
    const id = Number(assessmentInstanceId);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    setNullCatchupAssessmentInstanceId(id);
    setCurrentPage('questionnaire-null-catchup');
  }, []);

  const finishAuthenticatedBootstrap = useCallback((nextPage, { useLockedLanding = false } = {}) => {
    flushSync(() => {
      if (useLockedLanding) {
        applyLockedLanding(nextPage);
      } else {
        setCurrentPage(nextPage);
      }
      setIsBootstrappingSession(false);
    });
  }, [applyLockedLanding]);

  useEffect(() => {
    const trySessionRestore = async () => {
      const refreshTokenValue = getRefreshToken();

      if (!refreshTokenValue) {
        setCurrentPage('splash');
        setIsBootstrappingSession(false);
        return;
      }

      try {
        const refreshResponse = await refreshToken(refreshTokenValue);
        const tokens = extractTokensFromResponse(refreshResponse, refreshTokenValue);
        saveAuthTokens(tokens);
      } catch (error) {
        console.error('Token refresh failed:', error);
        clearAuthTokens();
        // Unauthenticated after a failed restore should land on splash (not login),
        // so cold starts without a valid session still show the intro screen.
        setCurrentPage('splash');
        setIsBootstrappingSession(false);
        return;
      }

      prefetchRouteChunk('home');
      void getLatestAssessmentIdsCached(45000).catch(() => {});

      try {
        const profileResponse = await getMyProfile({ forceRefresh: true });
        const profile = profileResponse?.data && typeof profileResponse.data === 'object'
          ? profileResponse.data
          : profileResponse;
        setUserName(profile?.first_name || '');
        setEmployerOrganizerName(deriveEmployerOrganizerName(profile));
        setUserAge(getAgeFromProfile(profile));

        const activeUserId = Number(profile?.user_id || 0);
        const normalizedCurrentUserId = activeUserId > 0 ? activeUserId : null;
        setCurrentUserId(normalizedCurrentUserId);

        const linkedProfilesResponse = await getMyProfiles({ forceRefresh: true });
        const linkedProfiles = Array.isArray(linkedProfilesResponse?.data)
          ? linkedProfilesResponse.data
          : Array.isArray(linkedProfilesResponse)
            ? linkedProfilesResponse
            : [];

        const normalizedLinkedAccounts = linkedProfiles
          .map((item) => {
            const accountId = Number(item?.user_id || item?.id || 0);
            if (accountId <= 0) {
              return null;
            }

            const firstName = String(item?.first_name || '').trim();
            const lastName = String(item?.last_name || '').trim();
            const relationship = String(item?.relationship || '').trim();
            const relationshipLabel = relationship
              ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
              : accountId === normalizedCurrentUserId
                ? 'Primary Account'
                : 'Linked Account';

            return {
              id: accountId,
              name: [firstName, lastName].filter(Boolean).join(' ') || 'User',
              relationshipLabel,
              gender: item?.gender || '',
              isPrimary: relationship.toLowerCase() === 'primary account' || accountId === normalizedCurrentUserId,
            };
          })
          .filter(Boolean);

        const hasCurrentInLinked = normalizedLinkedAccounts.some(
          (account) => Number(account.id) === Number(normalizedCurrentUserId)
        );

        const currentAccount = normalizedCurrentUserId
          ? {
              id: normalizedCurrentUserId,
              name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User',
              relationshipLabel: 'Primary Account',
              gender: profile?.gender || '',
              isPrimary: true,
            }
          : null;

        const normalizedAccounts = hasCurrentInLinked || !currentAccount
          ? normalizedLinkedAccounts
          : [currentAccount, ...normalizedLinkedAccounts];

        setLinkedAccounts(normalizedAccounts);
        setSelectedAccountId(normalizedCurrentUserId || normalizedAccounts[0]?.id || null);

        if (postLoginRedirectPageRef.current) {
          const targetPage = postLoginRedirectPageRef.current;
          postLoginRedirectPageRef.current = '';
          if (targetPage === 'home') {
            prefetchRouteChunk('home');
            try {
              await preloadHomeScreenData();
            } catch {
              /* HomePage will recover via its own fetch */
            }
          }
          finishAuthenticatedBootstrap(targetPage, { useLockedLanding: true });
          return;
        }
      } catch (bootstrapError) {
        console.error('Session bootstrap fallback due to non-auth error:', bootstrapError);
      }

      await preloadHomeScreenData();
      finishAuthenticatedBootstrap('home', { useLockedLanding: true });
    };

    trySessionRestore();
  }, [finishAuthenticatedBootstrap]);

  // Warm code-split chunks at idle: NavBar targets first, then the rest of the
  // app so most navigations resolve cached modules (no chunk flash). This does
  // not pre-mount screens (would duplicate effects/APIs).
  useEffect(() => {
    const requestIdle = window.requestIdleCallback
      || ((cb) => window.setTimeout(cb, 300));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;

    let outerHandle = null;
    let innerHandle = null;

    outerHandle = requestIdle(() => {
      prefetchNavbarRoutes();
      innerHandle = requestIdle(() => {
        prefetchSecondaryAppRouteChunks();
      });
    });

    return () => {
      if (outerHandle != null) {
        cancelIdle(outerHandle);
      }
      if (innerHandle != null) {
        cancelIdle(innerHandle);
      }
    };
  }, []);

  // After each navigation, warm chunks for common exits from this screen (idle-scheduled).
  useEffect(() => {
    if (isBootstrappingSession) {
      return undefined;
    }
    prefetchLikelyNextRoutes(currentPage);
    return undefined;
  }, [currentPage, isBootstrappingSession]);

  useEffect(() => {
    if (isBootstrappingSession || typeof window === 'undefined') {
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);
    const previewPage = String(params.get('page') || '').trim();
    if (previewPage === 'rate-experience') {
      setCurrentPage('rate-experience');
    } else if (previewPage === 'home-scheduled' || previewPage === 'home-slot-passed') {
      setCurrentPage('home');
    }

    return undefined;
  }, [isBootstrappingSession]);

  useEffect(() => {
    const userAgent = window.navigator.userAgent || '';
    const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isStandalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;

    if (!isStandalone) {
      setIsIosInstallFlow(isIosDevice);
      setShowInstallPrompt(true);
    } else {
      setIsIosInstallFlow(false);
      setShowInstallPrompt(false);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsIosInstallFlow(false);
      setShowInstallPrompt(true);
      console.log('Install prompt available');
    };

    const handleAppInstalled = () => {
      console.log('App installed');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const lockScrollPages = new Set([
      'health-assessment',
    ]);

    if (!lockScrollPages.has(currentPage)) {
      return undefined;
    }

    const { body, documentElement } = document;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      htmlOverflow: documentElement.style.overflow,
      htmlOverscrollBehavior: documentElement.style.overscrollBehavior,
    };

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.touchAction = previous.bodyTouchAction;
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
      documentElement.style.overflow = previous.htmlOverflow;
      documentElement.style.overscrollBehavior = previous.htmlOverscrollBehavior;
    };
  }, [currentPage]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      deferredPrompt.prompt();
      const choice = deferredPrompt.userChoice;
      if (choice && typeof choice.then === 'function') {
        const { outcome } = await choice;
        console.log(`User response: ${outcome}`);
      }
    } catch (error) {
      console.warn('PWA install prompt failed:', error);
    } finally {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
  };

  const handleInstallGotIt = async () => {
    try {
      if (!isIosInstallFlow && deferredPrompt) {
        await handleInstallClick();
        return;
      }
      handleDismissInstall();
    } catch (error) {
      console.warn('PWA install dismiss/install failed:', error);
      handleDismissInstall();
    }
  };

  const handleQuestionnaireSuccessOk = () => {
    try {
      sessionStorage.removeItem('ss_b2b_opened_questionnaire');
    } catch {
      // ignore storage issues and continue navigation
    }
    setIsB2bQuestionnaireFlow(false);
    setQuestionnaireSuccessMessage(null);
    invalidateNutritionLogQuestionnaireDraftCache();
    invalidateFamilyHistoryQuestionnaireDraftCache();
    setForceHomeApiRefresh(true);
    navigateToHome();
  };

  const preloadHomeScreenData = async () => {
    prefetchRouteChunk('home');
    void peekMyAssessmentsRowsCached(0).catch(() => {});
    const fitprintPreloadPromise = loadFitprintHealthSpanIndexState({
      ttlMs: 45000,
      assignFitprintIfMissing: false,
    })
      .then((flowState) => fitprintHealthSpanPreloadExtras(flowState))
      .catch(() => ({}));

    const resolveHealthSpanScoresForPreload = (fitprintExtras) => {
      if (fitprintExtras?.healthSpanScores) {
        return fitprintExtras.healthSpanScores;
      }
      return null;
    };

    const mergePreloadedHomePayload = (partial, healthSpanScores, fitprintExtras) => {
      const spanScores = fitprintExtras.healthSpanScores ?? healthSpanScores ?? partial.healthSpanScores ?? null;
      return {
        ...partial,
        ...fitprintExtras,
        healthSpanLockedNoFitprint: false,
        healthSpanScores: spanScores,
      };
    };

    try {
      const { assessmentId, response } = await fetchLatestAssessmentReport(
        (assessmentId) => `/reports/${assessmentId}/overview`
      );
      const overview = resolveOverviewPayload(response);
      const fitprintExtras = await fitprintPreloadPromise;
      const healthSpanScores = resolveHealthSpanScoresForPreload(fitprintExtras);
      const assessmentRows = await peekMyAssessmentsRowsCached(0).catch(() => []);
      const anchorEngagementId = resolveEngagementIdFromAssessmentId(assessmentRows, assessmentId);

      if (overview && typeof overview === 'object') {
        const metabolicAge = Number(overview?.metabolic_age);
        const metabolicAgeDisplay = Number.isFinite(metabolicAge) ? String(Math.round(metabolicAge)) : '-';

        setPreloadedHomeData(mergePreloadedHomePayload({
          [HOME_PRELOAD_COMPLETE_KEY]: true,
          metabolicAgeValue: metabolicAgeDisplay,
          positiveWinsData: resolvePositiveWinsPayload(overview),
          riskAnalysisData: Array.isArray(overview?.risk_analysis) ? overview.risk_analysis : [],
          healthSpanScores,
          anchorAssessmentId: Number(assessmentId) > 0 ? Number(assessmentId) : null,
          anchorEngagementId: anchorEngagementId || null,
        }, healthSpanScores, fitprintExtras));
        return true;
      }

      setPreloadedHomeData(mergePreloadedHomePayload({
        ...createEmptyPreloadedHome(),
        healthSpanScores,
      }, healthSpanScores, fitprintExtras));
      return false;
    } catch (err) {
      console.error('Failed to preload home screen data:', err);
      const fitprintExtras = await fitprintPreloadPromise;
      const healthSpanScores = resolveHealthSpanScoresForPreload(fitprintExtras);
      setPreloadedHomeData(mergePreloadedHomePayload({
        ...createEmptyPreloadedHome(),
        healthSpanScores,
      }, healthSpanScores, fitprintExtras));
      return false;
    }
  };

  useEffect(() => {
    if (preloadedHomeData != null) {
      return undefined;
    }
    void preloadHomeScreenData();
    return undefined;
  }, [preloadedHomeData]);

  useEffect(() => {
    if (!CAMP_DOCTOR_CONSULTATION_ENABLED || currentPage !== 'home' || isBootstrappingSession) {
      setShowCampDoctorConsultation(false);
      setDoctorConsultationContext(null);
      return undefined;
    }

    campDoctorPopupDismissedRef.current = false;

    let cancelled = false;

    const loadDoctorConsultationEligibility = async () => {
      try {
        const [result, apiAppointments] = await Promise.all([
          fetchDoctorConsultationPopupEligibility(),
          fetchMyConsultationAppointments().catch(() => []),
        ]);
        if (cancelled) {
          return;
        }

        // Drop stale local reminder rows when API says that consult is past / cancelled.
        setCampAppointments((current) => reconcileCampAppointmentsWithApi(current, apiAppointments));

        if (campDoctorPopupDismissedRef.current) {
          setShowCampDoctorConsultation(false);
          setDoctorConsultationContext(null);
          return;
        }

        const popupUserId = selectedAccountId ?? currentUserId;
        const optedOut = hasOptedOutOfConsultationPopup(popupUserId, result.engagementId);
        const shouldShow = Boolean(result.shouldShow) && !optedOut;

        setShowCampDoctorConsultation(shouldShow);
        if (shouldShow) {
          setDoctorConsultationContext({
            engagementId: result.engagementId,
            engagementCode: result.engagementCode,
            consultationMode: result.consultationMode,
            expertType: result.expertType || 'doctor',
          });
        } else {
          setDoctorConsultationContext(null);
        }
      } catch (error) {
        console.error('Failed to resolve doctor consultation popup eligibility:', error);
        if (!cancelled) {
          setShowCampDoctorConsultation(false);
          setDoctorConsultationContext(null);
        }
      }
    };

    void loadDoctorConsultationEligibility();

    return () => {
      cancelled = true;
    };
  }, [currentPage, forceHomeApiRefresh, isBootstrappingSession, selectedAccountId, currentUserId]);

  const readOtpDeliveryFromResponse = (response) => {
    const payload = response?.data && typeof response.data === 'object'
      ? response.data
      : response;
    const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
    return email;
  };

  const handleSendOtp = async (phone) => {
    const response = await resendOtp(phone);
    setPhoneNumber(phone);
    setOtpEmail(readOtpDeliveryFromResponse(response));
    setCurrentPage('otp');
  };

  const handleResendOtp = async (phone) => {
    const response = await resendOtp(phone);
    setPhoneNumber(phone);
    setOtpEmail(readOtpDeliveryFromResponse(response));
  };

  const handleSignup = async (formData) => {
    try {
      sessionStorage.setItem(PACKAGE_ONBOARDING_NEW_USER_SESSION_KEY, '1');
    } catch {
      // ignore storage issues and continue signup flow
    }
    setIsSignupNewUserFlow(true);
    await createUser(formData);
    await handleSendOtp(formData.phone);
  };

  const handleVerifyOtp = async (otp) => {
    const verificationResponse = await verifyOtp({ phone: phoneNumber, otp });
    const tokens = extractTokensFromResponse(verificationResponse);

    if (!tokens.refreshToken) {
      throw new Error('Login response missing refresh token. Please contact backend team.');
    }

    saveAuthTokens(tokens);

    prefetchRouteChunk('home');
    void getLatestAssessmentIdsCached(45000).catch(() => {});

    try {
      const profileResponse = await getMyProfile();
      const profile = profileResponse?.data && typeof profileResponse.data === 'object'
        ? profileResponse.data
        : profileResponse;
      setUserName(profile?.first_name || '');
      setEmployerOrganizerName(deriveEmployerOrganizerName(profile));
      setUserAge(getAgeFromProfile(profile));

      const activeUserId = Number(profile?.user_id || 0);
      const normalizedCurrentUserId = activeUserId > 0 ? activeUserId : null;
      setCurrentUserId(normalizedCurrentUserId);
      const isNewUserFlow = isSignupNewUserFlow || (() => {
        try {
          return sessionStorage.getItem(PACKAGE_ONBOARDING_NEW_USER_SESSION_KEY) === '1';
        } catch {
          return false;
        }
      })();
      if (isNewUserFlow && normalizedCurrentUserId) {
        setPackageOnboardingEligible(normalizedCurrentUserId, true);
      }
      try {
        sessionStorage.removeItem(PACKAGE_ONBOARDING_NEW_USER_SESSION_KEY);
      } catch {
        // ignore storage issues
      }
      setIsSignupNewUserFlow(false);

      const linkedProfilesResponse = await getMyProfiles();
      const linkedProfiles = Array.isArray(linkedProfilesResponse?.data)
        ? linkedProfilesResponse.data
        : Array.isArray(linkedProfilesResponse)
          ? linkedProfilesResponse
          : [];

      const normalizedLinkedAccounts = linkedProfiles
        .map((item) => {
          const accountId = Number(item?.user_id || item?.id || 0);
          if (accountId <= 0) {
            return null;
          }

          const firstName = String(item?.first_name || '').trim();
          const lastName = String(item?.last_name || '').trim();
          const relationship = String(item?.relationship || '').trim();
          const relationshipLabel = relationship
            ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
            : accountId === normalizedCurrentUserId
              ? 'Primary Account'
              : 'Linked Account';

          return {
            id: accountId,
            name: [firstName, lastName].filter(Boolean).join(' ') || 'User',
            relationshipLabel,
            gender: item?.gender || '',
            isPrimary: relationship.toLowerCase() === 'primary account' || accountId === normalizedCurrentUserId,
          };
        })
        .filter(Boolean);

      const hasCurrentInLinked = normalizedLinkedAccounts.some(
        (account) => Number(account.id) === Number(normalizedCurrentUserId)
      );

      const currentAccount = normalizedCurrentUserId
        ? {
            id: normalizedCurrentUserId,
            name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User',
            relationshipLabel: 'Primary Account',
            gender: profile?.gender || '',
            isPrimary: true,
          }
        : null;

      const normalizedAccounts = hasCurrentInLinked || !currentAccount
        ? normalizedLinkedAccounts
        : [currentAccount, ...normalizedLinkedAccounts];

      setLinkedAccounts(normalizedAccounts);
      setSelectedAccountId(normalizedCurrentUserId || normalizedAccounts[0]?.id || null);

      if (postLoginRedirectPageRef.current) {
        const targetPage = postLoginRedirectPageRef.current;
        postLoginRedirectPageRef.current = '';
        if (targetPage === 'home') {
          prefetchRouteChunk('home');
          try {
            await preloadHomeScreenData();
          } catch {
            /* HomePage will recover via its own fetch */
          }
        }
        applyLockedLanding(targetPage);
        return;
      }
    } catch (profileError) {
      console.error('Failed to fetch user profile:', profileError);
    }

    await preloadHomeScreenData();
    applyLockedLanding('home');
  };

  const resetAppSession = useCallback(() => {
    clearAuthTokens();
    clearReportRequestCache();
    clearStoredLatestAssessmentId();
    invalidateDiagnosticPackagesCache();
    clearSuperclubPlaylistLock();
    setSuperclubPlaylistPayload(null);
    setPhoneNumber('');
    setOtpEmail('');
    setUserAge(null);
    setQuestionnaireSteps([]);
    setQuestionnaireCurrentAssessment(null);
    setQuestionnaireAssessments([]);
    setQuestionnaireQuestionsByCategoryId({});
    setQuestionnaireProgress(0);
    setExpandedQuestionnaireStep(null);
    setQuestionnaireDraftResponsesByRoute({});
    setPreloadedHomeData(null);
    setUserName('');
    setEmployerOrganizerName('');
    try {
      sessionStorage.removeItem('ss_b2b_opened_questionnaire');
      sessionStorage.removeItem(PACKAGE_ONBOARDING_NEW_USER_SESSION_KEY);
    } catch {
      // ignore
    }
    setIsSignupNewUserFlow(false);
    setIsBootstrappingSession(false);
    setCurrentPage('login');
  }, []);

  useEffect(() => {
    const onSessionExpired = (event) => {
      logAuthError('Session expired — redirecting to login', event?.detail ?? null);
      resetAppSession();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [resetAppSession]);

  const handleLogout = async () => {
    const refreshTokenValue = getRefreshToken();

    if (refreshTokenValue) {
      try {
        await logout(refreshTokenValue);
      } catch (error) {
        logAuthError('Logout request failed', error);
      }
    } else {
      logAuthError('Logout skipped — no refresh token in storage', null);
    }

    resetAppSession();
  };

  const getPossessiveLabel = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return 'Your';
    }
    return trimmed.toLowerCase().endsWith('s') ? `${trimmed}'` : `${trimmed}'s`;
  };

  const handleCreateCustomPackage = (payload = {}) => {
    setPendingCustomPackagePayload({
      selectedCount: Number(payload.selectedCount || 0),
      selectedParameters: Number(payload.selectedParameters || 0),
      selectedTests: Array.isArray(payload.selectedTests) ? payload.selectedTests.filter(Boolean) : [],
      totalSale: Number(payload.totalSale || 0),
      totalOld: Number(payload.totalOld || 0),
      offText: String(payload.offText || ''),
    });

    setCurrentPage('review-package');
  };

  const handleCustomPackageBookingConfirmed = () => {
    const payload = pendingCustomPackagePayload || {};
    const selectedTests = Array.isArray(payload.selectedTests)
      ? payload.selectedTests.filter(Boolean)
      : [];

    setCustomPackageCard({
      id: `custom-${Date.now()}`,
      theme: 'custom',
      badges: ['Custom Built', 'Male', 'Female'],
      title: `${getPossessiveLabel(userName)} Custom Package`,
      chips: selectedTests.length > 0 ? selectedTests.slice(0, 4) : ['General health', 'Progressive tests'],
      metrics: {
        parameters: String(Math.max(1, Number(payload.selectedParameters || 0))),
        reportsIn: '48-72 hrs',
        fasting: '10-12 hrs',
      },
      pricing: {
        now: Number(payload.totalSale || 0),
        old: Number(payload.totalOld || 0),
        off: payload.offText || '',
      },
    });

    setPendingCustomPackagePayload(null);
    setCurrentPage('packages');
  };

  const tooltipTourAccountId = selectedAccountId ?? currentUserId;
  const tooltipTourScopeKey =
    tooltipTourAccountId != null && Number.isFinite(Number(tooltipTourAccountId))
      ? String(Number(tooltipTourAccountId))
      : 'pre-auth';
  const isTooltipEligibleHome = Boolean(tooltipTourAccountId != null)
    && hasRenderableOverviewData(preloadedHomeData);
  const canDirectInstallPwa = Boolean(deferredPrompt) && !isIosInstallFlow;
  if (isBootstrappingSession) {
    return (
      <div className="app-root app-root--bootstrapping" aria-busy="true" aria-label="Loading application" />
    );
  }

  return (
        <div
      className={`app-root${isSwipeBackLockedPage ? ' app-root--swipe-back-locked' : ''}${currentPage === 'home' ? ' app-root--home' : ''}`}
      onTouchStart={handleEdgeSwipeStart}
      onTouchMove={handleEdgeSwipeMove}
      onTouchEnd={handleEdgeSwipeEnd}
      onTouchCancel={handleEdgeSwipeCancel}
    >
      <div className="app-background" aria-hidden="true" />
      {currentPage === 'home' && isStandalonePwa() ? (
        <div className="app-home-edge-shield" aria-hidden="true" />
      ) : null}
      {/* PWA Install Prompt Banner - Fixed outside scroll container */}
      {showInstallPrompt && (
        <div className="app-install-popup-wrap" role="dialog" aria-live="polite" aria-label="Install app">
            <button
              type="button"
              className="app-install-popup-close"
              onClick={handleDismissInstall}
              aria-label="Close install popup"
            >
              ×
            </button>
            <div className="app-install-popup-card">
              <div className="app-install-popup-content">
                <div className="app-install-popup-title-row">
                  <span className="app-install-popup-title-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 4v8M9 11l3 3 3-3M7 17h10"
                        stroke="currentColor"
                        strokeWidth="1.65"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <p className="app-install-popup-title">Install SuperShyft App</p>
                </div>
                <p className="app-install-popup-body">
                  {canDirectInstallPwa ? (
                    <>
                      Install SuperShyft on your device for a better experience with offline access and faster loading.
                    </>
                  ) : isIosInstallFlow ? (
                    <>
                      (Tap the <strong className="app-install-popup-share-word">Share</strong> button{' '}
                      <span className="app-install-popup-share-glyph" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 22 22" fill="none">
                          <path fillRule="evenodd" clipRule="evenodd" d="M10.75 1.51873e-07C10.8583 -6.87596e-05 10.9653 0.0233142 11.0637 0.0685414C11.1621 0.113769 11.2495 0.179767 11.32 0.262L14.32 3.762C14.4494 3.91317 14.5135 4.10957 14.4981 4.30798C14.4827 4.5064 14.3892 4.69057 14.238 4.82C14.0868 4.94943 13.8904 5.0135 13.692 4.99812C13.4936 4.98274 13.3094 4.88917 13.18 4.738L11.5 2.778V13.75C11.5 13.9489 11.421 14.1397 11.2803 14.2803C11.1397 14.421 10.9489 14.5 10.75 14.5C10.5511 14.5 10.3603 14.421 10.2197 14.2803C10.079 14.1397 10 13.9489 10 13.75V2.777L8.32 4.738C8.25591 4.81285 8.17771 4.87435 8.08986 4.91898C8.00201 4.96361 7.90623 4.9905 7.80798 4.99812C7.70974 5.00573 7.61096 4.99392 7.51728 4.96336C7.4236 4.9328 7.33685 4.88409 7.262 4.82C7.18715 4.75592 7.12565 4.67771 7.08102 4.58986C7.03639 4.50201 7.0095 4.40623 7.00188 4.30798C6.99427 4.20974 7.00608 4.11096 7.03664 4.01728C7.0672 3.9236 7.11592 3.83685 7.18 3.762L10.18 0.262C10.2505 0.179767 10.3379 0.113769 10.4363 0.0685414C10.5347 0.0233142 10.6417 -6.87596e-05 10.75 1.51873e-07ZM5.746 7.002C5.94491 7.00094 6.1361 7.07894 6.2775 7.21884C6.4189 7.35874 6.49894 7.54909 6.5 7.748C6.50106 7.94691 6.42306 8.1381 6.28316 8.2795C6.14326 8.4209 5.95291 8.50094 5.754 8.502C4.661 8.508 3.886 8.536 3.297 8.644C2.731 8.749 2.402 8.916 2.159 9.159C1.882 9.436 1.702 9.825 1.603 10.559C1.502 11.314 1.5 12.315 1.5 13.75V14.75C1.5 16.186 1.502 17.187 1.603 17.942C1.702 18.676 1.883 19.064 2.159 19.342C2.436 19.618 2.824 19.798 3.559 19.897C4.313 19.999 5.315 20 6.75 20H14.75C16.185 20 17.186 19.999 17.942 19.897C18.676 19.798 19.064 19.618 19.341 19.341C19.618 19.064 19.798 18.676 19.897 17.942C19.998 17.187 20 16.186 20 14.75V13.75C20 12.315 19.998 11.314 19.897 10.558C19.798 9.825 19.617 9.436 19.341 9.159C19.097 8.916 18.769 8.749 18.203 8.644C17.614 8.536 16.839 8.508 15.746 8.502C15.6475 8.50147 15.5501 8.48155 15.4593 8.44338C15.3685 8.4052 15.2861 8.34952 15.2168 8.2795C15.1476 8.20949 15.0928 8.12651 15.0556 8.03532C15.0184 7.94412 14.9995 7.84649 15 7.748C15.0005 7.64951 15.0204 7.55209 15.0586 7.46129C15.0968 7.3705 15.1525 7.28811 15.2225 7.21884C15.2925 7.14957 15.3755 7.09477 15.4667 7.05756C15.5579 7.02035 15.6555 7.00147 15.754 7.002C16.836 7.008 17.737 7.034 18.474 7.169C19.232 7.309 19.877 7.574 20.402 8.099C21.004 8.7 21.262 9.459 21.384 10.359C21.5 11.225 21.5 12.328 21.5 13.695V14.805C21.5 16.173 21.5 17.275 21.384 18.142C21.262 19.042 21.004 19.8 20.402 20.402C19.8 21.004 19.042 21.262 18.142 21.384C17.275 21.5 16.172 21.5 14.805 21.5H6.695C5.328 21.5 4.225 21.5 3.358 21.384C2.458 21.263 1.7 21.004 1.098 20.402C0.496 19.8 0.238 19.042 0.117 18.142C-1.49012e-08 17.275 0 16.172 0 14.805V13.695C0 12.328 -1.49012e-08 11.225 0.117 10.358C0.237 9.458 0.497 8.7 1.098 8.098C1.623 7.574 2.268 7.308 3.026 7.169C3.763 7.034 4.664 7.008 5.746 7.002Z" fill="white"/>
                        </svg>
                      </span>{' '}
                      at the bottom, then select &quot;Add to Home Screen&quot; to install SuperShyft).
                    </>
                  ) : (
                    <>When your browser offers it, use Install or add this site to your home screen to install SuperShyft.</>
                  )}
                </p>
                <button
                  type="button"
                  className={`app-install-popup-got-it${canDirectInstallPwa ? ' app-install-popup-got-it--install' : ''}`}
                  onClick={handleInstallGotIt}
                >
                  {canDirectInstallPwa ? 'Install Now' : 'Got it'}
                </button>
              </div>
            </div>
        </div>
      )}
      {/*
        Camp Doctor consultation — compact card above the navbar (not a full-screen page).
        To hide: set CAMP_DOCTOR_CONSULTATION_ENABLED to false, or comment this block
        and the CampDoctorConsultationPage import above.
      */}
      {CAMP_DOCTOR_CONSULTATION_ENABLED && currentPage === 'home' && getUpcomingCampAppointment(campAppointments) ? (
        <ConsultationReminderBar
          appointment={getUpcomingCampAppointment(campAppointments)}
          onOpen={() => setCurrentPage('all-appointments')}
        />
      ) : null}
      {CAMP_DOCTOR_CONSULTATION_ENABLED && currentPage === 'home' && showCampDoctorConsultation && !getUpcomingCampAppointment(campAppointments) ? (
        <CampDoctorConsultationPage
          engagementId={doctorConsultationContext?.engagementId}
          engagementCode={doctorConsultationContext?.engagementCode}
          consultationMode={doctorConsultationContext?.consultationMode}
          expertType={doctorConsultationContext?.expertType}
          onClose={() => {
            campDoctorPopupDismissedRef.current = true;
            setShowCampDoctorConsultation(false);
            setDoctorConsultationContext(null);
          }}
          onOptOut={() => {
            const popupUserId = selectedAccountId ?? currentUserId;
            optOutOfConsultationPopup(popupUserId, doctorConsultationContext?.engagementId);
            campDoctorPopupDismissedRef.current = true;
            setShowCampDoctorConsultation(false);
            setDoctorConsultationContext(null);
          }}
          onAppointmentBooked={(appointment) => {
            if (appointment) {
              setCampAppointments(saveCampAppointment(appointment));
              campDoctorPopupDismissedRef.current = true;
              setShowCampDoctorConsultation(false);
              setDoctorConsultationContext(null);
            }
          }}
          onViewAppointment={() => {
            setCurrentPage('all-appointments');
          }}
        />
      ) : null}
      <AppTooltipTour
        key={tooltipTourScopeKey}
        currentPage={currentPage}
        enabled={isTooltipEligibleHome}
        scopeKey={tooltipTourScopeKey}
      />
      <div
        className={`app-scroll${currentPage === 'home' ? ' app-scroll--home-lock' : ''}${currentPage === 'super-club' || currentPage === 'super-club-playlist-confirm' ? ' app-scroll--superclub2-lock' : ''}`}
        ref={appScrollRef}
      >
      <Suspense fallback={null}>
      {currentPage === 'login' && (
        <LoginPage 
          onSuccess={handleSendOtp}
          onSignup={() => setCurrentPage('signup')}
        />
      )}

      {currentPage === 'signup' && (
        <SignupPage 
          onSuccess={handleSignup}
          onLogin={() => setCurrentPage('login')}
        />
      )}

      {currentPage === 'otp' && (
        <OTPPage 
          phoneNumber={phoneNumber}
          email={otpEmail}
          onVerifyOtp={handleVerifyOtp}
          onResendOtp={handleResendOtp}
          onBack={() => setCurrentPage('login')}
        />
      )}

      {currentPage === 'home' && (
        <HomePage
          key={`home-${selectedAccountId ?? currentUserId ?? 'guest'}${
            typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('page') === 'home-scheduled'
              ? '-scheduled-preview'
              : typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('page') === 'home-slot-passed'
                ? '-slot-passed-preview'
                : ''
          }`}
          userName={userName}
          userAge={userAge}
          employerOrganizerFallback={employerOrganizerName}
          preloadedData={preloadedHomeData}
          forceRefreshFromProfile={forceHomeApiRefresh}
          forceScheduledPreview={
            typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('page') === 'home-scheduled'
          }
          forceSlotPassedPreview={
            typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('page') === 'home-slot-passed'
          }
          onNavigateToHealthScan={() => {
            console.log('Navigate to Health Span Index');
            setSelectedHealthScanTab(0);
            setCurrentPage('health-scan-index');
          }}
          onNavigateToHealthScanTab={(tabIndex) => {
            console.log('Navigate to Health Span Index tab:', tabIndex);
            setSelectedHealthScanTab(tabIndex);
            setCurrentPage('health-scan-index');
          }}
          onNavigateToProfile={() => {
            console.log('Navigate to Profile');
            setCurrentPage('profile');
          }}
          onNavigateToRiskAnalysis={() => {
            console.log('Navigate to Disease Risk Analysis');
            setCurrentPage('disease-risk-analysis');
          }}
          onNavigateToDiseaseDetail={(disease) => {
            setSelectedDisease(disease);
            setCurrentPage('disease-detail');
          }}
          onOpenHealthAssessment={handleOpenHealthAssessmentFromHome}
          onOpenB2bHealthAssessment={handleOpenB2bHealthAssessment}
          onOpenFitprintGapQuestionnaire={handleOpenFitprintGapQuestionnaire}
          onNavigateToBloodMarkers={() => {
            console.log('Navigate to Blood Markers');
            setBloodMarkersInitialFilter(null);
            setBloodMarkersReturnPage('home');
            setCurrentPage('blood-markers');
          }}
          onNavigateToCancerMarkers={() => {
            setBloodMarkersInitialFilter('Cancer');
            setBloodMarkersReturnPage('home');
            setCurrentPage('blood-markers');
          }}
          onNavigateToAllergySensitivity={() => {
            setCurrentPage('allergy-sensitivity');
          }}
          onNavigateToBloodMarkerDetail={handleNavigateToBloodMarkerDetail}
          onNavigateToPackages={() => {
            console.log('Navigate to Packages');
            setCurrentPage('packages');
          }}
          onNavigateToDoctors={() => {
            console.log('Navigate to Doctors');
            setCurrentPage('doctors');
          }}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onOpenAllAppointments={() => {
            setCurrentPage('all-appointments');
          }}
        />
      )}

      {currentPage === 'super-club' && (
        <Superclub2Page
          userName={userName}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onJoinEarlyAccess={navigateToEarlyAccessFlow}
        />
      )}

      {currentPage === 'super-club-early-access' && (
        <SuperclubEarlyAccessPage
          userName={userName}
          initialPayload={superclubPlaylistPayload}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onDone={(payload) => {
            const p = payload || {};
            persistSuperclubPlaylistLock(p);
            setSuperclubPlaylistPayload(p);
            saveSuperclubMcqPreferences(p).catch(() => {});
            setCurrentPage('super-club-playlist-confirm');
          }}
        />
      )}

      {currentPage === 'super-club-playlist-confirm' && (
        <SuperclubPlaylistConfirmPage
          userName={userName}
          playlistPayload={superclubPlaylistPayload}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onStayUpdated={navigateToHome}
        />
      )}

      {SUPERCLUB_V1_SCREENS_ENABLED && currentPage === 'super-club-swipe' && (
        <SuperClubPage
          userName={userName}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onOnboardingComplete={handleSuperClubOnboardingComplete}
        />
      )}

      {SUPERCLUB_V1_SCREENS_ENABLED && currentPage === 'super-club-v1-playlist' && (
        <SuperClubPlaylistPage
          userName={userName}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onJoinEarly={() => {
            setCurrentPage('super-club');
          }}
        />
      )}

      {SUPERCLUB_V1_SCREENS_ENABLED && currentPage === 'super-club-2' && (
        <SuperClubPage2
          userName={userName}
          likedSports={getSuperClubSportsByIds(superClubLikedSportIds)}
          onMenuClick={() => {
            setCurrentPage('profile');
          }}
          onNavigateHome={navigateToHome}
          onNavigateToDoctors={() => {
            setCurrentPage('doctors');
          }}
          onNavigateToPackages={() => {
            setCurrentPage('packages');
          }}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onStayUpdated={navigateToHome}
          onSelectSport={() => {}}
        />
      )}

      {currentPage === 'packages' && (
        <PackagesPage
          accountScopeId={selectedAccountId ?? currentUserId}
          customPackageCard={customPackageCard}
          onNavigateHome={navigateToHome}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onNavigateToDoctors={() => {
            console.log('Navigate to Doctors');
            setCurrentPage('doctors');
          }}
          onOpenPackageDetails={(pkg) => {
            setSelectedPackageCard(pkg || null);
            console.log('Navigate to Package Details');
            setCurrentPage('package-details');
          }}
          onOpenCreateCustomPackage={() => {
            console.log('Navigate to Create Custom Package');
            setCurrentPage('create-custom-package');
          }}
        />
      )}

      {currentPage === 'doctors' && (
        <DoctorsPage
          onBack={navigateToHome}
          onNavigateToSuperClub={navigateToSuperClubFlow}
          onOpenPackages={() => {
            console.log('Navigate to Packages');
            setCurrentPage('packages');
          }}
          onOpenDoctorProfile={(expert) => {
            console.log('Navigate to Expert Details');
            const kind = typeof expert === 'string' ? expert : (expert?.kind || 'doctor');
            setSelectedExpertKind(kind);
            setSelectedExpert(typeof expert === 'string' ? null : (expert || null));
            setCurrentPage('expert-details-doctor');
          }}
          onOpenIntegratedProfile={() => {
            console.log('Navigate to Integrated Health Program');
            setCurrentPage('integrated-health-program');
          }}
        />
      )}

      {currentPage === 'integrated-health-program' && (
        <IntegratedHealthProgramPage
          onBack={() => {
            console.log('Back to Doctors');
            setCurrentPage('doctors');
          }}
        />
      )}

      {currentPage === 'expert-details-doctor' && (
        <DoctorProfilePage
          profileKind={selectedExpertKind}
          expert={selectedExpert}
          bookingUserId={selectedAccountId ?? currentUserId}
          onBack={() => {
            console.log('Back to Doctors');
            setCurrentPage('doctors');
          }}
          onGoHome={() => setCurrentPage('home')}
          onViewAppointments={() => setCurrentPage('all-appointments')}
        />
      )}

      {currentPage === 'expert-details-nutritionist' && (
        <DoctorProfilePage
          profileKind="nutritionist"
          bookingUserId={selectedAccountId ?? currentUserId}
          onBack={() => {
            console.log('Back to Doctors');
            setCurrentPage('doctors');
          }}
          onGoHome={() => setCurrentPage('home')}
          onViewAppointments={() => setCurrentPage('all-appointments')}
        />
      )}

      {currentPage === 'package-details' && (
        <PackageDetailsPage
          packageId={selectedPackageCard?.apiData?.diagnostic_package_id || selectedPackageCard?.id || null}
          packageCard={selectedPackageCard}
          onBack={() => {
            console.log('Back to Packages');
            setCurrentPage('packages');
          }}
        />
      )}

      {currentPage === 'create-custom-package' && (
        <CreateCustomPackagePage
          onBack={() => {
            console.log('Back to Packages');
            setCurrentPage('packages');
          }}
          onCreatePackage={handleCreateCustomPackage}
        />
      )}

      {currentPage === 'review-package' && (
        <PackageDetailsPage
          variant="custom-review"
          profileName={userName}
          onCustomBookingConfirmed={handleCustomPackageBookingConfirmed}
          onBack={() => {
            console.log('Back to Create Custom Package');
            setCurrentPage('create-custom-package');
          }}
        />
      )}

      {currentPage === 'blood-markers' && (
        <BloodMarkersPage
          {...bloodMarkersPageDetailProps}
          onBack={() => {
            if (bloodMarkersReturnPage === 'allergy-sensitivity') {
              setBloodMarkersReturnPage('home');
              setCurrentPage('allergy-sensitivity');
              return;
            }
            navigateToHome();
          }}
        />
      )}

      {currentPage === 'allergy-sensitivity' && (
        <AllergySensitivityPage
          onBack={navigateToHome}
          onSeeMore={() => {
            setBloodMarkersInitialFilter('Allergies');
            setBloodMarkersReturnPage('allergy-sensitivity');
            setCurrentPage('blood-markers');
          }}
        />
      )}

      {currentPage === 'questionnaire-null-catchup' && Number(nullCatchupAssessmentInstanceId) > 0 && (
        <QuestionnaireNullCatchupPage
          assessmentInstanceId={nullCatchupAssessmentInstanceId}
          onBack={() => {
            setNullCatchupAssessmentInstanceId(null);
            setForceHomeApiRefresh(true);
            navigateToHome();
          }}
          onDone={() => {
            setNullCatchupAssessmentInstanceId(null);
            markFitprintGapQuestionnaireSubmitted();
            invalidateFamilyHistoryQuestionnaireDraftCache();
            invalidateNutritionLogQuestionnaireDraftCache();
            clearReportRequestCache();
            setForceHomeApiRefresh(true);
            navigateToHome();
          }}
        />
      )}

      {currentPage === 'health-assessment' && (
        <HealthAssessmentPage
          isB2b={isB2bQuestionnaireFlow}
          steps={questionnaireSteps}
          progress={questionnaireProgress}
          expandedStep={expandedQuestionnaireStep}
          onExpandStep={(stepIndex) => {
            setExpandedQuestionnaireStep(stepIndex);
          }}
          questionsByRouteId={{
            'anthropometry': getQuestionsByRoute('anthropometry'),
            'family-history': getQuestionsByRoute('family-history'),
            'lifestyle-habits': getQuestionsByRoute('lifestyle-habits'),
            'nutrition-log': getQuestionsByRoute('nutrition-log'),
            'vitals': getQuestionsByRoute('vitals'),
          }}
          initialResponsesByRoute={questionnaireDraftResponsesByRoute}
          onStepComplete={handleStepComplete}
          onStepDraftSave={handleStepDraftSave}
          onAssessmentSubmit={async () => {
            await submitLatestEngagementAssessment({ excludeVitals: isB2bQuestionnaireFlow });

            try {
              sessionStorage.removeItem('ss_b2b_opened_questionnaire');
            } catch {
              // ignore
            }
            clearReportRequestCache();
            clearStoredLatestAssessmentId();
            invalidateNutritionLogQuestionnaireDraftCache();
            invalidateFamilyHistoryQuestionnaireDraftCache();
            invalidateHealthQuestionnaireSubmittedCache();

            let successTitle = 'Submitted successfully!';
            try {
              const [nutritionSaved, familySaved] = await Promise.all([
                hasNutritionLogQuestionnaireDraft({ forceRefresh: true }),
                hasFamilyHistoryQuestionnaireDraft({ forceRefresh: true }),
              ]);
              if (nutritionSaved || familySaved) {
                successTitle = 'Questionnaire completed!';
              }
            } catch {
              // keep default title
            }
            setQuestionnaireSuccessMessage(successTitle);
          }}
          onNavigateHome={() => {
            setQuestionnaireSuccessMessage(null);
            invalidateNutritionLogQuestionnaireDraftCache();
            invalidateFamilyHistoryQuestionnaireDraftCache();
            setForceHomeApiRefresh(true);
            navigateToHome();
          }}
          onBack={() => {
            const next = healthAssessmentBackPage || 'home';
            if (next === 'home') {
              invalidateNutritionLogQuestionnaireDraftCache();
              invalidateFamilyHistoryQuestionnaireDraftCache();
              setForceHomeApiRefresh(true);
              navigateToHome();
              return;
            }
            setCurrentPage(next);
          }}
        />
      )}

      {currentPage === 'questionnaire-blank' && (
        <QuestionnaireBlankPage
          onBack={() => {
            setExpandedQuestionnaireStep(null);
            setCurrentPage('health-assessment');
          }}
        />
      )}

      {currentPage === 'health-scan-index' && (
        <HealthScanIndexPage 
          initialTab={selectedHealthScanTab}
          onBack={navigateToHome}
          onNavigateToRiskAnalysis={() => {
            console.log('Navigate to Disease Risk Analysis');
            setCurrentPage('disease-risk-analysis');
          }}
        />
      )}

      {currentPage === 'disease-risk-analysis' && (
        <DiseaseRiskAnalysisPage 
          onBack={navigateToHome}
          onDiseaseSelect={(disease) => {
            setSelectedDisease(disease);
            setCurrentPage('disease-detail');
          }}
        />
      )}

      {currentPage === 'disease-detail' && (
        <DiseaseDetailPage
          disease={selectedDisease}
          onBack={() => {
            console.log('Back to Disease Risk Analysis');
            setCurrentPage('disease-risk-analysis');
          }}
        />
      )}

      {currentPage === 'profile' && (
        <ProfilePage
          onAccountSwitched={(payload = {}) => {
            const switchedProfile = payload?.profile && typeof payload.profile === 'object'
              ? payload.profile
              : null;

            setUserName(switchedProfile?.first_name || '');
            setEmployerOrganizerName(deriveEmployerOrganizerName(switchedProfile));
            setUserAge(getAgeFromProfile(switchedProfile));

            const switchedUserId = Number(switchedProfile?.user_id || 0);
            const normalizedSwitchedUserId = switchedUserId > 0 ? switchedUserId : null;
            setCurrentUserId(normalizedSwitchedUserId);
            setSelectedAccountId(normalizedSwitchedUserId);

            const linkedProfiles = Array.isArray(payload?.linkedProfiles) ? payload.linkedProfiles : [];
            const normalizedLinkedAccounts = linkedProfiles
              .map((item) => {
                const accountId = Number(item?.user_id || item?.id || 0);
                if (accountId <= 0) {
                  return null;
                }

                const firstName = String(item?.first_name || '').trim();
                const lastName = String(item?.last_name || '').trim();
                const relationship = String(item?.relationship || '').trim();
                const relationshipLabel = relationship
                  ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
                  : accountId === normalizedSwitchedUserId
                    ? 'Primary Account'
                    : 'Linked Account';

                return {
                  id: accountId,
                  name: [firstName, lastName].filter(Boolean).join(' ') || 'User',
                  relationshipLabel,
                  gender: item?.gender || '',
                  isPrimary: relationship.toLowerCase() === 'primary account' || accountId === normalizedSwitchedUserId,
                };
              })
              .filter(Boolean);

            setLinkedAccounts(normalizedLinkedAccounts);
            clearReportRequestCache();
            clearStoredLatestAssessmentId();
            setPreloadedHomeData(null);
            setForceHomeApiRefresh(true);
            void preloadHomeScreenData();
          }}
          onBack={() => {
            clearReportRequestCache();
            clearStoredLatestAssessmentId();
            setForceHomeApiRefresh(true);
            navigateToHome();
          }}
          onOpenReports={() => {
            console.log('Navigate to Reports');
            setCurrentPage('reports');
          }}
          onOpenCustomerSupport={() => {
            console.log('Navigate to Customer Support');
            setCurrentPage('customer-support');
          }}
          onOpenAllAppointments={() => {
            console.log('Navigate to All Appointments');
            setCurrentPage('all-appointments');
          }}
          onOpenAddresses={() => {
            setCurrentPage('addresses');
          }}
          onOpenAddAccount={() => {
            console.log('Navigate to Add Account');
            setCurrentPage('add-account');
          }}
          onOpenEditProfile={() => {
            console.log('Navigate to Edit Profile');
            setCurrentPage('edit-profile');
          }}
          onOpenFaq={() => {
            console.log("Navigate to FAQ's");
            setCurrentPage('faq');
          }}
          onOpenTerms={() => {
            console.log('Navigate to Terms & Conditions');
            setCurrentPage('terms');
          }}
          onOpenPrivacy={() => {
            console.log('Navigate to Privacy Policy');
            setCurrentPage('privacy-policy');
          }}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'reports' && (
        <ReportsPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'customer-support' && (
        <CustomerSupportPage
          currentUserId={currentUserId}
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'permissions' && (
        <PermissionsPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'all-appointments' && (
        <AllAppointmentsPage
          appointments={campAppointments}
          onOpenAppointment={(appointment) => {
            const expertId = Number(appointment?.expertId ?? appointment?.expert_id);
            setSelectedAppointment(appointment ? {
              ...appointment,
              expertId: Number.isFinite(expertId) && expertId > 0 ? expertId : (appointment.expertId ?? null),
              expert_id: Number.isFinite(expertId) && expertId > 0 ? expertId : (appointment.expert_id ?? null),
            } : null);
            setCurrentPage('appointment-details');
          }}
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'appointment-details' && (
        <AppointmentDetailsPage
          key={selectedAppointment?.id || selectedAppointment?.consultationId || 'appointment-details'}
          appointment={selectedAppointment}
          onBack={() => {
            setCurrentPage('all-appointments');
          }}
          onRescheduled={(_result, nextSlot) => {
            if (selectedAppointment && nextSlot) {
              setSelectedAppointment({
                ...selectedAppointment,
                apiDate: nextSlot.date || selectedAppointment.apiDate,
                apiSlot: nextSlot.slot || selectedAppointment.apiSlot,
                cabin: nextSlot.cabin ?? selectedAppointment.cabin,
              });
            }
            setCurrentPage('all-appointments');
          }}
        />
      )}

      {currentPage === 'addresses' && (
        <AddressesPage
          onBack={() => {
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'consultation-notes' && (
        <ConsultationNotesPage
          onBack={() => {
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'add-account' && (
        <AddAccountPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'edit-profile' && (
        <EditProfilePage
          currentUserId={currentUserId}
          linkedAccounts={linkedAccounts}
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'faq' && (
        <FAQPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'rate-experience' && (
        <RateExperiencePage
          currentUserId={currentUserId}
          onBack={() => {
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'terms' && (
        <TermsConditionsPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'privacy-policy' && (
        <PrivacyPolicyPage
          onBack={() => {
            console.log('Back to Profile');
            setCurrentPage('profile');
          }}
        />
      )}

      {currentPage === 'splash' && !isBootstrappingSession && (
        <SplashScreen
          onComplete={() => {
            console.log('Splash animation complete');
          }}
          onLogin={() => setCurrentPage('login')}
          onSignup={() => setCurrentPage('signup')}
          showInstallBannerLogo={showInstallPrompt}
        />
      )}
      </Suspense>
      </div>
      {Boolean(questionnaireSuccessMessage) && (
        <div
          className="questionnaire-success-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-live="polite"
          aria-labelledby="questionnaire-success-title"
          onClick={handleQuestionnaireSuccessOk}
        >
          <div
            className="questionnaire-success-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="questionnaire-success-close"
              onClick={handleQuestionnaireSuccessOk}
              aria-label="Close"
            >
              ×
            </button>
            <h3 id="questionnaire-success-title" className="questionnaire-success-title">
              {questionnaireSuccessMessage}
            </h3>
            <p className="questionnaire-success-description">
              You can review your results from the home screen anytime.
            </p>
            <div className="questionnaire-success-actions">
              <button
                type="button"
                className="questionnaire-success-btn questionnaire-success-btn--ok"
                onClick={handleQuestionnaireSuccessOk}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
