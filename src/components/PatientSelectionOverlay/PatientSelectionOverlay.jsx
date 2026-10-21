import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './PatientSelectionOverlay.css';
import maleAvatar from '../../images/male-avatar.png';
import femaleAvatar from '../../images/female-avatar.png';
import { getMyProfiles, createMySubProfile, invalidateMyProfilesCache } from '../../services/usersService';
import { createMyAddress, getMyProfile, listMyAddresses } from '../../services/profileService';
import {
  assignGroupsToPackage,
  createDiagnosticPackage,
  getDiagnosticPackageTests,
  listDiagnosticPackages,
  listDiagnosticPackageFilterChips,
  listDiagnosticTestGroups,
  listDiagnosticTestGroupTests,
  listPublicDiagnosticPackageFilterChips,
  removeGroupFromPackage,
} from '../../services/diagnosticPackagesService';
import {
  loadRazorpayScript,
  getDefaultRazorpayKeyId,
} from '../../services/paymentService';
import {
  bookBioAiBatch,
  buildAvailableSlotsPayload,
  buildBookPayPayload,
  extractBioAiBookingMembers,
  getBioAiBookingFailureMessage,
  getPrimaryBioAiBookingId,
  buildCheckServiceAvailabilityPayload,
  buildLockSlotsPayload,
  AREA_NOT_SERVICEABLE_MESSAGE,
  checkServiceAvailability,
  chunkScheduleSlots,
  createBookPayOrder,
  fetchAvailableSlots,
  validateDiscountCode,
  formatApiSlotTimeToDisplay,
  formatBloodCollectionTimeSlot,
  isServiceAvailabilityDenied,
  lockSlots,
  mapServiceAvailabilityByUserId,
  normalizeAvailableSlotsForUi,
} from '../../services/bookingService';
import { PAYMENT_DEMO_MODE, BACKEND_ENABLED } from '../../config/appConfig';
import {
  buildResolvedAddressFromEngagement,
  buildServiceAvailabilityMapFromEngagement,
  engagementHasAddress,
  findPackageCardByDiagnosticPackageId,
  getDraftParticipantUserIds,
  getDraftScheduleTimeLabel,
  matchScheduleDateId,
  parseEngagementAddressToForm,
  resolveDraftResumeView,
} from '../../utils/bookingDraftUtils';
import { validateCityMatchesPincode } from '../../utils/pincodeCityMatch';
import {
  MAX_USER_ADDRESSES,
  bookingFormToAddressPayload,
  formatProfileAddressDisplay,
  savedAddressToBookingForm,
} from '../../utils/profileAddress';
import { hasPersonalizedForYouRecommendations, loadPackageOnboardingResult } from '../../utils/packageRecommendationStorage';
import PackageDetailsPage from '../../pages/PackageDetailsPage/PackageDetailsPage';

const PATIENTS = [];

const toCustomGroupNumericId = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const normalizeCustomGroupCard = (row, index = 0) => {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const title = String(
    row.title
    || row.group_name
    || row.test_group_name
    || row.name
    || `Test Group ${index + 1}`
  ).trim();
  const groupId = toCustomGroupNumericId(
    row.groupId
    ?? row.group_id
    ?? row.diagnostic_test_group_id
    ?? row.test_group_id
    ?? row.id
  );
  const id = String(row.id || (groupId ? `test-group-${groupId}` : `test-group-${index}`)).trim();
  const salePrice = Math.max(0, Math.round(Number(row.salePrice ?? row.price ?? row.sale_price ?? 0) || 0));
  const oldPriceCandidate = Math.max(0, Math.round(Number(row.oldPrice ?? row.original_price ?? row.old_price ?? salePrice) || 0));
  const tags = Array.isArray(row.tags)
    ? row.tags.map((tag) => {
      if (typeof tag === 'string' || typeof tag === 'number') {
        return String(tag).trim();
      }
      return String(tag?.display_name || tag?.chip_key || tag?.name || tag?.tag_name || '').trim();
    }).filter(Boolean)
    : Array.isArray(row.filter_chips)
      ? row.filter_chips.map((chip) => String(chip?.display_name || chip?.chip_key || chip?.name || '').trim()).filter(Boolean)
      : [];
  const tests = Array.isArray(row.tests)
    ? row.tests.map((test) => {
      if (typeof test === 'string' || typeof test === 'number') {
        return String(test).trim();
      }
      return String(test?.test_name || test?.parameter_name || test?.name || test?.title || '').trim();
    }).filter(Boolean)
    : [];

  return {
    id,
    groupId,
    title,
    salePrice,
    oldPrice: oldPriceCandidate >= salePrice ? oldPriceCandidate : salePrice,
    tags,
    tests,
    testsLoaded: Boolean(row.testsLoaded) || tests.length > 0,
  };
};

const mergeCustomGroupCards = (current, incoming) => {
  const map = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])]
    .map((row, index) => normalizeCustomGroupCard(row, index))
    .filter(Boolean)
    .forEach((card) => {
      const existing = map.get(card.id);
      if (!existing) {
        map.set(card.id, card);
        return;
      }
      map.set(card.id, {
        ...existing,
        ...card,
        tests: card.tests.length > 0 ? card.tests : existing.tests,
        testsLoaded: card.testsLoaded || existing.testsLoaded,
      });
    });
  return Array.from(map.values());
};

const toGroupSetKey = (groupIds) => (
  (Array.isArray(groupIds) ? groupIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b)
    .join(',')
);

const extractAssignedGroupIds = (payload) => {
  const groups = Array.isArray(payload?.groups) ? payload.groups : [];
  return groups
    .map((group) => toCustomGroupNumericId(group?.group_id ?? group?.diagnostic_test_group_id ?? group?.id))
    .filter(Boolean);
};

const getPossessiveLabel = (name) => {
  const trimmed = String(name || '').trim() || 'User';
  return trimmed.toLowerCase().endsWith('s') ? `${trimmed}'` : `${trimmed}'s`;
};

const formatCustomGroupNames = (groups) => (
  (Array.isArray(groups) ? groups : [])
    .map((item) => String(item?.title || '').trim())
    .filter(Boolean)
    .join(' • ')
);

const PACKAGE_OPTIONS = [
  {
    id: 'advanced',
    name: 'Advanced Wellness Panel',
    currentPrice: 1999,
    oldPrice: 2999,
    offPercent: 33,
    parameters: '92 parameters',
    rating: '4.7 (12k)',
    recommended: 'Doctor Recommended',
    searchTags: ['full body', 'wellness', 'doctor', 'health goals'],
  },
  {
    id: 'basic',
    name: 'Basic Health Checkup',
    currentPrice: 999,
    oldPrice: 1499,
    offPercent: 33,
    parameters: '45 parameters',
    rating: '4.5 (8k)',
    recommended: '',
    searchTags: ['full body', 'basic', 'health'],
  },
  {
    id: 'diabetes-care',
    name: 'Diabetes Care Panel',
    currentPrice: 1499,
    oldPrice: 2299,
    offPercent: 35,
    parameters: '68 parameters',
    rating: '4.6 (9k)',
    recommended: 'Doctor Recommended',
    searchTags: ['diabetes', 'sugar', 'hba1c', 'health goals'],
  },
  {
    id: 'kidney-plus',
    name: 'Kidney Plus Profile',
    currentPrice: 1799,
    oldPrice: 2699,
    offPercent: 33,
    parameters: '74 parameters',
    rating: '4.8 (6k)',
    recommended: 'Doctor Recommended',
    searchTags: ['kidney', 'renal', 'creatinine', 'full body'],
  },
];

const MISSING_VALUE = '-';
const OVERLAY_ALL_FILTER = {
  filter_chip_id: 'all',
  chip_key: 'all',
  display_name: 'All',
};

const normalizePackageId = (value) => String(value ?? '').trim();
const normalizeFilterChipValue = (value) => {
  if (value == null) {
    return '';
  }
  return String(value).trim();
};

const getPackageFilterChips = (pkg) => {
  const values = [];
  const pushValue = (value) => {
    const normalized = normalizeFilterChipValue(value);
    if (normalized) {
      values.push(normalized);
    }
  };

  const rawFilterChip = pkg?.filter_chip ?? pkg?.filter_chips;
  if (typeof rawFilterChip === 'string') {
    rawFilterChip.split(',').map((item) => item.trim()).filter(Boolean).forEach(pushValue);
  } else if (Array.isArray(rawFilterChip)) {
    rawFilterChip.forEach((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        pushValue(item);
        return;
      }
      if (item && typeof item === 'object') {
        pushValue(item?.display_name || item?.filter_chip || item?.chip_key || item?.name);
      }
    });
  } else if (rawFilterChip && typeof rawFilterChip === 'object') {
    pushValue(rawFilterChip?.display_name || rawFilterChip?.filter_chip || rawFilterChip?.chip_key || rawFilterChip?.name);
  }

  return Array.from(new Map(values.map((value) => [value.toLowerCase(), value])).values());
};

const normalizeFilterChipRows = (rows) => {
  const source = Array.isArray(rows) ? rows : [];
  const normalized = source
    .map((row, index) => {
      const chipKey = String(row?.chip_key || row?.key || '').trim();
      const displayName = String(row?.display_name || row?.name || chipKey).trim();
      if (!chipKey || !displayName) {
        return null;
      }
      return {
        filter_chip_id: row?.filter_chip_id ?? row?.id ?? `${chipKey}-${index}`,
        chip_key: chipKey,
        display_name: displayName,
      };
    })
    .filter(Boolean);

  const uniqueByKey = Array.from(new Map(normalized.map((chip) => [String(chip.chip_key).toLowerCase(), chip])).values());
  return [OVERLAY_ALL_FILTER, ...uniqueByKey.filter((chip) => String(chip.chip_key).toLowerCase() !== 'all')];
};

const toNormalizedPackageTagValues = (pkg) => {
  const values = new Set();
  getPackageFilterChips(pkg?.apiData || {}).forEach((value) => {
    const normalized = String(value).trim().toLowerCase();
    if (normalized) {
      values.add(normalized);
    }
  });

  const rawTags = Array.isArray(pkg?.apiData?.tags) ? pkg.apiData.tags : [];
  rawTags.forEach((tag) => {
    if (typeof tag === 'string' || typeof tag === 'number') {
      const value = String(tag).trim().toLowerCase();
      if (value) {
        values.add(value);
      }
      return;
    }
    if (tag && typeof tag === 'object') {
      [tag?.tag_name, tag?.name, tag?.filter_chip, tag?.chip_key, tag?.display_name]
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
        .forEach((item) => values.add(item));
    }
  });

  const genderSuitability = String(pkg?.apiData?.gender_suitability || '').trim().toLowerCase();
  if (genderSuitability === 'male' || genderSuitability === 'both') {
    values.add('male');
  }
  if (genderSuitability === 'female' || genderSuitability === 'both') {
    values.add('female');
  }

  return values;
};

const FOR_YOU_CHIP_KEYS = new Set(['for_you', 'for-you', 'foryou']);

const FOR_YOU_AGE_BANDS = [
  {
    id: 'young',
    min: 0,
    max: 29,
    keywords: ['genz', 'gen z', 'basic', 'core', 'supershyft basic', 'supershyft core'],
  },
  {
    id: 'mid',
    min: 30,
    max: 44,
    keywords: ['peak', 'elite', 'performance', 'progressive'],
  },
  {
    id: 'mature',
    min: 45,
    max: 120,
    keywords: ['c-suite', 'c suite', 'csuite', 'executive', 'ddecor'],
  },
];

const buildOverlayPackageSearchHaystack = (item) => {
  const parts = [
    String(item?.name || ''),
    String(item?.apiData?.package_name || ''),
    String(item?.recommended || ''),
    ...(Array.isArray(item?.searchTags) ? item.searchTags : []),
    ...getPackageFilterChips(item?.apiData || {}),
  ];

  const rawTags = Array.isArray(item?.apiData?.tags) ? item.apiData.tags : [];
  rawTags.forEach((tag) => {
    if (typeof tag === 'string' || typeof tag === 'number') {
      parts.push(String(tag));
      return;
    }

    if (tag && typeof tag === 'object') {
      parts.push(
        tag.tag_name,
        tag.name,
        tag.filter_chip,
        tag.chip_key,
        tag.display_name,
      );
    }
  });

  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const getOverlayPackageAgeBandIds = (item) => {
  const haystack = buildOverlayPackageSearchHaystack(item);
  return FOR_YOU_AGE_BANDS
    .filter((band) => band.keywords.some((keyword) => haystack.includes(keyword)))
    .map((band) => band.id);
};

const getAgeBandForAge = (age) => {
  if (!Number.isFinite(age)) {
    return null;
  }

  return FOR_YOU_AGE_BANDS.find((band) => age >= band.min && age <= band.max) || null;
};

const packageMatchesForYouGender = (item, userGender) => {
  if (!userGender) {
    return true;
  }

  const suitability = String(item?.apiData?.gender_suitability || '').trim().toLowerCase();
  if (!suitability || suitability === 'both') {
    return true;
  }

  return suitability === userGender;
};

const packageMatchesForYouAge = (item, userAge) => {
  const userBand = getAgeBandForAge(userAge);
  if (!userBand) {
    return true;
  }

  const packageBands = getOverlayPackageAgeBandIds(item);
  if (packageBands.length === 0) {
    return true;
  }

  return packageBands.includes(userBand.id);
};

const isForYouChipKey = (chipKey) => FOR_YOU_CHIP_KEYS.has(String(chipKey || '').trim().toLowerCase());

const isWomenFilterChip = (chip) => {
  const key = String(chip?.chip_key || '').trim().toLowerCase();
  const label = String(chip?.display_name || '').trim().toLowerCase();
  return key === 'women' || key === 'woman' || key === 'female'
    || label === 'women' || label === 'woman' || label === 'female';
};

const isMenFilterChip = (chip) => {
  const key = String(chip?.chip_key || '').trim().toLowerCase();
  const label = String(chip?.display_name || '').trim().toLowerCase();
  return key === 'men' || key === 'man' || key === 'male'
    || label === 'men' || label === 'man' || label === 'male';
};

const packageMatchesForYou = (item, forYouContext) => (
  packageMatchesForYouGender(item, forYouContext?.gender)
  && packageMatchesForYouAge(item, forYouContext?.age)
);

const mapDiagnosticPackageToOverlayCard = (pkg, index) => {
  const id = String(pkg?.diagnostic_package_id || pkg?.id || `pkg-${index}`).trim();
  const name = String(pkg?.package_name || '').trim() || MISSING_VALUE;
  const currentPrice = Number(pkg?.price || 0);
  const oldPrice = Number(pkg?.original_price || 0);
  const offPercent = pkg?.discount_percent ? Math.round(Number(pkg.discount_percent)) : (oldPrice > 0 && currentPrice < oldPrice ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100) : 0);
  const testsCount = Number(pkg?.tests_count || pkg?.parameters_count || 0);
  const parameters = testsCount > 0 ? `${testsCount} parameters` : MISSING_VALUE;
  const rating = MISSING_VALUE;
  const recommended = pkg?.is_most_popular ? 'Most Popular' : '';
  
  const tagLabels = Array.isArray(pkg?.tags)
    ? pkg.tags.map((tag) => {
        if (typeof tag === 'string') return tag.toLowerCase();
        return String(tag?.tag_name || tag?.name || '').toLowerCase();
      }).filter(Boolean).slice(0, 3)
    : [];
  
  const searchTags = [name.toLowerCase(), ...tagLabels];

  return {
    id,
    name,
    currentPrice: currentPrice > 0 ? currentPrice : 0,
    oldPrice: oldPrice > 0 ? oldPrice : currentPrice,
    offPercent,
    parameters,
    rating,
    recommended,
    searchTags,
    apiData: pkg,
  };
};

const mapInitialPackageToOverlayCard = (pkg) => {
  if (!pkg || typeof pkg !== 'object') {
    return null;
  }

  const apiData = pkg.apiData && typeof pkg.apiData === 'object' ? pkg.apiData : pkg;
  const id = String(
    apiData?.diagnostic_package_id
    || apiData?.id
    || pkg?.diagnostic_package_id
    || pkg?.id
    || ''
  ).trim();
  const name = String(
    apiData?.package_name
    || pkg?.package_name
    || pkg?.title
    || pkg?.name
    || ''
  ).trim();

  if (!id && !name) {
    return null;
  }

  const currentPriceRaw = Number(apiData?.price ?? pkg?.pricing?.now ?? pkg?.currentPrice ?? 0);
  const oldPriceRaw = Number(apiData?.original_price ?? pkg?.pricing?.old ?? pkg?.oldPrice ?? currentPriceRaw);
  const currentPrice = Number.isFinite(currentPriceRaw) && currentPriceRaw > 0 ? currentPriceRaw : 0;
  const oldPrice = Number.isFinite(oldPriceRaw) && oldPriceRaw > 0 ? oldPriceRaw : currentPrice;
  const offPercent = oldPrice > currentPrice && oldPrice > 0
    ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
    : 0;

  const testsCount = Number(apiData?.no_of_tests ?? apiData?.tests_count ?? pkg?.metrics?.parameters ?? 0);
  const parameters = Number.isFinite(testsCount) && testsCount > 0 ? `${testsCount} parameters` : MISSING_VALUE;

  return {
    id: id || `initial-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name: name || MISSING_VALUE,
    currentPrice,
    oldPrice,
    offPercent,
    parameters,
    rating: MISSING_VALUE,
    recommended: apiData?.is_most_popular ? 'Most Popular' : '',
    searchTags: [String(name || '').toLowerCase()].filter(Boolean),
    apiData,
  };
};

const MaleIcon = () => <img src={maleAvatar} alt="" aria-hidden="true" className="patient-select-overlay__avatar-image" />;

const FemaleIcon = () => <img src={femaleAvatar} alt="" aria-hidden="true" className="patient-select-overlay__avatar-image" />;

const UncheckedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true">
    <path d="M14.5 0.5H4.5C2.29086 0.5 0.5 2.29086 0.5 4.5V14.5C0.5 16.7091 2.29086 18.5 4.5 18.5H14.5C16.7091 18.5 18.5 16.7091 18.5 14.5V4.5C18.5 2.29086 16.7091 0.5 14.5 0.5Z" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
    <path d="M0.75 4.75L4.25 8.25L11.25 0.75" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect width="24" height="24" rx="12" fill="white" fillOpacity="0.1"/>
    <path d="M8.34687 12.875L13.2469 17.775L12 19L5 12L12 5L13.2469 6.225L8.34687 11.125H19V12.875H8.34687Z" fill="#9A9A9A"/>
  </svg>
);

const DownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect width="24" height="24" rx="12" fill="white" fillOpacity="0.1"/>
    <path d="M12 15L7 10H17L12 15Z" fill="#9A9A9A"/>
  </svg>
);

const PackagePulseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
    <path d="M14.418 6.854H12.713C12.0955 6.85282 11.5528 7.22226 11.3861 7.75738L9.77047 12.9301C9.74908 12.9961 9.68186 13.0415 9.60547 13.0415C9.52908 13.0415 9.46186 12.9961 9.44047 12.9301L5.64547 0.777879C5.62408 0.711879 5.55686 0.666504 5.48047 0.666504C5.40408 0.666504 5.33686 0.711879 5.31547 0.777879L3.69984 5.95063C3.53381 6.48353 2.9948 6.85242 2.37984 6.854H0.667969" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SelectedRowPackageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path d="M14.0013 7.33317H12.348C11.7492 7.33189 11.223 7.72995 11.0613 8.3065L9.49464 13.8798C9.47389 13.9509 9.40871 13.9998 9.33464 13.9998C9.26056 13.9998 9.19538 13.9509 9.17464 13.8798L5.49464 0.786504C5.47389 0.715393 5.40871 0.666504 5.33464 0.666504C5.26056 0.666504 5.19538 0.715393 5.17464 0.786504L3.60797 6.35984C3.44696 6.93401 2.92429 7.33146 2.32797 7.33317H0.667969" stroke="#C4C4C4" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PackageSearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M15.7511 15.7501L12.4961 12.4951" stroke="#8B9496" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.25 8.25C2.25 11.5615 4.93851 14.25 8.25 14.25C11.5615 14.25 14.25 11.5615 14.25 8.25C14.25 4.93851 11.5615 2.25 8.25 2.25C4.93851 2.25 2.25 4.93851 2.25 8.25V8.25" stroke="#8B9496" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PackageDoctorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <path d="M5.83203 0.583496V1.75016M2.33203 0.583496V1.75016M2.33203 1.16683H1.7487C1.1048 1.16683 0.582031 1.6896 0.582031 2.3335V4.66683C0.582031 6.59853 2.15033 8.16683 4.08203 8.16683C6.01373 8.16683 7.58203 6.59853 7.58203 4.66683V2.3335C7.58203 1.6896 7.05927 1.16683 6.41536 1.16683H5.83203" stroke="#8B9496" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PackageOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.83203 5.8335H14.1654V14.1668M5.83203 14.1668L14.1654 5.8335" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TestChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 10L12 15L17 10" stroke="#E8ECEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TestChevronUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M17 14L12 9L7 14" stroke="#90DF9E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PreferredDateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
  <path d="M6.66797 1.66699V5.00033M13.3346 1.66699V5.00033" stroke="#9A9A9A" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4.16667 3.3335H15.8333C16.7538 3.3335 17.5 4.07969 17.5 5.00016V16.6668C17.5 17.5873 16.7538 18.3335 15.8333 18.3335H4.16667C3.24619 18.3335 2.5 17.5873 2.5 16.6668V5.00016C2.5 4.07969 3.24619 3.3335 4.16667 3.3335V3.3335" stroke="#9A9A9A" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2.5 8.3335H17.5" stroke="#9A9A9A" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
);

const PreferredTimeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="19" viewBox="0 0 20 19" fill="none" aria-hidden="true">
    <path d="M10 0C15.523 0 20 4.1045 20 9.16798C20 14.2315 15.523 18.336 10 18.336C4.477 18.336 0 14.2315 0 9.16798C0 4.1045 4.477 0 10 0ZM10 1.8336C7.87827 1.8336 5.84344 2.60632 4.34315 3.98179C2.84285 5.35725 2 7.22278 2 9.16798C2 11.1132 2.84285 12.9787 4.34315 14.3542C5.84344 15.7296 7.87827 16.5024 10 16.5024C12.1217 16.5024 14.1566 15.7296 15.6569 14.3542C17.1571 12.9787 18 11.1132 18 9.16798C18 7.22278 17.1571 5.35725 15.6569 3.98179C14.1566 2.60632 12.1217 1.8336 10 1.8336ZM10 3.66719C10.2449 3.66722 10.4813 3.74966 10.6644 3.89888C10.8474 4.0481 10.9643 4.25371 10.993 4.47672L11 4.58399V8.78842L13.707 11.2702C13.8863 11.4352 13.9905 11.6566 13.9982 11.8894C14.006 12.1222 13.9168 12.349 13.7488 12.5237C13.5807 12.6984 13.3464 12.8079 13.0935 12.83C12.8406 12.8521 12.588 12.7851 12.387 12.6426L12.293 12.5665L9.293 9.81615C9.13758 9.67354 9.03776 9.48794 9.009 9.28808L9 9.16798V4.58399C9 4.34084 9.10536 4.10765 9.29289 3.93571C9.48043 3.76378 9.73478 3.66719 10 3.66719Z" fill="#9A9A9A"/>
  </svg>
);

const DetailEditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M8.82118 2.83842C9.27961 2.38011 9.2797 1.63582 8.82138 1.17738C8.36306 0.718949 7.61878 0.718855 7.16034 1.17717L1.59951 6.73926C1.50277 6.83572 1.43122 6.95448 1.39118 7.08509L0.840759 8.89843C0.81882 8.97184 0.83895 9.05137 0.893174 9.10551C0.947398 9.15965 1.02696 9.17965 1.10034 9.15759L2.91409 8.60759C3.04458 8.5679 3.16333 8.4968 3.25993 8.40051L8.82118 2.83842M6.24868 2.08342L7.91534 3.75009" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DetailLocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <path d="M8.4987 1.4165C5.38203 1.4165 2.83203 3.9665 2.83203 7.08317C2.83203 10.9082 7.79036 15.229 8.00286 15.4415C8.14453 15.5123 8.35703 15.5832 8.4987 15.5832C8.64036 15.5832 8.85286 15.5123 8.99453 15.4415C9.20703 15.229 14.1654 10.9082 14.1654 7.08317C14.1654 3.9665 11.6154 1.4165 8.4987 1.4165ZM8.4987 13.954C7.0112 12.5373 4.2487 9.4915 4.2487 7.08317C4.2487 4.74567 6.1612 2.83317 8.4987 2.83317C10.8362 2.83317 12.7487 4.74567 12.7487 7.08317C12.7487 9.42067 9.9862 12.5373 8.4987 13.954ZM8.4987 4.24984C6.94036 4.24984 5.66536 5.52484 5.66536 7.08317C5.66536 8.6415 6.94036 9.9165 8.4987 9.9165C10.057 9.9165 11.332 8.6415 11.332 7.08317C11.332 5.52484 10.057 4.24984 8.4987 4.24984ZM8.4987 8.49984C7.71953 8.49984 7.08203 7.86234 7.08203 7.08317C7.08203 6.304 7.71953 5.6665 8.4987 5.6665C9.27786 5.6665 9.91536 6.304 9.91536 7.08317C9.91536 7.86234 9.27786 8.49984 8.4987 8.49984Z" fill="#CCCCCC"/>
  </svg>
);

const DetailCityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M14.3013 7.4847H13.3746C13.2535 6.22441 12.6977 5.04553 11.8024 4.15027C10.9071 3.25501 9.72826 2.69915 8.46797 2.57803V1.65137C8.46797 1.51876 8.41529 1.39158 8.32152 1.29781C8.22775 1.20405 8.10058 1.15137 7.96797 1.15137C7.83536 1.15137 7.70818 1.20405 7.61442 1.29781C7.52065 1.39158 7.46797 1.51876 7.46797 1.65137V2.57803C6.2132 2.7052 5.04144 3.26388 4.15268 4.15872C3.26392 5.05355 2.71325 6.22909 2.59464 7.4847H1.66797C1.60231 7.4847 1.53729 7.49763 1.47663 7.52276C1.41596 7.54789 1.36084 7.58472 1.31442 7.63115C1.26799 7.67758 1.23116 7.7327 1.20603 7.79336C1.1809 7.85402 1.16797 7.91904 1.16797 7.9847C1.16797 8.05036 1.1809 8.11538 1.20603 8.17604C1.23116 8.2367 1.26799 8.29182 1.31442 8.33825C1.36084 8.38468 1.41596 8.42151 1.47663 8.44664C1.53729 8.47177 1.60231 8.4847 1.66797 8.4847H2.59464C2.71575 9.74499 3.27161 10.9239 4.16687 11.8191C5.06214 12.7144 6.24101 13.2703 7.5013 13.3914V14.318C7.5013 14.4506 7.55398 14.5778 7.64775 14.6716C7.74152 14.7654 7.86869 14.818 8.0013 14.818C8.13391 14.818 8.26109 14.7654 8.35486 14.6716C8.44862 14.5778 8.5013 14.4506 8.5013 14.318V13.3914C9.76113 13.269 10.9393 12.7128 11.8343 11.8177C12.7294 10.9227 13.2856 9.74453 13.408 8.4847H14.3346C14.4003 8.4847 14.4653 8.47177 14.526 8.44664C14.5866 8.42151 14.6418 8.38468 14.6882 8.33825C14.7346 8.29182 14.7714 8.2367 14.7966 8.17604C14.8217 8.11538 14.8346 8.05036 14.8346 7.9847C14.8346 7.91904 14.8217 7.85402 14.7966 7.79336C14.7714 7.7327 14.7346 7.67758 14.6882 7.63115C14.6418 7.58472 14.5866 7.54789 14.526 7.52276C14.4653 7.49763 14.4003 7.4847 14.3346 7.4847H14.3013ZM7.96797 12.4114C7.09246 12.4114 6.23661 12.1517 5.50865 11.6653C4.78068 11.1789 4.21331 10.4876 3.87826 9.67871C3.54322 8.86984 3.45556 7.97979 3.62636 7.1211C3.79716 6.26241 4.21876 5.47365 4.83784 4.85457C5.45692 4.23549 6.24568 3.81389 7.10437 3.64309C7.96306 3.47229 8.85311 3.55995 9.66198 3.89499C10.4708 4.23004 11.1622 4.79741 11.6486 5.52538C12.135 6.25334 12.3946 7.10919 12.3946 7.9847C12.3946 9.15934 11.9285 10.286 11.0985 11.1172C10.2685 11.9484 9.14261 12.4163 7.96797 12.418V12.4114Z" fill="#CCCCCC"/>
    <path d="M10.9869 7.99152C10.9869 8.59042 10.8092 9.17586 10.4764 9.67373C10.1435 10.1716 9.67041 10.5595 9.11697 10.7884C8.56353 11.0173 7.95463 11.0769 7.36733 10.9595C6.78004 10.8422 6.24075 10.5533 5.81773 10.1293C5.39471 9.70537 5.10697 9.16545 4.99094 8.57789C4.87491 7.99034 4.9358 7.38157 5.1659 6.82864C5.39601 6.2757 5.78498 5.80346 6.28359 5.47169C6.7822 5.13992 7.36803 4.96353 7.96693 4.96485C8.36408 4.96485 8.75734 5.04319 9.12417 5.19537C9.49101 5.34756 9.82423 5.5706 10.1048 5.85174C10.3853 6.13288 10.6076 6.46659 10.759 6.83377C10.9103 7.20094 10.9878 7.59437 10.9869 7.99152Z" fill="#CCCCCC"/>
  </svg>
);

const DetailCalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M8 4V6M13 4V6" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.22222 5H14.7778C15.4528 5 16 5.49746 16 6.11111V13.8889C16 14.5025 15.4528 15 14.7778 15H6.22222C5.54721 15 5 14.5025 5 13.8889V6.11111C5 5.49746 5.54721 5 6.22222 5V5" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 8H16" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DetailClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M1.19922 6.0002C1.19922 8.64939 3.35003 10.8002 5.99922 10.8002C8.64841 10.8002 10.7992 8.64939 10.7992 6.0002C10.7992 3.351 8.64841 1.2002 5.99922 1.2002C3.35003 1.2002 1.19922 3.351 1.19922 6.0002Z" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 3V6L8 7" stroke="#CCCCCC" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ConfirmTickIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="25" height="18" viewBox="0 0 25 18" fill="none" aria-hidden="true">
    <path d="M23.0013 1.6665L8.33463 16.3332L1.66797 9.6665" stroke="#90DF9E" strokeWidth="3.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ConfirmCrossIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2 2L16 16M16 2L2 16" stroke="#EF4444" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SCHEDULE_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHEDULE_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SCHEDULE_FALLBACK_TIME_SLOTS = [
  ['06:00 AM', '06:30 AM', '07:00 AM'],
  ['07:30 AM', '08:00 AM', '08:30 AM'],
  ['09:00 AM', '09:30 AM', '10:00 AM'],
  ['10:30 AM', '11:00 AM', '11:30 AM'],
  ['12:00 PM', '12:30 PM', '01:00 PM'],
];

const DEFAULT_FORM_DATA = {
  firstName: '',
  lastName: '',
  relation: '',
  age: '',
  gender: '',
  phone: '',
  email: '',
  city: '',
};

/** Labels must match API SubProfileCreate.relationship literals (lowercased on submit). */
const RELATION_OPTIONS = ['Parent', 'Child', 'Sibling', 'Spouse', 'Grandparent', 'Other'];
const GENDER_OPTIONS = ['Male', 'Female'];
/** Temp key so package Change on Add member binds before the profile exists. */
const PENDING_ADD_PATIENT_ID = '__pending_add__';

const ADD_REQUIRED_FIELD = 'Required Field';
const ADD_INVALID_FORMAT = 'Invalid Format';
const ADD_FIELD_REQUIRED = 'Field Required';
const RE_ADD_NAME = /^(?=.*[a-zA-Z])[a-zA-Z\s'-]{1,60}$/;
const RE_ADD_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_ADD_PHONE = /^\d{10}$/;
const RE_ADD_CITY = /^(?=.*[a-zA-Z])[a-zA-Z\s,.'-]{1,100}$/;

const optionalOrInvalidAddFormat = (value, pattern) => {
  const t = String(value).trim();
  if (!t) return null;
  if (!pattern.test(t)) return ADD_INVALID_FORMAT;
  return null;
};

const requiredOrInvalidAddFormat = (value, pattern) => {
  const t = String(value).trim();
  if (!t) return ADD_REQUIRED_FIELD;
  if (!pattern.test(t)) return ADD_INVALID_FORMAT;
  return null;
};

const validateAddMemberForm = (data) => {
  const errors = {};
  const set = (key, msg) => {
    if (msg) errors[key] = msg;
  };

  set('firstName', requiredOrInvalidAddFormat(data.firstName, RE_ADD_NAME));
  set('lastName', requiredOrInvalidAddFormat(data.lastName, RE_ADD_NAME));
  set('city', requiredOrInvalidAddFormat(data.city, RE_ADD_CITY));
  set('phone', optionalOrInvalidAddFormat(data.phone, RE_ADD_PHONE));
  set('email', optionalOrInvalidAddFormat(data.email, RE_ADD_EMAIL));

  const ageRaw = String(data.age || '').trim();
  if (!ageRaw) {
    errors.age = ADD_REQUIRED_FIELD;
  } else {
    const age = Number.parseInt(ageRaw, 10);
    if (Number.isNaN(age) || age < 18 || age > 99) {
      errors.age = ADD_INVALID_FORMAT;
    }
  }

  if (!String(data.gender || '').trim()) {
    errors.gender = ADD_FIELD_REQUIRED;
  }
  if (!String(data.relation || '').trim()) {
    errors.relation = ADD_FIELD_REQUIRED;
  }

  return errors;
};

const clearAddFieldError = (setAddFieldErrors, field) => {
  setAddFieldErrors((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
};

const DEFAULT_ADDRESS_DATA = {
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  pincode: '',
};

const ADDRESS_REQUIRED_MSG = 'Required Field';
const ADDRESS_PIN_INVALID_MSG = 'Invalid Format';
const RE_PACKAGE_ADDRESS_PINCODE = /^\d{6}$/;

const ADDRESS_FIELD_ORDER = ['addressLine1', 'addressLine2', 'landmark', 'city', 'pincode'];

const formatBookingAddressDisplay = (addressData) => {
  const line1 = String(addressData?.addressLine1 || '').trim();
  const line2 = String(addressData?.addressLine2 || '').trim();
  const landmark = String(addressData?.landmark || '').trim();
  return [line1, line2, landmark].filter(Boolean).join(', ') || '-';
};

const validatePackageAddressForm = (data) => {
  const errors = {};
  if (!String(data.addressLine1 || '').trim()) {
    errors.addressLine1 = ADDRESS_REQUIRED_MSG;
  }
  if (!String(data.addressLine2 || '').trim()) {
    errors.addressLine2 = ADDRESS_REQUIRED_MSG;
  }
  if (!String(data.landmark || '').trim()) {
    errors.landmark = ADDRESS_REQUIRED_MSG;
  }
  if (!String(data.city || '').trim()) {
    errors.city = ADDRESS_REQUIRED_MSG;
  }
  const pin = String(data.pincode || '').trim();
  if (!pin) {
    errors.pincode = ADDRESS_REQUIRED_MSG;
  } else if (!RE_PACKAGE_ADDRESS_PINCODE.test(pin)) {
    errors.pincode = ADDRESS_PIN_INVALID_MSG;
  }
  return errors;
};

const getAgeFromProfile = (profile) => {
  if (typeof profile?.age === 'number' && profile.age > 0) {
    return String(profile.age);
  }

  if (!profile?.date_of_birth) {
    return '--';
  }

  const dob = new Date(profile.date_of_birth);
  if (Number.isNaN(dob.getTime())) {
    return '--';
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age > 0 ? String(age) : '--';
};

const getNumericAgeFromProfile = (profile) => {
  if (typeof profile?.age === 'number' && profile.age > 0) {
    return Math.floor(profile.age);
  }

  const parsedAge = Number.parseInt(getAgeFromProfile(profile), 10);
  return Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null;
};

const normalizeProfileGenderForYou = (profile) => {
  const gender = String(profile?.gender || '').trim().toLowerCase();
  if (gender === 'male' || gender === 'm' || gender === 'man') {
    return 'male';
  }
  if (gender === 'female' || gender === 'f' || gender === 'woman') {
    return 'female';
  }
  return null;
};

const normalizeGenderType = (genderValue) => {
  const normalizedGender = String(genderValue || '').trim().toLowerCase();
  return normalizedGender.startsWith('f') ? 'female' : 'male';
};

const getRelationshipLabel = (value, fallback = 'Primary') => {
  const relationship = String(value || '').trim();
  if (!relationship) {
    return fallback;
  }

  return relationship.charAt(0).toUpperCase() + relationship.slice(1);
};

const mapProfileToPatient = (profile, relationshipFallback = 'Primary') => {
  const userId = Number(profile?.user_id || profile?.id || 0);
  if (userId <= 0) {
    return null;
  }

  const firstName = String(profile?.first_name || '').trim();
  const lastName = String(profile?.last_name || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  const age = getAgeFromProfile(profile);
  const genderType = normalizeGenderType(profile?.gender);
  const genderCode = genderType === 'female' ? 'F' : 'M';
  const relationship = getRelationshipLabel(profile?.relationship, relationshipFallback);

  return {
    id: `profile-${userId}`,
    userId,
    name: fullName,
    meta: `${genderCode}, ${age}  |  ${relationship}`,
    gender: genderType,
  };
};

const getNumericPatientUserId = (patient) => {
  const fromField = Number(patient?.userId);
  if (Number.isInteger(fromField) && fromField > 0) {
    return fromField;
  }

  const rawId = String(patient?.id || '').trim();
  const suffix = rawId.includes('-') ? rawId.split('-').pop() : rawId;
  const parsed = Number(suffix);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildAddressFromProfile = (profile) => {
  const addressText = String(profile?.address || '').trim();
  const addressParts = addressText
    ? addressText.split(',').map((part) => part.trim()).filter(Boolean)
    : [];
  const city = String(profile?.city || profile?.state || addressParts[3] || '').trim();

  return {
    addressLine1: addressParts[0] || '',
    addressLine2: addressParts[1] || '',
    landmark: addressParts[2] || '',
    city,
    pincode: String(profile?.pin_code || profile?.pincode || profile?.postal_code || '').trim(),
  };
};

const pickDefaultSavedAddress = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows.find((row) => row.is_default) || rows[0];
};

const toResolvedAddressData = (data) => ({
  addressLine1: String(data?.addressLine1 || '').trim(),
  addressLine2: String(data?.addressLine2 || '').trim(),
  landmark: String(data?.landmark || '').trim(),
  city: String(data?.city || '').trim(),
  pincode: String(data?.pincode || '').trim(),
});

const PatientSelectionOverlay = ({
  open,
  onClose,
  customFlow = false,
  initialPackage = null,
  initialCustomGroups = [],
  draftEngagement = null,
  onBookingConfirmed,
}) => {
  const [view, setView] = useState('select');
  const [patients, setPatients] = useState(PATIENTS);
  const [profileData, setProfileData] = useState(null);
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('advanced');
  const [selectedPackageByPatientId, setSelectedPackageByPatientId] = useState({});
  const [draftPackageId, setDraftPackageId] = useState('advanced');
  const [packageViewReturn, setPackageViewReturn] = useState('select');
  const [addressViewReturn, setAddressViewReturn] = useState('select');
  const [scheduleViewReturn, setScheduleViewReturn] = useState('address');
  const [selectViewReturn, setSelectViewReturn] = useState(null);
  const [packageTargetName, setPackageTargetName] = useState('User');
  const [packageTargetPatientId, setPackageTargetPatientId] = useState(null);
  const [activeField, setActiveField] = useState('firstName');
  const [activeAddressField, setActiveAddressField] = useState('addressLine1');
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [addFieldErrors, setAddFieldErrors] = useState({});
  const [addSubmitError, setAddSubmitError] = useState('');
  const [addMemberSuccess, setAddMemberSuccess] = useState('');
  const [addressData, setAddressData] = useState(DEFAULT_ADDRESS_DATA);
  const [resolvedAddressData, setResolvedAddressData] = useState(null);
  const [addressFieldErrors, setAddressFieldErrors] = useState({});
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressSubmitError, setAddressSubmitError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);
  const [addingSavedAddress, setAddingSavedAddress] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedSlotMeta, setSelectedSlotMeta] = useState(null);
  const [availableSlotRows, setAvailableSlotRows] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleLockError, setScheduleLockError] = useState('');
  const [serviceAvailabilityByUserId, setServiceAvailabilityByUserId] = useState({});
  const [customActiveFilterKey, setCustomActiveFilterKey] = useState('all');
  const [customFilterChips, setCustomFilterChips] = useState([OVERLAY_ALL_FILTER]);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [customGroupCards, setCustomGroupCards] = useState([]);
  const [defaultCustomGroupIds, setDefaultCustomGroupIds] = useState([]);
  const [selectedGroupIdsByPatientId, setSelectedGroupIdsByPatientId] = useState({});
  const [customExpandedIds, setCustomExpandedIds] = useState(() => new Set());
  const [customSelectedIds, setCustomSelectedIds] = useState(() => new Set());
  const [customPackageCards, setCustomPackageCards] = useState([]);
  const [customPersisting, setCustomPersisting] = useState(false);
  const [customPersistError, setCustomPersistError] = useState('');
  const [customTestLoadingById, setCustomTestLoadingById] = useState({});
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [bioBookingError, setBioBookingError] = useState('');
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);
  const [paymentOutcome, setPaymentOutcome] = useState('success');
  const [resultPhase, setResultPhase] = useState(null);
  const [packageCardsFromApi, setPackageCardsFromApi] = useState([]);
  const [packageFilterChips, setPackageFilterChips] = useState([OVERLAY_ALL_FILTER]);
  const [packageDetailsCard, setPackageDetailsCard] = useState(null);
  const paymentSuccessRef = useRef(false);
  const paymentHandlerInvokedRef = useRef(false);
  const packageManuallyChangedRef = useRef(false);
  const draftAppliedRef = useRef(false);
  const dropdownRefs = useRef({});
  const scheduleDates = useMemo(() => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    return Array.from({ length: 4 }, (_, index) => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + 2 + index);

      const day = SCHEDULE_DAY_LABELS[date.getDay()];
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      const month = SCHEDULE_MONTH_LABELS[date.getMonth()];
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${d}`;

      return {
        id: `${day.toLowerCase()}-${dayOfMonth}-${month.toLowerCase()}`,
        day,
        date: dayOfMonth,
        month,
        isoDate,
      };
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setView('select');
      setSelectedIds([]);
      setSelectedPackageByPatientId({});
      setSelectedDateId('');
      setSelectedTimeSlot('');
      setSelectedSlotMeta(null);
      setAvailableSlotRows([]);
      setSlotsLoading(false);
      setSlotsError('');
      setScheduleSubmitting(false);
      setScheduleLockError('');
      setServiceAvailabilityByUserId({});
      setPackageDetailsCard(null);
      setFormData(DEFAULT_FORM_DATA);
      setAddFieldErrors({});
      setAddSubmitError('');
      setAddMemberSuccess('');
      setPaymentError(null);
      setPaymentSubmitting(false);
      setPromoCode('');
      setAppliedPromo(null);
      setPromoError('');
      setPromoApplying(false);
      setBioBookingError('');
      setConfirmedBookingId(null);
      setPaymentOutcome('success');
      setResultPhase(null);
      setPackageTargetPatientId(null);
      setCustomGroupCards([]);
      setDefaultCustomGroupIds([]);
      setSelectedGroupIdsByPatientId({});
      setCustomExpandedIds(new Set());
      setCustomSelectedIds(new Set());
      setCustomPackageCards([]);
      setCustomPersisting(false);
      setCustomPersistError('');
      setCustomTestLoadingById({});
      packageManuallyChangedRef.current = false;
      paymentSuccessRef.current = false;
      paymentHandlerInvokedRef.current = false;
      setAddressViewReturn('select');
      setScheduleViewReturn('address');
      setSelectViewReturn(null);
      setResolvedAddressData(null);
      setAddressSubmitting(false);
      setAddressSubmitError('');
      setSavedAddresses([]);
      setSelectedSavedAddressId(null);
      setAddingSavedAddress(false);
      setAddressData(DEFAULT_ADDRESS_DATA);
      setAddressFieldErrors({});
    }
  }, [open, scheduleDates]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;
    const loadFilterChips = async () => {
      try {
        const rows = await listPublicDiagnosticPackageFilterChips({});
        if (!mounted) {
          return;
        }
        const normalized = normalizeFilterChipRows(rows);
        setPackageFilterChips(normalized.length > 0 ? normalized : [OVERLAY_ALL_FILTER]);
      } catch {
        if (mounted) {
          setPackageFilterChips([OVERLAY_ALL_FILTER]);
        }
      }
    };
    loadFilterChips();
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !customFlow) {
      return;
    }

    const seeded = mergeCustomGroupCards([], initialCustomGroups);
    const seededIds = seeded.map((item) => item.id);
    setCustomGroupCards(seeded);
    setDefaultCustomGroupIds(seededIds);
    setSelectedGroupIdsByPatientId({
      [PENDING_ADD_PATIENT_ID]: seededIds,
    });
    setCustomSelectedIds(new Set(seededIds));
    setCustomExpandedIds(new Set());
    setCustomPackageCards([]);
    setCustomPersistError('');

    let mounted = true;
    const loadCustomCatalog = async () => {
      try {
        const [chipRows, groupRows] = await Promise.all([
          listDiagnosticPackageFilterChips({ chip_for: 'custom_package' }),
          listDiagnosticTestGroups(),
        ]);
        if (!mounted) {
          return;
        }
        const normalizedChips = normalizeFilterChipRows(chipRows);
        setCustomFilterChips(normalizedChips.length > 0 ? normalizedChips : [OVERLAY_ALL_FILTER]);
        const catalog = (Array.isArray(groupRows) ? groupRows : [])
          .map((row, index) => normalizeCustomGroupCard(row, index))
          .filter((row) => row && row.groupId && row.salePrice > 0);
        setCustomGroupCards((prev) => mergeCustomGroupCards(catalog, prev));
      } catch {
        if (mounted) {
          setCustomFilterChips([OVERLAY_ALL_FILTER]);
        }
      }
    };
    loadCustomCatalog();
    return () => {
      mounted = false;
    };
    // Seed from the builder only when the overlay opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customFlow]);

  useEffect(() => {
    if (selectedDateId && !scheduleDates.some((item) => item.id === selectedDateId)) {
      setSelectedDateId('');
      setSelectedTimeSlot('');
      setSelectedSlotMeta(null);
      setAvailableSlotRows([]);
      setSlotsError('');
    }
  }, [scheduleDates, selectedDateId]);

  useEffect(() => {
    if (view === 'payment') {
      setPaymentError(null);
      setPaymentOutcome('success');
      setResultPhase(null);
    }
  }, [view]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;

    const loadPackagesData = async () => {
      try {
        if (BACKEND_ENABLED) {
          const packages = await listDiagnosticPackages();
          if (mounted && Array.isArray(packages)) {
            const transformedPackages = packages.map((pkg, idx) => mapDiagnosticPackageToOverlayCard(pkg, idx));
            setPackageCardsFromApi(transformedPackages);
          }
        }
      } catch (err) {
        setPackageCardsFromApi([]);
      }
    };

    const loadOverlayData = async () => {
      try {
        const [profileResponse, linkedProfilesResponse, addressesResponse] = await Promise.all([
          getMyProfile(),
          getMyProfiles(),
          BACKEND_ENABLED ? listMyAddresses().catch(() => []) : Promise.resolve([]),
        ]);

        const profile = profileResponse?.data && typeof profileResponse.data === 'object'
          ? profileResponse.data
          : profileResponse;
        const linkedProfiles = Array.isArray(linkedProfilesResponse?.data)
          ? linkedProfilesResponse.data
          : Array.isArray(linkedProfilesResponse)
            ? linkedProfilesResponse
            : [];
        const addressRows = Array.isArray(addressesResponse) ? addressesResponse : [];

        if (!mounted) {
          return;
        }

        setProfileData(profile || null);
        setSavedAddresses(addressRows);
        setAddingSavedAddress(addressRows.length === 0);

        const patientItems = [];
        const uniqueUserIds = new Set();
        const primaryPatient = mapProfileToPatient(profile, 'Primary');
        if (primaryPatient) {
          uniqueUserIds.add(primaryPatient.id);
          patientItems.push(primaryPatient);
        }

        linkedProfiles.forEach((item) => {
          const mapped = mapProfileToPatient(item, 'Member');
          if (!mapped || uniqueUserIds.has(mapped.id)) {
            return;
          }

          uniqueUserIds.add(mapped.id);
          patientItems.push(mapped);
        });

        setPatients(patientItems);

        const defaultSaved = pickDefaultSavedAddress(addressRows);
        if (defaultSaved) {
          setSelectedSavedAddressId(defaultSaved.user_address_id);
        } else {
          setSelectedSavedAddressId(null);
        }

        await loadPackagesData();

        if (!draftEngagement) {
          if (defaultSaved) {
            setAddressData(savedAddressToBookingForm(defaultSaved));
          } else {
            setAddressData((prev) => ({
              ...prev,
              ...buildAddressFromProfile(profile),
            }));
          }
        }

      } catch (error) {
        if (mounted) {
          setPatients([]);
        }
      }
    };

    loadOverlayData();

    return () => {
      mounted = false;
    };
  }, [draftEngagement, open]);

  useEffect(() => {
    if (!open || view !== 'address' || !profileData || draftEngagement) {
      return;
    }
    if (savedAddresses.length > 0) {
      return;
    }

    const fromProfile = buildAddressFromProfile(profileData);
    setAddressData((prev) => ({
      ...prev,
      addressLine1: prev.addressLine1 || fromProfile.addressLine1,
      addressLine2: prev.addressLine2 || fromProfile.addressLine2,
      landmark: prev.landmark || fromProfile.landmark,
      city: prev.city || fromProfile.city,
      pincode: prev.pincode || fromProfile.pincode || '',
    }));
  }, [draftEngagement, open, profileData, savedAddresses.length, view]);

  useEffect(() => {
    const { body, documentElement } = document;
    const appScroll = document.querySelector('.app-scroll');
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlTouchAction = documentElement.style.touchAction;
    const previousAppScrollOverflow = appScroll ? appScroll.style.overflow : '';
    const previousAppScrollTouchAction = appScroll ? appScroll.style.touchAction : '';
    const previousAppScrollOverscroll = appScroll ? appScroll.style.overscrollBehavior : '';
    const scrollY = window.scrollY;

    if (open) {
      documentElement.style.overflow = 'hidden';
      documentElement.style.touchAction = 'none';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
      body.style.touchAction = 'none';

      if (appScroll) {
        appScroll.style.overflow = 'hidden';
        appScroll.style.touchAction = 'none';
        appScroll.style.overscrollBehavior = 'none';
      }
    }

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.touchAction = previousHtmlTouchAction;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.touchAction = previousBodyTouchAction;

      if (appScroll) {
        appScroll.style.overflow = previousAppScrollOverflow;
        appScroll.style.touchAction = previousAppScrollTouchAction;
        appScroll.style.overscrollBehavior = previousAppScrollOverscroll;
      }

      if (open) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [open]);

  const initialPackageCard = useMemo(
    () => mapInitialPackageToOverlayCard(initialPackage),
    [initialPackage],
  );

  const sourcePackages = useMemo(() => {
    if (packageCardsFromApi.length > 0) {
      return packageCardsFromApi;
    }

    if (!initialPackageCard) {
      return PACKAGE_OPTIONS;
    }

    const initialId = normalizePackageId(initialPackageCard.id);
    const initialName = String(initialPackageCard.name || '').trim().toLowerCase();
    const existsInDefaults = PACKAGE_OPTIONS.some((item) => {
      const sameId = initialId && normalizePackageId(item.id) === initialId;
      const sameName = initialName && String(item.name || '').trim().toLowerCase() === initialName;
      return sameId || sameName;
    });

    return existsInDefaults ? PACKAGE_OPTIONS : [initialPackageCard, ...PACKAGE_OPTIONS];
  }, [packageCardsFromApi, initialPackageCard]);

  const selectedPackage = useMemo(
    () => sourcePackages.find((item) => normalizePackageId(item.id) === normalizePackageId(selectedPackageId)) || sourcePackages[0],
    [selectedPackageId, sourcePackages],
  );
  const customPackageDisplayName = useMemo(() => {
    const profileName = [profileData?.first_name, profileData?.last_name]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();

    const displayName = profileName || 'User';
    const possessive = displayName.toLowerCase().endsWith('s') ? `${displayName}'` : `${displayName}'s`;
    return `${possessive} Custom Package`;
  }, [profileData]);

  const draftPackage = useMemo(
    () => sourcePackages.find((item) => normalizePackageId(item.id) === normalizePackageId(draftPackageId)) || sourcePackages[0],
    [draftPackageId, sourcePackages],
  );

  const packageById = useMemo(() => {
    const map = new Map();
    [...sourcePackages, ...customPackageCards].forEach((item) => {
      map.set(normalizePackageId(item.id), item);
    });
    return map;
  }, [customPackageCards, sourcePackages]);

  const getPackageForPatient = useCallback((patientId) => {
    const mappedPackageId = normalizePackageId(selectedPackageByPatientId[patientId]);
    return packageById.get(mappedPackageId) || selectedPackage;
  }, [packageById, selectedPackageByPatientId, selectedPackage]);

  const getCustomGroupsForPatient = useCallback((patientId) => {
    const mappedIds = Array.isArray(selectedGroupIdsByPatientId[patientId])
      ? selectedGroupIdsByPatientId[patientId]
      : defaultCustomGroupIds;
    const cardMap = new Map(customGroupCards.map((item) => [item.id, item]));
    return mappedIds.map((id) => cardMap.get(id)).filter(Boolean);
  }, [customGroupCards, defaultCustomGroupIds, selectedGroupIdsByPatientId]);

  const getCustomPriceForPatient = useCallback((patientId) => {
    const groups = getCustomGroupsForPatient(patientId);
    const current = groups.reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
    const old = groups.reduce((sum, item) => sum + Number(item.oldPrice || item.salePrice || 0), 0);
    return { current, old };
  }, [getCustomGroupsForPatient]);

  useEffect(() => {
    if (!open) {
      draftAppliedRef.current = false;
      return;
    }
    if (!draftEngagement || draftAppliedRef.current || patients.length === 0) {
      return;
    }
    if (BACKEND_ENABLED && sourcePackages.length <= 0) {
      return;
    }

    const participantSelection = getDraftParticipantUserIds(draftEngagement);
    let selectedPatientIds = [];

    if (Array.isArray(participantSelection)) {
      selectedPatientIds = patients
        .filter((patient) => participantSelection.includes(getNumericPatientUserId(patient)))
        .map((patient) => patient.id);
    }

    if (!selectedPatientIds.length) {
      const fallbackCount = participantSelection?.fallbackCount
        || Math.max(1, Number(draftEngagement?.participant_count) || 1);
      selectedPatientIds = patients.slice(0, fallbackCount).map((patient) => patient.id);
    }

    if (!selectedPatientIds.length) {
      return;
    }

    const matchedPackage = findPackageCardByDiagnosticPackageId(
      sourcePackages,
      draftEngagement?.diagnostic_package_id,
    ) || initialPackageCard;
    const packageId = normalizePackageId(
      matchedPackage?.id
      || draftEngagement?.diagnostic_package_id
      || selectedPackageId,
    );
    const packageSelectionByPatient = {};
    selectedPatientIds.forEach((patientId) => {
      packageSelectionByPatient[patientId] = packageId;
    });

    setSelectedIds(selectedPatientIds);
    setSelectedPackageId(packageId);
    setDraftPackageId(packageId);
    setSelectedPackageByPatientId(packageSelectionByPatient);

    if (engagementHasAddress(draftEngagement)) {
      const draftAddressForm = parseEngagementAddressToForm(draftEngagement);
      setAddressData(draftAddressForm);
      setResolvedAddressData(buildResolvedAddressFromEngagement(draftEngagement));

      const matchedSaved = savedAddresses.find((row) => {
        const mapped = savedAddressToBookingForm(row);
        return mapped.addressLine1 === String(draftAddressForm.addressLine1 || '').trim()
          && mapped.city === String(draftAddressForm.city || '').trim()
          && mapped.pincode === String(draftAddressForm.pincode || '').trim();
      });
      if (matchedSaved) {
        setSelectedSavedAddressId(matchedSaved.user_address_id);
        setAddingSavedAddress(false);
      }

      const selectedUserIds = selectedPatientIds
        .map((patientId) => {
          const patient = patients.find((item) => item.id === patientId);
          return getNumericPatientUserId(patient);
        })
        .filter((userId) => Number.isInteger(userId) && userId > 0);

      setServiceAvailabilityByUserId(
        buildServiceAvailabilityMapFromEngagement(draftEngagement, selectedUserIds),
      );
    }

    const resumeView = resolveDraftResumeView(draftEngagement);
    const matchedDateId = matchScheduleDateId(scheduleDates, draftEngagement);
    const scheduleTimeLabel = getDraftScheduleTimeLabel(draftEngagement);

    if (matchedDateId) {
      setSelectedDateId(matchedDateId);
    }
    if (scheduleTimeLabel) {
      setSelectedTimeSlot(scheduleTimeLabel);
    }

    setAddressViewReturn(resumeView === 'details' || resumeView === 'payment' ? 'details' : 'select');
    setScheduleViewReturn(resumeView === 'details' || resumeView === 'payment' ? 'details' : 'address');
    setView(resumeView);
    draftAppliedRef.current = true;
  }, [
    draftEngagement,
    initialPackageCard,
    open,
    patients,
    savedAddresses,
    scheduleDates,
    selectedPackageId,
    sourcePackages,
  ]);

  useEffect(() => {
    if (!open || customFlow || sourcePackages.length <= 0 || view === 'package' || packageManuallyChangedRef.current || draftEngagement) {
      return;
    }

    const initialPackageId = normalizePackageId(
      initialPackage?.id
      || initialPackage?.diagnostic_package_id
      || initialPackage?.apiData?.diagnostic_package_id
    );
    const initialPackageName = String(
      initialPackage?.name
      || initialPackage?.title
      || initialPackage?.package_name
      || initialPackage?.apiData?.package_name
      || ''
    ).trim().toLowerCase();

    const matchedFromContext = sourcePackages.find((item) => {
      const sameId = initialPackageId && normalizePackageId(item.id) === initialPackageId;
      const sameName = initialPackageName && String(item?.name || '').trim().toLowerCase() === initialPackageName;
      return sameId || sameName;
    });

    const selectedId = normalizePackageId(selectedPackageId);
    const draftId = normalizePackageId(draftPackageId);
    const hasSelectedPackage = sourcePackages.some((item) => normalizePackageId(item.id) === selectedId);
    const hasDraftPackage = sourcePackages.some((item) => normalizePackageId(item.id) === draftId);
    const preferredPackage = matchedFromContext || (hasSelectedPackage ? sourcePackages.find((item) => normalizePackageId(item.id) === selectedId) : null) || sourcePackages[0];

    if (preferredPackage && !hasSelectedPackage) {
      setSelectedPackageId(preferredPackage.id);
    }

    if (preferredPackage && !hasDraftPackage) {
      setDraftPackageId(preferredPackage.id);
    }
  }, [
    customFlow,
    draftPackageId,
    initialPackage,
    open,
    selectedPackageId,
    sourcePackages,
    view,
  ]);

  const selectedMemberGender = useMemo(() => {
    if (packageTargetPatientId) {
      const patient = patients.find((item) => item.id === packageTargetPatientId);
      if (patient?.gender === 'male' || patient?.gender === 'female') {
        return patient.gender;
      }
    }
    if (view === 'package' && packageViewReturn === 'add' && formData?.gender) {
      return normalizeGenderType(formData.gender);
    }
    return null;
  }, [packageTargetPatientId, patients, view, packageViewReturn, formData?.gender]);

  const filteredPackages = useMemo(() => {
    const selectedChip = packageFilterChips.find((chip) => String(chip?.chip_key || '').toLowerCase() === activeFilterKey);
    const selectedKey = String(selectedChip?.chip_key || activeFilterKey || 'all').trim().toLowerCase();
    const selectedLabel = String(selectedChip?.display_name || '').trim().toLowerCase();
    const q = searchQuery.trim().toLowerCase();

    const passesMemberGender = (item) => {
      if (!selectedMemberGender) {
        return true;
      }
      return packageMatchesForYouGender(item, selectedMemberGender);
    };

    const applySearchFilter = (items) => items.filter((item) => {
      if (!q) {
        return true;
      }

      const inName = item.name.toLowerCase().includes(q);
      const inTags = item.searchTags.some((tag) => tag.toLowerCase().includes(q));
      return inName || inTags;
    });

    const scopeId = profileData?.user_id || profileData?.id;
    const onboardingResult = scopeId ? loadPackageOnboardingResult(scopeId) : null;
    const forYouContext = {
      gender: selectedMemberGender || normalizeProfileGenderForYou(profileData),
      age: getNumericAgeFromProfile(profileData),
    };

    if (isForYouChipKey(selectedKey) && hasPersonalizedForYouRecommendations(onboardingResult)) {
      const rankById = new Map(
        onboardingResult.rankedPackages.map((row, index) => [Number(row.packageId), { ...row, order: index }]),
      );

      const recommendedPackages = sourcePackages
        .filter((item) => rankById.has(Number(item.id)))
        .filter(passesMemberGender)
        .map((item) => {
          const meta = rankById.get(Number(item.id));
          const recommendationLabel = meta?.label || null;
          return {
            ...item,
            recommended: item.recommended || recommendationLabel || '',
          };
        })
        .sort((a, b) => rankById.get(Number(a.id)).order - rankById.get(Number(b.id)).order);

      return applySearchFilter(recommendedPackages);
    }

    const filtered = sourcePackages.filter((item) => {
      if (!passesMemberGender(item)) {
        return false;
      }

      if (selectedKey === 'all') {
        return true;
      }

      if (isForYouChipKey(selectedKey)) {
        return packageMatchesForYou(item, forYouContext);
      }

      const packageValues = toNormalizedPackageTagValues(item);
      return packageValues.has(selectedKey)
        || (selectedLabel ? packageValues.has(selectedLabel) : false);
    });

    return applySearchFilter(filtered);
  }, [activeFilterKey, packageFilterChips, profileData, searchQuery, selectedMemberGender, sourcePackages]);

  const packageFilterTabs = useMemo(() => {
    if (!selectedMemberGender) {
      return packageFilterChips;
    }
    return packageFilterChips.filter((chip) => {
      if (selectedMemberGender === 'male' && isWomenFilterChip(chip)) {
        return false;
      }
      if (selectedMemberGender === 'female' && isMenFilterChip(chip)) {
        return false;
      }
      return true;
    });
  }, [packageFilterChips, selectedMemberGender]);

  const customFilterTabs = useMemo(() => {
    return customFilterChips;
  }, [customFilterChips]);

  useEffect(() => {
    const availableKeys = new Set(
      packageFilterTabs
        .map((chip) => String(chip?.chip_key || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (!availableKeys.has(activeFilterKey)) {
      setActiveFilterKey('all');
    }
  }, [activeFilterKey, packageFilterTabs]);

  useEffect(() => {
    const availableKeys = new Set(
      customFilterTabs
        .map((chip) => String(chip?.chip_key || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (!availableKeys.has(customActiveFilterKey)) {
      setCustomActiveFilterKey('all');
    }
  }, [customActiveFilterKey, customFilterTabs]);

  const selectedCount = selectedIds.length;
  const canContinue = selectedCount > 0;

  const customSelectedCards = useMemo(
    () => customGroupCards.filter((item) => customSelectedIds.has(item.id)),
    [customGroupCards, customSelectedIds],
  );

  const selectedText = useMemo(() => {
    if (selectedCount === 1) {
      return '1 patient selected';
    }
    return customFlow ? `${selectedCount} patients selected` : `${selectedCount} members selected`;
  }, [customFlow, selectedCount]);

  const selectedPatients = useMemo(() => {
    if (selectedIds.length <= 0) {
      return patients.slice(0, 2);
    }

    const patientMap = new Map(patients.map((item) => [item.id, item]));
    return selectedIds.map((id) => patientMap.get(id)).filter(Boolean);
  }, [patients, selectedIds]);

  const pricing = useMemo(() => {
    if (selectedCount <= 0) {
      return null;
    }

    if (customFlow) {
      const totals = selectedPatients.reduce((acc, patient) => {
        const price = getCustomPriceForPatient(patient.id);
        acc.current += price.current;
        acc.old += price.old;
        return acc;
      }, { current: 0, old: 0 });
      const off = totals.old > 0 ? Math.round(((totals.old - totals.current) / totals.old) * 100) : 0;
      return {
        current: totals.current,
        old: totals.old,
        off,
      };
    }

    const totals = selectedPatients.reduce((acc, patient) => {
      const pkg = getPackageForPatient(patient.id);
      const current = Number(pkg?.currentPrice || 0);
      const old = Number(pkg?.oldPrice || current);
      acc.current += current;
      acc.old += old;
      return acc;
    }, { current: 0, old: 0 });

    const off = totals.old > 0 ? Math.round(((totals.old - totals.current) / totals.old) * 100) : 0;
    return {
      current: totals.current,
      old: totals.old,
      off,
    };
  }, [selectedCount, selectedPatients, customFlow, getCustomPriceForPatient, getPackageForPatient]);

  const paymentBreakdown = useMemo(() => {
    const current = pricing?.current ?? 0;
    const old = pricing?.old ?? 0;
    const discount = Math.max(old - current, 0);
    const promoRupees = appliedPromo?.discountPaise
      ? appliedPromo.discountPaise / 100
      : 0;
    const totalNew = Math.max(current - promoRupees, 0);

    return {
      totalMrp: old,
      platformDiscount: discount,
      subtotal: current,
      totalOld: old,
      totalNew,
    };
  }, [pricing, appliedPromo]);

  const formatPrice = (value) => `₹ ${value.toLocaleString('en-IN')}`;

  const formatBreakdownPrice = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

  const handleApplyPromo = async () => {
    if (appliedPromo) {
      setAppliedPromo(null);
      setPromoCode('');
      setPromoError('');
      return;
    }

    const code = promoCode.trim();
    if (!code) {
      setPromoError('Enter a promo code');
      return;
    }

    if (!BACKEND_ENABLED) {
      setPromoError('Promo codes are unavailable right now.');
      return;
    }

    const items = selectedPatients.map((patient) => {
      const pkg = getPackageForPatient(patient.id);
      const entityId = Number(
        pkg?.apiData?.diagnostic_package_id
        ?? pkg?.apiData?.id
        ?? pkg?.id
        ?? 0,
      );
      return {
        user_id: getNumericPatientUserId(patient),
        entity_type: 'diagnostic_package',
        entity_id: entityId,
        amount_paise: Math.round(Number(pkg?.currentPrice || 0) * 100),
      };
    }).filter((item) => item.user_id > 0 && item.entity_id > 0 && item.amount_paise > 0);

    if (!items.length) {
      setPromoError('Select a package before applying a promo code.');
      return;
    }

    setPromoApplying(true);
    setPromoError('');
    try {
      const result = await validateDiscountCode({
        code,
        items,
        city: addressData?.city,
      });
      if (!result?.ok) {
        setAppliedPromo(null);
        setPromoError(result?.message || 'This promo code cannot be applied.');
        return;
      }
      const appliedCode = String(result.code || code).trim().toUpperCase();
      setAppliedPromo({
        code: appliedCode,
        discountPaise: Number(result.discount_paise) || 0,
      });
      setPromoCode(appliedCode);
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err?.message || 'Could not apply promo code.');
    } finally {
      setPromoApplying(false);
    }
  };

  const normalizedCustomQuery = customSearchQuery.trim().toLowerCase();

  const filteredCustomCards = useMemo(() => {
    const activeFilterKey = String(customActiveFilterKey || 'all').trim().toLowerCase();
    const activeChip = customFilterTabs.find(
      (chip) => String(chip?.chip_key || '').trim().toLowerCase() === activeFilterKey
    );
    const activeMatchValues = activeFilterKey === 'all'
      ? []
      : [
        activeFilterKey,
        String(activeChip?.display_name || '').trim().toLowerCase(),
        activeFilterKey.replace(/_/g, ' '),
      ].filter(Boolean);

    return customGroupCards.filter((item) => {
      const inTag = activeFilterKey === 'all'
        ? true
        : item.tags.some((tag) => {
          const normalizedTag = String(tag || '').trim().toLowerCase();
          return activeMatchValues.some((value) => normalizedTag === value || normalizedTag.includes(value));
        });

      if (!inTag) {
        return false;
      }

      if (!normalizedCustomQuery) {
        return true;
      }

      const testsText = item.tests.join(' ').toLowerCase();
      return item.title.toLowerCase().includes(normalizedCustomQuery) || testsText.includes(normalizedCustomQuery);
    });
  }, [customActiveFilterKey, customFilterTabs, customGroupCards, normalizedCustomQuery]);

  const customSelectedNames = useMemo(
    () => customSelectedCards.map((item) => item.title.split(' ')[0]).join(', '),
    [customSelectedCards],
  );

  const getTimeRange = () => {
    if (!selectedTimeSlot) {
      return '';
    }

    if (selectedSlotMeta?.end_time) {
      const endLabel = formatApiSlotTimeToDisplay(selectedSlotMeta.end_time);
      if (endLabel) {
        return `${selectedTimeSlot} - ${endLabel}`;
      }
    }

    const [timeValue, meridiem] = selectedTimeSlot.split(' ');
    const [hourText, minuteText] = timeValue.split(':');
    let hour24 = Number(hourText);

    if (meridiem === 'PM' && hour24 !== 12) {
      hour24 += 12;
    }
    if (meridiem === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    const startDate = new Date(2000, 0, 1, hour24, Number(minuteText), 0, 0);
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    const endHour = endDate.getHours().toString().padStart(2, '0');
    const endMinute = endDate.getMinutes().toString().padStart(2, '0');
    const endSuffix = endDate.getHours() >= 12 ? 'PM' : 'AM';
    let endDisplayHour = Number(endHour) % 12;
    if (endDisplayHour === 0) {
      endDisplayHour = 12;
    }

    return `${selectedTimeSlot} - ${String(endDisplayHour).padStart(2, '0')}:${endMinute} ${endSuffix}`;
  };

  const getAppointmentDate = () => {
    const selectedDate = scheduleDates.find((item) => item.id === selectedDateId);
    if (!selectedDate) {
      return '';
    }
    return `${selectedDate.day}, ${selectedDate.date} ${selectedDate.month}`;
  };

  const formatScheduleSummary = () => {
    const selectedDate = scheduleDates.find((item) => item.id === selectedDateId);
    if (!selectedDate || !selectedTimeSlot) {
      return '';
    }

    const [timeValue, meridiem] = selectedTimeSlot.split(' ');
    const [hourText, minuteText] = timeValue.split(':');
    let hour24 = Number(hourText);

    if (meridiem === 'PM' && hour24 !== 12) {
      hour24 += 12;
    }
    if (meridiem === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    const startDate = new Date(2000, 0, 1, hour24, Number(minuteText), 0, 0);
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));

    const format12 = (value) => {
      let h = value.getHours();
      const m = value.getMinutes().toString().padStart(2, '0');
      h %= 12;
      if (h === 0) {
        h = 12;
      }
      return `${h}:${m}`;
    };

    return `${selectedDate.date} ${selectedDate.month} | ${format12(startDate)} - ${format12(endDate)} ${endDate.getHours() >= 12 ? 'PM' : 'AM'}`;
  };

  const handleDetailsContinueToPayment = () => {
    setBioBookingError('');
    if (!BACKEND_ENABLED) {
      setView('payment');
      return;
    }

    try {
      buildBookPayPayload({
        selectedPatients,
        getNumericPatientUserId,
        serviceAvailabilityByUserId,
      });
      setView('payment');
    } catch (err) {
      setBioBookingError(err?.message || 'Complete address and schedule before continuing to payment.');
    }
  };

  const confirmHealthiansBookingAfterPayment = async (razorpayResponse) => {
    const bioResponse = await bookBioAiBatch({
      razorpay_payment_id: razorpayResponse?.razorpay_payment_id,
      razorpay_order_id: razorpayResponse?.razorpay_order_id,
      razorpay_signature: razorpayResponse?.razorpay_signature,
    });
    const members = extractBioAiBookingMembers(bioResponse);
    const failureMessage = getBioAiBookingFailureMessage(members);
    if (failureMessage) {
      throw new Error(failureMessage);
    }
    return getPrimaryBioAiBookingId(members)
      || bioResponse?.data?.razorpay_payment_id
      || razorpayResponse?.razorpay_payment_id
      || null;
  };

  const getPaymentResultTitle = () => {
    if (paymentOutcome === 'booking_failed') {
      return 'Booking Failed';
    }
    if (paymentOutcome === 'payment_failed') {
      return 'Payment Failed';
    }
    return 'Booking Confirmed';
  };

  const handlePayWithRazorpay = async () => {
    setPaymentError(null);
    setPaymentOutcome('success');
    paymentSuccessRef.current = false;
    paymentHandlerInvokedRef.current = false;
    setPaymentSubmitting(true);
    try {
      if (PAYMENT_DEMO_MODE && !BACKEND_ENABLED) {
        setConfirmedBookingId(`DEMO-${Date.now().toString(36).toUpperCase()}`);
        setPaymentOutcome('success');
        setResultPhase('success');
        paymentSuccessRef.current = true;
        setView('confirmed');
        if (typeof onBookingConfirmed === 'function') {
          onBookingConfirmed();
        }
        setPaymentSubmitting(false);
        return;
      }

      const payPayload = buildBookPayPayload({
        selectedPatients,
        getNumericPatientUserId,
        serviceAvailabilityByUserId,
        discountCode: appliedPromo?.code,
      });

      await loadRazorpayScript();
      const order = await createBookPayOrder(payPayload);

      const key = order.keyId || getDefaultRazorpayKeyId();
      if (!key) {
        throw new Error('Set REACT_APP_RAZORPAY_KEY_ID or return key_id from /book/pay.');
      }

      const options = {
        key,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.orderId,
        name: 'Super Shyft',
        description: selectedPatients.length > 1
          ? `Diagnostic packages (${selectedPatients.length} members)`
          : (getPackageForPatient(selectedPatients?.[0]?.id)?.name || 'Diagnostic package booking'),
        theme: { color: '#296359' },
        prefill: {
          name: [formData.firstName, formData.lastName].filter(Boolean).join(' ') || undefined,
          email: formData.email || undefined,
          contact: (formData.phone || '').replace(/\D/g, '').slice(-10) || undefined,
        },
        handler(response) {
          paymentHandlerInvokedRef.current = true;
          setPaymentSubmitting(true);
          void (async () => {
            try {
              paymentSuccessRef.current = true;

              let healthiansBookingId = null;
              if (BACKEND_ENABLED && !customFlow) {
                healthiansBookingId = await confirmHealthiansBookingAfterPayment(response);
              }

              setConfirmedBookingId(
                healthiansBookingId
                || response.razorpay_payment_id
                || order.bookingId
                || order.bookingIds?.[0]
                || '—',
              );
              setPaymentOutcome('success');
              setResultPhase('success');
              setPaymentError(null);
              setView('confirmed');
              if (typeof onBookingConfirmed === 'function') {
                onBookingConfirmed();
              }
            } catch (err) {
              const paymentWasVerified = paymentSuccessRef.current;
              setConfirmedBookingId(
                response.razorpay_payment_id
                || order.bookingIds?.[0]
                || response.razorpay_order_id
                || '—',
              );
              setPaymentOutcome(paymentWasVerified ? 'booking_failed' : 'payment_failed');
              setResultPhase(paymentWasVerified ? null : 'failure');
              setPaymentError(
                paymentWasVerified
                  ? (err?.message || 'Payment succeeded but lab booking could not be confirmed. Contact support with your payment ID.')
                  : (err?.message || 'Payment could not be completed. If you were charged, contact support.'),
              );
              setView('confirmed');
            } finally {
              setPaymentSubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss() {
            if (paymentHandlerInvokedRef.current || paymentSuccessRef.current) {
              return;
            }

            setConfirmedBookingId(order.bookingIds?.[0] || order.orderId || '—');
            setPaymentOutcome('payment_failed');
            setResultPhase('failure');
            setPaymentError('Payment was cancelled or could not be completed.');
            setView('confirmed');
            setPaymentSubmitting(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        paymentHandlerInvokedRef.current = true;
        const reason = response?.error?.description
          || response?.error?.reason
          || 'Payment could not be completed.';
        setConfirmedBookingId(order.bookingIds?.[0] || order.orderId || '—');
        setPaymentOutcome('payment_failed');
        setResultPhase('failure');
        setPaymentError(reason);
        setView('confirmed');
        setPaymentSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      setPaymentError(err.message || 'Could not start payment.');
      setPaymentOutcome('payment_failed');
      setResultPhase('failure');
      setView('confirmed');
      setPaymentSubmitting(false);
    }
  };

  const togglePatient = (patientId) => {
    setSelectedIds((prev) => {
      if (prev.includes(patientId)) {
        return prev.filter((id) => id !== patientId);
      }
      return [...prev, patientId];
    });
    if (customFlow) {
      setSelectedGroupIdsByPatientId((prev) => {
        if (Array.isArray(prev[patientId]) && prev[patientId].length > 0) {
          return prev;
        }
        return {
          ...prev,
          [patientId]: [...defaultCustomGroupIds],
        };
      });
    }
  };

  if (!open) {
    return null;
  }

  const handleClose = () => {
    setPackageTargetPatientId(null);
    setResultPhase(null);
    setView('select');
    onClose();
  };

  const fetchCustomGroupTests = async (cardIds) => {
    const uniqueIds = Array.from(new Set((Array.isArray(cardIds) ? cardIds : []).filter(Boolean)));
    const cardsToFetch = customGroupCards.filter((card) => (
      uniqueIds.includes(card.id)
      && card.groupId
      && !card.testsLoaded
      && !customTestLoadingById[card.id]
    ));

    if (cardsToFetch.length === 0) {
      return;
    }

    setCustomTestLoadingById((prev) => {
      const next = { ...prev };
      cardsToFetch.forEach((card) => {
        next[card.id] = true;
      });
      return next;
    });

    const results = await Promise.all(cardsToFetch.map(async (card) => {
      try {
        const rows = await listDiagnosticTestGroupTests(card.groupId);
        const tests = (Array.isArray(rows) ? rows : []).map((test) => (
          typeof test === 'string' || typeof test === 'number'
            ? String(test).trim()
            : String(test?.test_name || test?.parameter_name || test?.name || test?.title || '').trim()
        )).filter(Boolean);
        return { id: card.id, tests };
      } catch {
        return { id: card.id, tests: [] };
      }
    }));

    setCustomGroupCards((prev) => prev.map((card) => {
      const result = results.find((entry) => entry.id === card.id);
      if (!result) {
        return card;
      }
      return {
        ...card,
        tests: result.tests.length > 0 ? result.tests : card.tests,
        testsLoaded: true,
      };
    }));

    setCustomTestLoadingById((prev) => {
      const next = { ...prev };
      cardsToFetch.forEach((card) => {
        delete next[card.id];
      });
      return next;
    });
  };

  const openPackageSelector = (returnView, nameHint, patientId = null) => {
    const patientPackageId = patientId ? normalizePackageId(selectedPackageByPatientId[patientId]) : '';
    setDraftPackageId(patientPackageId || selectedPackageId);
    setPackageViewReturn(returnView);
    setPackageTargetName(nameHint || 'User');
    setPackageTargetPatientId(patientId);
    if (customFlow) {
      const currentIds = Array.isArray(selectedGroupIdsByPatientId[patientId])
        ? selectedGroupIdsByPatientId[patientId]
        : defaultCustomGroupIds;
      setCustomSelectedIds(new Set(currentIds));
      void fetchCustomGroupTests(currentIds);
    }
    setView('package');
  };

  const handleConfirmPackage = () => {
    packageManuallyChangedRef.current = true;
    if (packageTargetPatientId) {
      setSelectedPackageByPatientId((prev) => ({
        ...prev,
        [packageTargetPatientId]: normalizePackageId(draftPackageId),
      }));
    } else {
      setSelectedPackageId(draftPackageId);
    }
    setPackageTargetPatientId(null);
    setView(packageViewReturn);
  };

  const handleConfirmCustomTests = () => {
    const nextIds = customGroupCards
      .filter((item) => customSelectedIds.has(item.id) && item.groupId)
      .map((item) => item.id);

    if (nextIds.length === 0) {
      return;
    }

    const targetId = packageTargetPatientId || PENDING_ADD_PATIENT_ID;
    setSelectedGroupIdsByPatientId((prev) => ({
      ...prev,
      [targetId]: nextIds,
    }));
    if (!packageTargetPatientId) {
      setDefaultCustomGroupIds(nextIds);
    }
    setPackageTargetPatientId(null);
    setView(packageViewReturn);
  };

  const persistCustomPackagesForSelection = async () => {
    const uniqueSets = new Map();

    selectedPatients.forEach((patient) => {
      const groups = getCustomGroupsForPatient(patient.id);
      const numericIds = groups.map((item) => item.groupId).filter(Boolean);
      const key = toGroupSetKey(numericIds);
      if (!key) {
        throw new Error(`Select tests for ${patient.name || 'this patient'} before continuing.`);
      }
      if (!uniqueSets.has(key)) {
        uniqueSets.set(key, {
          groupIds: numericIds,
          groups,
          patientIds: [patient.id],
          firstPatient: patient,
        });
        return;
      }
      uniqueSets.get(key).patientIds.push(patient.id);
    });

    const existingPackages = await listDiagnosticPackages({ type: 'custom_package' });
    const existingWithGroups = await Promise.all((Array.isArray(existingPackages) ? existingPackages : []).map(async (pkg) => {
      const packageId = Number(pkg?.diagnostic_package_id || pkg?.id || 0);
      if (!packageId) {
        return null;
      }
      try {
        const tests = await getDiagnosticPackageTests(packageId);
        return {
          pkg,
          packageId,
          key: toGroupSetKey(extractAssignedGroupIds(tests)),
          assignedIds: extractAssignedGroupIds(tests),
        };
      } catch {
        return {
          pkg,
          packageId,
          key: '',
          assignedIds: [],
        };
      }
    }));

    const nextCards = [];
    const nextPatientPackageMap = { ...selectedPackageByPatientId };

    await Promise.all(Array.from(uniqueSets.entries()).map(async ([key, entry]) => {
      let matched = existingWithGroups.find((item) => item && item.key === key);
      const current = entry.groups.reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
      const old = entry.groups.reduce((sum, item) => sum + Number(item.oldPrice || item.salePrice || 0), 0);
      const shared = entry.patientIds.length > 1;
      const packageName = `${getPossessiveLabel(shared
        ? ([profileData?.first_name, profileData?.last_name].filter(Boolean).join(' ') || 'User')
        : entry.firstPatient?.name)} Custom Package`;

      if (matched) {
        const missing = entry.groupIds.filter((id) => !matched.assignedIds.includes(id));
        const extra = matched.assignedIds.filter((id) => !entry.groupIds.includes(id));
        if (missing.length > 0) {
          await assignGroupsToPackage(matched.packageId, missing);
        }
        await Promise.all(extra.map((groupId) => removeGroupFromPackage(matched.packageId, groupId)));
      } else {
        const created = await createDiagnosticPackage({
          package_name: packageName,
          custom: true,
          price: current,
          original_price: old,
          diagnostic_provider: 'healthians',
        });
        const packageId = Number(created?.diagnostic_package_id || created?.id || 0);
        if (!packageId) {
          throw new Error('Could not create a custom package. Please try again.');
        }
        await assignGroupsToPackage(packageId, entry.groupIds);
        matched = {
          pkg: created,
          packageId,
          key,
          assignedIds: entry.groupIds,
        };
      }

      const card = mapDiagnosticPackageToOverlayCard({
        ...matched.pkg,
        diagnostic_package_id: matched.packageId,
        package_name: matched.pkg?.package_name || packageName,
        price: current,
        original_price: old,
      });
      nextCards.push(card);
      entry.patientIds.forEach((patientId) => {
        nextPatientPackageMap[patientId] = normalizePackageId(card.id);
      });
    }));

    setCustomPackageCards(nextCards);
    setSelectedPackageByPatientId(nextPatientPackageMap);
  };

  const handleToggleCustomExpanded = (id) => {
    const isOpening = !customExpandedIds.has(id);
    if (isOpening) {
      void fetchCustomGroupTests([id]);
    }
    setCustomExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleCustomSelected = (id) => {
    setCustomSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderInputField = (key, label, options = {}) => {
    const errMsg = addFieldErrors[key];
    const fieldClass = `patient-add__field${activeField === key ? ' is-focused' : ''}${errMsg ? ' is-error' : ''}`;
    const isDropdown = options.dropdown;
    const dropdownOptions = key === 'relation' ? RELATION_OPTIONS : key === 'gender' ? GENDER_OPTIONS : [];

    const handleFieldChange = (rawValue) => {
      let nextValue = rawValue;
      if (key === 'phone') {
        nextValue = String(rawValue || '').replace(/\D/g, '').slice(0, 10);
      } else if (key === 'age') {
        nextValue = String(rawValue || '').replace(/\D/g, '').slice(0, 2);
      }
      setFormData((prev) => ({ ...prev, [key]: nextValue }));
      clearAddFieldError(setAddFieldErrors, key);
      setAddSubmitError('');
    };

    return (
      <div className={`patient-add__field-wrap${options.half ? ' patient-add__field-wrap--half' : ''}`}>
        <label className={fieldClass} htmlFor={`patient-${key}`}>
          <span className="patient-add__label-chip">{label}</span>

          <div className="patient-add__field-inner">
            {isDropdown ? (
              <select
                id={`patient-${key}`}
                ref={(node) => {
                  dropdownRefs.current[key] = node;
                }}
                value={formData[key]}
                onFocus={() => setActiveField(key)}
                onChange={(event) => handleFieldChange(event.target.value)}
                className="patient-add__input patient-add__select"
              >
                <option value="" disabled>Select</option>
                {dropdownOptions.map((item) => (
                  <option key={`${key}-${item}`} value={item}>{item}</option>
                ))}
              </select>
            ) : (
              <input
                id={`patient-${key}`}
                type={key === 'email' ? 'email' : 'text'}
                inputMode={key === 'phone' || key === 'age' ? 'numeric' : undefined}
                maxLength={key === 'phone' ? 10 : key === 'age' ? 2 : undefined}
                value={formData[key]}
                onFocus={() => setActiveField(key)}
                onChange={(event) => handleFieldChange(event.target.value)}
                className="patient-add__input"
              />
            )}

            {isDropdown ? (
              <button
                type="button"
                className="patient-add__dropdown-btn"
                aria-label={`Open ${label} dropdown`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const selectNode = dropdownRefs.current[key];
                  if (!selectNode) {
                    return;
                  }
                  if (typeof selectNode.showPicker === 'function') {
                    selectNode.showPicker();
                    return;
                  }
                  selectNode.focus();
                  selectNode.click();
                }}
              >
                <DownIcon />
              </button>
            ) : null}
          </div>
        </label>
        {errMsg ? <p className="patient-add__field-error">{errMsg}</p> : null}
      </div>
    );
  };

  const handleAddressContinue = async () => {
    const showSavedPicker = savedAddresses.length > 0 && !addingSavedAddress;
    let nextAddressData = addressData;

    if (showSavedPicker) {
      const selectedRow = savedAddresses.find(
        (row) => Number(row.user_address_id) === Number(selectedSavedAddressId),
      );
      if (!selectedRow) {
        setAddressSubmitError('Select an address to continue.');
        return;
      }
      nextAddressData = savedAddressToBookingForm(selectedRow);
      setAddressData(nextAddressData);
    } else {
      const nextErrors = validatePackageAddressForm(addressData);
      setAddressFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
      setAddressFieldErrors({});
    }

    setAddressSubmitError('');
    setAddressSubmitting(true);
    try {
      const mismatchErrors = await validateCityMatchesPincode(nextAddressData);
      if (mismatchErrors) {
        setAddressFieldErrors(mismatchErrors);
        return;
      }

      if (!showSavedPicker && BACKEND_ENABLED) {
        const created = await createMyAddress(bookingFormToAddressPayload(nextAddressData));
        if (created?.user_address_id) {
          setSavedAddresses((prev) => (
            prev.some((row) => Number(row.user_address_id) === Number(created.user_address_id))
              ? prev
              : [...prev, created]
          ));
          setSelectedSavedAddressId(created.user_address_id);
        }
        setAddingSavedAddress(false);
      }

      setResolvedAddressData(toResolvedAddressData(nextAddressData));

      if (addressViewReturn === 'details') {
        setView('details');
        return;
      }

      if (!BACKEND_ENABLED) {
        setScheduleViewReturn('address');
        setView('schedule');
        return;
      }

      const availabilityPayload = buildCheckServiceAvailabilityPayload({
        selectedPatients,
        addressData: nextAddressData,
        getPackageForPatient,
        getNumericPatientUserId,
      });
      const availabilityResponse = await checkServiceAvailability(availabilityPayload);
      if (isServiceAvailabilityDenied(availabilityResponse)) {
        throw new Error(AREA_NOT_SERVICEABLE_MESSAGE);
      }
      setServiceAvailabilityByUserId(mapServiceAvailabilityByUserId(availabilityResponse));
      setSelectedDateId('');
      setSelectedTimeSlot('');
      setSelectedSlotMeta(null);
      setAvailableSlotRows([]);
      setSlotsError('');

      setScheduleViewReturn('address');
      setView('schedule');
    } catch (err) {
      setAddressSubmitError(err?.message || 'Could not verify service availability. Please try again.');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleScheduleDateSelect = async (dateItem) => {
    setSelectedDateId(dateItem.id);
    setSelectedTimeSlot('');
    setSelectedSlotMeta(null);
    setSlotsError('');
    setScheduleLockError('');
    setAvailableSlotRows([]);

    if (!BACKEND_ENABLED) {
      const fallbackSlots = SCHEDULE_FALLBACK_TIME_SLOTS.flat().map((displayLabel) => ({
        displayLabel,
        slot_time: formatBloodCollectionTimeSlot(displayLabel) || displayLabel,
        end_time: '',
        stm_id: displayLabel,
      }));
      setAvailableSlotRows(chunkScheduleSlots(fallbackSlots));
      return;
    }

    setSlotsLoading(true);
    try {
      const payload = buildAvailableSlotsPayload({
        selectedPatients,
        getNumericPatientUserId,
        serviceAvailabilityByUserId,
        bloodCollectionDate: dateItem.isoDate,
      });
      const response = await fetchAvailableSlots(payload);
      const normalizedSlots = normalizeAvailableSlotsForUi(response);
      if (!normalizedSlots.length) {
        setSlotsError('No slots available for this date.');
        return;
      }
      setAvailableSlotRows(chunkScheduleSlots(normalizedSlots));
    } catch (err) {
      setSlotsError(err?.message || 'Could not load available slots. Please try again.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleScheduleContinue = async () => {
    setScheduleLockError('');

    const selectedScheduleDate = scheduleDates.find((item) => item.id === selectedDateId);
    const bloodCollectionDate = selectedScheduleDate?.isoDate || '';
    const bloodCollectionTimeSlotId = String(selectedSlotMeta?.stm_id || '').trim();
    const bloodCollectionTimeSlot = String(
      selectedSlotMeta?.slot_time
      || formatBloodCollectionTimeSlot(selectedTimeSlot)
      || selectedTimeSlot
      || '',
    ).trim();

    if (!bloodCollectionDate || !selectedTimeSlot) {
      setScheduleLockError('Select a collection date and time slot.');
      return;
    }

    if (!BACKEND_ENABLED) {
      setView('details');
      return;
    }

    if (!bloodCollectionTimeSlotId || !bloodCollectionTimeSlot) {
      setScheduleLockError('Select a valid time slot.');
      return;
    }

    setScheduleSubmitting(true);
    try {
      const lockPayload = buildLockSlotsPayload({
        selectedPatients,
        getNumericPatientUserId,
        serviceAvailabilityByUserId,
        bloodCollectionDate,
        bloodCollectionTimeSlotId,
        bloodCollectionTimeSlot,
        addressData,
      });
      const lockResponse = await lockSlots(lockPayload);
      const lockMembers = lockResponse?.data?.members || lockResponse?.members || [];
      const failedLock = lockMembers.find((member) => {
        const status = String(member?.status || '').toLowerCase();
        return status && status !== 'success';
      });
      if (failedLock) {
        throw new Error(failedLock.message || 'Could not lock the selected slot. Please try again.');
      }
      setView('details');
    } catch (err) {
      setScheduleLockError(err?.message || 'Could not lock the selected slot. Please try again.');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const renderAddressField = (key, label, options = {}) => {
    const errMsg = addressFieldErrors[key];
    const fieldClass = `patient-address__field${activeAddressField === key ? ' is-focused' : ''}${errMsg ? ' is-error' : ''}${options.half ? ' patient-address__field--half' : ''}`;
    return (
      <div className={`patient-address__field-wrap${options.half ? ' patient-address__field-wrap--half' : ''}`}>
        <label className={fieldClass} htmlFor={`address-${key}`}>
          <span className="patient-add__label-chip">{label}</span>
          <div className="patient-address__field-inner">
            <input
              id={`address-${key}`}
              value={addressData[key] ?? ''}
              onFocus={() => setActiveAddressField(key)}
              onChange={(event) => {
                const raw = key === 'pincode' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value;
                setAddressData((prev) => ({ ...prev, [key]: raw }));
                setAddressSubmitError('');
                setAddressFieldErrors((prev) => {
                  if (!prev[key]) return prev;
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return;
                }
                event.preventDefault();
                const currentIndex = ADDRESS_FIELD_ORDER.indexOf(key);
                if (currentIndex < 0 || currentIndex >= ADDRESS_FIELD_ORDER.length - 1) {
                  return;
                }
                const nextKey = ADDRESS_FIELD_ORDER[currentIndex + 1];
                const nextInput = document.getElementById(`address-${nextKey}`);
                if (nextInput) {
                  nextInput.focus();
                }
              }}
              className="patient-address__input"
              inputMode={key === 'pincode' ? 'numeric' : undefined}
              maxLength={key === 'pincode' ? 6 : undefined}
            />
          </div>
        </label>
        {errMsg ? <p className="patient-address__field-error">{errMsg}</p> : null}
      </div>
    );
  };

  const handleSavePatient = async () => {
    const validation = validateAddMemberForm(formData);
    setAddFieldErrors(validation);
    setAddSubmitError('');
    if (Object.keys(validation).length > 0) {
      return;
    }

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const relation = formData.relation.trim();
    const gender = formData.gender.trim();
    const city = formData.city.trim();

    try {
      setSavingPatient(true);

      const createResponse = await createMySubProfile({
        firstName,
        lastName,
        age: formData.age,
        phone: formData.phone || '',
        email: formData.email || '',
        city,
        organization: '',
        gender,
        relation,
      });
      invalidateMyProfilesCache();

      const createdRow = createResponse?.data && typeof createResponse.data === 'object'
        ? createResponse.data
        : createResponse;
      const createdUserId = Number(createdRow?.user_id || 0);

      const refreshedProfilesResponse = await getMyProfiles({ forceRefresh: true });
      const refreshedProfiles = Array.isArray(refreshedProfilesResponse?.data)
        ? refreshedProfilesResponse.data
        : Array.isArray(refreshedProfilesResponse)
          ? refreshedProfilesResponse
          : [];

      const refreshedPatients = [];
      const uniqueUserIds = new Set();
      const primaryPatient = mapProfileToPatient(profileData, 'Primary');
      if (primaryPatient) {
        uniqueUserIds.add(primaryPatient.id);
        refreshedPatients.push(primaryPatient);
      }

      refreshedProfiles.forEach((item) => {
        const mapped = mapProfileToPatient(item, 'Member');
        if (!mapped || uniqueUserIds.has(mapped.id)) {
          return;
        }

        uniqueUserIds.add(mapped.id);
        refreshedPatients.push(mapped);
      });

      setPatients(refreshedPatients);

      const createdPatient = createdUserId > 0
        ? refreshedPatients.find((item) => Number(item.userId) === createdUserId)
        : null;

      const pendingPackageId = normalizePackageId(
        selectedPackageByPatientId[PENDING_ADD_PATIENT_ID],
      ) || selectedPackageId;
      const pendingGroupIds = Array.isArray(selectedGroupIdsByPatientId[PENDING_ADD_PATIENT_ID])
        && selectedGroupIdsByPatientId[PENDING_ADD_PATIENT_ID].length > 0
        ? selectedGroupIdsByPatientId[PENDING_ADD_PATIENT_ID]
        : defaultCustomGroupIds;

      if (createdPatient) {
        setSelectedIds((prev) => {
          if (prev.includes(createdPatient.id)) {
            return prev;
          }
          return [...prev, createdPatient.id];
        });
        setSelectedPackageByPatientId((prev) => {
          const next = { ...prev };
          delete next[PENDING_ADD_PATIENT_ID];
          next[createdPatient.id] = pendingPackageId;
          return next;
        });
        if (customFlow) {
          setSelectedGroupIdsByPatientId((prev) => {
            const next = { ...prev };
            delete next[PENDING_ADD_PATIENT_ID];
            next[createdPatient.id] = pendingGroupIds;
            return next;
          });
        }
      } else {
        setSelectedPackageByPatientId((prev) => {
          const next = { ...prev };
          delete next[PENDING_ADD_PATIENT_ID];
          return next;
        });
        if (customFlow) {
          setSelectedGroupIdsByPatientId((prev) => {
            const next = { ...prev };
            delete next[PENDING_ADD_PATIENT_ID];
            return next;
          });
        }
      }

      setFormData(DEFAULT_FORM_DATA);
      setAddFieldErrors({});
      setAddSubmitError('');
      setAddMemberSuccess(
        createdPatient
          ? `${createdPatient.name} added and selected.`
          : 'Member added successfully.',
      );
      setView('select');
    } catch (error) {
      setAddSubmitError(error?.message || 'Failed to add account. Please try again.');
    } finally {
      setSavingPatient(false);
    }
  };

  return (
    <div className="patient-select-overlay" role="dialog" aria-modal="true" aria-label="Select Patients">
      <button type="button" className="patient-select-overlay__close" aria-label="Close" onClick={handleClose}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="16" fill="#063533"/>
          <path d="M23.1992 8.75C23.2127 8.75003 23.2258 8.75513 23.2354 8.76465C23.2449 8.77417 23.25 8.78732 23.25 8.80078C23.25 8.81422 23.2448 8.82738 23.2354 8.83691L16.6006 15.4697L16.0703 16L16.6006 16.5303L23.2354 23.1631C23.2448 23.1726 23.25 23.1858 23.25 23.1992C23.25 23.2127 23.2449 23.2258 23.2354 23.2354C23.2258 23.2449 23.2127 23.25 23.1992 23.25C23.1858 23.25 23.1726 23.2448 23.1631 23.2354L16.5303 16.6006L16 16.0703L15.4697 16.6006L8.83691 23.2354C8.82738 23.2448 8.81422 23.25 8.80078 23.25C8.78732 23.25 8.77417 23.2449 8.76465 23.2354C8.75513 23.2258 8.75003 23.2127 8.75 23.1992C8.75 23.1858 8.75518 23.1726 8.76465 23.1631L15.3994 16.5303L15.9297 16L15.3994 15.4697L8.76465 8.83691C8.75998 8.83221 8.75644 8.82643 8.75391 8.82031C8.75136 8.81415 8.75 8.80745 8.75 8.80078C8.75002 8.79414 8.75136 8.78739 8.75391 8.78125C8.75646 8.77514 8.75996 8.76933 8.76465 8.76465C8.76933 8.75996 8.77514 8.75646 8.78125 8.75391C8.78739 8.75136 8.79414 8.75002 8.80078 8.75C8.80745 8.75 8.81415 8.75136 8.82031 8.75391C8.82643 8.75644 8.83221 8.75998 8.83691 8.76465L15.4697 15.3994L16 15.9297L16.5303 15.3994L23.1631 8.76465C23.1726 8.75518 23.1858 8.75 23.1992 8.75Z" fill="white" stroke="white" strokeWidth="1.5"/>
        </svg>
      </button>

      <div className={`patient-select-overlay__sheet${view === 'add' ? ' is-add' : ''}${view === 'package' ? ' is-package' : ''}${view === 'package-details' ? ' is-package-details' : ''}${view === 'address' ? ' is-address' : ''}${view === 'schedule' ? ' is-schedule' : ''}${view === 'details' ? ' is-details' : ''}${view === 'payment' ? ' is-payment' : ''}${view === 'confirmed' ? ' is-confirmed' : ''}${view === 'confirmed' && (resultPhase === 'failure' || (customFlow && resultPhase === 'success')) ? ' is-result-screen' : ''}${view === 'package' && customFlow ? ' is-custom-package' : ''}`}>
        {view === 'select' ? (
          <>
            <h3 className="patient-select-overlay__title">{customFlow ? 'Select patients' : 'Select members'}</h3>

            {addMemberSuccess ? (
              <p className="patient-select-overlay__success" role="status">
                {addMemberSuccess}
              </p>
            ) : null}

            <div className="patient-select-overlay__list">
              {patients.map((patient) => {
                const selected = selectedIds.includes(patient.id);
                return (
                  <div key={patient.id}>
                    <div className="patient-select-overlay__row">
                      <div className="patient-select-overlay__left">
                        <div className="patient-select-overlay__avatar">
                          {patient.gender === 'male' ? <MaleIcon /> : <FemaleIcon />}
                        </div>

                        <div className="patient-select-overlay__details">
                          <p className="patient-select-overlay__name">{patient.name}</p>
                          <p className="patient-select-overlay__meta">{patient.meta}</p>
                        </div>
                      </div>

                      <div className="patient-select-overlay__actions">
                        <button
                          type="button"
                          className="patient-select-overlay__icon-btn patient-select-overlay__check-btn"
                          aria-label={selected ? `Unselect ${patient.name}` : `Select ${patient.name}`}
                          onClick={() => togglePatient(patient.id)}
                        >
                          <UncheckedIcon />
                          {selected ? <span className="patient-select-overlay__checkmark"><CheckedIcon /></span> : null}
                        </button>
                      </div>
                    </div>

                    {selected ? (
                      <div className="patient-select-overlay__selected-package">
                        <div className="patient-select-overlay__selected-package-left">
                          {customFlow ? null : <SelectedRowPackageIcon />}
                          <span>
                            {customFlow
                              ? (formatCustomGroupNames(getCustomGroupsForPatient(patient.id)) || 'Add tests')
                              : getPackageForPatient(patient.id).name}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`patient-select-overlay__selected-package-change${customFlow ? ' is-custom' : ''}`}
                          onClick={() => openPackageSelector('select', patient.name.split(' ')[0] || 'User', patient.id)}
                        >
                          {customFlow ? 'Add tests' : 'Change'}
                        </button>
                      </div>
                    ) : null}

                    <div className="patient-select-overlay__divider" />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="patient-select-overlay__add-btn"
              onClick={() => {
                setFormData(DEFAULT_FORM_DATA);
                setAddFieldErrors({});
                setAddSubmitError('');
                setAddMemberSuccess('');
                setSelectedPackageByPatientId((prev) => ({
                  ...prev,
                  [PENDING_ADD_PATIENT_ID]: normalizePackageId(selectedPackageId),
                }));
                if (customFlow) {
                  setSelectedGroupIdsByPatientId((prev) => ({
                    ...prev,
                    [PENDING_ADD_PATIENT_ID]: Array.isArray(prev[PENDING_ADD_PATIENT_ID]) && prev[PENDING_ADD_PATIENT_ID].length > 0
                      ? prev[PENDING_ADD_PATIENT_ID]
                      : [...defaultCustomGroupIds],
                  }));
                }
                setView('add');
              }}
            >
              {customFlow ? '+ Add new patient' : '+ Add new member'}
            </button>

            {customPersistError ? (
              <p className="patient-select-overlay__persist-error" role="alert">{customPersistError}</p>
            ) : null}

            <div className="patient-select-overlay__footer">
              <div className="patient-select-overlay__footer-left">
                <span className="patient-select-overlay__selected-count">{selectedText}</span>
                {pricing ? (
                  <div className="patient-select-overlay__selected-price-row">
                    <span className="patient-select-overlay__selected-price-now">{formatPrice(pricing.current)}</span>
                    <span className="patient-select-overlay__selected-price-old">{formatPrice(pricing.old)}</span>
                    <span className="patient-select-overlay__selected-price-off">{pricing.off}% OFF</span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`patient-select-overlay__continue${canContinue ? ' is-active' : ''}`}
                disabled={!canContinue || customPersisting}
                onClick={async () => {
                  if (!canContinue || customPersisting) {
                    return;
                  }
                  if (customFlow && BACKEND_ENABLED) {
                    setCustomPersistError('');
                    setCustomPersisting(true);
                    try {
                      await persistCustomPackagesForSelection();
                    } catch (error) {
                      setCustomPersistError(error?.message || 'Could not save custom tests. Please try again.');
                      setCustomPersisting(false);
                      return;
                    }
                    setCustomPersisting(false);
                  }
                  if (selectViewReturn === 'details') {
                    setSelectViewReturn(null);
                    setView('details');
                    return;
                  }
                  setAddressViewReturn('select');
                  setView('address');
                }}
              >
                {customPersisting ? 'Please wait…' : 'Continue'}
              </button>
            </div>
          </>
        ) : view === 'add' ? (
          <>
            <div className="patient-add__header-row">
              <button
                type="button"
                className="patient-add__back"
                aria-label="Back to select patients"
                onClick={() => {
                  setAddFieldErrors({});
                  setAddSubmitError('');
                  setView('select');
                }}
              >
                <BackIcon />
              </button>
              <h3 className="patient-select-overlay__title">{customFlow ? 'Add a new patient' : 'Add a new member'}</h3>
            </div>

            <div className="patient-add__body">
              <div className="patient-add__split-row">
                {renderInputField('firstName', 'First Name', { half: true })}
                {renderInputField('lastName', 'Last Name', { half: true })}
              </div>

              {renderInputField('relation', 'Relation', { dropdown: true })}

              <div className="patient-add__split-row">
                {renderInputField('age', 'Age', { half: true })}
                {renderInputField('gender', 'Gender', { half: true, dropdown: true })}
              </div>

              {renderInputField('phone', 'Phone')}
              {renderInputField('email', 'Email')}
              {renderInputField('city', 'City')}

              {customFlow ? (
                <div className="patient-add__tests-block">
                  <p className="patient-add__tests-label">Tests selected</p>
                  <div className="patient-add__tests-chips">
                    {getCustomGroupsForPatient(PENDING_ADD_PATIENT_ID).map((group) => (
                      <span className="patient-add__tests-chip" key={group.id}>{group.title.split(' ')[0]}</span>
                    ))}
                    <button
                      type="button"
                      className="patient-add__tests-add"
                      onClick={() => openPackageSelector(
                        'add',
                        formData.firstName || 'User',
                        PENDING_ADD_PATIENT_ID,
                      )}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ) : (
                <div className="patient-add__package-row">
                  <div className="patient-add__package-left">
                    <PackagePulseIcon />
                    <div>
                      <p className="patient-add__package-title">
                        {getPackageForPatient(PENDING_ADD_PATIENT_ID).name}
                      </p>
                      <p className="patient-add__package-subtitle">Current Package</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="patient-add__change-btn"
                    onClick={() => openPackageSelector(
                      'add',
                      formData.firstName || 'User',
                      PENDING_ADD_PATIENT_ID,
                    )}
                  >
                    Change
                  </button>
                </div>
              )}

              {addSubmitError ? (
                <p className="patient-add__submit-error" role="alert">{addSubmitError}</p>
              ) : null}

              <button type="button" className="patient-add__save-btn" onClick={handleSavePatient} disabled={savingPatient}>
                {savingPatient ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        ) : view === 'package' ? (
          <>
            <div className="patient-add__header-row">
              <button
                type="button"
                className="patient-add__back"
                aria-label={packageViewReturn === 'add' ? 'Back to add member' : 'Back to select members'}
                onClick={() => setView(packageViewReturn)}
              >
                <BackIcon />
              </button>
              <h3 className="patient-select-overlay__title">{customFlow ? 'Add tests' : 'Select Package'}</h3>
            </div>

            {customFlow ? (
              <div className="patient-custom-tests">
                <div className="patient-package__search">
                  <PackageSearchIcon />
                  <input
                    type="text"
                    value={customSearchQuery}
                    onChange={(event) => setCustomSearchQuery(event.target.value)}
                    placeholder="Search tests or health goals"
                    className="patient-package__search-input"
                  />
                </div>

                <div className="patient-package__tabs" aria-label="Test categories">
                  {customFilterTabs.map((tab) => {
                    const filterKey = String(tab?.chip_key || 'all').trim().toLowerCase();
                    const label = String(tab?.display_name || tab?.chip_key || 'All').trim() || 'All';

                    return (
                      <button
                        key={String(tab?.filter_chip_id || filterKey)}
                        type="button"
                        className={`patient-package__tab${customActiveFilterKey === filterKey ? ' is-active' : ''}`}
                        onClick={() => setCustomActiveFilterKey(filterKey)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="patient-custom-tests__cards-scroll">
                  {filteredCustomCards.map((item) => {
                    const selectedCard = customSelectedIds.has(item.id);
                    const expanded = customExpandedIds.has(item.id);
                    const discount = Math.round(((item.oldPrice - item.salePrice) / item.oldPrice) * 100);

                    return (
                      <article key={item.id} className={`patient-custom-tests__card${selectedCard ? ' is-selected' : ''}`}>
                        <div className="patient-custom-tests__top-row">
                          <button
                            type="button"
                            className={`patient-custom-tests__checkbox${selectedCard ? ' is-selected' : ''}`}
                            onClick={() => handleToggleCustomSelected(item.id)}
                            aria-label={`Select ${item.title}`}
                          >
                            {selectedCard ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
                                <path d="M13.9154 0.583374L4.7487 9.75004L0.582031 5.58337" stroke="#90DF9E" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </button>

                          <div className="patient-custom-tests__title-col">
                            <h4>{item.title}</h4>
                            <div className="patient-custom-tests__price-row">
                              <span className="patient-custom-tests__price-now">Rs. {item.salePrice}</span>
                              <span className="patient-custom-tests__price-old">Rs. {item.oldPrice}</span>
                              <span className="patient-custom-tests__price-off">{discount}% off</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="patient-custom-tests__expand-btn"
                            onClick={() => handleToggleCustomExpanded(item.id)}
                            aria-label={`Toggle details for ${item.title}`}
                          >
                            {expanded ? <TestChevronUpIcon /> : <TestChevronDownIcon />}
                          </button>
                        </div>

                        {expanded ? (
                          <>
                            <div className="patient-custom-tests__divider" />
                            <div className="patient-custom-tests__tests-grid">
                              {customTestLoadingById[item.id] ? (
                                <span className="patient-custom-tests__test-item">Loading tests...</span>
                              ) : null}
                              {!customTestLoadingById[item.id] && item.tests.length === 0 ? (
                                <span className="patient-custom-tests__test-item">No tests available</span>
                              ) : null}
                              {item.tests.map((test) => (
                                <span key={`${item.id}-${test}`} className="patient-custom-tests__test-item">
                                  <span className="patient-custom-tests__dot" aria-hidden="true" />
                                  <span className="patient-custom-tests__test-label">{test}</span>
                                </span>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <div className="patient-package__bottom-bar">
                  <div className="patient-package__bottom-left">
                    <span>SELECTED TESTS</span>
                    <p>{customSelectedNames || 'None'}</p>
                  </div>
                  <button
                    type="button"
                    className="patient-package__confirm-btn patient-package__confirm-btn--compact"
                    onClick={handleConfirmCustomTests}
                    disabled={customSelectedCards.length === 0}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <div className="patient-package">
                <div className="patient-package__search">
                  <PackageSearchIcon />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search tests or health goals"
                    className="patient-package__search-input"
                  />
                </div>

                <div className="patient-package__tabs" aria-label="Package tags">
                  {packageFilterTabs.map((tab) => (
                    <button
                      key={String(tab?.filter_chip_id || tab?.chip_key)}
                      type="button"
                      className={`patient-package__tab${activeFilterKey === String(tab?.chip_key || '').toLowerCase() ? ' is-active' : ''}`}
                      onClick={() => setActiveFilterKey(String(tab?.chip_key || '').toLowerCase())}
                    >
                      {String(tab?.display_name || tab?.chip_key || 'All')}
                    </button>
                  ))}
                </div>

                <div className="patient-package__cards-scroll">
                  {filteredPackages.map((item) => {
                    const selectedCard = normalizePackageId(draftPackageId) === normalizePackageId(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`patient-package__card${selectedCard ? ' is-selected' : ''}`}
                        onClick={() => {
                          packageManuallyChangedRef.current = true;
                          if (selectedCard) {
                            setPackageDetailsCard(item);
                            setView('package-details');
                            return;
                          }
                          setDraftPackageId(item.id);
                        }}
                      >
                        <div className="patient-package__card-main">
                          <h4>{item.name}</h4>

                          <div className="patient-package__price-row">
                            <span className="patient-package__price-now">{formatPrice(item.currentPrice)}</span>
                            <span className="patient-package__price-old">{formatPrice(item.oldPrice)}</span>
                            <span className="patient-package__off-pill">{item.offPercent}% OFF</span>
                            <span className="patient-package__open-icon"><PackageOpenIcon /></span>
                          </div>

                          {item.recommended ? (
                            <div className="patient-package__doctor-row">
                              <PackageDoctorIcon />
                              <span>{item.recommended}</span>
                            </div>
                          ) : null}
                        </div>

                      </button>
                    );
                  })}
                </div>

                <div className="patient-package__bottom-bar">
                  <div className="patient-package__bottom-left">
                    <span>SELECTED PACKAGE</span>
                    <p>{draftPackage.name.replace(' Panel', '').replace(' Checkup', '')}</p>
                  </div>
                  <button type="button" className="patient-package__confirm-btn" onClick={handleConfirmPackage}>
                    {`Confirm for ${packageTargetName}`}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : view === 'package-details' ? (
          <PackageDetailsPage
            onBack={() => setView('package')}
            packageId={Number(packageDetailsCard?.apiData?.diagnostic_package_id || packageDetailsCard?.apiData?.id || packageDetailsCard?.id || 0) || null}
            packageCard={packageDetailsCard}
            hideBookBar
          />
        ) : view === 'address' ? (
          <>
            <div className="patient-add__header-row">
              <button
                type="button"
                className="patient-add__back"
                aria-label={
                  addingSavedAddress && savedAddresses.length > 0
                    ? 'Back to saved addresses'
                    : addressViewReturn === 'details'
                      ? 'Back to booking summary'
                      : 'Back to select members'
                }
                onClick={() => {
                  if (addingSavedAddress && savedAddresses.length > 0) {
                    setAddingSavedAddress(false);
                    setAddressFieldErrors({});
                    setAddressSubmitError('');
                    const selectedRow = savedAddresses.find(
                      (row) => Number(row.user_address_id) === Number(selectedSavedAddressId),
                    ) || pickDefaultSavedAddress(savedAddresses);
                    if (selectedRow) {
                      setAddressData(savedAddressToBookingForm(selectedRow));
                    }
                    return;
                  }
                  setView(addressViewReturn);
                }}
              >
                <BackIcon />
              </button>
              <h3 className="patient-select-overlay__title">
                {savedAddresses.length > 0 && !addingSavedAddress ? 'Select Address' : 'Add Address'}
              </h3>
            </div>

            <div className="patient-address__body">
              {savedAddresses.length > 0 && !addingSavedAddress ? (
                <>
                  <div className="patient-address__picker" role="listbox" aria-label="Saved addresses">
                    {savedAddresses.map((row) => {
                      const isSelected = Number(row.user_address_id) === Number(selectedSavedAddressId);
                      return (
                        <button
                          key={row.user_address_id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`patient-address__option${isSelected ? ' is-selected' : ''}`}
                          onClick={() => {
                            setSelectedSavedAddressId(row.user_address_id);
                            setAddressData(savedAddressToBookingForm(row));
                            setAddressSubmitError('');
                          }}
                        >
                          {row.is_default ? <span className="patient-address__option-badge">Default</span> : null}
                          <p className="patient-address__option-text">{formatProfileAddressDisplay(row)}</p>
                          {row.pincode ? <p className="patient-address__option-meta">{row.pincode}</p> : null}
                        </button>
                      );
                    })}
                  </div>
                  {savedAddresses.length < MAX_USER_ADDRESSES ? (
                    <button
                      type="button"
                      className="patient-address__add-btn"
                      onClick={() => {
                        setAddingSavedAddress(true);
                        setAddressData(DEFAULT_ADDRESS_DATA);
                        setAddressFieldErrors({});
                        setAddressSubmitError('');
                        setActiveAddressField('addressLine1');
                      }}
                    >
                      Add Address
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  {renderAddressField('addressLine1', 'Address Line 1')}
                  {renderAddressField('addressLine2', 'Address Line 2')}
                  {renderAddressField('landmark', 'Landmark')}

                  <div className="patient-address__split-row">
                    {renderAddressField('city', 'City', { half: true })}
                    {renderAddressField('pincode', 'Pincode', { half: true })}
                  </div>
                </>
              )}

              {addressSubmitError ? (
                <p className="patient-address__field-error patient-address__submit-error" role="alert">
                  {addressSubmitError}
                </p>
              ) : null}

              <button
                type="button"
                className="patient-address__continue-btn"
                onClick={handleAddressContinue}
                disabled={addressSubmitting || (savedAddresses.length > 0 && !addingSavedAddress && !selectedSavedAddressId)}
              >
                {addressSubmitting ? 'Please wait…' : 'Continue'}
              </button>
            </div>
          </>
        ) : view === 'schedule' ? (
          <>
            <div className="patient-add__header-row">
              <button
                type="button"
                className="patient-add__back"
                aria-label={scheduleViewReturn === 'details' ? 'Back to booking summary' : 'Back to add address'}
                onClick={() => setView(scheduleViewReturn)}
              >
                <BackIcon />
              </button>
              <h3 className="patient-select-overlay__title">Schedule Collection</h3>
            </div>

            <div className="patient-schedule">
              <div className="patient-schedule__section-title-row">
                <PreferredDateIcon />
                <span>Preferred Date</span>
              </div>

              <div className="patient-schedule__dates">
                {scheduleDates.map((item) => {
                  const isSelected = item.id === selectedDateId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`patient-schedule__date-card${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleScheduleDateSelect(item)}
                      disabled={slotsLoading}
                    >
                      <span className="patient-schedule__date-day">{item.day}</span>
                      <span className="patient-schedule__date-number">{item.date}</span>
                    </button>
                  );
                })}
              </div>

              <div className="patient-schedule__time-head">
                <div className="patient-schedule__section-title-row">
                  <PreferredTimeIcon />
                  <span>Preferred Time Slot</span>
                </div>
                <p className="patient-schedule__time-subtitle">Collection window is of 1 hour</p>
              </div>

              <div className="patient-schedule__slots-wrap">
                {!selectedDateId ? (
                  <p className="patient-schedule__slots-hint">Select a date to view available time slots.</p>
                ) : slotsLoading ? (
                  <p className="patient-schedule__slots-hint">Loading available slots…</p>
                ) : slotsError ? (
                  <p className="patient-schedule__slots-error" role="alert">{slotsError}</p>
                ) : availableSlotRows.length > 0 ? (
                  availableSlotRows.map((row, index) => (
                    <div key={`row-${index}`} className="patient-schedule__slot-row">
                      {row.map((slot) => {
                        const isSelected = slot.displayLabel === selectedTimeSlot;
                        return (
                          <button
                            key={slot.stm_id || slot.displayLabel}
                            type="button"
                            className={`patient-schedule__slot-pill${isSelected ? ' is-selected' : ''}`}
                            onClick={() => {
                              setSelectedTimeSlot(slot.displayLabel);
                              setSelectedSlotMeta(slot);
                              setScheduleLockError('');
                            }}
                          >
                            {slot.displayLabel}
                          </button>
                        );
                      })}
                    </div>
                  ))
                ) : null}
              </div>

              <div className="patient-schedule__footer">
                <div className="patient-schedule__footer-left">
                  <span className="patient-schedule__slot-label">Slot selected</span>
                  <p className="patient-schedule__slot-value">{formatScheduleSummary()}</p>
                </div>
                {scheduleLockError ? (
                  <p className="patient-schedule__slots-error patient-schedule__lock-error" role="alert">
                    {scheduleLockError}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={`patient-select-overlay__continue${selectedTimeSlot ? ' is-active' : ''}`}
                  disabled={!selectedTimeSlot || scheduleSubmitting}
                  onClick={handleScheduleContinue}
                >
                  {scheduleSubmitting ? 'Please wait…' : 'Continue'}
                </button>
              </div>
            </div>
          </>
        ) : view === 'details' ? (
          <>
            <div className="patient-confirm">
              <div className="patient-confirm__section-head patient-confirm__section-head--first">
                <h4>Member Details</h4>
                <button
                  type="button"
                  className="patient-confirm__edit-btn"
                  aria-label="Edit member details"
                  onClick={() => {
                    setSelectViewReturn('details');
                    setView('select');
                  }}
                >
                  <DetailEditIcon />
                </button>
              </div>

              <div className="patient-confirm__patients">
                {selectedPatients.map((patient) => (
                  <div key={patient.id} className="patient-confirm__patient-card">
                    <div className="patient-confirm__patient-top">
                      <div className="patient-confirm__patient-main">
                        <div className="patient-select-overlay__avatar">
                          {patient.gender === 'male' ? <MaleIcon /> : <FemaleIcon />}
                        </div>
                        <div className="patient-select-overlay__details">
                          <p className="patient-select-overlay__name">{patient.name}</p>
                          <p className="patient-select-overlay__meta">{patient.meta}</p>
                        </div>
                      </div>
                    </div>

                    <div className="patient-confirm__divider" />

                    <div className="patient-confirm__patient-price-row">
                      <div className="patient-confirm__patient-package">
                        <SelectedRowPackageIcon />
                        <span>
                          {customFlow
                            ? (formatCustomGroupNames(getCustomGroupsForPatient(patient.id)) || customPackageDisplayName)
                            : getPackageForPatient(patient.id).name}
                        </span>
                      </div>

                      <div className="patient-confirm__price-group">
                        <span className="patient-confirm__price-old">{formatPrice(customFlow ? getCustomPriceForPatient(patient.id).old : getPackageForPatient(patient.id).oldPrice)}/-</span>
                        <span className="patient-confirm__price-now">{formatPrice(customFlow ? getCustomPriceForPatient(patient.id).current : getPackageForPatient(patient.id).currentPrice)}/-</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="patient-confirm__section-head">
                <h4>Address Details</h4>
                <button
                  type="button"
                  className="patient-confirm__edit-btn"
                  aria-label="Edit address details"
                  onClick={() => {
                    setAddressViewReturn('details');
                    setView('address');
                  }}
                >
                  <DetailEditIcon />
                </button>
              </div>

              <div className="patient-confirm__info-card">
                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon"><DetailLocationIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Address</p>
                    <p className="patient-confirm__info-value">{formatBookingAddressDisplay(addressData)}</p>
                  </div>
                </div>

                <div className="patient-confirm__divider" />

                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon is-city"><DetailCityIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">City</p>
                    <p className="patient-confirm__info-value">{`${addressData.city}, ${addressData.pincode}`}</p>
                  </div>
                </div>
              </div>

              <div className="patient-confirm__section-head">
                <h4>Appointment Details</h4>
                <button
                  type="button"
                  className="patient-confirm__edit-btn"
                  aria-label="Edit appointment details"
                  onClick={() => {
                    setScheduleViewReturn('details');
                    setView('schedule');
                  }}
                >
                  <DetailEditIcon />
                </button>
              </div>

              <div className="patient-confirm__info-card patient-confirm__info-card--appointment">
                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon"><DetailCalendarIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Date</p>
                    <p className="patient-confirm__info-value">{getAppointmentDate()}</p>
                  </div>
                </div>

                <div className="patient-confirm__divider" />

                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon is-city"><DetailClockIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Time Slot</p>
                    <p className="patient-confirm__info-value">{getTimeRange()}</p>
                  </div>
                </div>
              </div>

              {bioBookingError ? (
                <p className="patient-payment__error" role="alert">
                  {bioBookingError}
                </p>
              ) : null}

              <button
                type="button"
                className="patient-confirm__continue"
                onClick={handleDetailsContinueToPayment}
              >
                Continue
              </button>
            </div>
          </>
        ) : view === 'payment' ? (
          <>
            <h3 className="patient-select-overlay__title">Payment Breakdown</h3>

            <div className="patient-payment">
              <div className="patient-payment__box">
                <div className="patient-payment__row">
                  <span className="patient-payment__label">Total MRP</span>
                  <span className="patient-payment__value">{formatBreakdownPrice(paymentBreakdown.totalMrp)}</span>
                </div>

                <div className="patient-payment__row">
                  <span className="patient-payment__label">Platform Discount</span>
                  <span className="patient-payment__value patient-payment__value--discount">- {formatBreakdownPrice(paymentBreakdown.platformDiscount)}</span>
                </div>

                <div className="patient-payment__divider" />

                <div className="patient-payment__row">
                  <span className="patient-payment__label patient-payment__label--subtotal">Subtotal</span>
                  <span className="patient-payment__value patient-payment__value--subtotal">{formatBreakdownPrice(paymentBreakdown.subtotal)}</span>
                </div>
              </div>

              <div className="patient-payment__promo">
                <p className="patient-payment__promo-label">Promo Code</p>
                <div className="patient-payment__promo-box">
                  <input
                    className="patient-payment__promo-input"
                    type="text"
                    value={promoCode}
                    placeholder="Enter promo code here"
                    aria-label="Promo code"
                    autoCapitalize="characters"
                    disabled={promoApplying || Boolean(appliedPromo)}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setPromoError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleApplyPromo();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="patient-payment__promo-apply"
                    onClick={handleApplyPromo}
                    disabled={promoApplying}
                  >
                    {promoApplying ? 'APPLY' : appliedPromo ? 'REMOVE' : 'APPLY'}
                  </button>
                </div>
                {promoError ? (
                  <p className="patient-payment__promo-error" role="alert">{promoError}</p>
                ) : null}
              </div>

              <div className="patient-payment__total-row">
                <span className="patient-payment__total-label">Total Amount</span>
                <div className="patient-payment__total-right">
                  <span className="patient-payment__total-old">{formatBreakdownPrice(paymentBreakdown.totalOld)}/-</span>
                  <span className="patient-payment__total-new">{formatBreakdownPrice(paymentBreakdown.totalNew)}</span>
                </div>
              </div>

              {paymentError ? (
                <p className="patient-payment__error" role="alert">
                  {paymentError}
                </p>
              ) : null}

              <button
                type="button"
                className="patient-payment__continue"
                onClick={handlePayWithRazorpay}
                disabled={paymentSubmitting || promoApplying}
              >
                {paymentSubmitting ? 'Please wait…' : 'Continue'}
              </button>
            </div>
          </>
        ) : resultPhase === 'failure' || (customFlow && resultPhase === 'success') ? (
          <div
            key={resultPhase}
            className={`patient-result${resultPhase === 'failure' ? ' is-failed' : ''}`}
          >
            <div className="patient-result__glow" aria-hidden="true" />
            <div className="patient-result__halo" aria-hidden="true">
              <span className="patient-result__ring patient-result__ring--lg" />
              <span className="patient-result__ring patient-result__ring--md" />
              <span className="patient-result__ring patient-result__ring--sm" />
              <div className="patient-result__orb">
                {resultPhase === 'failure' ? (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path d="M8 8L24 24M24 8L8 24" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="36" height="28" viewBox="0 0 36 28" fill="none" aria-hidden="true">
                    <path d="M33 3L13 23L3 13" stroke="#163E06" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>

            <h3 className="patient-result__title">
              {resultPhase === 'failure' ? 'Payment Failed' : 'Payment Successful!'}
            </h3>
            <p className="patient-result__copy">
              {resultPhase === 'failure'
                ? "Oops! Your payment couldn't go through."
                : 'Your transaction has been processed securely.'}
            </p>

            {resultPhase === 'success' ? (
              <div className="patient-result__card">
                <div className="patient-result__card-head">
                  <span>Transaction Details</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2.5V11" stroke="#9A9A9A" strokeWidth="1.33" strokeLinecap="round" />
                    <path d="M5 8.5L8 11.5L11 8.5" stroke="#9A9A9A" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 13.5H13" stroke="#9A9A9A" strokeWidth="1.33" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="patient-result__card-row">
                  <span>Transaction ID</span>
                  <strong>{confirmedBookingId || '—'}</strong>
                </div>
                <div className="patient-result__card-row">
                  <span>Amount</span>
                  <strong>{`₹${Math.round(Number(paymentBreakdown.totalNew || 0)).toLocaleString('en-IN')}/-`}</strong>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="patient-result__cta"
              onClick={() => {
                if (resultPhase === 'failure') {
                  setResultPhase(null);
                  setView('payment');
                  return;
                }
                setResultPhase(null);
              }}
            >
              {resultPhase === 'failure' ? 'Retry Payment' : 'Continue'}
            </button>
          </div>
        ) : (
          <>
            <div className="patient-final">
              <div className={`patient-final__status-icon${paymentOutcome !== 'success' ? ' is-failed' : ''}`}>
                {paymentOutcome !== 'success' ? <ConfirmCrossIcon /> : <ConfirmTickIcon />}
              </div>

              <p className={`patient-final__status-text${paymentOutcome !== 'success' ? ' is-failed' : ''}`}>
                {getPaymentResultTitle()}
              </p>

              {paymentError ? (
                <p className="patient-payment__error patient-final__error" role="alert">
                  {paymentError}
                </p>
              ) : null}

              <>
              <div className="patient-final__booking-id">
                <span>{paymentOutcome === 'success' ? 'Booking ID' : 'Reference ID'}</span>
                <i>|</i>
                <strong>{confirmedBookingId || '—'}</strong>
              </div>

              <h4 className="patient-final__section-title">Member Details</h4>
              <div className="patient-final__patients-box">
                {selectedPatients.map((patient, index) => (
                  <React.Fragment key={patient.id}>
                    <div className="patient-final__patient-row">
                      <div className="patient-select-overlay__left">
                        <div className="patient-select-overlay__avatar">
                          {patient.gender === 'male' ? <MaleIcon /> : <FemaleIcon />}
                        </div>
                        <div className="patient-select-overlay__details">
                          <p className="patient-select-overlay__name">{patient.name}</p>
                          <p className="patient-select-overlay__meta">{patient.meta}</p>
                        </div>
                      </div>

                      <div className="patient-final__patient-package">
                        <span>Package</span>
                        <p>
                          {customFlow
                            ? (formatCustomGroupNames(getCustomGroupsForPatient(patient.id)) || customPackageDisplayName)
                            : getPackageForPatient(patient.id).name}
                        </p>
                      </div>
                    </div>

                    {index < selectedPatients.length - 1 ? <div className="patient-confirm__divider" /> : null}
                  </React.Fragment>
                ))}
              </div>

              <h4 className="patient-final__section-title">Address Details</h4>
              <div className="patient-confirm__info-card patient-final__info-card">
                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon"><DetailLocationIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Address</p>
                    <p className="patient-confirm__info-value">{formatBookingAddressDisplay(addressData)}</p>
                  </div>
                </div>

                <div className="patient-confirm__divider" />

                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon is-city"><DetailCityIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">City</p>
                    <p className="patient-confirm__info-value">{`${addressData.city}, ${addressData.pincode}`}</p>
                  </div>
                </div>
              </div>

              <h4 className="patient-final__section-title">Appointment Details</h4>
              <div className="patient-confirm__info-card patient-confirm__info-card--appointment patient-final__info-card">
                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon"><DetailCalendarIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Date</p>
                    <p className="patient-confirm__info-value">{getAppointmentDate()}</p>
                  </div>
                </div>

                <div className="patient-confirm__divider" />

                <div className="patient-confirm__info-row">
                  <span className="patient-confirm__info-icon is-city"><DetailClockIcon /></span>
                  <div className="patient-confirm__info-text-wrap">
                    <p className="patient-confirm__info-label">Time Slot</p>
                    <p className="patient-confirm__info-value">{getTimeRange()}</p>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>
          </>
        )}

        <div className="patient-select-overlay__grip" aria-hidden="true" />
      </div>
    </div>
  );
};

export default PatientSelectionOverlay;
