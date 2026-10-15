const STORAGE_KEY = 'ss-camp-appointments';
const SLOT_DURATION_MS = 15 * 60 * 1000;

const parseList = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readCampAppointments = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const fromLocal = window.localStorage.getItem(STORAGE_KEY);
    if (fromLocal) {
      return parseList(fromLocal);
    }

    const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) {
      window.localStorage.setItem(STORAGE_KEY, fromSession);
      return parseList(fromSession);
    }
  } catch {
    return [];
  }

  return [];
};

export const saveCampAppointment = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return readCampAppointments();
  }

  const next = [
    appointment,
    ...readCampAppointments().filter((item) => item.id !== appointment.id),
  ];

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures; in-memory state still works for this session.
  }

  return next;
};

export const getAppointmentEndMs = (appointment) => {
  const endsAt = Number(appointment?.endsAt || 0);
  if (endsAt > 0) {
    return endsAt;
  }

  const startsAt = Number(appointment?.startsAt || 0);
  return startsAt > 0 ? startsAt + SLOT_DURATION_MS : 0;
};

const persistCampAppointments = (appointments) => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
    }
  } catch {
    // Ignore quota / private-mode failures.
  }
  return appointments;
};

/** Mark locally stored scheduled appointments as cancelled once their slot has ended. */
export const expirePastCampAppointments = (appointments = [], nowMs = Date.now()) => {
  let changed = false;
  const next = (Array.isArray(appointments) ? appointments : []).map((item) => {
    if (!item || item.status !== 'scheduled') {
      return item;
    }
    const endMs = getAppointmentEndMs(item);
    if (endMs > 0 && endMs <= nowMs) {
      changed = true;
      return {
        ...item,
        status: 'cancelled',
        cancelReason: item.cancelReason || 'Missed',
      };
    }
    return item;
  });

  return changed ? persistCampAppointments(next) : next;
};

/**
 * Align local camp reminder appointments with API consultation rows.
 * If the API already has the same expert category as cancelled/completed (or past + not done),
 * drop the stale local "scheduled" reminder so home / All Appointments do not show it.
 */
export const reconcileCampAppointmentsWithApi = (appointments = [], apiAppointments = [], nowMs = Date.now()) => {
  let next = expirePastCampAppointments(appointments, nowMs);
  const apiRows = Array.isArray(apiAppointments) ? apiAppointments : [];
  let changed = false;

  next = next.map((item) => {
    if (!item || item.status !== 'scheduled') {
      return item;
    }

    const category = String(item.category || item.expertType || '').trim().toLowerCase();
    if (!category) {
      return item;
    }

    const matchingApi = apiRows.filter((row) => {
      const rowCategory = String(row?.category || row?.expertType || '').trim().toLowerCase();
      return rowCategory && rowCategory === category;
    });

    if (matchingApi.length === 0) {
      return item;
    }

    // Keep local reminder if API still has any scheduled row for this type.
    if (matchingApi.some((row) => String(row?.status || '').trim().toLowerCase() === 'scheduled')) {
      return item;
    }

    const superseded = matchingApi[0];
    const apiStatus = String(superseded?.status || '').trim().toLowerCase();
    changed = true;
    return {
      ...item,
      status: apiStatus === 'completed' ? 'completed' : 'cancelled',
      cancelReason: superseded?.cancelReason || item.cancelReason || 'Missed',
    };
  });

  return changed ? persistCampAppointments(next) : next;
};

export const getUpcomingCampAppointment = (appointments = [], nowMs = Date.now()) => {
  const active = expirePastCampAppointments(appointments, nowMs);
  return active.find((item) => {
    if (!item || item.status !== 'scheduled') {
      return false;
    }

    const endMs = getAppointmentEndMs(item);
    if (!endMs) {
      return true;
    }

    return endMs > nowMs;
  }) || null;
};
