import { peekMyAssessmentsRowsCached, resolveEngagementIdFromAssessmentId } from '../services/reportService';
import { getEngagementByCode, getEngagementConsultation } from '../services/engagementsService';
import { getMyUpcomingSlot } from '../services/usersService';
import { hasEnabledOfflineConsultationDates } from './campDoctorOfflineSchedule';

const extractAssessmentInstanceIdFromRow = (row) => {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const id = row.assessment_instance_id ?? row.assessment_id ?? row.id;
  const numericId = Number(id);
  return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
};

/** Blood-test / camp day from GET /users/me/upcoming-slot (`slot.engagement_date`). */
export const extractBloodTestDateFromUpcomingSlot = (root) => {
  if (!root || typeof root !== 'object') {
    return '';
  }

  const slots = Array.isArray(root.slots) ? root.slots : [];
  const first = slots[0] || {};
  const slot = first.slot && typeof first.slot === 'object' ? first.slot : {};
  const engagement = first.engagement && typeof first.engagement === 'object'
    ? first.engagement
    : {};

  return String(
    slot.engagement_date
    || slot.blood_collection_date
    || slot.blood_test_date
    || engagement.blood_collection_date
    || engagement.engagement_date
    || first.engagement_date
    || '',
  ).trim();
};

const parseYmdLocalDate = (raw) => {
  const ymd = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return null;
  }
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
};

/** True when blood-test day is strictly after local today. */
export const isBloodTestDateAfterToday = (rawDate) => {
  const bloodDate = parseYmdLocalDate(rawDate);
  if (!bloodDate) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bloodDate.getTime() > today.getTime();
};

export const resolveActiveEngagementIdFromAssessments = (rawRows) => {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (rows.length === 0) {
    return null;
  }

  const activeRow = rows.find((row) => String(row?.status || '').toLowerCase() === 'active') || rows[0];
  const assessmentInstanceId = extractAssessmentInstanceIdFromRow(activeRow);
  if (!assessmentInstanceId) {
    return null;
  }

  const engagementKey = resolveEngagementIdFromAssessmentId(rows, assessmentInstanceId);
  const engagementId = Number(engagementKey);
  return Number.isFinite(engagementId) && engagementId > 0 ? engagementId : null;
};

const asTruthyConsultationFlag = (value) => (
  value === true
  || value === 'true'
  || value === 'True'
  || value === 1
  || value === '1'
);

/** Expert types offered on the engagement (`consultations.doctor`, `.nutritionist`, etc.). */
export const getOfferedConsultationTypes = (consultation) => {
  const map = consultation?.consultations;
  if (!map || typeof map !== 'object') {
    return [];
  }

  return Object.entries(map)
    .filter(([, value]) => asTruthyConsultationFlag(value))
    .map(([key]) => String(key).toLowerCase());
};

/**
 * True when any offered consultation type still needs a date/slot.
 * Empty my_consultations, or a missing entry for an offered type, counts as unfilled.
 */
export const isConsultationScheduleUnfilled = (consultation) => {
  const offeredTypes = getOfferedConsultationTypes(consultation);
  if (offeredTypes.length === 0) {
    return false;
  }

  const myConsultations = Array.isArray(consultation?.my_consultations)
    ? consultation.my_consultations
    : [];

  if (myConsultations.length === 0) {
    return true;
  }

  return offeredTypes.some((type) => {
    const entries = myConsultations.filter(
      (item) => String(item?.expert_type || '').toLowerCase() === type,
    );
    if (entries.length === 0) {
      return true;
    }
    return entries.some((item) => item?.date == null || item?.slot == null);
  });
};

/** True when a specific offered consultation type still needs a date/slot. */
export const isConsultationTypeUnfilled = (consultation, type) => {
  const normalizedType = String(type || '').toLowerCase();
  if (!normalizedType) {
    return false;
  }

  const myConsultations = Array.isArray(consultation?.my_consultations)
    ? consultation.my_consultations
    : [];

  const entries = myConsultations.filter(
    (item) => String(item?.expert_type || '').toLowerCase() === normalizedType,
  );

  if (entries.length === 0) {
    return true;
  }

  return entries.some((item) => item?.date == null || item?.slot == null);
};

/** First offered consultation type that still needs booking (doctor, nutritionist, etc.). */
export const resolveFirstUnfilledConsultationType = (consultation) => {
  const offeredTypes = getOfferedConsultationTypes(consultation);
  const unfilledType = offeredTypes.find((type) => isConsultationTypeUnfilled(consultation, type));
  return unfilledType || offeredTypes[0] || 'doctor';
};

/** @deprecated Use isConsultationScheduleUnfilled — kept for existing imports. */
export const isDoctorConsultationScheduleUnfilled = isConsultationScheduleUnfilled;

/**
 * Complimentary popup is only for engagements that are actively running.
 * Any other engagement_status hides the popup for that engagement.
 */
export const resolveEngagementStatus = (consultation, assessmentRows = [], engagementId = null) => {
  const fromConsultation = String(
    consultation?.engagement_status
    || consultation?.engagementStatus
    || consultation?.engagement?.engagement_status
    || consultation?.engagement?.status
    || '',
  ).trim().toLowerCase();
  if (fromConsultation) {
    return fromConsultation;
  }

  const targetId = Number(engagementId || consultation?.engagement_id);
  const rows = Array.isArray(assessmentRows) ? assessmentRows : [];
  const match = rows.find((row) => {
    const rowEngagementId = Number(
      row?.engagement_id
      ?? row?.engagementId
      ?? row?.engagement?.engagement_id
      ?? row?.engagement?.id,
    );
    return Number.isFinite(targetId) && targetId > 0 && rowEngagementId === targetId;
  }) || rows.find((row) => String(row?.status || '').toLowerCase() === 'active') || rows[0];

  return String(
    match?.engagement_status
    || match?.engagementStatus
    || match?.engagement?.engagement_status
    || match?.engagement?.status
    || '',
  ).trim().toLowerCase();
};

export const isEngagementRunningForComplimentaryPopup = (consultation, assessmentRows = [], engagementId = null) => (
  resolveEngagementStatus(consultation, assessmentRows, engagementId) === 'running'
);

/**
 * Show home consultation popup when any consultations.* flag is true
 * and that offered type is still unfilled (not doctor-only).
 *
 * Requires engagement_status === "running". Any other status hides the popup.
 *
 * Offline mode also requires GET /engagements/code/{code}:
 * - consultation.is_enable (master)
 * - at least one YYYY-MM-DD.is_enable date turned on
 */
export const shouldShowDoctorConsultationPopup = (
  consultation,
  {
    bloodTestDate,
    offlineScheduleEnabled = true,
    assessmentRows = [],
    engagementId = null,
  } = {},
) => {
  if (isBloodTestDateAfterToday(bloodTestDate)) {
    return false;
  }

  if (!consultation || typeof consultation !== 'object') {
    return false;
  }

  if (!isEngagementRunningForComplimentaryPopup(consultation, assessmentRows, engagementId)) {
    return false;
  }

  if (getOfferedConsultationTypes(consultation).length === 0) {
    return false;
  }

  if (!isConsultationScheduleUnfilled(consultation)) {
    return false;
  }

  const mode = String(consultation?.consultation_mode || '').trim().toLowerCase();
  if (mode === 'offline' && !offlineScheduleEnabled) {
    return false;
  }

  return true;
};

export const fetchDoctorConsultationPopupEligibility = async ({ ttlMs = 45000 } = {}) => {
  const empty = {
    shouldShow: false,
    engagementId: null,
    consultation: null,
    engagementCode: null,
    consultationMode: null,
    expertType: null,
  };

  const rows = await peekMyAssessmentsRowsCached(ttlMs).catch(() => []);
  const engagementId = resolveActiveEngagementIdFromAssessments(rows);

  if (!engagementId) {
    return empty;
  }

  const [consultation, upcomingSlot] = await Promise.all([
    getEngagementConsultation(engagementId),
    getMyUpcomingSlot().catch(() => null),
  ]);
  const bloodTestDate = extractBloodTestDateFromUpcomingSlot(upcomingSlot);
  const engagementCode = consultation?.engagement_code || null;
  const consultationMode = String(consultation?.consultation_mode || '').trim().toLowerCase() || null;

  let offlineScheduleEnabled = true;
  if (consultationMode === 'offline') {
    if (!engagementCode) {
      offlineScheduleEnabled = false;
    } else {
      try {
        const engagementDetails = await getEngagementByCode(engagementCode);
        offlineScheduleEnabled = hasEnabledOfflineConsultationDates(engagementDetails);
      } catch (_error) {
        offlineScheduleEnabled = false;
      }
    }
  }

  return {
    shouldShow: shouldShowDoctorConsultationPopup(consultation, {
      bloodTestDate,
      offlineScheduleEnabled,
      assessmentRows: rows,
      engagementId,
    }),
    engagementId,
    consultation,
    engagementCode,
    consultationMode: consultation?.consultation_mode || null,
    engagementStatus: resolveEngagementStatus(consultation, rows, engagementId) || null,
    expertType: resolveFirstUnfilledConsultationType(consultation),
  };
};

const CONSULTATION_POPUP_OPT_OUT_KEY = 'campDoctorConsultationOptOutByUser';

const readConsultationPopupOptOutMap = () => {
  try {
    const raw = window.localStorage.getItem(CONSULTATION_POPUP_OPT_OUT_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const optOutStorageKey = (userId, engagementId) => {
  const user = Number(userId);
  const engagement = Number(engagementId);
  if (!Number.isFinite(user) || user <= 0 || !Number.isFinite(engagement) || engagement <= 0) {
    return null;
  }
  return `${user}:${engagement}`;
};

/** True when this user opted out of the consultation popup for this engagement. */
export const hasOptedOutOfConsultationPopup = (userId, engagementId) => {
  const key = optOutStorageKey(userId, engagementId);
  if (!key) {
    return false;
  }
  const map = readConsultationPopupOptOutMap();
  return Boolean(map[key]);
};

/** Persist opt-out so the popup does not show again for this user + engagement. */
export const optOutOfConsultationPopup = (userId, engagementId) => {
  const key = optOutStorageKey(userId, engagementId);
  if (!key) {
    return false;
  }
  const map = readConsultationPopupOptOutMap();
  map[key] = true;
  try {
    window.localStorage.setItem(CONSULTATION_POPUP_OPT_OUT_KEY, JSON.stringify(map));
    return true;
  } catch (_error) {
    return false;
  }
};
