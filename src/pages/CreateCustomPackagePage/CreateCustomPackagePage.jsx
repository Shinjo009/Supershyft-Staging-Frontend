import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import './CreateCustomPackagePage.css';
import {
  listDiagnosticPackageFilterChips,
  listDiagnosticTestGroupTests,
  listDiagnosticTestGroups,
} from '../../services/diagnosticPackagesService';
import { getAccessToken } from '../../utils/authStorage';
import kidneyArt from '../../images/Custom Packages/Kidney_custom.svg';
import liverArt from '../../images/Custom Packages/LiverFunction.svg';
import cbcArt from '../../images/Custom Packages/CBC_custom.svg';
import thyroidArt from '../../images/Custom Packages/Thyroid_custom.svg';
import allergyArt from '../../images/Custom Packages/AllergyScreening_custom.svg';
import vitaminsArt from '../../images/Custom Packages/Vitamins_custom.svg';
import cancerArt from '../../images/Custom Packages/CancerScreening_custom.svg';
import lhArt from '../../images/Custom Packages/lh_custom.svg';
import fshArt from '../../images/Custom Packages/fsh_custom.svg';
import prolactinArt from '../../images/Custom Packages/Prolactin_custom.svg';
import testosteroneArt from '../../images/Custom Packages/testosterone_custom.svg';
import cortisolArt from '../../images/Custom Packages/Cortisol_custom.svg';
import insulinArt from '../../images/Custom Packages/Insulin_custom.svg';
import afpArt from '../../images/Custom Packages/AFP_custom.svg';
import prostateArt from '../../images/Custom Packages/prostate_custom.svg';
import colorectalArt from '../../images/Custom Packages/Colorectal_custom.svg';
import breastArt from '../../images/Custom Packages/Breast_custom.svg';
import ovariesArt from '../../images/Custom Packages/Ovaries_custom.svg';
import pancreasArt from '../../images/Custom Packages/Pancreas_custom.svg';
import lungsArt from '../../images/Custom Packages/Lungs_custom.svg';
import stomachArt from '../../images/Custom Packages/stomach_custom.svg';
import lipidArt from '../../images/Custom Packages/Lipid_custom.svg';
import ironArt from '../../images/Custom Packages/Iron_custom.svg';
import diabetesArt from '../../images/Custom Packages/Diabetes_custom.svg';
import hormonesArt from '../../images/Custom Packages/Hormones_custom.svg';
import leafArt from '../../images/Custom Packages/Object_custom_card.png';

const normalizeProfileArtKey = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const matchesProfileArtKeyword = (haystack, keyword) => {
  const needle = normalizeProfileArtKey(keyword);
  if (!haystack || !needle) {
    return false;
  }

  if (needle.includes(' ') || needle.length > 3) {
    return haystack.includes(needle);
  }

  return new RegExp(`(?:^| )${needle}(?: |$)`).test(haystack);
};

// Specific tests/organs first so they do not fall through to a generic profile image.
const PROFILE_ART_KEYWORDS = [
  ['luteinizing', lhArt],
  ['lh', lhArt],
  ['follicle stimulating', fshArt],
  ['fsh', fshArt],
  ['prolactin', prolactinArt],
  ['testosterone', testosteroneArt],
  ['cortisol', cortisolArt],
  ['insulin', insulinArt],
  ['alpha fetoprotein', afpArt],
  ['afp', afpArt],
  ['prostate', prostateArt],
  ['psa', prostateArt],
  ['colorectal', colorectalArt],
  ['colon', colorectalArt],
  ['cea', colorectalArt],
  ['breast', breastArt],
  ['ca 15', breastArt],
  ['ca15', breastArt],
  ['ovaries', ovariesArt],
  ['ovarian', ovariesArt],
  ['ca 125', ovariesArt],
  ['ca125', ovariesArt],
  ['amh', ovariesArt],
  ['pancreas', pancreasArt],
  ['pancreatic', pancreasArt],
  ['ca 19', pancreasArt],
  ['ca19', pancreasArt],
  ['lung', lungsArt],
  ['pulmonary', lungsArt],
  ['stomach', stomachArt],
  ['gastric', stomachArt],
  ['pylori', stomachArt],
  ['lipid', lipidArt],
  ['cholesterol', lipidArt],
  ['triglyceride', lipidArt],
  ['iron', ironArt],
  ['ferritin', ironArt],
  ['tibc', ironArt],
  ['transferrin', ironArt],
  ['diabetes', diabetesArt],
  ['glucose', diabetesArt],
  ['hba1c', diabetesArt],
  ['blood sugar', diabetesArt],
  ['prandial', diabetesArt],
  ['hormone', hormonesArt],
  ['liver', liverArt],
  ['cbc', cbcArt],
  ['haem', cbcArt],
  ['hemogram', cbcArt],
  ['hematology', cbcArt],
  ['haematology', cbcArt],
  ['thyroid', thyroidArt],
  ['allerg', allergyArt],
  ['vitamin', vitaminsArt],
  ['cancer', cancerArt],
  ['tumor', cancerArt],
  ['kidney', kidneyArt],
  ['renal', kidneyArt],
];

const getProfileArt = (name, groupKey, tags = []) => {
  const tagText = Array.isArray(tags) ? tags.join(' ') : '';
  const key = normalizeProfileArtKey(`${String(name || '')} ${String(groupKey || '')} ${tagText}`);
  if (!key) {
    return kidneyArt;
  }
  for (const [keyword, art] of PROFILE_ART_KEYWORDS) {
    if (matchesProfileArtKeyword(key, keyword)) {
      return art;
    }
  }
  return kidneyArt;
};

const ALL_CHIP = {
  filter_chip_id: 'all',
  chip_key: 'all',
  display_name: 'All',
  display_order: -1,
  chip_for: 'custom_package',
  status: 'active',
};

const toNumericPrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric);
};

const normalizeTagList = (rawTags) => {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag) => {
      if (typeof tag === 'string' || typeof tag === 'number') {
        return String(tag).trim();
      }
      if (tag && typeof tag === 'object') {
        return String(tag?.tag_name || tag?.name || tag?.filter_chip || '').trim();
      }
      return '';
    })
    .filter(Boolean);
};

const normalizeTests = (rawTests) => {
  if (!Array.isArray(rawTests)) {
    return [];
  }

  return rawTests
    .map((test) => {
      if (typeof test === 'string' || typeof test === 'number') {
        return String(test).trim();
      }
      if (test && typeof test === 'object') {
        return String(
          test?.test_name
          || test?.name
          || test?.parameter_name
          || test?.title
          || ''
        ).trim();
      }
      return '';
    })
    .filter(Boolean);
};

const normalizeGroupRow = (row, index) => {
  const title = String(
    row?.test_group_name
    || row?.group_name
    || row?.name
    || row?.title
    || `Test Group ${index + 1}`
  ).trim();

  const groupKey = String(row?.group_key || row?.key || '').trim();
  const groupId = Number(row?.diagnostic_test_group_id ?? row?.test_group_id ?? row?.group_id ?? row?.id);
  const safeGroupId = Number.isFinite(groupId) && groupId > 0 ? groupId : null;
  const idValue = (safeGroupId ?? title) || index;
  const id = `test-group-${String(idValue).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || index}`;

  const salePrice = toNumericPrice(
    row?.sale_price
    ?? row?.discounted_price
    ?? row?.offer_price
    ?? row?.price
    ?? 0
  );
  const oldPriceCandidate = toNumericPrice(
    row?.old_price
    ?? row?.original_price
    ?? row?.mrp
    ?? row?.list_price
    ?? salePrice
  );

  const oldPrice = oldPriceCandidate >= salePrice ? oldPriceCandidate : salePrice;
  const tags = normalizeTagList(row?.tags ?? row?.filter_chips ?? row?.chips ?? []);

  const tests = normalizeTests(
    row?.tests
    ?? row?.diagnostic_tests
    ?? row?.parameters
    ?? row?.test_items
    ?? []
  );

  const rawCount = Number(
    row?.test_count
    ?? row?.tests_count
    ?? row?.parameter_count
    ?? row?.parameters_count
    ?? row?.num_tests
  );
  const parameterCount = Number.isFinite(rawCount) && rawCount > 0
    ? Math.round(rawCount)
    : tests.length;

  const discountLabel = String(row?.discount || '').trim();
  const discountPercent = oldPrice > 0
    ? Math.max(0, Math.round(((oldPrice - salePrice) / oldPrice) * 100))
    : 0;

  return {
    id,
    groupId: safeGroupId,
    groupKey,
    title,
    salePrice,
    oldPrice,
    discountLabel,
    discountPercent,
    tags,
    tests,
    parameterCount,
    testsLoaded: tests.length > 0,
  };
};

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchIcon = ({ stroke = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 21L16.65 16.65" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M17 18C17.5304 18 18.0391 18.2107 18.4142 18.5858C18.7893 18.9609 19 19.4696 19 20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22C16.4696 22 15.9609 21.7893 15.5858 21.4142C15.2107 21.0391 15 20.5304 15 20C15 18.89 15.89 18 17 18ZM1 2H4.27L5.21 4H20C20.2652 4 20.5196 4.10536 20.7071 4.29289C20.8946 4.48043 21 4.73478 21 5C21 5.17 20.95 5.34 20.88 5.5L17.3 11.97C16.96 12.58 16.3 13 15.55 13H8.1L7.2 14.63L7.17 14.75C7.17 14.8163 7.19634 14.8799 7.24322 14.9268C7.29011 14.9737 7.3537 15 7.42 15H19V17H7C6.46957 17 5.96086 16.7893 5.58579 16.4142C5.21071 16.0391 5 15.5304 5 15C5 14.65 5.09 14.32 5.24 14.04L6.6 11.59L3 4H1V2ZM7 18C7.53043 18 8.03914 18.2107 8.41421 18.5858C8.78929 18.9609 9 19.4696 9 20C9 20.5304 8.78929 21.0391 8.41421 21.4142C8.03914 21.7893 7.53043 22 7 22C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20C5 18.89 5.89 18 7 18Z" fill="white" />
  </svg>
);

const ChevronDownIcon = ({ color = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 7.5L10 12.5L15 7.5" stroke={color} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronUpIcon = ({ color = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M15 12.5L10 7.5L5 12.5" stroke={color} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M8.33268 2.5L3.74935 7.08333L1.66602 5" stroke="#90DF9E" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
    <circle cx="4" cy="4" r="4" fill="#90DF9E" />
  </svg>
);

const CloseCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="#8C9B99" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PatientSelectionOverlay = lazy(() => import('../../components/PatientSelectionOverlay'));

const formatMoney = (value) => `₹${value}/-`;

const getDiscountText = (category) => {
  if (category?.discountLabel) {
    const label = category.discountLabel.endsWith('%')
      ? `${category.discountLabel} off`
      : category.discountLabel;
    return label;
  }
  if (category?.discountPercent > 0) {
    return `${category.discountPercent}% off`;
  }
  return '';
};

const normalizeFilterChips = (rows) => {
  const source = Array.isArray(rows) ? rows : [];

  const normalized = source
    .map((row, index) => {
      const chipKey = String(row?.chip_key || row?.key || '').trim();
      const displayName = String(row?.display_name || row?.name || chipKey).trim();

      if (!chipKey || !displayName) {
        return null;
      }

      const orderRaw = Number(row?.display_order);

      return {
        filter_chip_id: row?.filter_chip_id ?? row?.id ?? `${chipKey}-${index}`,
        chip_key: chipKey,
        display_name: displayName,
        display_order: Number.isFinite(orderRaw) ? orderRaw : null,
        chip_for: row?.chip_for || 'custom_package',
        status: row?.status || 'active',
      };
    })
    .filter(Boolean);

  return [ALL_CHIP, ...normalized];
};

const CreateCustomPackagePage = ({ onBack }) => {
  const [isPatientOverlayOpen, setIsPatientOverlayOpen] = useState(false);
  const [filterChips, setFilterChips] = useState([ALL_CHIP]);
  const [activeChipKey, setActiveChipKey] = useState('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [categoryData, setCategoryData] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [testLoadingById, setTestLoadingById] = useState({});

  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    let isActive = true;

    const loadFilterChips = async () => {
      try {
        const rows = await listDiagnosticPackageFilterChips({
          accessToken: getAccessToken(),
        });

        if (!isActive) {
          return;
        }

        setFilterChips(normalizeFilterChips(rows));
      } catch {
        if (!isActive) {
          return;
        }
        setFilterChips([ALL_CHIP]);
      }
    };

    loadFilterChips();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadGroups = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoriesError('');

        const rows = await listDiagnosticTestGroups(
          activeChipKey === 'all' ? undefined : activeChipKey,
          { accessToken: getAccessToken() }
        );
        const normalizedRows = (Array.isArray(rows) ? rows : [])
          .map((row, index) => normalizeGroupRow(row, index))
          .filter((row) => row.salePrice > 0);

        if (!isActive) {
          return;
        }

        setCategoryData(normalizedRows);

        setExpandedIds((prev) => {
          const next = new Set(
            Array.from(prev).filter((id) => normalizedRows.some((row) => row.id === id))
          );
          return next;
        });

        setSelectedIds((prev) => {
          const next = new Set(
            Array.from(prev).filter((id) => normalizedRows.some((row) => row.id === id))
          );
          return next;
        });

        const idsToPrefetch = normalizedRows
          .filter((row) => row.groupId && !row.testsLoaded)
          .map((row) => row.id);

        if (idsToPrefetch.length > 0) {
          void fetchTestsForCategoryIds(idsToPrefetch, normalizedRows);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        setCategoryData([]);
        setCategoriesError(error?.message || 'Failed to load tests. Please try again.');
      } finally {
        if (isActive) {
          setIsLoadingCategories(false);
        }
      }
    };

    loadGroups();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChipKey]);

  const visibleCategories = useMemo(() => {
    return categoryData.filter((category) => {
      if (!normalizedQuery) {
        return true;
      }
      const testText = category.tests.join(' ').toLowerCase();
      return category.title.toLowerCase().includes(normalizedQuery) || testText.includes(normalizedQuery);
    });
  }, [categoryData, normalizedQuery]);

  const selectedCategories = useMemo(() => {
    return categoryData.filter((item) => selectedIds.has(item.id));
  }, [categoryData, selectedIds]);

  const selectedCount = selectedCategories.length;
  const totalSale = selectedCategories.reduce((sum, item) => sum + item.salePrice, 0);
  const totalOld = selectedCategories.reduce((sum, item) => sum + item.oldPrice, 0);

  const selectedTokens = selectedCategories.map((item) => ({
    id: item.id,
    label: item.title.split(' ')[0],
  }));

  useEffect(() => {
    if (selectedCount === 0 && isViewAllOpen) {
      setIsViewAllOpen(false);
    }
  }, [selectedCount, isViewAllOpen]);

  const fetchTestsForCategoryIds = async (categoryIds, sourceCategories) => {
    const uniqueIds = Array.from(new Set((Array.isArray(categoryIds) ? categoryIds : []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return;
    }

    const source = Array.isArray(sourceCategories) && sourceCategories.length > 0
      ? sourceCategories
      : categoryData;
    const categoriesToFetch = source.filter(
      (category) => uniqueIds.includes(category.id) && category.groupId && !category.testsLoaded && !testLoadingById[category.id]
    );

    if (categoriesToFetch.length === 0) {
      return;
    }

    const authPayload = { accessToken: getAccessToken() };

    setTestLoadingById((prev) => {
      const next = { ...prev };
      categoriesToFetch.forEach((category) => {
        next[category.id] = true;
      });
      return next;
    });

    const results = await Promise.all(
      categoriesToFetch.map(async (category) => {
        try {
          const rows = await listDiagnosticTestGroupTests(category.groupId, authPayload);
          return {
            id: category.id,
            tests: normalizeTests(rows),
          };
        } catch {
          return {
            id: category.id,
            tests: [],
          };
        }
      })
    );

    setCategoryData((prev) => prev.map((item) => {
      const result = results.find((entry) => entry.id === item.id);
      if (!result) {
        return item;
      }
      return {
        ...item,
        tests: result.tests.length > 0 ? result.tests : item.tests,
        parameterCount: result.tests.length > 0 ? result.tests.length : item.parameterCount,
        testsLoaded: true,
      };
    }));

    setTestLoadingById((prev) => {
      const next = { ...prev };
      categoriesToFetch.forEach((category) => {
        delete next[category.id];
      });
      return next;
    });
  };

  const toggleExpanded = (id) => {
    const isOpening = !expandedIds.has(id);
    if (isOpening) {
      void fetchTestsForCategoryIds([id]);
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        void fetchTestsForCategoryIds([id]);
      }
      return next;
    });
  };

  const removeSelected = (id) => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const hasSummary = selectedCount > 0;
  const canBookTests = selectedCategories.some((item) => Number(item.groupId) > 0);

  const initialCustomGroups = useMemo(
    () => selectedCategories
      .filter((item) => Number(item.groupId) > 0)
      .map((item) => ({
        id: item.id,
        groupId: item.groupId,
        title: item.title,
        salePrice: item.salePrice,
        oldPrice: item.oldPrice,
        tags: item.tags,
        tests: item.tests,
        testsLoaded: item.testsLoaded,
      })),
    [selectedCategories],
  );

  return (
    <div className={`create-custom-page ${isSearchOpen ? 'create-custom-page--search-open' : ''} ${isViewAllOpen ? 'create-custom-page--view-all-open' : ''} ${hasSummary ? 'create-custom-page--has-summary' : ''}`}>
      <div className="create-custom-page__fixed-top">
        <header className="create-custom-page__header">
          <div className="create-custom-page__header-left">
            <button type="button" className="create-custom-page__icon-btn" onClick={onBack} aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className="create-custom-page__title">Custom Package</h1>
          </div>

          <div className="create-custom-page__header-actions">
            <button
              type="button"
              className="create-custom-page__icon-btn"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label="Search"
            >
              <SearchIcon />
            </button>
            <button type="button" className="create-custom-page__icon-btn" aria-label="Open cart">
              <CartIcon />
            </button>
          </div>
        </header>

        <div className={`create-custom-page__search-row create-custom-page__search-row--animated ${isSearchOpen ? 'is-open' : ''}`} aria-hidden={!isSearchOpen}>
          <SearchIcon stroke="rgba(255, 255, 255, 0.72)" />
          <input
            type="text"
            className="create-custom-page__search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search tests"
          />
        </div>

        <div className="create-custom-page__pills" role="tablist" aria-label="Category filters">
          {filterChips.map((chip) => {
            const isActive = chip.chip_key === activeChipKey;
            return (
              <button
                key={chip.filter_chip_id}
                type="button"
                className={`create-custom-page__pill ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveChipKey(chip.chip_key)}
                role="tab"
                aria-selected={isActive}
              >
                {chip.display_name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="create-custom-page__content">
        <div className="create-custom-page__cards">
          {isLoadingCategories ? (
            <article className="create-custom-page__card create-custom-page__card--status">
              <p className="create-custom-page__card-title">Loading tests...</p>
            </article>
          ) : null}

          {!isLoadingCategories && categoriesError ? (
            <article className="create-custom-page__card create-custom-page__card--status">
              <p className="create-custom-page__card-title">{categoriesError}</p>
            </article>
          ) : null}

          {!isLoadingCategories && !categoriesError && visibleCategories.length === 0 ? (
            <article className="create-custom-page__card create-custom-page__card--status">
              <p className="create-custom-page__card-title">No tests found for this filter.</p>
            </article>
          ) : null}

          {visibleCategories.map((category) => {
            const isExpanded = expandedIds.has(category.id);
            const isSelected = selectedIds.has(category.id);
            const isTestsLoading = Boolean(testLoadingById[category.id]);
            const parameterCount = category.parameterCount || category.tests.length;
            const profileArt = getProfileArt(category.title, category.groupKey, category.tags);
            const discountText = getDiscountText(category);

            return (
              <article
                key={category.id}
                className={`create-custom-page__card ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                onClick={() => toggleExpanded(category.id)}
              >
                <img
                  className="create-custom-page__card-leaf"
                  src={leafArt}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="create-custom-page__card-art"
                  src={profileArt}
                  alt=""
                  aria-hidden="true"
                />

                <div className="create-custom-page__card-body">
                  <div className="create-custom-page__card-top">
                    <p className="create-custom-page__card-title">{category.title}</p>
                    <button
                      type="button"
                      className="create-custom-page__expand-btn"
                      aria-label={`Toggle details for ${category.title}`}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="create-custom-page__tests-grid">
                      {isTestsLoading ? (
                        <span className="create-custom-page__test-item">Loading tests...</span>
                      ) : null}
                      {!isTestsLoading && category.tests.length === 0 ? (
                        <span className="create-custom-page__test-item">No tests available</span>
                      ) : null}
                      {category.tests.map((test, testIndex) => (
                        <span key={`${category.id}-${test}-${testIndex}`} className="create-custom-page__test-item">
                          {test}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="create-custom-page__card-bottom">
                    <div className="create-custom-page__card-info">
                      {!isExpanded ? (
                        <span className="create-custom-page__card-parameters">
                          {parameterCount} parameter{parameterCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      <div className="create-custom-page__price-row">
                        <span className="create-custom-page__price-now">{formatMoney(category.salePrice)}</span>
                        <span className="create-custom-page__price-old">{formatMoney(category.oldPrice)}</span>
                        {discountText ? (
                          <span className="create-custom-page__price-off">{discountText}</span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`create-custom-page__add-btn ${isSelected ? 'is-added' : ''}`}
                      aria-pressed={isSelected}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(category.id);
                      }}
                    >
                      {isSelected ? (
                        <>
                          <span className="create-custom-page__add-btn-circle" aria-hidden="true">
                            <CheckIcon />
                          </span>
                          Added
                        </>
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {hasSummary ? (
        <div
          className={`create-custom-page__summary-overlay${isViewAllOpen ? ' is-expanded' : ''}`}
          onClick={(event) => {
            if (isViewAllOpen && event.target === event.currentTarget) {
              setIsViewAllOpen(false);
            }
          }}
        >
          <footer
            className="create-custom-page__summary"
            style={{ background: '#06141b' }}
            onWheel={(event) => {
              if (isViewAllOpen && event.target.closest('.create-custom-page__selected-list')) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
            }}
            onTouchMove={(event) => {
              if (isViewAllOpen && event.target.closest('.create-custom-page__selected-list')) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {isViewAllOpen ? (
              <div className="create-custom-page__selected-list" aria-label="Selected tests">
                {selectedCategories.map((item) => (
                  <article className="create-custom-page__selected-card" key={item.id}>
                    <div className="create-custom-page__selected-card-top">
                      <h3 className="create-custom-page__selected-card-title">{item.title}</h3>
                      <div className="create-custom-page__selected-card-right">
                        <span className="create-custom-page__selected-card-price">{formatMoney(item.salePrice)}</span>
                        <button
                          type="button"
                          className="create-custom-page__selected-card-remove"
                          aria-label={`Remove ${item.title}`}
                          onClick={() => removeSelected(item.id)}
                        >
                          <CloseCircleIcon />
                        </button>
                      </div>
                    </div>

                    <div className="create-custom-page__selected-card-tests">
                      {testLoadingById[item.id] ? (
                        <span className="create-custom-page__selected-card-test">Loading tests...</span>
                      ) : null}
                      {!testLoadingById[item.id] && item.tests.length === 0 ? (
                        <span className="create-custom-page__selected-card-test">No tests available</span>
                      ) : null}
                      {item.tests.map((test, testIndex) => (
                        <span className="create-custom-page__selected-card-test" key={`${item.id}-${test}-${testIndex}`}>
                          <DotIcon />
                          <span className="create-custom-page__selected-card-test-label">{test}</span>
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="create-custom-page__summary-tags">
                {selectedTokens.map((token) => (
                  <span className="create-custom-page__summary-tag" key={token.id}>
                    {token.label}
                    <button type="button" aria-label={`Remove ${token.label}`} onClick={() => removeSelected(token.id)}>
                      <CloseCircleIcon />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="create-custom-page__summary-row">
              <div className="create-custom-page__summary-copy">
                <span className="create-custom-page__summary-selected">{selectedCount} selected</span>
                <span className="create-custom-page__summary-dot">•</span>
                <span className="create-custom-page__summary-total">{formatMoney(totalSale)}</span>
                <span className="create-custom-page__summary-old">{formatMoney(totalOld)}</span>
              </div>

              <button
                type="button"
                className="create-custom-page__view-all"
                onClick={() => {
                  const isOpening = !isViewAllOpen;
                  if (isOpening) {
                    void fetchTestsForCategoryIds(Array.from(selectedIds));
                  }
                  setIsViewAllOpen((prev) => !prev);
                }}
              >
                <span>View All</span>
                {isViewAllOpen ? <ChevronDownIcon color="#E6F6F4" /> : <ChevronUpIcon color="#E6F6F4" />}
              </button>
            </div>

            <button
              type="button"
              className="create-custom-page__create-btn"
              disabled={!canBookTests}
              aria-disabled={!canBookTests}
              onClick={() => {
                if (canBookTests) {
                  setIsPatientOverlayOpen(true);
                }
              }}
            >
              Book Tests
            </button>
          </footer>
        </div>
      ) : null}

      {isPatientOverlayOpen ? (
        <Suspense fallback={null}>
          <PatientSelectionOverlay
            open={isPatientOverlayOpen}
            customFlow
            initialCustomGroups={initialCustomGroups}
            onClose={() => setIsPatientOverlayOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default CreateCustomPackagePage;
