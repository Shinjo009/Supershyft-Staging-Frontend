/**
 * Packages booking APIs.
 * POST /book/pay — create Razorpay order for draft engagements
 * POST /book/bio-ai — verify payment + finalize Healthians booking
 */

import { authorizedRequest } from './apiClient';

const BOOK_PAY_PATH =
  process.env.REACT_APP_BOOK_PAY_PATH || '/book/pay';
const BOOK_BIO_AI_PATH =
  process.env.REACT_APP_BOOK_BIO_AI_PATH || '/book/bio-ai';
const GEOCODE_SEARCH_PATH =
  process.env.REACT_APP_GEOCODE_SEARCH_PATH || '/geocode/search';
const CHECK_SERVICE_AVAILABILITY_PATH =
  process.env.REACT_APP_CHECK_SERVICE_AVAILABILITY_PATH || '/book/check-service-availability';
const AVAILABLE_SLOTS_PATH =
  process.env.REACT_APP_AVAILABLE_SLOTS_PATH || '/book/available-slots';
const LOCK_SLOTS_PATH =
  process.env.REACT_APP_LOCK_SLOTS_PATH || '/book/lock';

export const AREA_NOT_SERVICEABLE_MESSAGE = 'This area is not yet serviceable.';

/**
 * Convert UI slot like "06:00 AM" to API format "6:00" (24h, minutes zero-padded).
 */
export const formatBloodCollectionTimeSlot = (selectedTimeSlot) => {
  if (!selectedTimeSlot || typeof selectedTimeSlot !== 'string') {
    return '';
  }
  const trimmed = selectedTimeSlot.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return '';
  }
  const meridiem = String(parts[parts.length - 1] || '').toUpperCase();
  const timeValue = parts.slice(0, -1).join(' ');
  const [hourText, minuteRaw = '0'] = timeValue.split(':');
  let hour24 = Number(hourText);
  const minutes = Number(String(minuteRaw).replace(/\D/g, '') || '0');
  if (!Number.isFinite(hour24) || !Number.isFinite(minutes)) {
    return '';
  }
  if (meridiem === 'PM' && hour24 !== 12) {
    hour24 += 12;
  }
  if (meridiem === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  return `${hour24}:${String(minutes).padStart(2, '0')}`;
};

const assertBookPayMember = (member, index) => {
  const label = `Member ${index + 1}`;
  if (!Number.isInteger(member.user_id) || member.user_id <= 0) {
    throw new Error(`${label}: missing or invalid user_id for booking.`);
  }
  if (!Number.isInteger(member.engagement_id) || member.engagement_id <= 0) {
    throw new Error(`${label}: missing or invalid engagement_id for booking.`);
  }
};

/**
 * Build POST /book/pay body from overlay selection.
 *
 * @param {object} params
 * @param {Array} params.selectedPatients
 * @param {(patient: object) => number|null} params.getNumericPatientUserId
 * @param {Record<number, object>} params.serviceAvailabilityByUserId
 */
export const buildBookPayPayload = ({
  selectedPatients,
  getNumericPatientUserId,
  serviceAvailabilityByUserId,
  discountCode,
}) => {
  if (!Array.isArray(selectedPatients) || selectedPatients.length === 0) {
    throw new Error('Select at least one member to book.');
  }

  const members = selectedPatients.map((patient) => {
    const user_id = getNumericPatientUserId(patient);
    const engagement_id = Number(serviceAvailabilityByUserId?.[user_id]?.engagement_id);

    return {
      user_id,
      engagement_id,
    };
  });

  members.forEach(assertBookPayMember);

  const payload = { members };
  const code = String(discountCode || '').trim();
  if (code) {
    payload.discount_code = code;
  }
  return payload;
};

/** @deprecated Use buildBookPayPayload */
export const buildBookBioAiPayload = buildBookPayPayload;

/**
 * Normalize POST /book/pay response for Razorpay Checkout.
 *
 * @param {unknown} response
 * @returns {{ orderId: string, amount: number, currency: string, keyId?: string, bookingIds: Array, bookingId?: string }}
 */
export const normalizeBookPayOrder = (response) => {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid /book/pay response from server.');
  }

  const orderId = data.razorpay_order_id || data.orderId || data.id;
  if (!orderId) {
    throw new Error('/book/pay response is missing razorpay order id.');
  }

  const amountPaise = Number(data.amount_paise ?? data.amount ?? data.amountPaise);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error('/book/pay response is missing amount in paise.');
  }

  const bookingIds = Array.isArray(data.booking_ids)
    ? data.booking_ids
    : (data.booking_id ? [data.booking_id] : []);

  return {
    orderId: String(orderId),
    amount: amountPaise,
    currency: data.currency || 'INR',
    keyId: data.key_id || data.keyId,
    bookingIds,
    bookingId: data.booking_id || bookingIds[0],
    members: Array.isArray(data.members) ? data.members : [],
    raw: data,
  };
};

/**
 * POST /book/pay — create Razorpay order for locked draft engagements.
 *
 * @param {{ members: Array<{ user_id: number, engagement_id: number }> }} payload
 */
export async function createBookPayOrder(payload) {
  const response = await authorizedRequest(BOOK_PAY_PATH, {
    method: 'POST',
    payload,
    missingAuthMessage: 'Please log in to complete payment.',
  });
  return normalizeBookPayOrder(response);
}

/**
 * POST /book/consultation/pay — create a Razorpay order for a Super Care consult.
 *
 * @param {{ members: Array<{ user_id: number, expert_type: string, expert_id: number, date: string, slot: string }> }} payload
 */
export async function createConsultationPayOrder(payload) {
  const response = await authorizedRequest('/book/consultation/pay', {
    method: 'POST',
    payload,
    missingAuthMessage: 'Please log in to complete payment.',
  });
  return normalizeBookPayOrder(response);
}

/**
 * POST /book/consultation — verify Razorpay payment and schedule the consult.
 *
 * @param {{ razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string }} payload
 */
export async function confirmConsultationBooking(payload) {
  const razorpay_payment_id = String(payload?.razorpay_payment_id || '').trim();
  const razorpay_order_id = String(payload?.razorpay_order_id || '').trim();
  const razorpay_signature = String(payload?.razorpay_signature || '').trim();
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new Error('Payment confirmation is missing Razorpay details.');
  }

  const response = await authorizedRequest('/book/consultation', {
    method: 'POST',
    payload: {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    },
    missingAuthMessage: 'Please log in to complete payment.',
  });
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid consultation booking response.');
  }
  if (data.payment_verified === false) {
    throw new Error('Payment could not be verified.');
  }
  const members = Array.isArray(data.members) ? data.members : [];
  const failed = members.find((member) => String(member?.status || '').toLowerCase() !== 'success');
  if (failed) {
    throw new Error(failed.message || 'Consultation could not be scheduled.');
  }
  return data;
}

/**
 * POST /discounts/validate — check a promo code against the current cart.
 *
 * @param {{ code: string, items: Array<object>, city?: string }} payload
 */
export async function validateDiscountCode({ code, items, city }) {
  const response = await authorizedRequest('/discounts/validate', {
    method: 'POST',
    payload: {
      code: String(code || '').trim(),
      items,
      context: {
        city: String(city || '').trim() || null,
      },
    },
    missingAuthMessage: 'Please log in to apply a promo code.',
  });
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return data;
}

/**
 * @param {unknown} response Parsed POST /book/bio-ai response
 * @returns {Array<object>} Per-member booking results
 */
export const extractBioAiBookingMembers = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data?.members)) {
    return data.members;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
};

/**
 * @param {Array<object>} members
 * @returns {string|null} Combined error message when any member failed
 */
export const getBioAiBookingFailureMessage = (members) => {
  if (!Array.isArray(members) || !members.length) {
    return 'Booking could not be confirmed. Please contact support.';
  }
  const failed = members.filter((member) => (
    String(member?.status || '').trim().toLowerCase() !== 'success'
  ));
  if (!failed.length) {
    return null;
  }
  return failed
    .map((member) => String(member?.message || 'Booking failed').trim())
    .filter(Boolean)
    .join(' ');
};

/**
 * @param {Array<object>} members
 * @returns {string|null} Healthians booking_id from the first successful member
 */
export const getPrimaryBioAiBookingId = (members) => {
  if (!Array.isArray(members)) {
    return null;
  }
  const success = members.find((member) => (
    String(member?.status || '').trim().toLowerCase() === 'success'
    && String(member?.booking_id || '').trim()
  ));
  if (success?.booking_id) {
    return String(success.booking_id).trim();
  }
  const withId = members.find((member) => String(member?.booking_id || '').trim());
  return withId ? String(withId.booking_id).trim() : null;
};

/**
 * POST /book/bio-ai — verify Razorpay payment and finalize Healthians bookings.
 *
 * @param {{ razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string }} payload
 * @returns {Promise<unknown>} Parsed JSON body from server
 */
export async function bookBioAiBatch(payload) {
  const razorpay_payment_id = String(payload?.razorpay_payment_id || '').trim();
  const razorpay_order_id = String(payload?.razorpay_order_id || '').trim();
  const razorpay_signature = String(payload?.razorpay_signature || '').trim();

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new Error('Payment confirmation details are missing.');
  }

  return authorizedRequest(BOOK_BIO_AI_PATH, {
    method: 'POST',
    payload: {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    },
    missingAuthMessage: 'Please log in to complete booking.',
  });
}

/**
 * Build the `q` query for GET /geocode/search (address lines, city, pincode — comma separated).
 */
export const buildGeocodeSearchQuery = (addressData) => {
  const line1 = String(addressData?.addressLine1 || addressData?.house || '').trim();
  const line2 = String(addressData?.addressLine2 || addressData?.area || '').trim();
  return [line1, line2, addressData?.city, addressData?.pincode]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};

const buildGeocodeSearchQueryVariants = (addressData) => {
  const full = buildGeocodeSearchQuery(addressData);
  const line2 = String(addressData?.addressLine2 || addressData?.area || '').trim();
  const areaCityPincode = [line2, addressData?.city, addressData?.pincode]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
  const areaCity = [line2, addressData?.city]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');

  return [full, areaCityPincode, areaCity].filter((query, index, queries) => (
    query && queries.indexOf(query) === index
  ));
};

const extractGeocodeRows = (response) => {
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  if (Array.isArray(response)) {
    return response;
  }
  return [];
};

/**
 * Resolve coordinates and normalized address fields via GET /geocode/search.
 *
 * @param {object} addressData — addressLine1, addressLine2, landmark, city, pincode
 * @returns {Promise<object>} First geocode match
 */
export async function searchGeocodeByAddress(addressData) {
  const queryVariants = buildGeocodeSearchQueryVariants(addressData);
  if (!queryVariants.length) {
    throw new Error('Enter address line 1, city, and pincode to continue.');
  }

  for (const q of queryVariants) {
    const response = await authorizedRequest(GEOCODE_SEARCH_PATH, {
      method: 'GET',
      query: { q, limit: 1 },
      missingAuthMessage: 'Please log in to continue booking.',
    });

    const rows = extractGeocodeRows(response);
    if (rows.length) {
      return rows[0];
    }
  }

  throw new Error(AREA_NOT_SERVICEABLE_MESSAGE);
}

/**
 * Merge form address with geocode result for downstream booking steps.
 */
export const buildResolvedAddressFromGeocode = (addressData, geocodeResult) => {
  const addressLine1 = String(addressData?.addressLine1 || addressData?.house || '').trim();
  const addressLine2 = String(addressData?.addressLine2 || addressData?.area || '').trim();
  const landmark = String(addressData?.landmark || '').trim();
  const pincode = String(addressData?.pincode || '').trim();
  const geocodeAddress = String(geocodeResult?.address || geocodeResult?.display_name || '').trim();
  const address = [addressLine1, addressLine2, geocodeAddress].filter(Boolean).join(', ') || geocodeAddress;

  return {
    addressLine1,
    addressLine2,
    landmark: landmark || String(geocodeResult?.landmark || '').trim(),
    city: String(geocodeResult?.city || addressData?.city || '').trim(),
    pincode: pincode || String(geocodeResult?.pincode || '').trim(),
    sub_locality: String(geocodeResult?.sub_locality || '').trim(),
    state: String(geocodeResult?.state || '').trim(),
    country: String(geocodeResult?.country || 'India').trim(),
    latitude: Number(geocodeResult?.latitude),
    longitude: Number(geocodeResult?.longitude),
    address,
    geocode: geocodeResult,
  };
};

const assertServiceAvailabilityMember = (member, index) => {
  const label = `Member ${index + 1}`;
  if (!Number.isInteger(member.user_id) || member.user_id <= 0) {
    throw new Error(`${label}: missing or invalid user_id for service check.`);
  }
  if (!Number.isInteger(member.diagnostic_package_id) || member.diagnostic_package_id <= 0) {
    throw new Error(`${label}: missing or invalid diagnostic package for service check.`);
  }
  if (!String(member.address_line || '').trim()) {
    throw new Error(`${label}: address line is required for service check.`);
  }
  if (!String(member.city || '').trim()) {
    throw new Error(`${label}: city is required for service check.`);
  }
  if (!String(member.pincode || '').trim()) {
    throw new Error(`${label}: pincode is required for service check.`);
  }
};

/**
 * Combine address lines for POST /book/check-service-availability `address_line`.
 */
export const buildBookingAddressLine = (addressData) => {
  const line1 = String(addressData?.addressLine1 || addressData?.house || '').trim();
  const line2 = String(addressData?.addressLine2 || addressData?.area || '').trim();
  return [line1, line2].filter(Boolean).join(', ');
};

/**
 * Build POST /book/check-service-availability body.
 * Maps Address Line 1 + Line 2 → `address_line`; landmark/city/pincode pass through.
 */
export const buildCheckServiceAvailabilityPayload = ({
  selectedPatients,
  addressData,
  getPackageForPatient,
  getNumericPatientUserId,
}) => {
  if (!Array.isArray(selectedPatients) || selectedPatients.length === 0) {
    throw new Error('Select at least one member to continue.');
  }

  const addressLine1 = String(addressData?.addressLine1 || addressData?.house || '').trim();
  const address_line = buildBookingAddressLine(addressData);
  const landmark = String(addressData?.landmark || '').trim();
  const city = String(addressData?.city || '').trim();
  const pincode = String(addressData?.pincode || '').trim();

  if (!addressLine1 || !city || !pincode) {
    throw new Error('Enter address line 1, city, and pincode to continue.');
  }

  const members = selectedPatients.map((patient) => {
    const user_id = getNumericPatientUserId(patient);
    const memberPackage = getPackageForPatient(patient.id);
    const diagnostic_package_id = Number(
      memberPackage?.apiData?.diagnostic_package_id
        ?? memberPackage?.apiData?.id
        ?? memberPackage?.id
        ?? 0,
    );

    return {
      user_id,
      address_line,
      landmark: landmark || null,
      city,
      pincode,
      diagnostic_package_id,
    };
  });

  members.forEach(assertServiceAvailabilityMember);
  return { members };
};

/**
 * @param {unknown} response Parsed API response body
 * @returns {Array<object>} Per-member availability results
 */
export const extractServiceAvailabilityMembers = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data?.members)) {
    return data.members;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
};

/**
 * @param {unknown} response Parsed API response body
 * @returns {boolean} True when every member has status "serviceable"
 */
export const isAreaServiceable = (response) => {
  const members = extractServiceAvailabilityMembers(response);
  if (!members.length) {
    return false;
  }
  return members.every((member) => (
    String(member?.status || '').trim().toLowerCase() === 'serviceable'
  ));
};

/**
 * @param {unknown} response Parsed API response body
 * @returns {boolean} True when the payload indicates service is not available
 */
export const isServiceAvailabilityDenied = (response) => !isAreaServiceable(response);

/**
 * @param {{ members: Array<object> }} payload
 * @returns {Promise<unknown>} Parsed JSON body from server
 */
export async function checkServiceAvailability(payload) {
  return authorizedRequest(CHECK_SERVICE_AVAILABILITY_PATH, {
    method: 'POST',
    payload,
    missingAuthMessage: 'Please log in to continue booking.',
  });
}

/**
 * @param {unknown} response Parsed service-availability API response
 * @returns {Record<number, object>} user_id → availability member (engagement_id, zone_id, …)
 */
export const mapServiceAvailabilityByUserId = (response) => {
  const members = extractServiceAvailabilityMembers(response);
  const byUserId = {};
  members.forEach((member) => {
    const userId = Number(member?.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      byUserId[userId] = member;
    }
  });
  return byUserId;
};

/**
 * Convert API slot_time like "06:00:00" to UI label "06:00 AM".
 */
export const formatApiSlotTimeToDisplay = (slotTime) => {
  const parts = String(slotTime || '').trim().split(':');
  const hour24 = Number(parts[0]);
  const minutes = String(parts[1] || '00').padStart(2, '0');
  if (!Number.isFinite(hour24)) {
    return '';
  }
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return `${String(hour12).padStart(2, '0')}:${minutes} ${meridiem}`;
};

/**
 * @param {unknown} response Parsed available-slots API response
 * @returns {Array<object>} Per-member slot results
 */
export const extractAvailableSlotsMembers = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data?.members)) {
    return data.members;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
};

/**
 * Normalize API slot rows for the schedule UI.
 */
export const normalizeAvailableSlotsForUi = (response) => {
  const members = extractAvailableSlotsMembers(response);
  const memberWithSlots = members.find((member) => Array.isArray(member?.slots) && member.slots.length > 0)
    || members[0];
  const slots = Array.isArray(memberWithSlots?.slots) ? memberWithSlots.slots : [];

  return slots
    .map((slot) => ({
      ...slot,
      stm_id: String(slot?.stm_id || ''),
      slot_time: String(slot?.slot_time || ''),
      end_time: String(slot?.end_time || ''),
      displayLabel: formatApiSlotTimeToDisplay(slot?.slot_time),
    }))
    .filter((slot) => slot.displayLabel);
};

export const chunkScheduleSlots = (slots, size = 3) => {
  const rows = [];
  for (let index = 0; index < slots.length; index += size) {
    rows.push(slots.slice(index, index + size));
  }
  return rows;
};

/**
 * Build POST /book/available-slots body.
 *
 * @param {object} params
 * @param {Array} params.selectedPatients
 * @param {(patient: object) => number|null} params.getNumericPatientUserId
 * @param {Record<number, object>} params.serviceAvailabilityByUserId
 * @param {string} params.bloodCollectionDate — YYYY-MM-DD
 */
export const buildAvailableSlotsPayload = ({
  selectedPatients,
  getNumericPatientUserId,
  serviceAvailabilityByUserId,
  bloodCollectionDate,
}) => {
  if (!Array.isArray(selectedPatients) || selectedPatients.length === 0) {
    throw new Error('Select at least one member to view slots.');
  }
  if (!String(bloodCollectionDate || '').trim()) {
    throw new Error('Select a collection date.');
  }

  const members = selectedPatients.map((patient, index) => {
    const user_id = getNumericPatientUserId(patient);
    const availability = serviceAvailabilityByUserId?.[user_id];
    const engagement_id = Number(availability?.engagement_id);

    if (!Number.isInteger(user_id) || user_id <= 0) {
      throw new Error(`Member ${index + 1}: missing or invalid user_id for slot lookup.`);
    }
    if (!Number.isInteger(engagement_id) || engagement_id <= 0) {
      throw new Error(`Member ${index + 1}: missing engagement for slot lookup.`);
    }

    return {
      user_id,
      engagement_id,
      blood_collection_date: bloodCollectionDate,
    };
  });

  return { members };
};

/**
 * @param {{ members: Array<object> }} payload
 * @returns {Promise<unknown>} Parsed JSON body from server
 */
export async function fetchAvailableSlots(payload) {
  return authorizedRequest(AVAILABLE_SLOTS_PATH, {
    method: 'POST',
    payload,
    missingAuthMessage: 'Please log in to view available slots.',
  });
}

/**
 * Build POST /book/lock body.
 */
export const buildLockSlotsPayload = ({
  selectedPatients,
  getNumericPatientUserId,
  serviceAvailabilityByUserId,
  bloodCollectionDate,
  bloodCollectionTimeSlotId,
  bloodCollectionTimeSlot,
  addressData,
}) => {
  if (!Array.isArray(selectedPatients) || selectedPatients.length === 0) {
    throw new Error('Select at least one member to lock a slot.');
  }
  if (!String(bloodCollectionDate || '').trim()) {
    throw new Error('Select a collection date.');
  }
  const slotId = String(bloodCollectionTimeSlotId || '').trim();
  if (!slotId) {
    throw new Error('Select a valid time slot.');
  }
  const slotTime = String(bloodCollectionTimeSlot || '').trim();
  if (!slotTime) {
    throw new Error('Select a valid time slot.');
  }
  const pincode = String(addressData?.pincode || '').trim();

  const members = selectedPatients.map((patient, index) => {
    const user_id = getNumericPatientUserId(patient);
    const engagement_id = Number(serviceAvailabilityByUserId?.[user_id]?.engagement_id);

    if (!Number.isInteger(user_id) || user_id <= 0) {
      throw new Error(`Member ${index + 1}: missing or invalid user_id for slot lock.`);
    }
    if (!Number.isInteger(engagement_id) || engagement_id <= 0) {
      throw new Error(`Member ${index + 1}: missing engagement for slot lock.`);
    }

    return {
      user_id,
      engagement_id,
      blood_collection_date: bloodCollectionDate,
      blood_collection_time_slot_id: slotId,
      blood_collection_time_slot: slotTime,
      ...(pincode ? { pincode } : {}),
    };
  });

  return { members };
};

/**
 * @param {{ members: Array<object> }} payload
 * @returns {Promise<unknown>} Parsed JSON body from server
 */
export async function lockSlots(payload) {
  return authorizedRequest(LOCK_SLOTS_PATH, {
    method: 'POST',
    payload,
    missingAuthMessage: 'Please log in to lock your slot.',
  });
}

/**
 * @returns {Promise<unknown>}
 */
export async function getMyBookingDrafts() {
  return authorizedRequest('/book/me/drafts', {
    method: 'GET',
    missingAuthMessage: 'Please log in to view booking drafts.',
  });
}

/**
 * @param {number} engagementId
 * @returns {Promise<unknown>}
 */
export async function getEngagementDetails(engagementId) {
  const id = Number(engagementId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid engagement id.');
  }

  return authorizedRequest(`/engagements/${id}`, {
    method: 'GET',
    missingAuthMessage: 'Please log in to resume your booking.',
  });
}
