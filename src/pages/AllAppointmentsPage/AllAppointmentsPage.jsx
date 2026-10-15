import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AllAppointmentsPage.css';
import RescheduleConsultationSheet from '../../components/RescheduleConsultationSheet';
import { getMyConsultations } from '../../services/usersService';
import { appointmentsFromConsultationRows } from '../../utils/myConsultationsAppointments';
import backIcon from '../../images/AllAppointments/back.svg';
import homeIcon from '../../images/AllAppointments/home.svg';
import videoIcon from '../../images/AllAppointments/video.svg';
import attachmentIcon from '../../images/AllAppointments/attachment.svg';
import prescriptionIcon from '../../images/AllAppointments/prescription.svg';
import chevronIcon from '../../images/AllAppointments/chevron.svg';
import cabinIcon from '../../images/AllAppointments/cabin.svg';
import periodChevronIcon from '../../images/AllAppointments/period-chevron.svg';
import infoIcon from '../../images/AllAppointments/info.svg';
import timelineLine from '../../images/AllAppointments/timeline.svg';

const STATUS_TABS = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'nutritionist', label: 'Nutritionist' },
  { key: 'blood', label: 'Blood test' },
];

const PERIOD_OPTIONS = ['6 Months', '3 Months', '1 Month'];

const GENERIC_EXPERT_LABELS = new Set([
  'Doctor Consultation',
  'Nutrition Consultation',
  'Ayurveda Consultation',
  'Clinical Nutritionist',
  'Ayurvedic Practitioner',
  'General Physician',
  'Consultation',
]);

const SCHEDULED_SAMPLE_APPOINTMENTS = [
  {
    id: 'scheduled-blood-sample',
    status: 'scheduled',
    category: 'blood',
    accent: 'blue',
    whenLabel: 'Today, 7:30 AM',
    title: 'Blood Collection',
    subtitle: 'Complete Blood Count',
    mode: 'Home Collection',
    modeIcon: 'home',
    primaryAction: 'Cancel',
    primaryTone: 'red',
    secondaryAction: 'Reschedule',
    showInfo: true,
  },
  {
    id: 'scheduled-doctor-sample',
    status: 'scheduled',
    category: 'doctor',
    accent: 'teal',
    whenLabel: 'Tomorrow, 10:00 AM',
    title: 'Doctor Consultation',
    personName: 'Dr. Priya Nair',
    personRole: 'General Physician',
    mode: 'Video Consultation',
    modeIcon: 'video',
    primaryAction: 'Join Call',
    secondaryAction: 'Reschedule',
    showInfo: true,
  },
];

const getStatusBadgeIcon = (icon) => {
  if (icon === 'prescription') {
    return prescriptionIcon;
  }
  return attachmentIcon;
};

const getDetailIcon = (modeIcon) => {
  if (modeIcon === 'home') {
    return homeIcon;
  }
  if (modeIcon === 'video') {
    return videoIcon;
  }
  return cabinIcon;
};

const getDetailIconClass = (modeIcon) => {
  if (modeIcon === 'home') {
    return 'all-appointments-page__icon-box--home';
  }
  if (modeIcon === 'video') {
    return 'all-appointments-page__icon-box--video';
  }
  return 'all-appointments-page__icon-box--cabin';
};

const formatCabinLabel = (cabinId) => {
  const id = Number(cabinId);
  return id > 0 ? `Cabin ${id}` : undefined;
};

const canRescheduleConsultation = (appointment) => {
  const engagementId = Number(appointment?.engagementId);
  const expertType = String(appointment?.expertType || appointment?.category || '').trim().toLowerCase();
  const category = String(appointment?.category || '').trim().toLowerCase();
  if (!Number.isFinite(engagementId) || engagementId <= 0) {
    return false;
  }
  if (category === 'blood') {
    return false;
  }
  return Boolean(expertType);
};

const decorateScheduledAppointment = (item) => {
  const next = { ...item };
  const status = next.status || 'scheduled';
  if (status !== 'scheduled') {
    return next;
  }

  if (next.category === 'doctor' || next.category === 'nutritionist' || next.category === 'ayurveda') {
    const expertId = Number(next.expertId ?? next.expert_id);
    const hasExpert = Number.isFinite(expertId) && expertId > 0;
    if (hasExpert) {
      next.expertId = expertId;
      next.expert_id = expertId;
      delete next.pendingDetails;
      delete next.pendingDetailsText;
    } else {
      next.expertId = null;
      next.expert_id = null;
      next.pendingDetails = true;
      next.pendingDetailsText = next.pendingDetailsText
        || 'An expert will be assigned within 24 hours';
    }
    const expertName = String(next.expertName || '').trim();
    if (!next.personName && expertName && expertName !== next.title && !GENERIC_EXPERT_LABELS.has(expertName)) {
      next.personName = expertName;
    }
    if (!next.photo && next.expert_photo) {
      next.photo = next.expert_photo;
    }
    const fallbackRole = next.category === 'nutritionist'
      ? 'Clinical Nutritionist'
      : next.category === 'ayurveda'
        ? 'Ayurvedic Practitioner'
        : 'General Physician';
    if (next.personRole && GENERIC_EXPERT_LABELS.has(String(next.personRole).trim()) && next.expert_specialization) {
      next.personRole = next.expert_specialization;
    } else {
      next.personRole = next.personRole || next.expert_specialization || fallbackRole;
    }
    if (
      next.personName
      && next.personRole
      && String(next.personName).trim().toLowerCase() === String(next.personRole).trim().toLowerCase()
    ) {
      next.subtitle = next.subtitle || next.personName;
      delete next.personName;
    }
    if (!next.personName && !next.subtitle) {
      next.subtitle = fallbackRole;
    }
    if (!next.cabinLabel && !next.cabinId && !next.mode) {
      next.mode = 'Video Consultation';
      next.modeIcon = 'video';
    }
    next.primaryAction = next.primaryAction || 'Join Call';
    next.primaryTone = next.primaryTone || 'teal';
    next.secondaryAction = next.secondaryAction || 'Reschedule';
    next.showInfo = true;
  }

  if (next.category === 'blood') {
    if (!next.cabinLabel && !next.cabinId && !next.mode) {
      next.mode = 'Home Collection';
      next.modeIcon = 'home';
    }
    next.primaryAction = next.primaryAction || 'Cancel';
    next.primaryTone = next.primaryTone || 'red';
    next.secondaryAction = next.secondaryAction || 'Reschedule';
    next.showInfo = true;
  }

  if (next.cabinId) {
    next.cabinLabel = formatCabinLabel(next.cabinId);
  } else if (next.cabinLabel) {
    const cabinMatch = String(next.cabinLabel).match(/^Cabin(?:\s+No\.)?\s*(\d+)$/i);
    if (cabinMatch) {
      next.cabinId = Number(cabinMatch[1]);
      next.cabinLabel = formatCabinLabel(next.cabinId);
    } else if (next.cabinLabel === 'Cabin') {
      delete next.cabinLabel;
    }
  }

  if (next.cabinLabel) {
    delete next.mode;
    delete next.modeIcon;
  }

  return next;
};

const AllAppointmentsPage = ({ onBack, onOpenAppointment, appointments = [] }) => {
  const [activeStatus, setActiveStatus] = useState('scheduled');
  const [activeCategory, setActiveCategory] = useState('all');
  const [periodLabel, setPeriodLabel] = useState(PERIOD_OPTIONS[0]);
  const [consultationAppointments, setConsultationAppointments] = useState([]);
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(true);
  const [hasLoadedConsultations, setHasLoadedConsultations] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const cyclePeriod = () => {
    setPeriodLabel((current) => {
      const index = PERIOD_OPTIONS.indexOf(current);
      return PERIOD_OPTIONS[(index + 1) % PERIOD_OPTIONS.length];
    });
  };

  const loadConsultations = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setIsLoadingConsultations(true);
    }
    try {
      const response = await getMyConsultations();
      const rows = Array.isArray(response?.data) ? response.data : [];
      const items = await appointmentsFromConsultationRows(rows);
      setConsultationAppointments(items);
    } catch (error) {
      console.error('Failed to load consultation appointments:', error);
      if (!quiet) {
        setConsultationAppointments([]);
      }
    } finally {
      setIsLoadingConsultations(false);
      setHasLoadedConsultations(true);
    }
  }, []);

  useEffect(() => {
    void loadConsultations();
  }, [loadConsultations]);

  const openReschedule = (appointment) => {
    if (!canRescheduleConsultation(appointment)) {
      return;
    }
    setRescheduleTarget(appointment);
  };

  const mergedAppointments = useMemo(() => {
    const apiAppointments = consultationAppointments.map(decorateScheduledAppointment);

    if (hasLoadedConsultations && apiAppointments.length > 0) {
      const seen = new Set(apiAppointments.map((item) => item.id));
      const extras = appointments
        .map(decorateScheduledAppointment)
        .filter((item) => item?.id && !seen.has(item.id));
      return [...apiAppointments, ...extras];
    }

    let result = appointments.map(decorateScheduledAppointment);
    if (!result.some((item) => (item.status || 'scheduled') === 'scheduled')) {
      result = [...result, ...SCHEDULED_SAMPLE_APPOINTMENTS];
    }
    return result;
  }, [appointments, consultationAppointments, hasLoadedConsultations]);

  const visibleAppointments = useMemo(() => {
    return mergedAppointments.filter((item) => {
      const matchesStatus = (item.status || 'scheduled') === activeStatus;
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      return matchesStatus && matchesCategory;
    });
  }, [mergedAppointments, activeStatus, activeCategory]);

  const openAppointmentDetails = (appointment) => {
    if (typeof onOpenAppointment !== 'function' || !appointment) {
      return;
    }
    const expertId = Number(appointment.expertId ?? appointment.expert_id);
    onOpenAppointment({
      ...appointment,
      expertId: Number.isFinite(expertId) && expertId > 0 ? expertId : null,
      expert_id: Number.isFinite(expertId) && expertId > 0 ? expertId : null,
      consultationId: appointment.consultationId ?? appointment.consultation_id ?? null,
      engagementId: appointment.engagementId ?? appointment.engagement_id ?? null,
      apiDate: appointment.apiDate ?? null,
      apiSlot: appointment.apiSlot ?? null,
    });
  };

  const renderScheduledCard = (appointment, accent, kind) => {
    const detailLabel = appointment.mode || appointment.cabinLabel || appointment.locationLabel;
    const detailIcon = appointment.modeIcon || (appointment.cabinLabel ? 'cabin' : null);
    const actionCount = [appointment.primaryAction, appointment.secondaryAction].filter(Boolean).length;
    const primaryTone = appointment.primaryTone || accent;
    const primaryClass = `all-appointments-page__action all-appointments-page__action--${primaryTone}`;

    return (
      <>
        <div className="all-appointments-page__card-top">
          {kind === 'program' ? (
            <div className="all-appointments-page__badges">
              {appointment.weekLabel ? (
                <span className="all-appointments-page__badge all-appointments-page__badge--amber">
                  {appointment.weekLabel}
                </span>
              ) : null}
              {appointment.nextSessionLabel ? (
                <span className="all-appointments-page__badge all-appointments-page__badge--muted">
                  {appointment.nextSessionLabel}
                </span>
              ) : null}
            </div>
          ) : (
            <span className={`all-appointments-page__when all-appointments-page__when--${accent}`}>
              {appointment.whenLabel}
            </span>
          )}
        </div>

        <h2 className="all-appointments-page__card-title all-appointments-page__card-title--scheduled">
          {appointment.title}
        </h2>

        {appointment.pendingDetails ? (
          <p className="all-appointments-page__subtitle">
            {appointment.pendingDetailsText || 'Doctor details will be shared soon.'}
          </p>
        ) : appointment.personName ? (
          <p className="all-appointments-page__person">
            <span>{appointment.personName}</span>
            {appointment.personRole ? (
              <span className="all-appointments-page__person-role">({appointment.personRole})</span>
            ) : null}
          </p>
        ) : appointment.subtitle ? (
          <p className={`all-appointments-page__subtitle${kind === 'program' ? ' all-appointments-page__subtitle--program' : ''}`}>
            {appointment.subtitle}
          </p>
        ) : null}

        {detailLabel ? (
          <div className="all-appointments-page__detail-line all-appointments-page__detail-line--scheduled">
            <span className={`all-appointments-page__icon-box ${getDetailIconClass(detailIcon)}`}>
              <img src={getDetailIcon(detailIcon)} alt="" />
            </span>
            <span>{detailLabel}</span>
          </div>
        ) : null}

        {kind === 'program' && typeof appointment.progressPercent === 'number' ? (
          <div className="all-appointments-page__progress">
            <div className="all-appointments-page__progress-row">
              <span>CURRENT PROGRESS</span>
              <span className="all-appointments-page__progress-value">{appointment.progressPercent}%</span>
            </div>
            <div className="all-appointments-page__progress-track">
              <span
                className="all-appointments-page__progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, appointment.progressPercent))}%` }}
              />
            </div>
          </div>
        ) : null}

        {actionCount > 0 ? (
          <div className={`all-appointments-page__actions all-appointments-page__actions--scheduled${kind === 'program' ? ' all-appointments-page__actions--program' : ''}${actionCount === 1 ? ' all-appointments-page__actions--single' : ''}`}>
            {appointment.primaryAction ? (
              <button
                className={primaryClass}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                {appointment.primaryAction}
              </button>
            ) : null}
            {appointment.secondaryAction ? (
              <button
                className="all-appointments-page__action all-appointments-page__action--ghost"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (appointment.secondaryAction === 'Reschedule') {
                    openReschedule(appointment);
                  }
                }}
              >
                {appointment.secondaryAction}
              </button>
            ) : null}
          </div>
        ) : null}

        {appointment.showInfo ? (
          <button
            type="button"
            className="all-appointments-page__info-btn all-appointments-page__info-btn--scheduled"
            aria-label="Appointment info"
            onClick={(event) => {
              event.stopPropagation();
              openAppointmentDetails(appointment);
            }}
          >
            <img src={infoIcon} alt="" width="14" height="14" />
          </button>
        ) : null}
      </>
    );
  };

  const renderCancelledCard = (appointment, accent, kind) => {
    const detailLabel = appointment.mode || appointment.locationLabel || appointment.cabinLabel;
    const actionCount = [appointment.primaryAction, appointment.secondaryAction].filter(Boolean).length;
    const primaryClass = `all-appointments-page__action all-appointments-page__action--${accent}`;
    const whenClass = `all-appointments-page__when all-appointments-page__when--${accent} all-appointments-page__when--faded${accent === 'amber' ? ' all-appointments-page__when--faded-amber' : ''}`;

    return (
      <>
        <div className="all-appointments-page__cancel-badges">
          {appointment.whenLabel ? (
            <span className={whenClass}>{appointment.whenLabel}</span>
          ) : null}
          {appointment.cancelReason ? (
            <span className="all-appointments-page__cancel-badge">{appointment.cancelReason}</span>
          ) : null}
        </div>

        <h2 className="all-appointments-page__card-title all-appointments-page__card-title--cancelled">
          {appointment.title}
        </h2>

        {appointment.personName ? (
          <p className="all-appointments-page__person">
            <span>{appointment.personName}</span>
            {appointment.personRole ? (
              <span className="all-appointments-page__person-role">({appointment.personRole})</span>
            ) : null}
          </p>
        ) : appointment.subtitle ? (
          <p className={`all-appointments-page__subtitle${kind === 'program' ? ' all-appointments-page__subtitle--program-cancelled' : ''}`}>
            {appointment.subtitle}
          </p>
        ) : null}

        {detailLabel ? (
          <div className="all-appointments-page__detail-line all-appointments-page__detail-line--cancelled">
            <span className={`all-appointments-page__icon-box ${getDetailIconClass(appointment.modeIcon)}`}>
              <img src={getDetailIcon(appointment.modeIcon)} alt="" />
            </span>
            <span>{detailLabel}</span>
          </div>
        ) : null}

        {kind === 'program' && typeof appointment.progressPercent === 'number' ? (
          <div className="all-appointments-page__progress all-appointments-page__progress--cancelled">
            <div className="all-appointments-page__progress-row">
              <span>CURRENT PROGRESS</span>
              <span className="all-appointments-page__progress-value">{appointment.progressPercent}%</span>
            </div>
            <div className="all-appointments-page__progress-track">
              <span
                className="all-appointments-page__progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, appointment.progressPercent))}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className={`all-appointments-page__actions all-appointments-page__actions--cancelled${kind === 'program' ? ' all-appointments-page__actions--program' : ''}${actionCount === 1 ? ' all-appointments-page__actions--single' : ''}`}>
          {appointment.primaryAction ? (
            <button className={primaryClass} type="button">
              {appointment.primaryAction}
            </button>
          ) : null}
          {appointment.secondaryAction ? (
            <button
              className="all-appointments-page__action all-appointments-page__action--ghost"
              type="button"
              onClick={() => {
                if (appointment.secondaryAction === 'Reschedule') {
                  openReschedule(appointment);
                }
              }}
            >
              {appointment.secondaryAction}
            </button>
          ) : null}
        </div>
      </>
    );
  };

  const renderCompletedCard = (appointment, accent) => {
    const badge = appointment.statusBadge;
    const detailLabel = appointment.mode || appointment.locationLabel || appointment.cabinLabel;

    return (
      <>
        <div className="all-appointments-page__card-body">
          {badge ? (
            <div className="all-appointments-page__card-top">
              <span className={`all-appointments-page__status-badge all-appointments-page__status-badge--${accent}`}>
                <img
                  src={getStatusBadgeIcon(badge.icon)}
                  alt=""
                  className={`all-appointments-page__status-badge-icon all-appointments-page__status-badge-icon--${badge.icon}`}
                />
                <span>{badge.label}</span>
              </span>
            </div>
          ) : null}

          <h2 className="all-appointments-page__card-title all-appointments-page__card-title--completed">
            {appointment.title}
          </h2>

          {appointment.personName ? (
            <p className="all-appointments-page__person">
              <span>{appointment.personName}</span>
              {appointment.personRole ? (
                <span className="all-appointments-page__person-role">({appointment.personRole})</span>
              ) : null}
            </p>
          ) : appointment.subtitle ? (
            <p className="all-appointments-page__subtitle">{appointment.subtitle}</p>
          ) : null}

          {detailLabel ? (
            <div className="all-appointments-page__detail-line all-appointments-page__detail-line--completed">
              <span className={`all-appointments-page__icon-box ${getDetailIconClass(appointment.modeIcon)}`}>
                <img src={getDetailIcon(appointment.modeIcon)} alt="" />
              </span>
              <span>{detailLabel}</span>
            </div>
          ) : null}
        </div>

        <button type="button" className="all-appointments-page__chevron-btn" aria-label="View appointment details">
          <img src={chevronIcon} alt="" className="all-appointments-page__chevron-img" />
        </button>
      </>
    );
  };

  return (
    <div className="all-appointments-page">
      <div className="all-appointments-page__header-row">
        <div className="all-appointments-page__header-left">
          <button
            className="all-appointments-page__back-btn"
            onClick={onBack}
            aria-label="Go back"
            type="button"
          >
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
          <h1 className="all-appointments-page__title">All Appointments</h1>
        </div>
        <button
          className="all-appointments-page__period-btn"
          type="button"
          aria-label={`Appointment period: ${periodLabel}`}
          onClick={cyclePeriod}
        >
          <span>{periodLabel}</span>
          <img
            className="all-appointments-page__period-chevron"
            src={periodChevronIcon}
            alt=""
            width="4.5"
            height="7.5"
          />
        </button>
      </div>

      <div className="all-appointments-page__body">
        <div className="all-appointments-page__filters">
        <div className="all-appointments-page__status-wrap">
          <div className="all-appointments-page__tabs" role="tablist" aria-label="Appointment status tabs">
            {STATUS_TABS.map((tab) => {
              const isActive = tab.key === activeStatus;
              return (
                <button
                  key={tab.key}
                  className={`all-appointments-page__tab${isActive ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveStatus(tab.key);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="all-appointments-page__chips" role="tablist" aria-label="Appointment type filters">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = chip.key === activeCategory;
            return (
              <button
                key={chip.key}
                className={`all-appointments-page__chip${isActive ? ' is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveCategory(chip.key);
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`all-appointments-page__list${visibleAppointments.length === 0 ? ' is-empty' : ''}`}>
        {visibleAppointments.length > 0 ? (
          <span className="all-appointments-page__timeline" aria-hidden="true">
            <img src={timelineLine} alt="" width="598.003" height="21" />
          </span>
        ) : null}
        {isLoadingConsultations ? (
          <div className="all-appointments-page__empty" role="status">
            <p className="all-appointments-page__empty-title">Loading appointments...</p>
          </div>
        ) : null}

        {!isLoadingConsultations && visibleAppointments.length === 0 ? (
          <div className="all-appointments-page__empty" role="status">
            <p className="all-appointments-page__empty-title">No appointments yet.</p>
            <p className="all-appointments-page__empty-sub">They will appear here when booked</p>
          </div>
        ) : null}

        {!isLoadingConsultations ? visibleAppointments.map((appointment) => {
          const accent = appointment.accent || 'teal';
          const kind = appointment.kind || 'consult';
          const status = appointment.status || 'scheduled';
          const isCompleted = status === 'completed';
          const isCancelled = status === 'cancelled';

          let cardContent;
          if (isCompleted) {
            cardContent = renderCompletedCard(appointment, accent);
          } else if (isCancelled) {
            cardContent = renderCancelledCard(appointment, accent, kind);
          } else {
            cardContent = renderScheduledCard(appointment, accent, kind);
          }

          return (
            <div className="all-appointments-page__row" key={appointment.id}>
              <div className="all-appointments-page__rail" aria-hidden="true">
                <span className={`all-appointments-page__dot all-appointments-page__dot--${accent}`} />
              </div>

              <article
                className={`all-appointments-page__card${isCompleted ? ' all-appointments-page__card--completed' : ''}${isCancelled ? ' all-appointments-page__card--cancelled' : ''}${status === 'scheduled' ? ' all-appointments-page__card--scheduled' : ''}${status === 'scheduled' ? ' is-clickable' : ''}`}
                onClick={status === 'scheduled' ? () => openAppointmentDetails(appointment) : undefined}
                onKeyDown={status === 'scheduled' ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAppointmentDetails(appointment);
                  }
                } : undefined}
                role={status === 'scheduled' ? 'button' : undefined}
                tabIndex={status === 'scheduled' ? 0 : undefined}
              >
                {cardContent}
              </article>
            </div>
          );
        }) : null}
      </div>
      </div>

      {rescheduleTarget ? (
        <RescheduleConsultationSheet
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={async () => {
            setRescheduleTarget(null);
            await loadConsultations({ quiet: true });
          }}
        />
      ) : null}
    </div>
  );
};

export default AllAppointmentsPage;
