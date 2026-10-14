/*
 * Centralized route-level prefetch for code-split pages.
 *
 * React.lazy() defers each screen’s JS until first navigation. Calling the same
 * dynamic import() ahead of time warms webpack’s module cache so the next
 * `setCurrentPage(...)` mount is not blocked on network + parse for that chunk.
 *
 * This does **not** mount React trees off-screen (that would duplicate effects
 * and data fetches). For “instant” UX we prefetch **chunks** at idle; first
 * paint of the destination still runs once when you navigate.
 */

import { preloadSuperclub2TileImages } from './superclub2ImagePreload';
import { prefetchPackagesPageData } from '../services/diagnosticPackagesService';

const APP_ROUTE_LOADERS = {
  home: () => import('../pages/HomePage'),
  /** Same module as `doctors`; NavBar uses this id. */
  'super-sync': () => import('../pages/DoctorsPage'),
  otp: () => import('../pages/OTPPage'),
  signup: () => import('../pages/SignupPage'),
  'health-scan-index': () => import('../pages/HealthScanIndexPage'),
  profile: () => import('../pages/ProfilePage'),
  'all-appointments': () => import('../pages/AllAppointmentsPage'),
  'appointment-details': () => import('../pages/AppointmentDetailsPage'),
  addresses: () => import('../pages/AddressesPage'),
  'consultation-notes': () => import('../pages/ConsultationNotesPage'),
  'new-des-ques': () => import('../pages/NewDesQuesPage'),
  reports: () => import('../pages/ReportsPage'),
  nutrition: () => import('../pages/NutritionPage'),
  'customer-support': () => import('../pages/CustomerSupportPage'),
  permissions: () => import('../pages/PermissionsPage'),
  'add-account': () => import('../pages/AddAccountPage'),
  'edit-profile': () => import('../pages/EditProfilePage'),
  faq: () => import('../pages/FAQPage'),
  'rate-experience': () => import('../pages/RateExperiencePage'),
  terms: () => import('../pages/TermsConditionsPage'),
  'privacy-policy': () => import('../pages/PrivacyPolicyPage'),
  'health-assessment': () => import('../pages/HealthAssessmentPage'),
  'questionnaire-blank': () => import('../pages/QuestionnaireBlankPage'),
  'blood-markers': () => import('../pages/BloodMarkersPage/BloodMarkersPage'),
  'allergy-sensitivity': () => import('../pages/AllergySensitivityPage/AllergySensitivityPage'),
  packages: () => import('../pages/PackagesPage'),
  'package-details': () => import('../pages/PackageDetailsPage'),
  'create-custom-package': () => import('../pages/CreateCustomPackagePage/CreateCustomPackagePage'),
  'review-package': () => import('../pages/PackageDetailsPage'),
  doctors: () => import('../pages/DoctorsPage'),
  'integrated-health-program': () => import('../pages/IntegratedHealthProgramPage'),
  'expert-details-doctor': () => import('../pages/DoctorProfilePage'),
  'expert-details-nutritionist': () => import('../pages/DoctorProfilePage'),
  'super-club': () => import('../pages/Superclub2/Superclub2Page'),
  'super-club-early-access': () => import('../pages/Superclub2/SuperclubEarlyAccessPage'),
  'super-club-playlist-confirm': () => import('../pages/Superclub2/SuperclubPlaylistConfirmPage'),
  'super-club-swipe': () => import('../pages/SuperClubPage/SuperClubPage'),
  'super-club-v1-playlist': () => import('../pages/SuperClubPage/SuperClubPlaylistPage'),
  'super-club-2': () => import('../pages/SuperClubPage/SuperClubPage2'),
  'disease-risk-analysis': () => import('../pages/DiseaseRiskAnalysisPage'),
  'disease-detail': () => import('../pages/DiseaseDetailPage'),
};

const NAVBAR_ROUTE_IDS = ['home', 'packages', 'super-club', 'super-sync'];

export const prefetchRouteChunk = (id) => {
  const loader = APP_ROUTE_LOADERS[id];
  if (!loader) {
    return;
  }

  try {
    if (id === 'super-club') {
      preloadSuperclub2TileImages();
    }
    if (id === 'packages') {
      prefetchPackagesPageData();
    }
    loader();
  } catch (error) {
    console.warn('Route prefetch failed:', id, error);
  }
};

/** Bottom-nav destinations (plus doctors as “super-sync”). Home first — most common landing after auth. */
export const prefetchNavbarRoutes = () => {
  prefetchRouteChunk('home');
  NAVBAR_ROUTE_IDS.filter((id) => id !== 'home').forEach(prefetchRouteChunk);
};

/** All other lazy screens after nav targets are warm (second idle slice). */
export const prefetchSecondaryAppRouteChunks = () => {
  Object.keys(APP_ROUTE_LOADERS)
    .filter((id) => !NAVBAR_ROUTE_IDS.includes(id))
    .forEach(prefetchRouteChunk);
};

/**
 * Likely navigations from the current screen (same chunk ids as `currentPage` in App).
 * Used to prefetch the *next* route’s JS right after landing so the first tap is fast
 * even before the global idle sweep finishes.
 */
const LIKELY_NEXT_ROUTES = {
  splash: ['login', 'signup'],
  login: ['signup', 'otp'],
  signup: ['login', 'otp'],
  otp: ['home'],
  home: [
    'profile',
    'health-scan-index',
    'health-assessment',
    'blood-markers',
    'disease-risk-analysis',
    'packages',
    'doctors',
    'super-club',
  ],
  profile: [
    'edit-profile',
    'faq',
    'terms',
    'privacy-policy',
    'all-appointments',
    'addresses',
    'consultation-notes',
    'permissions',
    'customer-support',
    'reports',
    'home',
  ],
  packages: ['package-details', 'create-custom-package', 'home'],
  'package-details': ['review-package', 'packages', 'home'],
  'create-custom-package': ['review-package', 'packages'],
  'review-package': ['packages', 'home'],
  doctors: ['expert-details-doctor', 'expert-details-nutritionist', 'integrated-health-program', 'home'],
  'integrated-health-program': ['doctors', 'home'],
  'expert-details-doctor': ['doctors'],
  'expert-details-nutritionist': ['doctors'],
  'super-club': ['super-club-early-access', 'super-club-swipe', 'super-club-v1-playlist', 'health-assessment', 'home'],
  'super-club-early-access': ['super-club-playlist-confirm', 'home', 'super-club'],
  'super-club-playlist-confirm': ['home', 'super-club'],
  'super-club-swipe': ['super-club-2', 'super-club', 'home'],
  'super-club-v1-playlist': ['super-club', 'home'],
  'super-club-2': ['super-club', 'home'],
  'health-scan-index': ['home'],
  'blood-markers': ['home'],
  'disease-risk-analysis': ['disease-detail', 'home'],
  'disease-detail': ['disease-risk-analysis', 'home'],
  'health-assessment': ['home', 'questionnaire-blank'],
  'questionnaire-blank': ['health-assessment', 'home'],
  'edit-profile': ['profile', 'add-account'],
  'add-account': ['profile', 'edit-profile'],
  faq: ['profile'],
  terms: ['profile'],
  'privacy-policy': ['profile'],
  'all-appointments': ['profile'],
  addresses: ['profile'],
  'consultation-notes': ['profile'],
  'new-des-ques': ['profile'],
  permissions: ['profile'],
  'customer-support': ['profile'],
  nutrition: ['profile'],
  reports: ['profile'],
};

/**
 * Prefetch webpack chunks for routes the user is likely to open next from `currentPage`.
 * Schedules work on idle so it does not compete with the incoming screen’s first paint.
 */
export const prefetchLikelyNextRoutes = (currentPage) => {
  const ids = LIKELY_NEXT_ROUTES[String(currentPage || '')];
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  if (ids.includes('home')) {
    prefetchRouteChunk('home');
  }

  const run = () => {
    ids.forEach((id) => {
      if (id === 'home') {
        return;
      }
      prefetchRouteChunk(id);
    });
  };

  if (typeof window === 'undefined') {
    return;
  }

  const ric = window.requestIdleCallback;
  if (typeof ric === 'function') {
    ric(run, { timeout: 2500 });
    return;
  }

  window.setTimeout(run, 0);
};
