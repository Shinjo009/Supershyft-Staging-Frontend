import { authorizedRequest } from './apiClient';
import { getAccessToken } from '../utils/authStorage';
import { packageHasFastingData, packageHasReportDuration } from '../utils/diagnosticPackageCardMapper';

const PACKAGES_CACHE_TTL_MS = 120000;
const PACKAGES_LIST_CACHE_VERSION = 2;

let packagesListCache = null;
let packagesListInFlight = null;
let filterChipsCache = null;
let filterChipsInFlight = null;

const getCacheToken = () => getAccessToken() || '__anonymous__';

export const getCachedDiagnosticPackagesList = () => {
  const token = getCacheToken();
  if (packagesListCache
    && packagesListCache.token === token
    && packagesListCache.version === PACKAGES_LIST_CACHE_VERSION
    && packagesListCache.expiresAt > Date.now()) {
    return packagesListCache.value;
  }
  return null;
};

export const getCachedDiagnosticPackageFilterChips = () => {
  const token = getCacheToken();
  if (filterChipsCache
    && filterChipsCache.token === token
    && filterChipsCache.expiresAt > Date.now()) {
    return filterChipsCache.value;
  }
  return null;
};

export const invalidateDiagnosticPackagesCache = () => {
  packagesListCache = null;
  packagesListInFlight = null;
  filterChipsCache = null;
  filterChipsInFlight = null;
};

const authorizedGet = async (path) => {
  return authorizedRequest(path, {
    method: 'GET',
  });
};

const extractListPayload = (response) => {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};

const fetchDiagnosticPackagesList = async (_payload, options = {}) => {
  const query = {
    gender: options?.gender ?? _payload?.gender,
    tag: options?.tag ?? _payload?.tag,
    filter_chip: options?.filterChip ?? options?.filter_chip ?? _payload?.filterChip ?? _payload?.filter_chip,
    type: options?.type ?? _payload?.type,
    include_inactive: options?.includeInactive ?? options?.include_inactive ?? _payload?.includeInactive ?? _payload?.include_inactive,
    package_for: options?.packageFor ?? options?.package_for ?? _payload?.packageFor ?? _payload?.package_for,
  };

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });

  const queryString = params.toString();
  const path = queryString ? `/diagnostic-packages?${queryString}` : '/diagnostic-packages';
  const response = await authorizedGet(path);

  return extractListPayload(response);
};

export const listDiagnosticPackages = fetchDiagnosticPackagesList;

export const listDiagnosticPackagesCached = async (_payload, options = {}) => {
  const hasQueryFilters = Boolean(
    options?.gender
    || options?.tag
    || options?.filterChip
    || options?.filter_chip
    || options?.type
    || options?.includeInactive
    || options?.include_inactive
    || options?.packageFor
    || options?.package_for
    || _payload?.gender
    || _payload?.tag
    || _payload?.filterChip
    || _payload?.filter_chip
  );

  if (hasQueryFilters) {
    return fetchDiagnosticPackagesList(_payload, options);
  }

  const forceRefresh = Boolean(options?.forceRefresh);
  const token = getCacheToken();

  if (!forceRefresh
    && packagesListCache
    && packagesListCache.token === token
    && packagesListCache.version === PACKAGES_LIST_CACHE_VERSION
    && packagesListCache.expiresAt > Date.now()) {
    return packagesListCache.value;
  }

  if (!forceRefresh
    && packagesListInFlight
    && packagesListInFlight.token === token) {
    return packagesListInFlight.promise;
  }

  const promise = fetchDiagnosticPackagesList(_payload, options)
    .then((rows) => enrichPackagesWithDetailFields(rows))
    .then((value) => {
      packagesListCache = {
        token,
        value,
        version: PACKAGES_LIST_CACHE_VERSION,
        expiresAt: Date.now() + PACKAGES_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      if (packagesListInFlight?.token === token) {
        packagesListInFlight = null;
      }
    });

  packagesListInFlight = { token, promise };
  return promise;
};

export const listDiagnosticPackageFilterChips = async (_payload, options) => {
  const requestedChipFor = String(
    options?.chipFor
    ?? _payload?.chipFor
    ?? _payload?.chip_for
    ?? 'custom_package'
  ).trim();

  const chipFor = requestedChipFor || 'custom_package';
  const response = await authorizedGet(`/diagnostic-packages/filters-chips?for=${encodeURIComponent(chipFor)}`);

  return extractListPayload(response);
};

const fetchPublicDiagnosticPackageFilterChips = async () => {
  const response = await authorizedGet('/diagnostic-packages/filters-chips');

  return extractListPayload(response);
};

export const listPublicDiagnosticPackageFilterChips = fetchPublicDiagnosticPackageFilterChips;

export const listPublicDiagnosticPackageFilterChipsCached = async ({ forceRefresh = false } = {}) => {
  const token = getCacheToken();

  if (!forceRefresh
    && filterChipsCache
    && filterChipsCache.token === token
    && filterChipsCache.expiresAt > Date.now()) {
    return filterChipsCache.value;
  }

  if (!forceRefresh
    && filterChipsInFlight
    && filterChipsInFlight.token === token) {
    return filterChipsInFlight.promise;
  }

  const promise = fetchPublicDiagnosticPackageFilterChips()
    .then((value) => {
      filterChipsCache = {
        token,
        value,
        expiresAt: Date.now() + PACKAGES_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      if (filterChipsInFlight?.token === token) {
        filterChipsInFlight = null;
      }
    });

  filterChipsInFlight = { token, promise };
  return promise;
};

/** Warm packages list + filter chips while the Packages chunk loads (navbar hover / idle prefetch). */
export const prefetchPackagesPageData = () => {
  listDiagnosticPackagesCached().catch(() => {});
  listPublicDiagnosticPackageFilterChipsCached().catch(() => {});
};

const enrichPackagesWithDetailFields = async (rows) => {
  const list = Array.isArray(rows) ? rows : [];

  return Promise.all(list.map(async (row) => {
    const packageId = Number(row?.diagnostic_package_id);
    if (!Number.isFinite(packageId) || packageId <= 0) {
      return row;
    }

    if (packageHasReportDuration(row) && packageHasFastingData(row)) {
      return row;
    }

    try {
      const detail = await getDiagnosticPackageDetail(packageId);
      if (!detail || typeof detail !== 'object') {
        return row;
      }

      return {
        ...row,
        report_duration_hours: detail.report_duration_hours ?? row.report_duration_hours,
        preparations: detail.preparations ?? row.preparations,
      };
    } catch {
      return row;
    }
  }));
};

export const getDiagnosticPackageDetail = async (packageId, _payload) => {
  const parsedId = Number(packageId);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error('Invalid diagnostic package id.');
  }

  const response = await authorizedGet(`/diagnostic-packages/${parsedId}`);

  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }

  if (response && typeof response === 'object') {
    return response;
  }

  return null;
};

export const getDiagnosticPackageTests = async (packageId, _payload) => {
  const parsedId = Number(packageId);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error('Invalid diagnostic package id.');
  }

  const response = await authorizedGet(`/diagnostic-packages/${parsedId}/tests`);

  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }

  if (response && typeof response === 'object') {
    return response;
  }

  return { groups: [] };
};

const appendFilterChipQuery = (path, filterChip) => {
  if (filterChip == null || filterChip === '') {
    return path;
  }

  const chips = Array.isArray(filterChip) ? filterChip : [filterChip];
  const encoded = chips
    .map((chip) => String(chip || '').trim())
    .filter(Boolean)
    .map((chip) => `filter_chip=${encodeURIComponent(chip)}`);

  if (encoded.length === 0) {
    return path;
  }

  return `${path}?${encoded.join('&')}`;
};

export const listDiagnosticTestGroups = async (filterChip, _payload) => {
  const path = appendFilterChipQuery('/diagnostic-test-groups', filterChip);
  const response = await authorizedGet(path);

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};

export const createDiagnosticPackage = async (payload = {}) => {
  const response = await authorizedRequest('/diagnostic-packages', {
    method: 'POST',
    payload,
  });

  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }

  if (response && typeof response === 'object') {
    return response;
  }

  return null;
};

export const assignGroupsToPackage = async (packageId, groupIds) => {
  const parsedId = Number(packageId);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error('Invalid diagnostic package id.');
  }

  const ids = (Array.isArray(groupIds) ? groupIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) {
    throw new Error('Select at least one test group.');
  }

  const response = await authorizedRequest(`/diagnostic-packages/${parsedId}/test-groups`, {
    method: 'POST',
    payload: { group_ids: ids },
  });

  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }

  return response;
};

export const removeGroupFromPackage = async (packageId, groupId) => {
  const parsedPackageId = Number(packageId);
  const parsedGroupId = Number(groupId);

  if (!Number.isFinite(parsedPackageId) || parsedPackageId <= 0) {
    throw new Error('Invalid diagnostic package id.');
  }

  if (!Number.isFinite(parsedGroupId) || parsedGroupId <= 0) {
    throw new Error('Invalid diagnostic test group id.');
  }

  await authorizedRequest(`/diagnostic-packages/${parsedPackageId}/test-groups/${parsedGroupId}`, {
    method: 'DELETE',
  });
};

export const listDiagnosticTestGroupTests = async (groupId, _payload) => {
  const parsedId = Number(groupId);

  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error('Invalid diagnostic test group id.');
  }

  const response = await authorizedGet(`/diagnostic-test-groups/${parsedId}/tests`);

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};
