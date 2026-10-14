import { BACKEND_BASE_URL } from '../config/appConfig';

const TAB_BY_TYPE = {
  doctor: 'Doctors',
  doctors: 'Doctors',
  ayurveda: 'Ayurveda',
  ayurvedic: 'Ayurveda',
  nutritionist: 'Nutritionists',
  nutrition: 'Nutritionists',
  nutritionists: 'Nutritionists',
};

const MODE_LABELS = {
  video: 'Video',
  chat: 'Chat',
  voice: 'Voice',
  call: 'Call',
  clinic: 'In Clinic',
  in_clinic: 'In Clinic',
  'in-clinic': 'In Clinic',
  online: 'Online Call',
};

const rupeesFromPaise = (paise) => {
  const amount = Number(paise);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const rupees = amount / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
};

export const formatExpertRupees = (paise, { spaced = false } = {}) => {
  const rupees = rupeesFromPaise(paise);
  if (!rupees) {
    return '';
  }
  return spaced ? `₹ ${rupees}` : `₹${rupees}`;
};

const formatCount = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) {
    return '';
  }
  if (count >= 1000) {
    const scaled = count / 1000;
    const text = scaled >= 10 || Number.isInteger(scaled)
      ? String(Math.round(scaled))
      : scaled.toFixed(1).replace(/\.0$/, '');
    return `${text}k+`;
  }
  return `${Math.round(count)}+`;
};

const formatRating = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) {
    return '';
  }
  return rating.toFixed(1);
};

export const expertTabForType = (expertType) => {
  const key = String(expertType || '').trim().toLowerCase();
  if (TAB_BY_TYPE[key]) {
    return TAB_BY_TYPE[key];
  }
  if (key.includes('ayur')) return 'Ayurveda';
  if (key.includes('nutri')) return 'Nutritionists';
  if (key.includes('doctor') || key.includes('physician')) return 'Doctors';
  return '';
};

export const expertKindForTab = (tab) => {
  if (tab === 'Ayurveda') return 'ayurveda';
  if (tab === 'Nutritionists') return 'nutritionist';
  return 'doctor';
};

const resolvePhoto = (photo) => {
  const value = String(photo || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && BACKEND_BASE_URL) return `${BACKEND_BASE_URL}${value}`;
  return value;
};

const formatModes = (modes) => {
  const list = Array.isArray(modes) ? modes : [];
  return list
    .map((mode) => {
      const key = String(mode || '').trim().toLowerCase();
      if (!key) return '';
      return MODE_LABELS[key] || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    })
    .filter(Boolean)
    .join(' / ');
};

export const mapExpertRecord = (record, index = 0) => {
  const availability = record?.availability && typeof record.availability === 'object'
    ? record.availability
    : {};
  const feePaise = Number(record?.appointment_fee_paise);
  const originalFeePaise = Number(record?.original_fee_paise);
  const hasOriginal = Number.isFinite(originalFeePaise) && originalFeePaise > 0;
  const hasFee = Number.isFinite(feePaise) && feePaise >= 0;
  const discountPercent = Number(record?.discount_percent);
  const showDiscount = hasOriginal && hasFee && originalFeePaise > feePaise
    && Number.isFinite(discountPercent) && discountPercent > 0;
  const years = Number(record?.experience_years);
  const minutes = Number(record?.session_duration_mins);
  const languages = Array.isArray(record?.languages)
    ? record.languages.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const tab = expertTabForType(record?.expert_type);
  const kind = expertKindForTab(tab);

  return {
    id: String(record?.expert_id ?? `expert-${index}`),
    expertId: record?.expert_id ?? null,
    expertType: String(record?.expert_type || '').trim().toLowerCase(),
    kind,
    tab,
    name: String(record?.name || '').trim(),
    specialty: String(record?.specialization || '').trim(),
    rating: formatRating(record?.rating),
    availability: String(availability.day_label || '').trim(),
    consultation: String(availability.hours_label || '').trim(),
    duration: Number.isFinite(minutes) && minutes > 0 ? `${minutes} mins` : '',
    durationLabel: Number.isFinite(minutes) && minutes > 0 ? `${minutes} minutes` : '',
    sessionDurationMins: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    price: hasFee ? formatExpertRupees(feePaise, { spaced: true }) : '',
    priceOld: showDiscount ? formatExpertRupees(originalFeePaise) : '',
    discount: showDiscount ? `${Math.round(discountPercent)}% OFF` : '',
    feePaise: hasFee ? feePaise : null,
    originalFeePaise: showDiscount ? originalFeePaise : null,
    photo: resolvePhoto(
      record?.profile_photo
      || record?.photo
      || record?.image_url
      || record?.avatar
      || record?.profile_image,
    ),
    experience: Number.isFinite(years) && years > 0 ? `${years}+ Years Experience` : '',
    experienceStat: Number.isFinite(years) && years > 0 ? `${years} Years` : '',
    qualifications: String(record?.qualifications || '').trim(),
    about: String(record?.about_text || '').trim(),
    patientsLabel: formatCount(record?.patient_count),
    modeLabel: formatModes(record?.consultation_modes),
    languagesLabel: languages.join(', '),
    reviewCount: Number(record?.review_count) || 0,
    status: String(record?.status || '').trim().toLowerCase(),
  };
};

export const isListedExpert = (expert) => {
  if (!expert?.tab || !expert?.name) return false;
  if (!expert.status) return true;
  return expert.status === 'active';
};
