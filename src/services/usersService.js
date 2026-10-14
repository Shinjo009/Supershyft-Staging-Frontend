
import { post } from './authService';
import { SIGNUP_BEARER_TOKEN } from '../config/appConfig';
import { authorizedRequest } from './apiClient';
import { getAccessToken } from '../utils/authStorage';
import { invalidateMyProfileCache } from './profileService';

const MY_PROFILES_CACHE_TTL_MS = 30000;
let myProfilesCache = null;
let myProfilesInFlight = null;

// Preferences API
export const getMyPreferences = () =>
  authorizedUsersRequest('/users/me/preferences', 'GET').then((response) => response?.data || response);

export const updateMyPreferences = (preferences) =>
  authorizedUsersRequest('/users/me/preferences', 'PUT', preferences).then((response) => response?.data || response);

export const buildSuperclubPreferencesPayload = (sportsPlaylists) => {
  const sports = sportsPlaylists && typeof sportsPlaylists === 'object'
    ? sportsPlaylists
    : {};

  return {
    sports_playlists: {
      sportIds: Array.isArray(sports.sportIds) ? sports.sportIds : [],
      otherSelected: Boolean(sports.otherSelected),
      otherNote: typeof sports.otherNote === 'string' ? sports.otherNote : '',
    },
  };
};

export const saveSuperclubMcqPreferences = async (sportsPlaylists) => {
  const payload = buildSuperclubPreferencesPayload(sportsPlaylists);
  return updateMyPreferences(payload);
};

export const submitExperienceReview = async ({
  userId,
  overallMood,
  categoryRatings,
  improvementTags = [],
  comments = '',
}) => {
  const parsedUserId = Number(userId || 0);

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    throw new Error('Unable to submit review. Please sign in again and try.');
  }

  if (!overallMood) {
    throw new Error('Please select your overall experience.');
  }

  const response = await authorizedUsersRequest('/experience-reviews', 'POST', {
    user_id: parsedUserId,
    overall_mood: overallMood,
    blood_collection_rating: Number(categoryRatings?.blood_collection || 0),
    bio_ai_reports_rating: Number(categoryRatings?.bio_ai_reports || 0),
    consultations_rating: Number(categoryRatings?.consultations || 0),
    improvement_tags: Array.isArray(improvementTags) ? improvementTags : [],
    comments: String(comments || '').trim(),
  });

  return response?.data || response;
};

export const submitSupportTicket = ({ user_id, query_text }) => {
  const parsedUserId = Number(user_id || 0);

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    throw new Error('Unable to submit support request. Please sign in again and try.');
  }

  return authorizedUsersRequest('/support/tickets', 'POST', {
    user_id: parsedUserId,
    query_text,
  }).then((response) => response?.data || response);
};

const formatDate = (date) => date.toISOString().split('T')[0];

const parseAge = (ageValue) => {
  const age = Number.parseInt(ageValue, 10);

  if (Number.isNaN(age) || age <= 0) {
    return undefined;
  }

  return age;
};

const getDateOfBirthFromAge = (ageValue) => {
  const age = parseAge(ageValue);

  if (age === undefined) {
    return undefined;
  }

  const today = new Date();
  const dateOfBirth = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());

  return formatDate(dateOfBirth);
};

const authorizedUsersRequest = async (path, method = 'GET', payload) => {
  return authorizedRequest(path, {
    method,
    payload,
  });
};

export const buildCreateUserPayload = (formData) => ({
  age: parseAge(formData.age),
  first_name: formData.firstName.trim(),
  last_name: formData.lastName.trim(),
  phone: formData.phone.trim(),
  email: formData.email.trim(),
  date_of_birth: getDateOfBirthFromAge(formData.age),
  gender: formData.gender.trim(),
  city: formData.city.trim(),
  referred_by: formData.organization?.trim() || undefined,
  status: 'active',
});

export const createUser = (formData) => {
  const headers = SIGNUP_BEARER_TOKEN
    ? { Authorization: `Bearer ${SIGNUP_BEARER_TOKEN}` }
    : {};

  return post('/users', buildCreateUserPayload(formData), headers);
};

export const getMyProfiles = async ({ forceRefresh = false } = {}) => {
  const accessToken = getAccessToken();

  if (!forceRefresh
    && myProfilesCache
    && myProfilesCache.token === accessToken
    && myProfilesCache.expiresAt > Date.now()) {
    return myProfilesCache.value;
  }

  if (!forceRefresh
    && myProfilesInFlight
    && myProfilesInFlight.token === accessToken) {
    return myProfilesInFlight.promise;
  }

  const promise = authorizedUsersRequest('/users/me/profiles')
    .then((value) => {
      myProfilesCache = {
        token: accessToken,
        value,
        expiresAt: Date.now() + MY_PROFILES_CACHE_TTL_MS,
      };

      return value;
    })
    .finally(() => {
      if (myProfilesInFlight?.token === accessToken) {
        myProfilesInFlight = null;
      }
    });

  myProfilesInFlight = { token: accessToken, promise };
  return promise;
};

export const invalidateMyProfilesCache = () => {
  myProfilesCache = null;
  myProfilesInFlight = null;
};

export const buildCreateSubProfilePayload = (formData, options = {}) => {
  const payload = {
    age: parseAge(formData.age),
    first_name: formData.firstName.trim(),
    last_name: formData.lastName.trim(),
    date_of_birth: getDateOfBirthFromAge(formData.age),
    gender: formData.gender.trim().toLowerCase(),
    relationship: formData.relation.trim().toLowerCase(),
    city: formData.city?.trim() || null,
  };

  if (!options.omitPhone) {
    payload.phone = formData.phone?.trim() || null;
  }

  if (!options.omitEmail) {
    payload.email = formData.email?.trim() || null;
  }

  return payload;
};

export const createMySubProfile = (formData, options = {}) => {
  return authorizedUsersRequest('/users/me/profiles', 'POST', buildCreateSubProfilePayload(formData, options));
};

export const updateMySubProfile = async (userId, payload) => {
  const parsedUserId = Number(userId || 0);

  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    throw new Error('Invalid sub profile user id for update.');
  }

  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const result = await authorizedUsersRequest(`/users/me/profiles/${parsedUserId}`, 'PUT', safePayload);
  invalidateMyProfilesCache();
  invalidateMyProfileCache();
  return result;
};

export const unlinkMyProfile = (payload = {}) => {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return authorizedUsersRequest('/users/me/unlink', 'POST', safePayload);
};

/** Booked consultations for the signed-in user. GET /users/me/consultations */
export const getMyConsultations = async () => {
  const limit = 20;
  const first = await authorizedRequest('/users/me/consultations', {
    method: 'GET',
    query: { page: 1, limit },
  });
  const data = Array.isArray(first?.data) ? [...first.data] : [];
  const total = Number(first?.meta?.total);
  const pageSize = Number(first?.meta?.limit) || limit;

  if (Number.isFinite(total) && data.length < total) {
    const pages = Math.min(Math.ceil(total / pageSize), 10);
    for (let page = 2; page <= pages; page += 1) {
      const next = await authorizedRequest('/users/me/consultations', {
        method: 'GET',
        query: { page, limit: pageSize },
      });
      if (Array.isArray(next?.data)) {
        data.push(...next.data);
      }
    }
  }

  return {
    data,
    meta: first?.meta ?? null,
  };
};

/** Upcoming health camp / collection slot; includes B2B vs B2C on engagement. */
export const getMyUpcomingSlot = async () => {
  const parsedBody = await authorizedUsersRequest('/users/me/upcoming-slot', 'GET');
  if (parsedBody?.data && typeof parsedBody.data === 'object') {
    return parsedBody.data;
  }
  return parsedBody && typeof parsedBody === 'object' ? parsedBody : null;
};
