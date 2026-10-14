import {
  getEngagementConsultation,
  resolveConsultationIdForExpertType,
  submitEngagementConsultationConsent,
} from './engagementsService';
import { peekMyAssessmentsRowsCached } from './reportService';
import { resolveActiveEngagementIdFromAssessments } from '../utils/campDoctorConsultationEligibility';
import { authorizedRequest } from './apiClient';

/**
 * Single expert profile.
 * GET /experts/{expert_id}
 */
export const getExpertById = async (expertId) => {
  const id = Number(expertId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid expert id.');
  }

  const parsedBody = await authorizedRequest(`/experts/${id}`, {
    method: 'GET',
  });

  // API shape: { data: { expert_id, name, profile_photo, ... }, meta: {} }
  const payload = parsedBody && typeof parsedBody === 'object' ? parsedBody : null;
  let data = payload;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const inner = payload.data;
    data = Array.isArray(inner) ? inner[0] : inner;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid expert response.');
  }
  if (!String(data.name || '').trim() && !data.expert_id) {
    throw new Error('Expert profile is missing required fields.');
  }
  return data;
};

/**
 * Super Care expert directory.
 * GET /experts
 */
export const getExperts = async () => {
  const limit = 50;
  const first = await authorizedRequest('/experts', {
    method: 'GET',
    query: { page: 1, limit },
  });
  const data = Array.isArray(first?.data) ? [...first.data] : [];
  const total = Number(first?.meta?.total);
  const pageSize = Number(first?.meta?.limit) || limit;

  if (Number.isFinite(total) && data.length < total) {
    const pages = Math.min(Math.ceil(total / pageSize), 10);
    for (let page = 2; page <= pages; page += 1) {
      const next = await authorizedRequest('/experts', {
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

/**
 * Available consultation slots for online bookings.
 * GET /experts/consultations/slots?expert_type=doctor&expert_id=4
 */
export const getExpertConsultationSlots = async (expertType = 'doctor', options = {}) => {
  const type = String(expertType || '').trim();
  if (!type) {
    throw new Error('Expert type is required.');
  }

  const expertId = options?.expertId ?? options?.expert_id;
  const query = { expert_type: type };
  if (expertId !== undefined && expertId !== null && String(expertId).trim() !== '') {
    query.expert_id = expertId;
  }

  const parsedBody = await authorizedRequest('/experts/consultations/slots', {
    method: 'GET',
    query,
  });

  return parsedBody?.data ?? parsedBody;
};

/**
 * Book an expert consultation slot.
 * POST /experts/consultations/book
 */
export const bookExpertConsultation = async ({
  engagementId,
  expertType = 'doctor',
  date,
  cabin,
  slot,
}) => {
  const engagement = Number(engagementId);
  if (!Number.isFinite(engagement) || engagement <= 0) {
    throw new Error('Invalid engagement id.');
  }

  const bookingDate = String(date || '').trim();
  const cabinKey = String(cabin || '').trim();
  const bookingSlot = String(slot || '').trim();
  const type = String(expertType || '').trim();

  if (!bookingDate) {
    throw new Error('Consultation date is required.');
  }
  if (!bookingSlot) {
    throw new Error('Consultation slot is required.');
  }
  if (!type) {
    throw new Error('Expert type is required.');
  }

  const payload = {
    engagement_id: engagement,
    expert_type: type,
    date: bookingDate,
    slot: bookingSlot,
  };

  if (cabinKey) {
    payload.cabin = cabinKey;
  }

  const parsedBody = await authorizedRequest('/experts/consultations/book', {
    method: 'POST',
    payload,
  });

  return parsedBody?.data ?? parsedBody;
};

/**
 * Reschedule a booked consultation.
 * POST /experts/consultations/reschedule
 */
export const rescheduleExpertConsultation = async ({
  engagementId,
  expertType = 'doctor',
  date,
  slot,
  cabin = null,
}) => {
  const engagement = Number(engagementId);
  if (!Number.isFinite(engagement) || engagement <= 0) {
    throw new Error('Invalid engagement id.');
  }

  const type = String(expertType || '').trim();
  const consultationDate = String(date || '').trim();
  const slotMatch = String(slot || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  const consultationSlot = slotMatch
    ? `${String(Number(slotMatch[1])).padStart(2, '0')}:${slotMatch[2]}`
    : '';

  if (!type) {
    throw new Error('Expert type is required.');
  }
  if (!consultationDate) {
    throw new Error('Consultation date is required.');
  }
  if (!consultationSlot) {
    throw new Error('Consultation slot is required.');
  }

  const cabinValue = cabin === undefined || cabin === null || String(cabin).trim() === ''
    ? null
    : String(cabin).trim();

  const parsedBody = await authorizedRequest('/experts/consultations/reschedule', {
    method: 'POST',
    payload: {
      engagement_id: engagement,
      expert_type: type,
      consultation_date: consultationDate,
      consultation_slot: consultationSlot,
      consultation_cabin: cabinValue,
    },
  });

  return parsedBody?.data ?? parsedBody;
};

const resolveEngagementIdForConsent = async (engagementId) => {
  const direct = Number(engagementId);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const rows = await peekMyAssessmentsRowsCached(45000);
  return resolveActiveEngagementIdFromAssessments(rows);
};

/**
 * Record health-data sharing consent for a booked consultation.
 * Resolves engagement_id from /assessments/me when omitted, consultation_id from
 * GET /engagements/{engagement_id}/consultation → my_consultations[].
 */
export const submitConsultationHealthDataConsent = async ({
  engagementId,
  expertType = 'doctor',
  consentGranted = false,
}) => {
  const engagement = await resolveEngagementIdForConsent(engagementId);
  if (!Number.isFinite(engagement) || engagement <= 0) {
    throw new Error('Unable to resolve engagement id.');
  }

  const type = String(expertType || '').trim();
  if (!type) {
    throw new Error('Expert type is required.');
  }

  const consultationData = await getEngagementConsultation(engagement);
  const consultationId = resolveConsultationIdForExpertType(consultationData, type);
  if (!consultationId) {
    throw new Error('Unable to resolve consultation id.');
  }

  const granted = Boolean(consentGranted);

  return submitEngagementConsultationConsent({
    engagementId: engagement,
    consultationId,
    bioAi: granted,
    bloodReport: granted,
    questionnaire: granted,
  });
};
