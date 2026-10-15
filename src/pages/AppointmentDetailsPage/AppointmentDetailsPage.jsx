import React, { useEffect, useMemo, useState } from 'react';
import './AppointmentDetailsPage.css';
import RescheduleConsultationSheet from '../../components/RescheduleConsultationSheet';
import { getExpertById } from '../../services/expertsService';
import { getMyConsultations } from '../../services/usersService';
import backIcon from '../../images/AppointmentDetails/back.svg';
import starIcon from '../../images/AppointmentDetails/star.svg';
import dateIcon from '../../images/AppointmentDetails/icon-date.svg';
import timeIcon from '../../images/AppointmentDetails/icon-time.svg';
import typeIcon from '../../images/AppointmentDetails/icon-type.svg';
import frequencyIcon from '../../images/AppointmentDetails/icon-frequency.svg';
import bellIcon from '../../images/AppointmentDetails/icon-bell.svg';
import defaultAvatar from '../../images/supercare/supercare-doctor.jpg';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatDetailDate = (dateStr) => {
  if (!dateStr) {
    return '—';
  }

  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    return String(dateStr);
  }

  return `${MONTH_SHORT[month - 1]} ${day}, ${year}`;
};

const parseSlotParts = (slotStr) => {
  const raw = String(slotStr || '').trim();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
      period: match[3].toUpperCase(),
    };
  }

  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    let hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) {
      hour = 12;
    }
    return { hour, minute, period };
  }

  return null;
};

const formatClock = (hour, minute, period) => (
  `${hour}:${String(minute).padStart(2, '0')} ${period}`
);

const addMinutesToSlot = (parts, minutesToAdd) => {
  let hour24 = parts.hour % 12;
  if (parts.period === 'PM') {
    hour24 += 12;
  }
  if (parts.period === 'AM' && parts.hour === 12) {
    hour24 = 0;
  }

  let total = hour24 * 60 + parts.minute + minutesToAdd;
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);

  const nextHour24 = Math.floor(total / 60);
  const minute = total % 60;
  const period = nextHour24 >= 12 ? 'PM' : 'AM';
  let hour = nextHour24 % 12;
  if (hour === 0) {
    hour = 12;
  }

  return { hour, minute, period };
};

const formatDetailTime = (slotStr, durationMinutes = 30) => {
  const raw = String(slotStr || '').trim();
  if (!raw) {
    return '—';
  }

  const embedded = raw.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  const parts = parseSlotParts(embedded ? embedded[1] : raw);
  if (!parts) {
    return raw;
  }

  const end = addMinutesToSlot(parts, durationMinutes);
  const startLabel = `${parts.hour}:${String(parts.minute).padStart(2, '0')}`;

  if (parts.period === end.period) {
    return `${startLabel} - ${end.hour}:${String(end.minute).padStart(2, '0')} ${end.period}`;
  }

  return `${formatClock(parts.hour, parts.minute, parts.period)} - ${formatClock(end.hour, end.minute, end.period)}`;
};

const resolveTypeLabel = (appointment) => {
  if (!appointment) {
    return 'Online, Video Call';
  }

  if (appointment.mode && /video/i.test(appointment.mode)) {
    return 'Online, Video Call';
  }

  if (appointment.mode && /home/i.test(appointment.mode)) {
    return appointment.mode;
  }

  if (appointment.category === 'doctor' || appointment.category === 'nutritionist') {
    return 'Online, Video Call';
  }

  if (appointment.mode) {
    return appointment.mode;
  }

  if (appointment.locationLabel) {
    return appointment.locationLabel;
  }

  return 'Online, Video Call';
};

const canRescheduleConsultation = (item) => {
  const engagementId = Number(item?.engagementId);
  const expertType = String(item?.expertType || item?.category || '').trim().toLowerCase();
  const category = String(item?.category || '').trim().toLowerCase();
  if (!Number.isFinite(engagementId) || engagementId <= 0) {
    return false;
  }
  if (category === 'blood') {
    return false;
  }
  return Boolean(expertType);
};

const toPositiveId = (value) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const resolveAppointmentExpertId = (item) => (
  toPositiveId(item?.expertId)
  || toPositiveId(item?.expert_id)
  || null
);

const fallbackRoleForAppointment = (appointment) => {
  if (appointment?.category === 'nutritionist' || appointment?.expertType === 'nutritionist') {
    return 'Clinical Nutritionist';
  }
  if (appointment?.category === 'ayurveda' || appointment?.expertType === 'ayurveda') {
    return 'Ayurvedic Practitioner';
  }
  return 'General Physician';
};

const roleFromExpertType = (expertType) => {
  const value = String(expertType || '').trim().toLowerCase();
  if (value === 'nutritionist') {
    return 'Clinical Nutritionist';
  }
  if (value === 'ayurveda' || value === 'ayurvedic') {
    return 'Ayurvedic Practitioner';
  }
  if (value === 'doctor') {
    return 'General Physician';
  }
  return '';
};

const findConsultationMatch = async (appointment) => {
  const consultationId = toPositiveId(appointment?.consultationId ?? appointment?.consultation_id);
  const engagementId = toPositiveId(appointment?.engagementId ?? appointment?.engagement_id);
  const apiDate = String(appointment?.apiDate || '').trim();
  const apiSlot = String(appointment?.apiSlot || '').trim();

  try {
    const response = await getMyConsultations();
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows.find((row) => {
      if (consultationId && toPositiveId(row?.consultation_id) === consultationId) {
        return true;
      }
      if (
        engagementId
        && toPositiveId(row?.engagement_id) === engagementId
        && String(row?.date || '') === apiDate
        && String(row?.slot || '') === apiSlot
      ) {
        return true;
      }
      return false;
    }) || null;
  } catch {
    return null;
  }
};

const AppointmentDetailsPage = ({ appointment = null, onBack, onRescheduled }) => {
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [expertName, setExpertName] = useState('');
  const [expertSpecialty, setExpertSpecialty] = useState('');
  const [expertPhoto, setExpertPhoto] = useState('');
  const [expertRatingLabel, setExpertRatingLabel] = useState('');
  const [expertDurationMins, setExpertDurationMins] = useState(30);
  const [expertLoading, setExpertLoading] = useState(false);
  const [resolvedExpertId, setResolvedExpertId] = useState(() => resolveAppointmentExpertId(appointment));

  useEffect(() => {
    let cancelled = false;

    const applyExpert = (record) => {
      if (cancelled || !record || typeof record !== 'object') {
        return;
      }
      const name = String(record.name || '').trim();
      const specialty = String(record.specialization || '').trim()
        || roleFromExpertType(record.expert_type);
      const photo = String(record.profile_photo || '').trim();
      const ratingValue = Number(record.rating);
      const reviewCount = Number(record.review_count) || 0;
      const duration = Number(record.session_duration_mins);
      setExpertName(name);
      setExpertSpecialty(specialty);
      setExpertPhoto(photo);
      setExpertRatingLabel(
        Number.isFinite(ratingValue) && ratingValue > 0
          ? `${ratingValue.toFixed(1)}${reviewCount ? ` (${reviewCount} reviews)` : ''}`
          : '',
      );
      setExpertDurationMins(Number.isFinite(duration) && duration > 0 ? duration : 30);
    };

    const loadExpert = async () => {
      setExpertName('');
      setExpertSpecialty('');
      setExpertPhoto('');
      setExpertRatingLabel('');
      setExpertDurationMins(30);
      setExpertLoading(true);
      setResolvedExpertId(resolveAppointmentExpertId(appointment));

      try {
        let expertId = resolveAppointmentExpertId(appointment);
        if (!expertId && appointment) {
          const match = await findConsultationMatch(appointment);
          expertId = toPositiveId(match?.expert_id ?? match?.expertId);
        }
        if (cancelled) {
          return;
        }
        setResolvedExpertId(expertId);
        if (!expertId) {
          return;
        }
        // GET /experts/{expert_id}
        const record = await getExpertById(expertId);
        applyExpert(record);
      } catch {
        if (!cancelled) {
          setExpertName('');
          setExpertSpecialty('');
          setExpertPhoto('');
          setExpertRatingLabel('');
          setExpertDurationMins(30);
        }
      } finally {
        if (!cancelled) {
          setExpertLoading(false);
        }
      }
    };

    void loadExpert();

    return () => {
      cancelled = true;
    };
  }, [appointment]);

  const details = useMemo(() => {
    const fallbackRole = fallbackRoleForAppointment(appointment);
    const role = expertSpecialty || fallbackRole;
    const hasExpert = Boolean(resolvedExpertId);
    let name = expertName;
    if (!name) {
      if (expertLoading) {
        name = 'Loading…';
      } else if (!hasExpert) {
        name = 'Expert will be assigned';
      } else {
        name = appointment?.title || fallbackRole;
      }
    }
    const photo = expertPhoto || defaultAvatar;
    const dateLabel = appointment?.detailDateLabel
      || (appointment?.apiDate ? formatDetailDate(appointment.apiDate) : null)
      || '—';
    const timeLabel = appointment?.detailTimeLabel
      || formatDetailTime(appointment?.apiSlot || appointment?.whenLabel, expertDurationMins)
      || '—';
    const typeLabel = appointment?.detailTypeLabel || resolveTypeLabel(appointment);
    const frequencyLabel = appointment?.frequencyLabel || 'One-Time';

    return {
      name,
      role,
      ratingLabel: hasExpert ? (expertRatingLabel || null) : null,
      photo,
      dateLabel,
      timeLabel,
      typeLabel,
      frequencyLabel,
      hasExpert,
      expertLoading,
    };
  }, [
    appointment,
    expertName,
    expertSpecialty,
    expertPhoto,
    expertRatingLabel,
    expertDurationMins,
    expertLoading,
    resolvedExpertId,
  ]);

  return (
    <div className="appointment-details-page">
      <div className="appointment-details-page__header">
        <button
          type="button"
          className="appointment-details-page__back"
          onClick={onBack}
          aria-label="Go back"
        >
          <img src={backIcon} alt="" width="24" height="24" />
        </button>
        <h1 className="appointment-details-page__title">Appointment Details</h1>
      </div>

      <div className="appointment-details-page__identity">
        <div className="appointment-details-page__avatar-wrap">
          <div className="appointment-details-page__avatar">
            <img
              key={details.photo}
              src={details.photo}
              alt={details.name}
              onError={(event) => {
                if (event.currentTarget.src !== defaultAvatar) {
                  event.currentTarget.src = defaultAvatar;
                }
              }}
            />
          </div>
        </div>
        <h2 className="appointment-details-page__name">{details.name}</h2>
        <p className="appointment-details-page__role">{details.role}</p>
        {details.ratingLabel ? (
          <div className="appointment-details-page__rating">
            <span className="appointment-details-page__stars" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <img key={index} src={starIcon} alt="" width="11.667" height="11.083" />
              ))}
            </span>
            <span className="appointment-details-page__rating-text">{details.ratingLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="appointment-details-page__meta-grid">
        <div className="appointment-details-page__meta-card">
          <span className="appointment-details-page__meta-icon appointment-details-page__meta-icon--date">
            <img src={dateIcon} alt="" width="34" height="36" />
          </span>
          <span className="appointment-details-page__meta-label">DATE</span>
          <span className="appointment-details-page__meta-value">{details.dateLabel}</span>
        </div>
        <div className="appointment-details-page__meta-card">
          <span className="appointment-details-page__meta-icon appointment-details-page__meta-icon--time">
            <img src={timeIcon} alt="" width="36" height="36" />
          </span>
          <span className="appointment-details-page__meta-label">TIME</span>
          <span className="appointment-details-page__meta-value">{details.timeLabel}</span>
        </div>
        <div className="appointment-details-page__meta-card">
          <span className="appointment-details-page__meta-icon appointment-details-page__meta-icon--type">
            <img src={typeIcon} alt="" width="36" height="32" />
          </span>
          <span className="appointment-details-page__meta-label">TYPE</span>
          <span className="appointment-details-page__meta-value">{details.typeLabel}</span>
        </div>
        <div className="appointment-details-page__meta-card">
          <span className="appointment-details-page__meta-icon appointment-details-page__meta-icon--frequency">
            <img src={frequencyIcon} alt="" width="34" height="34" />
          </span>
          <span className="appointment-details-page__meta-label">FREQUENCY</span>
          <span className="appointment-details-page__meta-value">{details.frequencyLabel}</span>
        </div>
      </div>

      <div className="appointment-details-page__reminder">
        <div className="appointment-details-page__reminder-left">
          <span className="appointment-details-page__reminder-icon">
            <img src={bellIcon} alt="" width="20" height="20.05" />
          </span>
          <div className="appointment-details-page__reminder-copy">
            <p className="appointment-details-page__reminder-title">Enable reminders</p>
            <p className="appointment-details-page__reminder-sub">15 min before every session</p>
          </div>
        </div>
        <button
          type="button"
          className={`appointment-details-page__toggle${remindersEnabled ? ' is-on' : ''}`}
          role="switch"
          aria-checked={remindersEnabled}
          aria-label="Enable reminders"
          onClick={() => {
            setRemindersEnabled((value) => !value);
          }}
        >
          <span className="appointment-details-page__toggle-knob" />
        </button>
      </div>

      <div className="appointment-details-page__actions">
        <div className="appointment-details-page__actions-row">
          <button
            type="button"
            className="appointment-details-page__btn appointment-details-page__btn--ghost"
            disabled={!canRescheduleConsultation(appointment)}
            onClick={() => {
              if (canRescheduleConsultation(appointment)) {
                setShowReschedule(true);
              }
            }}
          >
            Reschedule
          </button>
          <button type="button" className="appointment-details-page__btn appointment-details-page__btn--ghost">
            Cancel
          </button>
        </div>
        <button type="button" className="appointment-details-page__btn appointment-details-page__btn--join" disabled>
          Join Call
        </button>
      </div>

      {showReschedule ? (
        <RescheduleConsultationSheet
          appointment={appointment}
          onClose={() => setShowReschedule(false)}
          onSuccess={(result, nextSlot) => {
            setShowReschedule(false);
            if (typeof onRescheduled === 'function') {
              onRescheduled(result, nextSlot);
            } else {
              onBack();
            }
          }}
        />
      ) : null}
    </div>
  );
};

export default AppointmentDetailsPage;
