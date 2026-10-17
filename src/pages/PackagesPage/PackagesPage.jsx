import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import './PackagesPage.css';
import NavBar from '../../components/NavBar';
import PackageOnboardingMcqPage from '../PackageOnboardingMcqPage/PackageOnboardingMcqPage';
import ElitePerformancePackageCard, {
  isElitePerformanceFemalePackage,
  isElitePerformanceMalePackage,
} from './ElitePerformancePackageCard';
import PeakPerformancePackageCard, {
  isPeakPerformanceFemalePackage,
  isPeakPerformanceMalePackage,
} from './PeakPerformancePackageCard';
import CSuitePackageCard, { isCSuitePackage } from './CSuitePackageCard';
import SupershyftCorePackageCard, { isSupershyftCoreFamilyPackage } from './SupershyftCorePackageCard';
import MenstrualHealthPackageCard, { isMenstrualHealthPackage } from './MenstrualHealthPackageCard';
import OncoCarePackageCard, { isOncoCarePackage } from './OncoCarePackageCard';
import HairHealthPackageCard, { isHairHealthPackage } from './HairHealthPackageCard';
import GenZPackageCard, { isGenZPackage } from './GenZPackageCard';
import FatiguePackageCard, { isFatiguePackage } from './FatiguePackageCard';
import SleepPackageCard, { isSleepPackage } from './SleepPackageCard';
import ExecutivePackageCard, { isExecutivePackage } from './ExecutivePackageCard';
import BioAllergyPlusPackageCard, { isBioAllergyPlusPackage } from './BioAllergyPlusPackageCard';
import {
  getCachedDiagnosticPackagesList,
  getCachedDiagnosticPackageFilterChips,
  listDiagnosticPackagesCached,
  listPublicDiagnosticPackageFilterChipsCached,
} from '../../services/diagnosticPackagesService';
import { getMyProfileCached } from '../../services/profileService';
import { getComplimentaryConsultationContent } from '../../utils/complimentaryConsultation';
import { ComplimentaryConsultationPromoIcon } from './PackageFaceCard';
import {
  buildConcernsFromMcq,
  computePackageRecommendations,
  computeProfileOnlyPackageRecommendations,
} from '../../utils/packageRecommendationEngine';
import {
  hasPersonalizedForYouRecommendations,
  isPackageOnboardingEligible,
  loadPackageOnboardingResult,
  savePackageOnboardingResult,
  setPackageOnboardingEligible,
} from '../../utils/packageRecommendationStorage';
import { mapDiagnosticPackageToCard } from '../../utils/diagnosticPackageCardMapper';
import {
  PackageFaceCardMetrics,
  PackageFaceCardPricing,
} from './PackageFaceCard';

// PatientSelectionOverlay is a large (~14 KiB) booking sheet that only renders when the user
// taps "Book"; keep it out of the initial Packages bundle via React.lazy + Suspense.
const PatientSelectionOverlay = lazy(() => import('../../components/PatientSelectionOverlay'));

const ALL_FILTER = {
  filter_chip_id: 'all',
  chip_key: 'all',
  display_name: 'All',
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

const unwrapProfileResponse = (response) => (
  response?.data && typeof response.data === 'object' ? response.data : response
);

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

const normalizeProfileGender = (profile) => {
  const gender = String(profile?.gender || '').trim().toLowerCase();
  if (gender === 'male' || gender === 'm' || gender === 'man') {
    return 'male';
  }
  if (gender === 'female' || gender === 'f' || gender === 'woman') {
    return 'female';
  }
  return null;
};

const buildPackageSearchHaystack = (pkg) => {
  const parts = [
    String(pkg?.title || ''),
    String(pkg?.apiData?.package_name || ''),
    ...(Array.isArray(pkg?.badges) ? pkg.badges : []),
    ...(Array.isArray(pkg?.chips) ? pkg.chips : []),
    ...getPackageFilterChips(pkg?.apiData || {}),
  ];

  const rawTags = Array.isArray(pkg?.apiData?.tags) ? pkg.apiData.tags : [];
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

const getPackageAgeBandIds = (pkg) => {
  const haystack = buildPackageSearchHaystack(pkg);

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

const packageMatchesForYouGender = (pkg, userGender) => {
  if (!userGender) {
    return true;
  }

  const suitability = String(pkg?.apiData?.gender_suitability || '').trim().toLowerCase();
  if (!suitability || suitability === 'both') {
    return true;
  }

  return suitability === userGender;
};

const packageMatchesForYouAge = (pkg, userAge) => {
  const userBand = getAgeBandForAge(userAge);
  if (!userBand) {
    return true;
  }

  const packageBands = getPackageAgeBandIds(pkg);
  if (packageBands.length === 0) {
    return true;
  }

  return packageBands.includes(userBand.id);
};

const isForYouChipKey = (chipKey) => FOR_YOU_CHIP_KEYS.has(String(chipKey || '').trim().toLowerCase());

const packageMatchesForYou = (pkg, forYouContext) => (
  packageMatchesForYouGender(pkg, forYouContext?.gender)
  && packageMatchesForYouAge(pkg, forYouContext?.age)
);

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
    rawFilterChip
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(pushValue);
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

  const unique = Array.from(new Map(values.map((value) => [value.toLowerCase(), value])).values());
  return unique;
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

  const uniqueByKey = Array.from(
    new Map(normalized.map((chip) => [String(chip.chip_key).toLowerCase(), chip])).values()
  );

  return [ALL_FILTER, ...uniqueByKey.filter((chip) => String(chip.chip_key).toLowerCase() !== 'all')];
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

  if (pkg?.apiData?.is_most_popular) {
    values.add('popular');
    values.add('most popular');
  }

  return values;
};

const OpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.83203 5.8335H14.1654V14.1668M5.83203 14.1668L14.1654 5.8335" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = ({ stroke = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 21L16.65 16.65" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CustomPackageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3.333V12.667M3.333 8H12.667" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const normalizeBadgeToken = (value) => String(value || '').trim().toLowerCase();

const getInitialPackageCardsFromCache = () => {
  const cached = getCachedDiagnosticPackagesList();
  if (!cached) {
    return [];
  }

  return (Array.isArray(cached) ? cached : []).map(mapDiagnosticPackageToCard);
};

const getInitialFilterChipsFromCache = () => {
  const cached = getCachedDiagnosticPackageFilterChips();
  if (!cached) {
    return [ALL_FILTER];
  }

  const normalized = normalizeFilterChipRows(cached);
  return normalized.length > 0 ? normalized : [ALL_FILTER];
};

const PackagesPage = ({
  accountScopeId = null,
  onNavigateHome,
  onOpenPackageDetails,
  onOpenCreateCustomPackage,
  onNavigateToDoctors,
  onNavigateToSuperClub,
  customPackageCard,
}) => {
  const [activeFilterKey, setActiveFilterKey] = useState('all');
  const [filterChips, setFilterChips] = useState(getInitialFilterChipsFromCache);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPatientOverlayOpen, setIsPatientOverlayOpen] = useState(false);
  const [packageCardsFromApi, setPackageCardsFromApi] = useState(getInitialPackageCardsFromCache);
  const [bookingPackage, setBookingPackage] = useState(null);
  const [forYouProfile, setForYouProfile] = useState(null);
  const [showPackageOnboarding, setShowPackageOnboarding] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState(null);
  const contentScrollRef = useRef(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (showPackageOnboarding) {
      setActiveFilterKey('all');
    }
  }, [showPackageOnboarding]);

  useEffect(() => {
    let mounted = true;

    const loadPageData = async () => {
      const [packagesResult, chipsResult, profileResult] = await Promise.allSettled([
        listDiagnosticPackagesCached(),
        listPublicDiagnosticPackageFilterChipsCached(),
        getMyProfileCached(),
      ]);

      if (!mounted) {
        return;
      }

      if (packagesResult.status === 'fulfilled') {
        const rows = packagesResult.value;
        const mappedRows = (Array.isArray(rows) ? rows : []).map(mapDiagnosticPackageToCard);
        setPackageCardsFromApi(mappedRows);
      } else {
        setPackageCardsFromApi((current) => (current.length > 0 ? current : []));
      }

      if (chipsResult.status === 'fulfilled') {
        const normalized = normalizeFilterChipRows(chipsResult.value);
        setFilterChips(normalized.length > 0 ? normalized : [ALL_FILTER]);
      } else {
        setFilterChips((current) => (current.length > 1 ? current : [ALL_FILTER]));
      }

      if (profileResult.status === 'fulfilled') {
        const profile = unwrapProfileResponse(profileResult.value);
        setForYouProfile({
          gender: normalizeProfileGender(profile),
          age: getAgeFromProfile(profile),
        });
      } else {
        setForYouProfile({ gender: null, age: null });
      }
    };

    loadPageData();

    return () => {
      mounted = false;
    };
  }, [accountScopeId]);

  useEffect(() => {
    if (!accountScopeId) {
      setOnboardingResult(null);
      setShowPackageOnboarding(false);
      return;
    }

    const saved = loadPackageOnboardingResult(accountScopeId);
    setOnboardingResult(saved);

    const isNewUser = isPackageOnboardingEligible(accountScopeId);
    const forYouIsGeneric = !hasPersonalizedForYouRecommendations(saved);
    setShowPackageOnboarding(isNewUser && forYouIsGeneric);
  }, [accountScopeId]);

  const resolveForYouChipKey = useCallback(() => {
    const chip = (Array.isArray(filterChips) ? filterChips : [])
      .find((item) => isForYouChipKey(item?.chip_key));
    return String(chip?.chip_key || 'for_you').trim().toLowerCase();
  }, [filterChips]);

  const handlePackageOnboardingComplete = useCallback(({ persona, primaryConcern, otherConcerns }) => {
    if (!accountScopeId) {
      return;
    }

    const concerns = buildConcernsFromMcq(primaryConcern, otherConcerns);
    const ranked = computePackageRecommendations({
      age: forYouProfile?.age ?? 28,
      gender: forYouProfile?.gender,
      persona,
      concerns,
      packageCards: packageCardsFromApi,
    });

    const payload = {
      skipped: false,
      source: 'questionnaire',
      persona,
      primaryConcern,
      otherConcerns,
      concerns,
      rankedPackages: ranked.map((row, index) => ({
        packageId: Number(row.package.id),
        score: row.score,
        label: row.label || null,
        rank: index + 1,
      })),
    };

    savePackageOnboardingResult(accountScopeId, payload);
    setPackageOnboardingEligible(accountScopeId, false);
    const saved = loadPackageOnboardingResult(accountScopeId);
    setOnboardingResult(saved);
    setShowPackageOnboarding(false);
    setActiveFilterKey(resolveForYouChipKey());
  }, [
    accountScopeId,
    forYouProfile?.age,
    forYouProfile?.gender,
    packageCardsFromApi,
    resolveForYouChipKey,
  ]);

  const handlePackageOnboardingSkip = useCallback(() => {
    if (!accountScopeId) {
      return;
    }

    const ranked = computeProfileOnlyPackageRecommendations({
      age: forYouProfile?.age ?? 28,
      gender: forYouProfile?.gender,
      packageCards: packageCardsFromApi,
    });

    const payload = {
      skipped: true,
      source: 'profile_only',
      persona: '',
      primaryConcern: '',
      otherConcerns: [],
      concerns: [],
      rankedPackages: ranked.map((row, index) => ({
        packageId: Number(row.package.id),
        score: row.score,
        label: row.label || null,
        rank: index + 1,
      })),
    };

    savePackageOnboardingResult(accountScopeId, payload);
    setPackageOnboardingEligible(accountScopeId, false);
    const saved = loadPackageOnboardingResult(accountScopeId);
    setOnboardingResult(saved);
    setShowPackageOnboarding(false);
    setActiveFilterKey(resolveForYouChipKey());
  }, [
    accountScopeId,
    forYouProfile?.age,
    forYouProfile?.gender,
    packageCardsFromApi,
    resolveForYouChipKey,
  ]);

  const sourceCards = useMemo(() => {
    return packageCardsFromApi;
  }, [packageCardsFromApi]);

  const isOnboardingOverlayOpen = showPackageOnboarding
    && Boolean(accountScopeId)
    && !isPatientOverlayOpen;

  useEffect(() => {
    const shouldLockScroll = isPatientOverlayOpen || isOnboardingOverlayOpen;
    if (!shouldLockScroll) {
      return undefined;
    }

    const { body, documentElement } = document;
    const appScroll = document.querySelector('.app-scroll');
    const contentEl = contentScrollRef.current;
    const previous = {
      htmlOverflow: documentElement.style.overflow,
      htmlOverscroll: documentElement.style.overscrollBehavior,
      htmlTouchAction: documentElement.style.touchAction,
      bodyOverflow: body.style.overflow,
      bodyTouchAction: body.style.touchAction,
      bodyOverscroll: body.style.overscrollBehavior,
      appScrollOverflow: appScroll?.style.overflow ?? '',
      appScrollTouchAction: appScroll?.style.touchAction ?? '',
      appScrollOverscroll: appScroll?.style.overscrollBehavior ?? '',
      contentOverflow: contentEl?.style.overflow ?? '',
      contentTouchAction: contentEl?.style.touchAction ?? '',
      contentOverscroll: contentEl?.style.overscrollBehavior ?? '',
    };
    const appScrollTop = appScroll?.scrollTop ?? 0;
    const contentScrollTop = contentEl?.scrollTop ?? 0;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    documentElement.style.touchAction = 'none';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    body.style.overscrollBehavior = 'none';

    if (appScroll) {
      appScroll.style.overflow = 'hidden';
      appScroll.style.touchAction = 'none';
      appScroll.style.overscrollBehavior = 'none';
    }

    if (contentEl) {
      contentEl.style.overflow = 'hidden';
      contentEl.style.touchAction = 'none';
      contentEl.style.overscrollBehavior = 'none';
    }

    return () => {
      documentElement.style.overflow = previous.htmlOverflow;
      documentElement.style.overscrollBehavior = previous.htmlOverscroll;
      documentElement.style.touchAction = previous.htmlTouchAction;
      body.style.overflow = previous.bodyOverflow;
      body.style.touchAction = previous.bodyTouchAction;
      body.style.overscrollBehavior = previous.bodyOverscroll;

      if (appScroll) {
        appScroll.style.overflow = previous.appScrollOverflow;
        appScroll.style.touchAction = previous.appScrollTouchAction;
        appScroll.style.overscrollBehavior = previous.appScrollOverscroll;
        appScroll.scrollTop = appScrollTop;
      }

      if (contentEl) {
        contentEl.style.overflow = previous.contentOverflow;
        contentEl.style.touchAction = previous.contentTouchAction;
        contentEl.style.overscrollBehavior = previous.contentOverscroll;
        contentEl.scrollTop = contentScrollTop;
      }
    };
  }, [isPatientOverlayOpen, isOnboardingOverlayOpen]);

  const visibleCards = useMemo(() => {
    const filterKeyForView = isOnboardingOverlayOpen ? 'all' : activeFilterKey;
    const selectedChip = filterChips.find((chip) => String(chip?.chip_key || '').toLowerCase() === filterKeyForView);
    const selectedKey = String(selectedChip?.chip_key || filterKeyForView || 'all').trim().toLowerCase();
    const selectedLabel = String(selectedChip?.display_name || '').trim().toLowerCase();

    const applySearchFilter = (cards) => cards.filter((pkg) => {
      if (!normalizedQuery) {
        return true;
      }

      const titleText = String(pkg?.title || '').toLowerCase();
      const badgesText = Array.isArray(pkg?.badges) ? pkg.badges.join(' ').toLowerCase() : '';
      const chipsText = Array.isArray(pkg?.chips) ? pkg.chips.join(' ').toLowerCase() : '';
      const tagsText = Array.isArray(pkg?.apiData?.tags)
        ? pkg.apiData.tags
          .map((tag) => {
            if (typeof tag === 'string' || typeof tag === 'number') {
              return String(tag);
            }
            if (tag && typeof tag === 'object') {
              return String(tag.tag_name || tag.name || tag.filter_chip || tag.chip_key || tag.display_name || '');
            }
            return '';
          })
          .join(' ')
          .toLowerCase()
        : '';

      return titleText.includes(normalizedQuery)
        || badgesText.includes(normalizedQuery)
        || chipsText.includes(normalizedQuery)
        || tagsText.includes(normalizedQuery);
    });

    const appendCustomCard = (cards) => {
      if (!customPackageCard) {
        return cards;
      }

      const shouldIncludeCustomCard = !normalizedQuery
        || String(customPackageCard?.title || '').toLowerCase().includes(normalizedQuery)
        || String(customPackageCard?.chips || '').toLowerCase().includes(normalizedQuery);

      return shouldIncludeCustomCard
        ? [...cards, { ...customPackageCard }]
        : cards;
    };

    if (isForYouChipKey(selectedKey) && hasPersonalizedForYouRecommendations(onboardingResult)) {
      const rankById = new Map(
        onboardingResult.rankedPackages.map((row, index) => [Number(row.packageId), { ...row, order: index }])
      );

      const recommendedCards = sourceCards
        .filter((pkg) => rankById.has(Number(pkg.id)))
        .map((pkg) => {
          const meta = rankById.get(Number(pkg.id));
          const recommendationLabel = meta?.label || null;
          const badges = Array.isArray(pkg.badges) ? [...pkg.badges] : [];

          if (recommendationLabel && !badges.includes(recommendationLabel)) {
            badges.unshift(recommendationLabel);
          }

          return {
            ...pkg,
            badges,
            recommendationLabel,
          };
        })
        .sort((a, b) => rankById.get(Number(a.id)).order - rankById.get(Number(b.id)).order);

      return appendCustomCard(applySearchFilter(recommendedCards));
    }

    const filteredCards = sourceCards.filter((pkg) => {
      if (selectedKey === 'all') {
        return true;
      }

      if (isForYouChipKey(selectedKey)) {
        return packageMatchesForYou(pkg, forYouProfile);
      }

      const packageValues = toNormalizedPackageTagValues(pkg);
      return packageValues.has(selectedKey) || (selectedLabel ? packageValues.has(selectedLabel) : false);
    });

    return appendCustomCard(applySearchFilter(filteredCards));
  }, [
    activeFilterKey,
    customPackageCard,
    filterChips,
    forYouProfile,
    isOnboardingOverlayOpen,
    normalizedQuery,
    onboardingResult,
    sourceCards,
  ]);

  useEffect(() => {
    const availableKeys = new Set(
      (Array.isArray(filterChips) ? filterChips : [])
        .map((chip) => String(chip?.chip_key || '').trim().toLowerCase())
        .filter(Boolean)
    );

    if (!availableKeys.has(activeFilterKey)) {
      setActiveFilterKey('all');
    }
  }, [activeFilterKey, filterChips]);

  const handleNav = (itemId) => {
    if (itemId === 'home' && onNavigateHome) {
      onNavigateHome();
      return;
    }

    if (itemId === 'super-sync' && onNavigateToDoctors) {
      onNavigateToDoctors();
      return;
    }

    if (itemId === 'super-club' && onNavigateToSuperClub) {
      onNavigateToSuperClub();
    }
  };

  const selectedFilterChip = filterChips.find(
    (chip) => String(chip?.chip_key || '').trim().toLowerCase() === activeFilterKey
  ) || null;
  const selectedFilterKey = normalizeBadgeToken(selectedFilterChip?.chip_key || activeFilterKey);
  const selectedFilterLabel = normalizeBadgeToken(selectedFilterChip?.display_name);
  const shouldHighlightFilterBadge = selectedFilterKey !== 'all';

  const getBadgeClass = (badge) => {
    if (badge === 'Custom Built') {
      return 'packages-card__badge--custom';
    }

    if (badge === 'Best Match' || badge === 'Premium Upgrade' || badge === 'Budget Alternative') {
      return 'packages-card__badge--popular';
    }

    if (!shouldHighlightFilterBadge) {
      return 'packages-card__badge--type';
    }

    const badgeToken = normalizeBadgeToken(badge);
    const isSelectedFilterBadge = badgeToken
      && (badgeToken === selectedFilterKey || (selectedFilterLabel && badgeToken === selectedFilterLabel));

    return isSelectedFilterBadge ? 'packages-card__badge--popular' : 'packages-card__badge--type';
  };

  return (
    <div className={`packages-page ${isSearchOpen ? 'packages-page--search-open' : ''}${isOnboardingOverlayOpen ? ' packages-page--onboarding' : ''}`}>
      <div className={`packages-page__underlay${isOnboardingOverlayOpen ? ' packages-page__underlay--blurred' : ''}`}>
      <div className="packages-page__fixed-top">
        <header className="packages-page__header">
          <h1 className="packages-page__title">Explore Packages</h1>
          <div className="packages-page__header-actions">
            <button
              type="button"
              className="packages-page__icon-btn"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </div>
        </header>

        <div className={`packages-page__search-row packages-page__search-row--animated ${isSearchOpen ? 'is-open' : ''}`} aria-hidden={!isSearchOpen}>
          <SearchIcon stroke="rgba(255, 255, 255, 0.72)" />
          <input
            type="text"
            className="packages-page__search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search packages"
          />
        </div>

        <section className="packages-page__custom-row" aria-label="Create custom package">
          <button
            type="button"
            className="packages-page__custom-btn"
            aria-label="Create custom package"
            data-tour="packages-custom"
            onClick={() => {
              if (onOpenCreateCustomPackage) {
                onOpenCreateCustomPackage();
              }
            }}
          >
            <span>Create Custom Package</span>
            <CustomPackageIcon />
          </button>
        </section>

        <section className="packages-page__filters" aria-label="Package filters">
          {filterChips.map((filter) => {
            const filterKey = String(filter?.chip_key || 'all').trim().toLowerCase();
            const label = String(filter?.display_name || filter?.chip_key || 'All').trim() || 'All';

            const isFilterActive = isOnboardingOverlayOpen
              ? filterKey === 'all'
              : activeFilterKey === filterKey;

            return (
            <button
              key={String(filter?.filter_chip_id || filterKey)}
              type="button"
              className={`packages-page__filter-pill${isFilterActive ? ' is-active' : ''}`}
              onClick={() => setActiveFilterKey(filterKey)}
            >
              {label}
            </button>
            );
          })}
        </section>
      </div>

      <div className="packages-page__content" ref={contentScrollRef}>
        <section className="packages-page__cards" aria-label="Packages list">
          {visibleCards.map((pkg) => {
            if (isElitePerformanceFemalePackage(pkg) || isElitePerformanceMalePackage(pkg)) {
              return (
                <ElitePerformancePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isPeakPerformanceFemalePackage(pkg) || isPeakPerformanceMalePackage(pkg)) {
              return (
                <PeakPerformancePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isCSuitePackage(pkg)) {
              return (
                <CSuitePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isSupershyftCoreFamilyPackage(pkg)) {
              return (
                <SupershyftCorePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isMenstrualHealthPackage(pkg)) {
              return (
                <MenstrualHealthPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isOncoCarePackage(pkg)) {
              return (
                <OncoCarePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isHairHealthPackage(pkg)) {
              return (
                <HairHealthPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isGenZPackage(pkg)) {
              return (
                <GenZPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isFatiguePackage(pkg)) {
              return (
                <FatiguePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isSleepPackage(pkg)) {
              return (
                <SleepPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isExecutivePackage(pkg)) {
              return (
                <ExecutivePackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            if (isBioAllergyPlusPackage(pkg)) {
              return (
                <BioAllergyPlusPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onOpenDetails={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
                  onBook={() => {
                    setBookingPackage(pkg);
                    setIsPatientOverlayOpen(true);
                  }}
                />
              );
            }

            return (
            <article
              key={pkg.id}
              className={`packages-card packages-card--${pkg.theme}`}
              onClick={() => onOpenPackageDetails && onOpenPackageDetails(pkg)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (onOpenPackageDetails) {
                    onOpenPackageDetails(pkg);
                  }
                }
              }}
            >
              <div className="packages-card__badges">
                {(pkg.badges || []).map((badge, index) => {
                  const badgeClass = getBadgeClass(badge);
                  return (
                    <span key={`${pkg.id}-${badge}-${index}`} className={`packages-card__badge ${badgeClass}`}>
                      {badge}
                    </span>
                  );
                })}
              </div>

              <div className="packages-card__title-row">
                <h2 className="packages-card__title">{pkg.title}</h2>
                <button
                  type="button"
                  className="packages-card__open-btn"
                  aria-label="Open package details"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onOpenPackageDetails) {
                      onOpenPackageDetails(pkg);
                    }
                  }}
                >
                  <OpenIcon />
                </button>
              </div>

              {(pkg.chips || []).length > 0 ? (
                <div className="packages-card__feature-chips">
                  {(pkg.chips || []).map((chip, chipIndex) => (
                    <span key={`${pkg.id}-chip-${chipIndex}`} className="packages-card__feature-chip">{chip}</span>
                  ))}
                </div>
              ) : null}

              <PackageFaceCardMetrics metrics={pkg.metrics} classPrefix="packages-card" />

              <div className="packages-card__book-row">
                {(() => {
                  const consultation = getComplimentaryConsultationContent(pkg?.apiData || pkg);
                  if (!consultation) {
                    return null;
                  }

                  return (
                    <div className="packages-card__book-perks">
                      <span className="packages-card__book-perk-pill">
                        <ComplimentaryConsultationPromoIcon />
                        <span>{consultation.topPillLabel}</span>
                      </span>
                    </div>
                  );
                })()}
                <div className="packages-card__book-main">
                  <PackageFaceCardPricing pricing={pkg.pricing} classPrefix="packages-card" />
                  <button
                    type="button"
                    className="packages-card__book-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setBookingPackage(pkg);
                      setIsPatientOverlayOpen(true);
                    }}
                  >
                    BOOK
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </section>
      </div>

      {!isPatientOverlayOpen ? <NavBar defaultActive="packages" onNavigate={handleNav} /> : null}
      </div>

      {isPatientOverlayOpen ? (
        <Suspense fallback={null}>
          <PatientSelectionOverlay
            open={isPatientOverlayOpen}
            onClose={() => {
              setIsPatientOverlayOpen(false);
              setBookingPackage(null);
            }}
            initialPackage={bookingPackage}
          />
        </Suspense>
      ) : null}

      {isOnboardingOverlayOpen ? (
        <PackageOnboardingMcqPage
          isOverlay
          onBack={onNavigateHome}
          onSkip={handlePackageOnboardingSkip}
          onComplete={handlePackageOnboardingComplete}
          profileGender={forYouProfile?.gender}
        />
      ) : null}
    </div>
  );
};

export default PackagesPage;