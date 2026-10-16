import { authorizedRequest } from './apiClient';
import {
  authorizedGetCached,
  resolveAssessmentSubmitTargetsForEngagementId,
  resolveAssessmentSubmitTargetsFromRows,
  resolveEngagementIdFromAssessmentId,
  resolveMetsightsSubmitInstanceIdsFromRows,
} from './reportService';
import { assertGapQuestionnaireReadyForMetsightsSubmit } from '../utils/fitprintGapCatchupCompletion';

const authorizedGet = async (path, query) => {
  const parsedBody = await authorizedRequest(path, {
    method: 'GET',
    query,
  });
  return parsedBody?.data ?? parsedBody;
};

const authorizedPut = async (path, body) => {
  const parsedBody = await authorizedRequest(path, {
    method: 'PUT',
    payload: body || {},
  });
  return parsedBody?.data ?? parsedBody;
};

const authorizedPost = async (path, body) => {
  const parsedBody = await authorizedRequest(path, {
    method: 'POST',
    payload: body || {},
  });
  return parsedBody?.data ?? parsedBody;
};

const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeAssessmentStatus = (status) => String(status || '').trim().toLowerCase();
const normalizeCategoryStatus = (status) => String(status || '').trim().toLowerCase();

const getAssessmentInstanceId = (assessment) => {
  return Number(
    assessment?.assessment_instance_id
    || assessment?.assessment_id
    || assessment?.id
    || 0
  );
};

/**
 * Prefer Metsights Pro/Essentials over FitPrint — only compares rows that share the same engagement_id.
 */
const normalizePackageCode = (row) => String(
  row?.package_code || row?.packageCode || row?.assessment?.package_code || '',
).trim()
  .toUpperCase()
  .replace(/\s+/g, '_');

/** Package codes from `/assessments/me` that must never win as “latest”. */
const IGNORED_ASSESSMENTS_ME_PACKAGE_CODES = new Set(['VIFC']);

const isIgnoredAssessmentsMePackage = (row) => (
  IGNORED_ASSESSMENTS_ME_PACKAGE_CODES.has(normalizePackageCode(row))
);

const withoutIgnoredAssessmentsMePackages = (rows) => (
  (Array.isArray(rows) ? rows : []).filter((row) => !isIgnoredAssessmentsMePackage(row))
);

const getPackagePriorityTier = (row) => {
  const code = normalizePackageCode(row);

  if (isIgnoredAssessmentsMePackage(row)) {
    return -1;
  }

  const isFitPrint = code === 'MY_FITNESS_PRINT'
    || code.includes('FITPRINT')
    || code.includes('FITNESS_PRINT');

  if (code.includes('METSIGHTS') && code.includes('PRO')) {
    return 3;
  }

  // Essentials replaced Basic; keep Basic match for any legacy assessment rows.
  if (
    code === 'METSIGHTS_ESSENTIALS'
    || (code.includes('METSIGHTS') && code.includes('ESSENTIALS'))
    || code === 'METSIGHTS_BASIC'
    || (code.includes('METSIGHTS') && code.includes('BASIC'))
  ) {
    return 2;
  }

  if (isFitPrint) {
    return 0;
  }

  return 1;
};

const groupAssessmentsByEngagementId = (rows = []) => {
  const buckets = new Map();

  rows.forEach((row) => {
    const engagementId = Number(row?.engagement_id || row?.engagementId || 0);
    const instanceId = getAssessmentInstanceId(row);
    const key = engagementId > 0 ? String(engagementId) : `single_${instanceId}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(row);
  });

  return buckets;
};

const pickPreferredAssessmentInEngagementGroup = (group = []) => {
  if (group.length <= 1) {
    return group[0] || null;
  }

  return [...group].sort((a, b) => {
    const tierDiff = getPackagePriorityTier(b) - getPackagePriorityTier(a);
    if (tierDiff !== 0) {
      return tierDiff;
    }

    const byAssigned = toTimestamp(b?.assigned_at) - toTimestamp(a?.assigned_at);
    if (byAssigned !== 0) {
      return byAssigned;
    }

    return getAssessmentInstanceId(b) - getAssessmentInstanceId(a);
  })[0];
};

const isActiveIncompleteAssessment = (assessment) => {
  const status = normalizeAssessmentStatus(assessment?.status);
  const normalizedCompletedAt = assessment?.completed_at || assessment?.completedAt || null;
  const isCompleteFlag = Boolean(assessment?.is_completed ?? assessment?.isComplete ?? false);

  const activeStatuses = new Set(['active', 'in_progress', 'in-progress', 'assigned', 'pending']);
  return activeStatuses.has(status) && !normalizedCompletedAt && !isCompleteFlag;
};

const extractCategoriesFromAssessmentStatus = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.categories)) {
    return payload.categories;
  }

  if (Array.isArray(payload.category_statuses)) {
    return payload.category_statuses;
  }

  if (Array.isArray(payload.assessment_categories)) {
    return payload.assessment_categories;
  }

  if (Array.isArray(payload.data?.categories)) {
    return payload.data.categories;
  }

  return [];
};

export {
  computeQuestionsWithVisibility,
  filterVisibleQuestions,
  getQuestionnairePreferencesFromProfile,
  pruneSelectionsForVisibleCards,
} from '../utils/questionnaireVisibility';

const extractQuestionsFromCategoryPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.questions)) {
    return payload.questions;
  }

  if (Array.isArray(payload.questionnaire)) {
    return payload.questionnaire;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.data?.questions)) {
    return payload.data.questions;
  }

  if (Array.isArray(payload.category?.questions)) {
    return payload.category.questions;
  }

  return [];
};

const isNil = (value) => value === null || value === undefined;

const isBlankString = (value) => typeof value === 'string' && value.trim() === '';

export const isEmptyAnswer = (value) => {
  if (isNil(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isBlankString(value)) {
    return true;
  }

  return false;
};

const normalizeScaleAnswer = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value;
  }

  const numericValue = Number(value.value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const normalizedUnit = String(value.unit ?? '').trim();
  if (!normalizedUnit) {
    return null;
  }

  return {
    value: numericValue,
    unit: normalizedUnit,
  };
};

const normalizeOutgoingAnswer = (answer) => {
  if (answer == null) {
    return answer;
  }

  if (Array.isArray(answer)) {
    return answer
      .map((item) => String(item ?? '').trim())
      .filter((item) => item !== '');
  }

  if (typeof answer === 'object') {
    return normalizeScaleAnswer(answer);
  }

  if (typeof answer === 'boolean') {
    return answer ? 'true' : 'false';
  }

  if (typeof answer === 'number') {
    return Number.isFinite(answer) ? String(answer) : null;
  }

  return answer;
};

const normalizeCategoryResponseItem = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const questionId = Number(item.question_id || item.questionId || item.id || 0);
  if (questionId <= 0) {
    return null;
  }

  const answer = item.answer
    ?? item.response
    ?? item.value
    ?? item.selected_option
    ?? item.selected_options
    ?? item.answers;

  const normalizedAnswer = normalizeOutgoingAnswer(answer);

  if (isEmptyAnswer(normalizedAnswer)) {
    return null;
  }

  return {
    question_id: questionId,
    answer: normalizedAnswer,
  };
};

const extractResponseCandidates = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidates = [
    payload.responses,
    payload.answers,
    payload.user_responses,
    payload.user_answers,
    payload.question_responses,
    payload.data?.responses,
    payload.data?.answers,
    payload.data?.user_responses,
    payload.questionnaire_responses,
  ];

  return candidates.filter(Array.isArray);
};

const extractResponsesFromQuestions = (questions = []) => {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question) => {
      const questionId = Number(question?.question_id || question?.id || 0);
      if (questionId <= 0) {
        return null;
      }

      const answer = question?.answer
        ?? question?.response
        ?? question?.value
        ?? question?.selected_option
        ?? question?.selected_options
        ?? question?.user_answer
        ?? question?.user_response;

      if (isEmptyAnswer(answer)) {
        return null;
      }

      return {
        question_id: questionId,
        answer,
      };
    })
    .filter(Boolean);
};

const extractResponsesFromCategoryPayload = (payload, questions = []) => {
  const responsesFromPayload = extractResponseCandidates(payload)
    .flatMap((responseArray) => responseArray.map(normalizeCategoryResponseItem).filter(Boolean));

  const responsesFromQuestions = extractResponsesFromQuestions(questions);
  const mergedByQuestionId = new Map();

  for (const response of [...responsesFromPayload, ...responsesFromQuestions]) {
    mergedByQuestionId.set(response.question_id, response);
  }

  return Array.from(mergedByQuestionId.values());
};

export const mapCategoryToRouteId = (category) => {
  const key = String(category?.category_key || '').toLowerCase();
  const name = String(category?.display_name || '').toLowerCase();

  if (key.includes('anthropometry') || name.includes('anthropometry')) {
    return 'anthropometry';
  }

  if (key.includes('family') || name.includes('family')) {
    return 'family-history';
  }

  if (key.includes('lifestyle') || name.includes('lifestyle')) {
    return 'lifestyle-habits';
  }

  if (key.includes('nutrition') || name.includes('nutrition') || key.includes('diet') || name.includes('diet')) {
    return 'nutrition-log';
  }

  if (key.includes('vital') || name.includes('vital')) {
    return 'vitals';
  }

  return '';
};

const routeOrder = ['family-history', 'lifestyle-habits', 'nutrition-log', 'anthropometry', 'vitals'];

const sortCategories = (categories) => {
  return [...categories].sort((a, b) => {
    const aIndex = routeOrder.indexOf(a.routeId);
    const bIndex = routeOrder.indexOf(b.routeId);

    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

    if (safeA !== safeB) {
      return safeA - safeB;
    }

    return Number(a.category_id || 0) - Number(b.category_id || 0);
  });
};

const pickLatestIncompleteActiveAssessment = (assessments) => {
  const activeIncomplete = assessments
    .filter((row) => isActiveIncompleteAssessment(row));

  if (activeIncomplete.length === 0) {
    return null;
  }

  if (activeIncomplete.length === 1) {
    return activeIncomplete[0];
  }

  const engagementBuckets = groupAssessmentsByEngagementId(activeIncomplete);
  const representatives = Array.from(engagementBuckets.values())
    .map((group) => pickPreferredAssessmentInEngagementGroup(group))
    .filter(Boolean);

  const sortedRepresentatives = representatives.sort((a, b) => {
    const byAssigned = toTimestamp(b?.assigned_at) - toTimestamp(a?.assigned_at);
    if (byAssigned !== 0) {
      return byAssigned;
    }
    return getAssessmentInstanceId(b) - getAssessmentInstanceId(a);
  });

  return sortedRepresentatives[0] || null;
};

/**
 * When all rows are complete, `pickLatestIncompleteActiveAssessment` is null but drafts/responses
 * still live on the latest assignment — use that row for category draft checks (matches in-app questionnaire).
 */
const pickLatestAssessmentRowByAssignment = (assessments) => {
  const rows = Array.isArray(assessments) ? assessments : [];
  const sorted = [...rows]
    .map((item) => ({
      ...item,
      assessmentInstanceId: getAssessmentInstanceId(item),
      assignedAtTs: toTimestamp(item?.assigned_at || item?.assignedAt),
    }))
    .filter((item) => item.assessmentInstanceId > 0)
    .sort((a, b) => {
      if (b.assignedAtTs !== a.assignedAtTs) {
        return b.assignedAtTs - a.assignedAtTs;
      }
      return b.assessmentInstanceId - a.assessmentInstanceId;
    });
  return sorted[0] || null;
};

const pickAssessmentRowForCategoryDraftCheck = (assessments) => (
  pickLatestIncompleteActiveAssessment(assessments) || pickLatestAssessmentRowByAssignment(assessments)
);

const extractAssessmentsFromListPayload = (payload) => {
  if (Array.isArray(payload)) {
    return withoutIgnoredAssessmentsMePackages(payload);
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return withoutIgnoredAssessmentsMePackages(payload.items);
  }

  if (Array.isArray(payload.results)) {
    return withoutIgnoredAssessmentsMePackages(payload.results);
  }

  if (Array.isArray(payload.rows)) {
    return withoutIgnoredAssessmentsMePackages(payload.rows);
  }

  if (Array.isArray(payload.data?.items)) {
    return withoutIgnoredAssessmentsMePackages(payload.data.items);
  }

  if (Array.isArray(payload.data?.results)) {
    return withoutIgnoredAssessmentsMePackages(payload.data.results);
  }

  if (Array.isArray(payload.data)) {
    return withoutIgnoredAssessmentsMePackages(payload.data);
  }

  return [];
};

export const listMyAssessments = async (page = 1, limit = 50) => {
  const raw = await authorizedGetCached('/assessments/me', 45000, { page, limit });
  return raw?.data ?? raw;
};

export const getAssessmentStatus = (assessmentInstanceId, { categoryOf = 'supershyft' } = {}) => {
  const id = Number(assessmentInstanceId);
  if (!Number.isFinite(id) || id <= 0) {
    return Promise.reject(new Error('Invalid assessment instance id.'));
  }
  const categoryOfValue = String(categoryOf || 'supershyft').trim() || 'supershyft';
  return authorizedGet(`/assessments/${id}/status`, { category_of: categoryOfValue });
};

const VALID_QUESTION_FILTERS = new Set(['all', 'answered', 'unanswered']);

/**
 * GET /questionnaire/{assessment_instance_id}/category/{category_id}
 * @param {number} assessmentInstanceId
 * @param {number} categoryId
 * @param {{ question?: 'all' | 'answered' | 'unanswered' }} [options]
 *   Filter by answer state. Frontend default is `all` so draft/full flows keep answered rows;
 *   Health Span / FitPrint catch-up should pass `unanswered` for remaining questions.
 */
export const getCategoryQuestionnaire = (
  assessmentInstanceId,
  categoryId,
  { question = 'all' } = {},
) => {
  const filter = String(question || 'all').trim().toLowerCase();
  const questionFilter = VALID_QUESTION_FILTERS.has(filter) ? filter : 'all';
  return authorizedGet(`/questionnaire/${assessmentInstanceId}/category/${categoryId}`, {
    question: questionFilter,
  });
};

const FH_FAMILY_DRAFT_CACHE_TTL_MS = 90_000;
let fhFamilyDraftCache = { expiresAt: 0, value: null };
let fhFamilyDraftInFlight = null;

/** Synchronous read; `null` means cache miss or expired (caller should await network). */
export const peekFamilyHistoryQuestionnaireDraftCache = () => {
  if (Date.now() < fhFamilyDraftCache.expiresAt) {
    return fhFamilyDraftCache.value;
  }
  return null;
};

/** Call after a successful family-history save so home can resolve without waiting on the network. */
export const markFamilyHistoryQuestionnaireDraftKnown = (hasDraft) => {
  fhFamilyDraftCache = {
    expiresAt: Date.now() + FH_FAMILY_DRAFT_CACHE_TTL_MS,
    value: Boolean(hasDraft),
  };
};

export const invalidateFamilyHistoryQuestionnaireDraftCache = () => {
  fhFamilyDraftCache = { expiresAt: 0, value: null };
  fhFamilyDraftInFlight = null;
};

async function fetchHasFamilyHistoryQuestionnaireDraftUncached() {
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const latestAssessment = pickAssessmentRowForCategoryDraftCheck(assessments);

  const assessmentInstanceId = getAssessmentInstanceId(latestAssessment || {});
  if (assessmentInstanceId <= 0) {
    return false;
  }

  const statusPayload = await getAssessmentStatus(assessmentInstanceId);
  const rawCategories = extractCategoriesFromAssessmentStatus(statusPayload);
  const familyCategory = rawCategories
    .map((category) => ({
      ...category,
      category_id: Number(category?.category_id || category?.id || 0),
      category_key: category?.category_key || category?.key || '',
      display_name: category?.display_name || category?.name || category?.category_name || '',
      assessment_instance_id: Number(
        category?.assessment_instance_id || category?.assessment_id || assessmentInstanceId,
      ),
    }))
    .find((category) => Number(category?.category_id || 0) > 0 && mapCategoryToRouteId(category) === 'family-history');

  if (!familyCategory) {
    return false;
  }

  const categoryAssessmentInstanceId = Number(
    familyCategory.assessment_instance_id || assessmentInstanceId,
  );
  const categoryId = Number(familyCategory.category_id || 0);
  if (categoryAssessmentInstanceId <= 0 || categoryId <= 0) {
    return false;
  }

  const questionnairePayload = await getCategoryQuestionnaire(
    categoryAssessmentInstanceId,
    categoryId,
    { question: 'answered' },
  );
  const questions = extractQuestionsFromCategoryPayload(questionnairePayload);
  const responses = extractResponsesFromCategoryPayload(questionnairePayload, questions);
  return responses.length > 0;
}

/**
 * True when the latest (by assignment time) assessment has at least one saved
 * family-history questionnaire response (draft or otherwise). Used for B2B home
 * “questionnaire submitted” UX — does not use per-category completion status.
 * Results are cached briefly and in-flight calls are deduped to speed repeat navigation (e.g. home).
 * @param {{ forceRefresh?: boolean }} [options]
 */
export const hasFamilyHistoryQuestionnaireDraft = async (options = {}) => {
  const { forceRefresh = false } = options;

  if (!forceRefresh && Date.now() < fhFamilyDraftCache.expiresAt) {
    return fhFamilyDraftCache.value;
  }

  if (!forceRefresh && fhFamilyDraftInFlight) {
    return fhFamilyDraftInFlight;
  }

  const promise = fetchHasFamilyHistoryQuestionnaireDraftUncached()
    .then((result) => {
      fhFamilyDraftCache = {
        expiresAt: Date.now() + FH_FAMILY_DRAFT_CACHE_TTL_MS,
        value: result,
      };
      return result;
    })
    .finally(() => {
      fhFamilyDraftInFlight = null;
    });

  if (!forceRefresh) {
    fhFamilyDraftInFlight = promise;
  }

  return promise;
};

const NUTRITION_DRAFT_CACHE_TTL_MS = 90_000;
let nutritionDraftCache = { expiresAt: 0, value: null };
let nutritionDraftInFlight = null;

export const peekNutritionLogQuestionnaireDraftCache = () => {
  if (Date.now() < nutritionDraftCache.expiresAt) {
    return nutritionDraftCache.value;
  }
  return null;
};

export const markNutritionLogQuestionnaireDraftKnown = (hasDraft) => {
  nutritionDraftCache = {
    expiresAt: Date.now() + NUTRITION_DRAFT_CACHE_TTL_MS,
    value: Boolean(hasDraft),
  };
};

export const invalidateNutritionLogQuestionnaireDraftCache = () => {
  nutritionDraftCache = { expiresAt: 0, value: null };
  nutritionDraftInFlight = null;
};

async function fetchHasNutritionLogQuestionnaireDraftUncached() {
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const latestAssessment = pickAssessmentRowForCategoryDraftCheck(assessments);

  const assessmentInstanceId = getAssessmentInstanceId(latestAssessment || {});
  if (assessmentInstanceId <= 0) {
    return false;
  }

  const statusPayload = await getAssessmentStatus(assessmentInstanceId);
  const rawCategories = extractCategoriesFromAssessmentStatus(statusPayload);
  const nutritionCategory = rawCategories
    .map((category) => ({
      ...category,
      category_id: Number(category?.category_id || category?.id || 0),
      category_key: category?.category_key || category?.key || '',
      display_name: category?.display_name || category?.name || category?.category_name || '',
      assessment_instance_id: Number(
        category?.assessment_instance_id || category?.assessment_id || assessmentInstanceId,
      ),
    }))
    .find((category) => Number(category?.category_id || 0) > 0 && mapCategoryToRouteId(category) === 'nutrition-log');

  if (!nutritionCategory) {
    return false;
  }

  const categoryAssessmentInstanceId = Number(
    nutritionCategory.assessment_instance_id || assessmentInstanceId,
  );
  const categoryId = Number(nutritionCategory.category_id || 0);
  if (categoryAssessmentInstanceId <= 0 || categoryId <= 0) {
    return false;
  }

  const questionnairePayload = await getCategoryQuestionnaire(
    categoryAssessmentInstanceId,
    categoryId,
    { question: 'answered' },
  );
  const questions = extractQuestionsFromCategoryPayload(questionnairePayload);
  const responses = extractResponsesFromCategoryPayload(questionnairePayload, questions);
  return responses.length > 0;
}

/**
 * True when the latest assessment has at least one saved nutrition-log response.
 * Used for B2B home “questionnaire progress” UX (same pattern as family-history draft check).
 */
export const hasNutritionLogQuestionnaireDraft = async (options = {}) => {
  const { forceRefresh = false } = options;

  if (!forceRefresh && Date.now() < nutritionDraftCache.expiresAt) {
    return nutritionDraftCache.value;
  }

  if (!forceRefresh && nutritionDraftInFlight) {
    return nutritionDraftInFlight;
  }

  const promise = fetchHasNutritionLogQuestionnaireDraftUncached()
    .then((result) => {
      nutritionDraftCache = {
        expiresAt: Date.now() + NUTRITION_DRAFT_CACHE_TTL_MS,
        value: result,
      };
      return result;
    })
    .finally(() => {
      nutritionDraftInFlight = null;
    });

  if (!forceRefresh) {
    nutritionDraftInFlight = promise;
  }

  return promise;
};

export const submitQuestionnaireResponses = (assessmentInstanceId, categoryId, responses = []) => {
  const normalizedResponses = Array.isArray(responses)
    ? responses.map(normalizeCategoryResponseItem).filter(Boolean)
    : [];

  if (normalizedResponses.length === 0) {
    return Promise.resolve(null);
  }

  return authorizedPut(`/questionnaire/${assessmentInstanceId}/category/${categoryId}/responses`, {
    responses: normalizedResponses,
  });
};

const METSIGHTS_SUBMIT_CATEGORY_OF = 'metsights';

/**
 * POST /assessments/{id}/submit — push one Metsights category through the strategy engine.
 * @param {number} assessmentInstanceId
 * @param {{ category: string, categoryOf?: string }} options
 */
export const submitAssessmentInstance = async (assessmentInstanceId, { category, categoryOf } = {}) => {
  const id = Number(assessmentInstanceId);
  const categoryName = String(category || '').trim();
  const categoryOfValue = String(categoryOf || METSIGHTS_SUBMIT_CATEGORY_OF).trim()
    || METSIGHTS_SUBMIT_CATEGORY_OF;

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid assessment instance id.');
  }
  if (!categoryName) {
    throw new Error('Category is required for assessment submit.');
  }

  return authorizedPost(`/assessments/${id}/submit`, {
    category: categoryName,
    category_of: categoryOfValue,
  });
};

const resolveMetsightsSubmitIds = (targets, assessments = []) => {
  const fromRows = resolveMetsightsSubmitInstanceIdsFromRows(assessments);
  const metsightsProId = Number(fromRows.metsightsProAssessmentId)
    || Number(targets?.basicOrProAssessmentId);
  const fitprintFullId = Number(fromRows.fitprintFullAssessmentId)
    || Number(targets?.fitprintAssessmentId);

  return {
    metsightsProId: Number.isFinite(metsightsProId) && metsightsProId > 0 ? metsightsProId : null,
    fitprintFullId: Number.isFinite(fitprintFullId) && fitprintFullId > 0 ? fitprintFullId : null,
  };
};

/**
 * Build 3 submit calls on Metsights Pro (or Essentials fallback) and 1 on FitPrint Full when present.
 * Used by the full health questionnaire (camp/B2B) — not the Health Span / FitPrint gap flow.
 * Instance ids come from `/assessments/me` — never the generic path instance id.
 */
const collectMetsightsSubmitJobs = (targets, assessments = [], { excludeVitals = false } = {}) => {
  const { metsightsProId, fitprintFullId } = resolveMetsightsSubmitIds(targets, assessments);
  const jobs = [];

  if (metsightsProId) {
    jobs.push({ assessmentInstanceId: metsightsProId, category: 'physical-measurement' });
    jobs.push({ assessmentInstanceId: metsightsProId, category: 'diet-lifestyle-parameters' });
    if (!excludeVitals) {
      jobs.push({ assessmentInstanceId: metsightsProId, category: 'vitals' });
    }
  }

  if (fitprintFullId) {
    jobs.push({ assessmentInstanceId: fitprintFullId, category: 'fitness-parameters' });
  }

  return jobs;
};

/**
 * Health Span Index / FitPrint gap finalize — push only to the FitPrint assessment via
 * POST /assessments/{fitprintId}/submit (no questionnaire PUT mirror onto FitPrint).
 */
const collectFitprintGapSubmitJobs = (targets, assessments = []) => {
  const { fitprintFullId } = resolveMetsightsSubmitIds(targets, assessments);
  const fromTargets = Number(targets?.fitprintAssessmentId);
  const fitprintId = fitprintFullId
    || (Number.isFinite(fromTargets) && fromTargets > 0 ? fromTargets : null);

  if (!fitprintId) {
    return [];
  }

  return [{ assessmentInstanceId: fitprintId, category: 'fitness-parameters' }];
};

/** FitPrint Full instance on the same engagement as the gap Basic/Pro assessment (or null). */
export const resolveFitprintAssessmentIdForGap = async (gapAssessmentInstanceId) => {
  const gapId = Number(gapAssessmentInstanceId);
  if (!Number.isFinite(gapId) || gapId <= 0) {
    return null;
  }

  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const engagementId = resolveEngagementIdFromAssessmentId(assessments, gapId);
  const targets = engagementId
    ? resolveAssessmentSubmitTargetsForEngagementId(assessments, engagementId)
    : resolveAssessmentSubmitTargetsFromRows(assessments);
  const { fitprintFullId } = resolveMetsightsSubmitIds(targets || {}, assessments);
  const fromTargets = Number(targets?.fitprintAssessmentId);
  const fitprintId = fitprintFullId
    || (Number.isFinite(fromTargets) && fromTargets > 0 ? fromTargets : null);
  return fitprintId;
};

const submitMetsightsCategoryJobs = async (jobs = []) => {
  let lastResult = null;
  for (const job of jobs) {
    lastResult = await submitAssessmentInstance(job.assessmentInstanceId, {
      category: job.category,
    });
    if (String(job.category || '').trim().toLowerCase() === 'fitness-parameters') {
      markFitprintGapQuestionnaireSubmitted(job.assessmentInstanceId);
    }
  }
  return lastResult;
};

const markHealthQuestionnaireSubmittedFromTargets = (assessments, targets) => {
  const { metsightsProId } = resolveMetsightsSubmitIds(targets, assessments);
  if (metsightsProId) {
    const engagementId = resolveEngagementIdFromAssessmentId(assessments, metsightsProId);
    markHealthQuestionnaireSubmitted({
      engagementId,
      basicProAssessmentId: metsightsProId,
    });
    return;
  }
  markHealthQuestionnaireSubmitted();
};

const isAssessmentAlreadyCompletedError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('already completed') || message.includes('assessment is already completed');
};

/** Resolve latest-engagement submit targets and POST submit (3 or 4 Metsights strategy calls). */
export const submitLatestEngagementAssessment = async ({ excludeVitals = false } = {}) => {
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const targets = resolveAssessmentSubmitTargetsFromRows(assessments);
  const { metsightsProId } = resolveMetsightsSubmitIds(targets, assessments);

  if (!metsightsProId) {
    throw new Error('No Metsights Pro or Essentials assessment is available to submit.');
  }

  const jobs = collectMetsightsSubmitJobs(targets, assessments, { excludeVitals });

  if (jobs.length === 0) {
    throw new Error('No Metsights questionnaire categories are available to submit.');
  }

  const result = await submitMetsightsCategoryJobs(jobs);
  markHealthQuestionnaireSubmittedFromTargets(assessments, targets);
  return result;
};

/**
 * Finalize Health Span Index / FitPrint gap questionnaire —
 * POST /assessments/{fitprintId}/submit with fitness-parameters only.
 * Draft answers stay on Basic/Pro; backend merges engagement responses when pushing.
 */
export const submitFitprintGapQuestionnaire = async (gapAssessmentInstanceId) => {
  const gapId = Number(gapAssessmentInstanceId);
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);

  const engagementId = resolveEngagementIdFromAssessmentId(assessments, gapId);
  let targets = engagementId
    ? resolveAssessmentSubmitTargetsForEngagementId(assessments, engagementId)
    : null;

  if (!targets?.assessmentInstanceId) {
    targets = resolveAssessmentSubmitTargetsFromRows(assessments);
  }

  if (!targets?.assessmentInstanceId && Number.isFinite(gapId) && gapId > 0) {
    targets = {
      assessmentInstanceId: gapId,
      sourceAssessmentInstanceIds: [gapId],
      basicOrProAssessmentId: gapId,
      fitprintAssessmentId: null,
    };
  }

  if (!targets?.assessmentInstanceId) {
    throw new Error('No active assessment is available to submit.');
  }

  const basicProIdForValidation = Number(
    targets.basicOrProAssessmentId
    || targets.sourceAssessmentInstanceIds?.[0]
    || gapId,
  );

  if (Number.isFinite(basicProIdForValidation) && basicProIdForValidation > 0) {
    await assertGapQuestionnaireReadyForMetsightsSubmit(basicProIdForValidation);
  }

  const jobs = collectFitprintGapSubmitJobs(targets, assessments);

  if (jobs.length === 0) {
    throw new Error('No FitPrint assessment is available to submit. Assign FitPrint on this engagement first.');
  }

  try {
    const result = await submitMetsightsCategoryJobs(jobs);
    markHealthQuestionnaireSubmittedFromTargets(assessments, targets);
    return result;
  } catch (error) {
    if (isAssessmentAlreadyCompletedError(error)) {
      markHealthQuestionnaireSubmittedFromTargets(assessments, targets);
      jobs.forEach((job) => {
        if (String(job.category || '').trim().toLowerCase() === 'fitness-parameters') {
          markFitprintGapQuestionnaireSubmitted(job.assessmentInstanceId);
        }
      });
      return { message: 'Assessment already submitted' };
    }
    const message = String(error?.message || error || '');
    if (message.includes('waist_circumference') && message.includes('required')) {
      throw new Error(
        'Waist size is required for FitPrint. Go back and complete Anthropometry (height, weight, and waist), then submit again.',
      );
    }
    throw error;
  }
};

/** True when the GET questionnaire payload shows no answer for this question (draft catch-up). */
export const isQuestionnaireQuestionUnanswered = (question) => {
  if (!question || typeof question !== 'object') {
    return false;
  }
  if (question.is_read_only) {
    return false;
  }
  if (question.is_visible === false) {
    return false;
  }

  const answer = question?.answer
    ?? question?.response
    ?? question?.value
    ?? question?.selected_option
    ?? question?.selected_options
    ?? question?.user_answer
    ?? question?.user_response;

  return isEmptyAnswer(answer);
};

export const loadQuestionnaireContext = async ({ question = 'all' } = {}) => {
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const latestAssessment = pickAssessmentRowForCategoryDraftCheck(assessments);
  const submitTargets = resolveAssessmentSubmitTargetsFromRows(assessments);

  const assessmentInstanceId = getAssessmentInstanceId(latestAssessment);

  if (!latestAssessment || assessmentInstanceId <= 0) {
    throw new Error('No active incomplete assessment is assigned to this user.');
  }

  const statusPayload = await getAssessmentStatus(assessmentInstanceId);
  const rawCategories = extractCategoriesFromAssessmentStatus(statusPayload);
  const categoriesWithRoute = rawCategories
    .map((category) => {
      const normalizedCategory = {
        ...category,
        category_id: Number(category?.category_id || category?.id || 0),
        category_key: category?.category_key || category?.key || '',
        display_name: category?.display_name || category?.name || category?.category_name || '',
        assessment_instance_id: Number(category?.assessment_instance_id || category?.assessment_id || assessmentInstanceId),
      };

      return {
        ...normalizedCategory,
        routeId: mapCategoryToRouteId(normalizedCategory),
        status: normalizeCategoryStatus(category?.status || category?.category_status),
      };
    })
    .filter((category) => Number(category?.category_id || 0) > 0);

  const categories = sortCategories(categoriesWithRoute);

  const questionEntries = await Promise.all(
    categories.map(async (category) => {
      const categoryAssessmentInstanceId = Number(category?.assessment_instance_id || assessmentInstanceId);
      const questionnairePayload = await getCategoryQuestionnaire(
        categoryAssessmentInstanceId,
        category.category_id,
        { question },
      );
      const questions = extractQuestionsFromCategoryPayload(questionnairePayload);
      const responses = extractResponsesFromCategoryPayload(questionnairePayload, questions);
      return [String(category.category_id), { questions, responses }];
    })
  );

  const questionsByCategoryId = {};
  const responsesByCategoryId = {};

  for (const [categoryId, entry] of questionEntries) {
    questionsByCategoryId[categoryId] = entry.questions;
    responsesByCategoryId[categoryId] = entry.responses;
  }

  return {
    assessments,
    assessment: latestAssessment,
    submitTargets,
    categories,
    questionsByCategoryId,
    responsesByCategoryId,
    questionFilter: question,
  };
};

/**
 * Same as {@link loadQuestionnaireContext} but for a specific assessment instance (e.g. completed Basic/Pro
 * when filling gaps before FitPrint / Health Span Index).
 * @param {number} assessmentInstanceId
 * @param {{ question?: 'all' | 'answered' | 'unanswered' }} [options]
 *   When `question` is `unanswered` (Health Span remaining questions), also loads answered drafts
 *   into `responsesByCategoryId` / `contextQuestionsByCategoryId` so visibility rules still resolve.
 */
export const loadQuestionnaireContextForAssessmentInstance = async (
  assessmentInstanceId,
  { question = 'all' } = {},
) => {
  const id = Number(assessmentInstanceId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid assessment instance id.');
  }

  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const assessment = assessments.find((row) => getAssessmentInstanceId(row) === id) || {
    assessment_instance_id: id,
    assessment_id: id,
    id,
  };

  const statusPayload = await getAssessmentStatus(id);
  const rawCategories = extractCategoriesFromAssessmentStatus(statusPayload);
  const categoriesWithRoute = rawCategories
    .map((category) => {
      const normalizedCategory = {
        ...category,
        category_id: Number(category?.category_id || category?.id || 0),
        category_key: category?.category_key || category?.key || '',
        display_name: category?.display_name || category?.name || category?.category_name || '',
        assessment_instance_id: Number(category?.assessment_instance_id || category?.assessment_id || id),
      };

      return {
        ...normalizedCategory,
        routeId: mapCategoryToRouteId(normalizedCategory),
        status: normalizeCategoryStatus(category?.status || category?.category_status),
      };
    })
    .filter((category) => Number(category?.category_id || 0) > 0);

  const categories = sortCategories(categoriesWithRoute);
  const questionFilter = String(question || 'all').trim().toLowerCase();
  const loadUnansweredWithContext = questionFilter === 'unanswered';

  const questionEntries = await Promise.all(
    categories.map(async (category) => {
      const categoryAssessmentInstanceId = Number(category?.assessment_instance_id || id);
      const categoryId = category.category_id;

      if (loadUnansweredWithContext) {
        const [unansweredPayload, answeredPayload] = await Promise.all([
          getCategoryQuestionnaire(categoryAssessmentInstanceId, categoryId, {
            question: 'unanswered',
          }),
          getCategoryQuestionnaire(categoryAssessmentInstanceId, categoryId, {
            question: 'answered',
          }),
        ]);
        const unansweredQuestions = extractQuestionsFromCategoryPayload(unansweredPayload);
        const answeredQuestions = extractQuestionsFromCategoryPayload(answeredPayload);
        const responses = extractResponsesFromCategoryPayload(answeredPayload, answeredQuestions);
        const contextById = new Map();
        [...answeredQuestions, ...unansweredQuestions].forEach((q) => {
          const qid = Number(q?.question_id || q?.id || 0);
          if (qid > 0 && !contextById.has(qid)) {
            contextById.set(qid, q);
          }
        });
        return [String(categoryId), {
          questions: unansweredQuestions,
          responses,
          contextQuestions: Array.from(contextById.values()),
        }];
      }

      const questionnairePayload = await getCategoryQuestionnaire(
        categoryAssessmentInstanceId,
        categoryId,
        { question: questionFilter },
      );
      const questions = extractQuestionsFromCategoryPayload(questionnairePayload);
      const responses = extractResponsesFromCategoryPayload(questionnairePayload, questions);
      return [String(categoryId), { questions, responses, contextQuestions: questions }];
    })
  );

  const questionsByCategoryId = {};
  const responsesByCategoryId = {};
  const contextQuestionsByCategoryId = {};

  for (const [categoryId, entry] of questionEntries) {
    questionsByCategoryId[categoryId] = entry.questions;
    responsesByCategoryId[categoryId] = entry.responses;
    contextQuestionsByCategoryId[categoryId] = entry.contextQuestions || entry.questions;
  }

  return {
    assessments,
    assessment,
    categories,
    questionsByCategoryId,
    responsesByCategoryId,
    contextQuestionsByCategoryId,
    questionFilter: questionFilter,
  };
};

/** Session marker: full health questionnaire POST submit succeeded (scoped to Basic/Pro instance when known). */
export const HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY = 'ss_health_questionnaire_submitted';

const parseHealthQuestionnaireSubmittedMarker = () => {
  try {
    const raw = sessionStorage.getItem(HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY);
    if (!raw || raw === '1') {
      return raw === '1' ? { legacy: true } : null;
    }
    const parsed = JSON.parse(raw);
    const basicProAssessmentId = Number(parsed?.basicProAssessmentId);
    if (!Number.isFinite(basicProAssessmentId) || basicProAssessmentId <= 0) {
      return null;
    }
    return {
      engagementId: Number(parsed?.engagementId) || 0,
      basicProAssessmentId,
    };
  } catch {
    return null;
  }
};

const pickLatestBasicOrProAssessmentRow = (assessments) => {
  const rows = (Array.isArray(assessments) ? assessments : [])
    .filter((row) => getPackagePriorityTier(row) >= 2);
  if (rows.length === 0) {
    return null;
  }
  return [...rows].sort((a, b) => {
    const byAssigned = toTimestamp(b?.assigned_at) - toTimestamp(a?.assigned_at);
    if (byAssigned !== 0) {
      return byAssigned;
    }
    return getAssessmentInstanceId(b) - getAssessmentInstanceId(a);
  })[0];
};

const isCategoryStatusFinalized = (status) => {
  const normalized = normalizeCategoryStatus(status);
  return normalized === 'complete' || normalized === 'completed' || normalized === 'submitted';
};

/**
 * True when FitPrint Full fitness-parameters was actually pushed.
 *
 * Do not use SuperShyft category completeness. Draft answers live on Basic/Pro;
 * POST /assessments/{fitprintId}/submit merges engagement responses for the
 * Metsights push, then is_category_complete() only looks at the FitPrint
 * instance — so fitness-parameters often stays `incomplete` after a successful
 * submit. A stale anthropometry `complete` on FitPrint also must not count.
 */
export const isFitprintAssessmentSubmitConfirmed = async (
  fitprintAssessmentInstanceId,
  { instanceStatus } = {},
) => {
  const id = Number(fitprintAssessmentInstanceId);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }

  if (isFitprintFitnessParametersSubmittedLocally(id)) {
    return true;
  }

  const instanceNormalized = normalizeCategoryStatus(instanceStatus);
  if (instanceNormalized === 'completed' || instanceNormalized === 'complete') {
    return true;
  }

  try {
    const metsightsStatus = await getAssessmentStatus(id, { categoryOf: 'metsights' });
    const metsightsCategories = extractCategoriesFromAssessmentStatus(metsightsStatus)
      .map((category) => ({
        category_key: String(category?.category_key || category?.key || '').trim().toLowerCase(),
        status: normalizeCategoryStatus(category?.status || category?.category_status),
      }));

    const fitnessCategory = metsightsCategories.find((category) => (
      category.category_key === 'fitness-parameters'
      || category.category_key.includes('fitness')
    ));
    return Boolean(fitnessCategory && isCategoryStatusFinalized(fitnessCategory.status));
  } catch {
    return false;
  }
};

const normalizeQuestionnaireCategoriesFromStatus = (statusPayload, fallbackAssessmentInstanceId) => {
  const fallbackId = Number(fallbackAssessmentInstanceId);
  return sortCategories(
    extractCategoriesFromAssessmentStatus(statusPayload)
      .map((category) => {
        const normalizedCategory = {
          category_id: Number(category?.category_id || category?.id || 0),
          category_key: category?.category_key || category?.key || '',
          display_name: category?.display_name || category?.name || category?.category_name || '',
          assessment_instance_id: Number(
            category?.assessment_instance_id || category?.assessment_id || fallbackId,
          ),
        };
        return {
          ...normalizedCategory,
          routeId: mapCategoryToRouteId(normalizedCategory),
          status: normalizeCategoryStatus(category?.status || category?.category_status),
        };
      })
      .filter((category) => (
        category.category_id > 0
        && category.routeId
        && routeOrder.includes(category.routeId)
      )),
  );
};

/** True when every questionnaire category is finalized on GET /assessments/{id}/status. */
const isQuestionnaireFinalizedFromStatusApi = async (assessmentInstanceId) => {
  const id = Number(assessmentInstanceId);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }

  try {
    const statusPayload = await getAssessmentStatus(id, { categoryOf: 'supershyft' });
    const questionnaireCategories = normalizeQuestionnaireCategoriesFromStatus(statusPayload, id);
    if (questionnaireCategories.length === 0) {
      return false;
    }
    return questionnaireCategories.every((category) => isCategoryStatusFinalized(category.status));
  } catch {
    return false;
  }
};

/**
 * B2B questionnaire CTAs: true when any non-Vitals section is still incomplete.
 * Vitals-only incomplete does not count. Fail closed (false) on empty/error.
 */
export const hasIncompleteNonVitalsQuestionnaireSection = async (assessmentInstanceId) => {
  const id = Number(assessmentInstanceId);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }

  try {
    const statusPayload = await getAssessmentStatus(id, { categoryOf: 'supershyft' });
    const questionnaireCategories = normalizeQuestionnaireCategoriesFromStatus(statusPayload, id);
    if (questionnaireCategories.length === 0) {
      return false;
    }
    return questionnaireCategories.some((category) => (
      category.routeId !== 'vitals'
      && !isCategoryStatusFinalized(category.status)
    ));
  } catch {
    return false;
  }
};

const matchesSubmittedSessionMarker = (basicProId, scopedEngagementId = 0) => {
  const marker = parseHealthQuestionnaireSubmittedMarker();
  if (!marker) {
    return false;
  }
  if (marker.legacy) {
    return true;
  }
  if (marker.basicProAssessmentId !== basicProId) {
    return false;
  }
  const engagementId = Number(scopedEngagementId);
  if (engagementId > 0 && marker.engagementId > 0 && marker.engagementId !== engagementId) {
    return false;
  }
  return true;
};

const resolveBasicProAssessmentIdForSubmitCheck = (assessments, scopedEngagementId = 0) => {
  const engagementId = Number(scopedEngagementId);
  const fromRows = resolveMetsightsSubmitInstanceIdsFromRows(assessments);

  if (engagementId > 0) {
    if (
      fromRows.metsightsProAssessmentId
      && (!fromRows.engagementId || Number(fromRows.engagementId) === engagementId)
    ) {
      return fromRows.metsightsProAssessmentId;
    }
    const scopedRows = assessments.filter((row) => {
      const rowEngagementId = Number(
        row?.engagement_id
        || row?.engagementId
        || row?.engagement?.engagement_id
        || row?.engagement?.id
        || 0,
      );
      return rowEngagementId === engagementId;
    });
    return getAssessmentInstanceId(pickLatestBasicOrProAssessmentRow(scopedRows));
  }

  if (fromRows.metsightsProAssessmentId) {
    return fromRows.metsightsProAssessmentId;
  }

  const activeIncomplete = pickLatestIncompleteActiveAssessment(assessments);
  if (activeIncomplete && getPackagePriorityTier(activeIncomplete) >= 2) {
    return getAssessmentInstanceId(activeIncomplete);
  }

  return getAssessmentInstanceId(pickLatestBasicOrProAssessmentRow(assessments));
};

/** Sync read after POST submit — avoids camp CTA flash while /assessments/me catches up. */
export const peekHealthQuestionnaireSubmittedForEngagement = (engagementId = null) => {
  const scopedEngagementId = Number(engagementId || 0);
  const marker = parseHealthQuestionnaireSubmittedMarker();
  if (!marker) {
    return false;
  }
  if (marker.legacy) {
    return true;
  }
  if (scopedEngagementId > 0 && marker.engagementId > 0 && marker.engagementId !== scopedEngagementId) {
    return false;
  }
  return marker.basicProAssessmentId > 0;
};

export function markHealthQuestionnaireSubmitted({ engagementId = null, basicProAssessmentId = null } = {}) {
  try {
    const id = Number(basicProAssessmentId);
    const eng = Number(engagementId);
    if (Number.isFinite(id) && id > 0) {
      sessionStorage.setItem(
        HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY,
        JSON.stringify({
          basicProAssessmentId: id,
          engagementId: Number.isFinite(eng) && eng > 0 ? eng : 0,
        }),
      );
    } else {
      sessionStorage.setItem(HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY, '1');
    }
    invalidateHealthQuestionnaireSubmittedCache();
  } catch {
    // private mode / disabled storage
  }
}

export function clearHealthQuestionnaireSubmittedFlag() {
  try {
    sessionStorage.removeItem(HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY);
    invalidateHealthQuestionnaireSubmittedCache();
  } catch {
    // ignore
  }
}

/** Drop the old unscoped session marker (`"1"`) so a new booking is not treated as already submitted. */
export function clearLegacyHealthQuestionnaireSubmittedMarker() {
  try {
    const raw = sessionStorage.getItem(HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY);
    if (raw === '1') {
      sessionStorage.removeItem(HEALTH_QUESTIONNAIRE_SUBMITTED_SESSION_KEY);
      invalidateHealthQuestionnaireSubmittedCache();
    }
  } catch {
    // ignore
  }
}

/**
 * Finalized health questionnaire on this engagement via GET /assessments/{id}/status.
 */
export const hasFinalizedHealthQuestionnaireForEngagement = async (engagementId) => (
  hasSubmittedHealthQuestionnaire({ forceRefresh: true, engagementId })
);

const HEALTH_SUBMITTED_CACHE_TTL_MS = 90_000;
let healthSubmittedCache = { expiresAt: 0, value: null };
let healthSubmittedInFlight = null;

export const peekHealthQuestionnaireSubmittedCache = () => {
  if (Date.now() < healthSubmittedCache.expiresAt) {
    return healthSubmittedCache.value;
  }
  return null;
};

export const invalidateHealthQuestionnaireSubmittedCache = () => {
  healthSubmittedCache = { expiresAt: 0, value: null };
  healthSubmittedInFlight = null;
};

async function fetchHasSubmittedHealthQuestionnaireUncached(options = {}) {
  const scopedEngagementId = Number(options.engagementId || 0);
  const assessmentsPayload = await listMyAssessments(1, 50);
  const assessments = extractAssessmentsFromListPayload(assessmentsPayload);
  const assessmentInstanceId = resolveBasicProAssessmentIdForSubmitCheck(
    assessments,
    scopedEngagementId,
  );

  if (assessmentInstanceId <= 0) {
    return false;
  }

  const fromStatus = await isQuestionnaireFinalizedFromStatusApi(assessmentInstanceId);
  if (fromStatus) {
    return true;
  }

  return matchesSubmittedSessionMarker(assessmentInstanceId, scopedEngagementId);
}

/**
 * True when the user has finalized the health questionnaire:
 * GET /assessments/{latest_pro_id}/status?category_of=supershyft shows every category complete.
 */
export const hasSubmittedHealthQuestionnaire = async (options = {}) => {
  const { forceRefresh = false, engagementId = null } = options;
  const scopedEngagementId = Number(engagementId || 0);
  const useGlobalCache = !forceRefresh && scopedEngagementId <= 0;

  if (useGlobalCache && Date.now() < healthSubmittedCache.expiresAt) {
    return healthSubmittedCache.value;
  }

  if (!forceRefresh && scopedEngagementId <= 0 && healthSubmittedInFlight) {
    return healthSubmittedInFlight;
  }

  const promise = fetchHasSubmittedHealthQuestionnaireUncached({ engagementId: scopedEngagementId })
    .then((result) => {
      if (scopedEngagementId <= 0) {
        healthSubmittedCache = {
          expiresAt: Date.now() + HEALTH_SUBMITTED_CACHE_TTL_MS,
          value: result,
        };
      }
      return result;
    })
    .finally(() => {
      if (scopedEngagementId <= 0) {
        healthSubmittedInFlight = null;
      }
    });

  if (!forceRefresh && scopedEngagementId <= 0) {
    healthSubmittedInFlight = promise;
  }

  return promise;
};

/** Session flag: FitPrint-gap questionnaire was submitted; home shows “reports preparing” until HSI unlocks. */
export const FITPRINT_GAP_QUESTIONNAIRE_SUBMITTED_SESSION_KEY = 'ss_fitprint_gap_questionnaire_submitted';
/** FitPrint instance ids that successfully POSTed fitness-parameters (survives refresh). */
const FITPRINT_FITNESS_SUBMITTED_IDS_KEY = 'ss_fitprint_fitness_parameters_submitted_ids';

const readFitprintFitnessSubmittedIds = () => {
  try {
    const raw = localStorage.getItem(FITPRINT_FITNESS_SUBMITTED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(
      (Array.isArray(parsed) ? parsed : [])
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  } catch {
    return new Set();
  }
};

const writeFitprintFitnessSubmittedIds = (ids) => {
  try {
    localStorage.setItem(FITPRINT_FITNESS_SUBMITTED_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // private mode / disabled storage
  }
};

export function markFitprintGapQuestionnaireSubmitted(fitprintAssessmentId) {
  try {
    sessionStorage.setItem(FITPRINT_GAP_QUESTIONNAIRE_SUBMITTED_SESSION_KEY, '1');
  } catch {
    // private mode / disabled storage
  }
  const id = Number(fitprintAssessmentId);
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }
  const ids = readFitprintFitnessSubmittedIds();
  ids.add(id);
  writeFitprintFitnessSubmittedIds(ids);
}

export function clearFitprintGapQuestionnaireSubmittedFlag(fitprintAssessmentId) {
  try {
    sessionStorage.removeItem(FITPRINT_GAP_QUESTIONNAIRE_SUBMITTED_SESSION_KEY);
  } catch {
    // ignore
  }
  const id = Number(fitprintAssessmentId);
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }
  const ids = readFitprintFitnessSubmittedIds();
  if (ids.delete(id)) {
    writeFitprintFitnessSubmittedIds(ids);
  }
}

export function isFitprintGapQuestionnaireSubmittedFlagSet() {
  try {
    return sessionStorage.getItem(FITPRINT_GAP_QUESTIONNAIRE_SUBMITTED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function isFitprintFitnessParametersSubmittedLocally(fitprintAssessmentId) {
  const id = Number(fitprintAssessmentId);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }
  return readFitprintFitnessSubmittedIds().has(id);
}
