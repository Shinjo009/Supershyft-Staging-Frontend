import { getMyConsultations } from '../services/usersService';
import { formatApiSlotToDisplay } from './campDoctorOfflineSchedule';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EXPERT_META = {
  doctor: {
    title: 'Doctor Consultation',
    category: 'doctor',
    accent: 'teal',
    subtitle: null,
  },
  nutritionist: {
    title: 'Nutrition Consultation',
    category: 'nutritionist',
    accent: 'teal',
    subtitle: 'Clinical Nutritionist',
  },
  ayurveda: {
    title: 'Ayurveda Consultation',
    category: 'ayurveda',
    accent: 'teal',
    subtitle: 'Ayurvedic Practitioner',
  },
  ayurvedic: {
    title: 'Ayurveda Consultation',
    category: 'ayurveda',
    accent: 'teal',
    subtitle: 'Ayurvedic Practitioner',
  },
};

const formatCabinDisplay = (cabin) => {
  const value = String(cabin || '').trim();
  if (!value) {
    return undefined;
  }
  if (/^cabin\s/i.test(value)) {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return `Cabin ${value}`;
  }
  return value;
};

const formatWhenLabel = (dateStr, slotStr) => {
  if (!dateStr || !slotStr) {
    return '';
  }

  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    return formatApiSlotToDisplay(slotStr);
  }

  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  const timeLabel = formatApiSlotToDisplay(slotStr);

  if (diffDays === 0) {
    return `Today, ${timeLabel}`;
  }
  if (diffDays === 1) {
    return `Tomorrow, ${timeLabel}`;
  }

  return `${DAY_SHORT[date.getDay()]}, ${timeLabel}`;
};

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatNotesWhenLabel = (dateStr, slotStr) => {
  if (!dateStr) {
    return formatApiSlotToDisplay(slotStr) || '';
  }

  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    return formatApiSlotToDisplay(slotStr) || '';
  }

  const timeLabel = formatApiSlotToDisplay(slotStr);
  const dateLabel = `${day} ${MONTH_LONG[month - 1]} ${year}`;
  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel;
};

const resolveExpertName = (item, expertType) => {
  const name = item?.expert_name
    || item?.doctor_name
    || item?.nutritionist_name
    || item?.expert?.name
    || item?.expert?.full_name;

  if (name) {
    return String(name).trim();
  }

  if (expertType === 'nutritionist') {
    return 'Clinical Nutritionist';
  }

  if (expertType === 'ayurveda' || expertType === 'ayurvedic') {
    return 'Ayurvedic Practitioner';
  }

  return 'Doctor Consultation';
};

const normalizeAttachments = (attachments) => {
  if (!attachments) {
    return [];
  }

  if (Array.isArray(attachments)) {
    return attachments
      .map((item, index) => {
        if (!item) {
          return null;
        }
        if (typeof item === 'string') {
          return {
            id: `attachment-${index}`,
            label: 'Prescription',
            fileType: 'PDF',
            sizeLabel: null,
            url: item,
          };
        }

        const url = item.url || item.file_url || item.download_url || null;
        const sizeBytes = Number(item.size || item.file_size || 0);
        let sizeLabel = item.size_label || null;
        if (!sizeLabel && Number.isFinite(sizeBytes) && sizeBytes > 0) {
          const mb = sizeBytes / (1024 * 1024);
          sizeLabel = mb >= 1 ? `${mb.toFixed(0)}Mb` : `${Math.max(1, Math.round(sizeBytes / 1024))}Kb`;
        }

        return {
          id: item.id || `attachment-${index}`,
          label: item.label || item.name || item.file_name || 'Prescription',
          fileType: item.file_type || item.type || 'PDF',
          sizeLabel,
          url,
        };
      })
      .filter(Boolean);
  }

  if (typeof attachments === 'string') {
    return [{
      id: 'attachment-0',
      label: 'Prescription',
      fileType: 'PDF',
      sizeLabel: null,
      url: attachments,
    }];
  }

  return [];
};

const resolveCompletedBadge = (item) => {
  const attachments = normalizeAttachments(item?.attachments);
  if (attachments.length > 0) {
    return {
      label: `${attachments.length} Attachment${attachments.length === 1 ? '' : 's'}`,
      icon: 'attachment',
    };
  }

  if (item?.consultation_summary) {
    return {
      label: 'Prescription Available',
      icon: 'prescription',
    };
  }

  return null;
};

const DEFAULT_SLOT_DURATION_MINUTES = 30;

const parseConsultationStartMs = (dateStr, slotStr) => {
  const dateMatch = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const slotMatch = String(slotStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !slotMatch) {
    return null;
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(slotMatch[1]);
  const minute = Number(slotMatch[2]);
  if (![year, month, day, hour, minute].every((value) => Number.isFinite(value))) {
    return null;
  }
  const start = new Date(year, month - 1, day, hour, minute, 0, 0);
  const ms = start.getTime();
  return Number.isFinite(ms) ? ms : null;
};

const isConsultationSlotPast = (item, nowMs = Date.now()) => {
  const startMs = parseConsultationStartMs(item?.date, item?.slot);
  if (startMs === null) {
    return false;
  }
  const durationMinutes = Number(item?.duration_minutes ?? item?.session_duration_mins);
  const durationMs = (
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : DEFAULT_SLOT_DURATION_MINUTES
  ) * 60 * 1000;
  return startMs + durationMs <= nowMs;
};

const hasAssignedExpertId = (item) => {
  const id = Number(item?.expert_id ?? item?.expertId);
  return Number.isFinite(id) && id > 0;
};

const resolveConsultationStatus = (item) => {
  const engagementStatus = String(item?.engagement_status || '').trim().toLowerCase();
  // Unassigned drafts (no expert yet) stay hidden. Expert-linked drafts still surface so
  // booked-from-profile consultations can open GET /experts/{expert_id} on details.
  if (engagementStatus === 'draft' && !hasAssignedExpertId(item)) {
    return null;
  }

  // engagement_status completed: done=true → Completed tab; done=false → Cancelled tab.
  if (engagementStatus === 'completed') {
    return item?.done === true ? 'completed' : 'cancelled';
  }

  const status = String(item?.status || '').trim().toLowerCase();
  if (item?.done === true || status === 'completed' || status === 'done') {
    return 'completed';
  }
  if (status === 'cancelled' || status === 'canceled' || engagementStatus === 'cancelled' || engagementStatus === 'canceled') {
    return 'cancelled';
  }

  const hasSlot = Boolean(item?.date && item?.slot);
  const isPast = hasSlot && isConsultationSlotPast(item);

  if (isPast) {
    // Past visits already marked done/completed return above.
    // Past slot with notes/attachments → completed; otherwise → cancelled.
    if (item?.consultation_summary || (Array.isArray(item?.attachments) && item.attachments.length > 0)) {
      return 'completed';
    }
    return 'cancelled';
  }

  if (status === 'scheduled' || engagementStatus === 'scheduled' || engagementStatus === 'running' || hasSlot) {
    return 'scheduled';
  }
  return null;
};

const resolveConsultationMode = (mode) => {
  const value = String(mode || '').trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (value === 'online' || value === 'video' || value === 'call') {
    return { mode: 'Video Consultation', modeIcon: 'video' };
  }
  if (value === 'home' || value === 'home_collection') {
    return { mode: 'Home Collection', modeIcon: 'home' };
  }
  if (value === 'clinic' || value === 'in_clinic' || value === 'in-clinic') {
    return { mode: 'In Clinic', modeIcon: 'cabin' };
  }
  return { mode: value.replace(/[_-]+/g, ' '), modeIcon: 'video' };
};

export const mapMyConsultationsToAppointments = (myConsultations = []) => {
  return (Array.isArray(myConsultations) ? myConsultations : [])
    .map((item) => {
      const status = resolveConsultationStatus(item);
      if (!status) {
        return null;
      }

      const expertType = String(item?.expert_type || '').toLowerCase();
      const meta = EXPERT_META[expertType] || {
        title: 'Consultation',
        category: expertType || 'doctor',
        accent: 'teal',
        subtitle: null,
      };

      const consultationMode = resolveConsultationMode(item.consultation_mode);
      const resolvedExpertId = (() => {
        const raw = item.expert_id ?? item.expertId;
        const id = Number(raw);
        return Number.isFinite(id) && id > 0 ? id : null;
      })();
      const appointment = {
        id: `consultation-${item.consultation_id}`,
        consultationId: item.consultation_id,
        consultation_id: item.consultation_id,
        engagementId: item.engagement_id ?? item.engagementId ?? null,
        engagement_id: item.engagement_id ?? item.engagementId ?? null,
        expertId: resolvedExpertId,
        expert_id: resolvedExpertId,
        status,
        category: meta.category,
        accent: meta.accent,
        expertType,
        expertName: resolveExpertName(item, expertType),
        personRole: item.expert_specialization || meta.subtitle || null,
        photo: item.expert_photo || null,
        ratingLabel: item.expert_rating
          ? `${item.expert_rating}${item.expert_review_count ? ` (${item.expert_review_count} reviews)` : ''}`
          : null,
        whenLabel: formatWhenLabel(item.date, item.slot),
        notesWhenLabel: formatNotesWhenLabel(item.date, item.slot),
        title: meta.title,
        subtitle: meta.subtitle,
        cabin: item.cabin ?? null,
        cabinLabel: formatCabinDisplay(item.cabin),
        ...(consultationMode || {}),
        apiDate: item.date,
        apiSlot: item.slot,
        consultationSummary: item.consultation_summary || null,
        attachments: normalizeAttachments(item.attachments),
        showInfo: status === 'scheduled',
      };

      if (status === 'completed') {
        const statusBadge = resolveCompletedBadge(item);
        if (statusBadge) {
          appointment.statusBadge = statusBadge;
        }
      }

      if (status === 'cancelled' && !appointment.cancelReason && isConsultationSlotPast(item)) {
        appointment.cancelReason = 'Missed';
      }

      return appointment;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a.apiDate || !b.apiDate) {
        return 0;
      }
      const dateCompare = a.apiDate.localeCompare(b.apiDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return String(a.apiSlot || '').localeCompare(String(b.apiSlot || ''));
    });
};

export const appointmentsFromConsultationRows = (rows) => {
  // Expert name/photo come from GET /experts/{expert_id} only on Appointment Details.
  return mapMyConsultationsToAppointments(Array.isArray(rows) ? rows : []);
};

export const fetchMyConsultationAppointments = async () => {
  const response = await getMyConsultations();
  return appointmentsFromConsultationRows(response?.data);
};
