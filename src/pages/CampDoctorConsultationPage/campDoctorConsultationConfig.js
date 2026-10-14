/**
 * Camp Doctor consultation — home bottom popup.
 *
 * Set to `false` (or comment the App.js render block) to hide this for non-camp builds.
 */
export const CAMP_DOCTOR_CONSULTATION_ENABLED = true;

/**
 * When `false`, Book Now always uses offline engagement slots
 * (`GET /engagements/code/{code}` → slot_detail.consultation) and never
 * `GET /experts/consultations/slots`.
 */
export const ONLINE_CONSULTATION_SLOTS_ENABLED = true;
