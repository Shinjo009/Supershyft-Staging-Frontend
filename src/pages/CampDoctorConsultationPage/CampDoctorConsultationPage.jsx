import React, { useEffect, useMemo, useState } from 'react';
import './CampDoctorConsultationPage.css';
import ConsultationHealthDataConsentSheet from '../../components/ConsultationHealthDataConsentSheet';
import { getEngagementByCode } from '../../services/engagementsService';
import { bookExpertConsultation, getExpertConsultationSlots } from '../../services/expertsService';
import {
  formatDisplaySlotToApi,
  getOfflineCabinsForSelection,
  parseDoctorOfflineSchedule,
  parseOnlineConsultationSchedule,
} from '../../utils/campDoctorOfflineSchedule';
import { ONLINE_CONSULTATION_SLOTS_ENABLED } from './campDoctorConsultationConfig';
import closeIcon from '../../images/camp-doctor-close.svg';
import calendarIcon from '../../images/camp-doctor-calendar.svg';
import clockIcon from '../../images/camp-doctor-clock.svg';

const TIME_SLOTS = [
  '09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM',
  '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
  '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
  '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM',
];

const DAY_PARTS = [
  { id: 'morning', label: 'Morning', startHour: 9, endHour: 12 },
  { id: 'noon', label: 'Noon', startHour: 12, endHour: 14 },
  { id: 'afternoon', label: 'Afternoon', startHour: 14, endHour: 17 },
  { id: 'evening', label: 'Evening', startHour: 17, endHour: 19 },
];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FALLBACK_CABINS = [
  { key: '1', label: 'Cabin 1', available: true },
  { key: '2', label: 'Cabin 2', available: false },
  { key: '3', label: 'Cabin 3', available: true },
  { key: '4', label: 'Cabin 4', available: true },
  { key: '5', label: 'Cabin 5', available: true },
  { key: '6', label: 'Cabin 6', available: true },
  { key: '7', label: 'Cabin 7', available: true },
  { key: '8', label: 'Cabin 8', available: true },
  { key: '9', label: 'Cabin 9', available: true },
];

const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

const buildUpcomingDates = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      id: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      day: DAY_SHORT[date.getDay()],
      number: date.getDate(),
      month: MONTH_SHORT[date.getMonth()],
      year: date.getFullYear(),
    };
  });
};

const addMinutesToSlot = (slotLabel, minutes = 15) => {
  const match = String(slotLabel || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return slotLabel;
  }
  let hours = Number(match[1]);
  const mins = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  const total = hours * 60 + mins + minutes;
  const endHours24 = Math.floor(total / 60) % 24;
  const endMins = total % 60;
  const endPeriod = endHours24 >= 12 ? 'PM' : 'AM';
  const endHours12 = endHours24 % 12 === 0 ? 12 : endHours24 % 12;
  return `${endHours12}:${String(endMins).padStart(2, '0')} ${endPeriod}`;
};

const formatSlotStart = (slotLabel) => {
  const match = String(slotLabel || '').match(/^0?(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return slotLabel;
  }
  return `${Number(match[1])}:${match[2]}`;
};

const formatSlotDisplay = (slotLabel) => {
  const match = String(slotLabel || '').match(/^0?(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return slotLabel;
  }
  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
};

const slotToMinutes = (slotLabel) => {
  const match = String(slotLabel || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return 0;
  }
  let hours = Number(match[1]);
  const mins = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + mins;
};

const toAppointmentStart = (date, slotLabel) => {
  if (date?.apiDate) {
    const [year, month, day] = date.apiDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const minutes = slotToMinutes(slotLabel);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return start;
  }

  const monthIndex = MONTH_SHORT.indexOf(date?.month);
  const start = new Date(
    date?.year || new Date().getFullYear(),
    monthIndex >= 0 ? monthIndex : new Date().getMonth(),
    date?.number || new Date().getDate(),
  );
  const minutes = slotToMinutes(slotLabel);
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return start;
};

const formatWhenLabel = (date, slotLabel) => {
  const time = formatSlotDisplay(slotLabel);
  if (!date) {
    return time;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const booked = toAppointmentStart(date, slotLabel);
  booked.setHours(0, 0, 0, 0);
  const diffDays = Math.round((booked.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) {
    return `Today, ${time}`;
  }
  if (diffDays === 1) {
    return `Tomorrow, ${time}`;
  }
  return `${date.day}, ${time}`;
};

const formatReminderDate = (date) => {
  if (!date) {
    return '';
  }
  return `${date.day}, ${date.number} ${date.month}`;
};

const getApiDate = (date) => {
  if (date?.apiDate) {
    return date.apiDate;
  }

  const monthIndex = MONTH_SHORT.indexOf(date?.month);
  if (monthIndex < 0 || !date?.number) {
    return null;
  }

  const year = date?.year || new Date().getFullYear();
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = String(date.number).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCampDoctorAppointment = (date, slotLabel, cabin, slotDurationMinutes = 15, expertType = 'doctor', consultationMode = 'online') => {
  const copy = resolveExpertPopupCopy(expertType);
  const start = toAppointmentStart(date, slotLabel);
  const startsAt = start.getTime();
  const durationMs = slotDurationMinutes * 60 * 1000;

  return {
    id: `camp-doctor-${date?.id || 'slot'}-${slotLabel}-${cabin?.key || 'online'}`,
    status: 'scheduled',
    category: copy.category,
    kind: 'consult',
    accent: 'teal',
    whenLabel: formatWhenLabel(date, slotLabel),
    reminderTime: slotLabel,
    reminderDate: formatReminderDate(date),
    startsAt,
    endsAt: startsAt + durationMs,
    title: copy.appointmentTitle,
    consultationMode,
    cabinKey: cabin?.key || null,
    cabinLabel: cabin?.label || null,
    apiDate: date?.apiDate || null,
    showInfo: true,
  };
};

const getFirstBookable = (dates, scheduleOrSlots, nowMs) => {
  for (const date of dates) {
    const slots = Array.isArray(scheduleOrSlots)
      ? scheduleOrSlots
      : getSlotsForDate(date, scheduleOrSlots);
    const slot = slots.find((item) => toAppointmentStart(date, item).getTime() > nowMs);
    if (slot) {
      return { dateId: date.id, slot };
    }
  }
  const fallbackDate = dates[0];
  const fallbackSlots = Array.isArray(scheduleOrSlots)
    ? scheduleOrSlots
    : getSlotsForDate(fallbackDate, scheduleOrSlots);
  return { dateId: fallbackDate?.id || '', slot: fallbackSlots[0] || '' };
};

const getSlotsForDate = (date, schedule) => {
  if (schedule && date?.apiDate) {
    return (schedule.slotsByDate[date.apiDate] || []).map((slotItem) => slotItem.displaySlot);
  }
  return TIME_SLOTS;
};

/** Drop dates that are fully past or have no remaining future slots. */
const filterBookableDates = (dateOptions, schedule, nowMs) => (
  (dateOptions || []).filter((date) => (
    getSlotsForDate(date, schedule).some((slot) => toAppointmentStart(date, slot).getTime() > nowMs)
  ))
);

const resolveExpertPopupCopy = (expertType) => {
  const normalized = String(expertType || 'doctor').toLowerCase();
  if (normalized === 'nutritionist') {
    return {
      title: 'Nutritionist Consultation',
      appointmentTitle: 'Nutritionist Consultation',
      category: 'nutritionist',
      lede: 'Tailored nutrition, designed around your body and lifestyle',
      optOutLabel: "I don't want to opt for a nutritionist consultation.",
    };
  }
  return {
    title: 'Doctor Consultation',
    appointmentTitle: 'Doctor Consultation',
    category: 'doctor',
    lede: 'Expert healthcare, personalized to your health conditions and lifestyle',
    optOutLabel: "I don't want to opt for a doctor consultation.",
  };
};

const CampDoctorConsultationPage = ({
  engagementId,
  engagementCode,
  consultationMode,
  expertType = 'doctor',
  onAppointmentBooked,
  onViewAppointment: _onViewAppointment,
  onClose: _onClose,
  onOptOut: _onOptOut,
}) => {
  const fallbackDates = useMemo(() => buildUpcomingDates(), []);
  const normalizedExpertType = String(expertType || 'doctor').toLowerCase();
  const isOnlineMode = ONLINE_CONSULTATION_SLOTS_ENABLED
    && String(consultationMode || '').toLowerCase() === 'online';
  const expertCopy = useMemo(() => resolveExpertPopupCopy(normalizedExpertType), [normalizedExpertType]);
  const canLoadBackendSchedule = isOnlineMode || Boolean(engagementCode);

  const [offlineSchedule, setOfflineSchedule] = useState(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [scheduleStep, setScheduleStep] = useState(null);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [selectedCabinKey, setSelectedCabinKey] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedDayPart, setSelectedDayPart] = useState('morning');

  const dates = useMemo(() => {
    const source = offlineSchedule?.dateOptions?.length ? offlineSchedule.dateOptions : fallbackDates;
    return filterBookableDates(source, offlineSchedule, nowMs);
  }, [offlineSchedule, fallbackDates, nowMs]);
  const slotDurationMinutes = offlineSchedule?.slotDurationMinutes || 15;
  const requiresCabinStep = offlineSchedule?.hasCabins === true;

  const firstBookable = useMemo(
    () => getFirstBookable(dates, offlineSchedule || TIME_SLOTS, nowMs),
    [dates, offlineSchedule, nowMs],
  );

  const [selectedDateId, setSelectedDateId] = useState(firstBookable.dateId);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(firstBookable.slot);

  useEffect(() => {
    const timerId = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    setSelectedDateId(firstBookable.dateId);
    setSelectedTimeSlot(firstBookable.slot);
  }, [firstBookable.dateId, firstBookable.slot]);

  const selectedDate = dates.find((item) => item.id === selectedDateId) || dates[0];

  const availableCabins = useMemo(() => {
    if (offlineSchedule && selectedDate?.apiDate && selectedTimeSlot) {
      const cabins = getOfflineCabinsForSelection(offlineSchedule, selectedDate, selectedTimeSlot);
      if (cabins.length > 0) {
        return cabins;
      }
    }
    if (!requiresCabinStep) {
      return [];
    }
    return FALLBACK_CABINS;
  }, [offlineSchedule, selectedDate, selectedTimeSlot, requiresCabinStep]);

  useEffect(() => {
    if (!availableCabins.some((cabin) => cabin.key === selectedCabinKey)) {
      setSelectedCabinKey(availableCabins[0]?.key || null);
    }
  }, [availableCabins, selectedCabinKey]);

  const selectedCabin = availableCabins.find((cabin) => cabin.key === selectedCabinKey) || availableCabins[0] || null;

  const selectedSlotMeta = useMemo(() => {
    if (!offlineSchedule || !selectedDate?.apiDate || !selectedTimeSlot) {
      return null;
    }
    return (offlineSchedule.slotsByDate[selectedDate.apiDate] || [])
      .find((item) => item.displaySlot === selectedTimeSlot) || null;
  }, [offlineSchedule, selectedDate, selectedTimeSlot]);

  const effectiveSlotDuration = selectedCabin?.slotDuration
    || selectedSlotMeta?.durationMinutes
    || slotDurationMinutes;

  const availableSlots = useMemo(() => {
    const part = DAY_PARTS.find((p) => p.id === selectedDayPart);
    const sourceSlots = offlineSchedule && selectedDate?.apiDate
      ? (offlineSchedule.slotsByDate[selectedDate.apiDate] || [])
      : [];
    const fallbackSlots = sourceSlots.length > 0
      ? sourceSlots
      : TIME_SLOTS.map((slot) => ({ displaySlot: slot, spotLeft: null }));

    return fallbackSlots
      .filter((slotItem) => {
        const slot = slotItem.displaySlot || slotItem;
        if (selectedDate && toAppointmentStart(selectedDate, slot).getTime() <= nowMs) {
          return false;
        }
        if (part) {
          const mins = slotToMinutes(slot);
          const hour = Math.floor(mins / 60);
          if (hour < part.startHour || hour >= part.endHour) {
            return false;
          }
        }
        return true;
      })
      .map((slotItem) => (
        typeof slotItem === 'string'
          ? { displaySlot: slotItem, spotLeft: null }
          : {
            displaySlot: slotItem.displaySlot,
            spotLeft: slotItem.spotLeft,
          }
      ));
  }, [offlineSchedule, selectedDate, nowMs, selectedDayPart]);

  useEffect(() => {
    if (
      availableSlots.length > 0
      && !availableSlots.some((slotItem) => slotItem.displaySlot === selectedTimeSlot)
    ) {
      setSelectedTimeSlot(availableSlots[0].displaySlot);
    }
  }, [availableSlots, selectedTimeSlot]);

  const dateSummary = selectedDate
    ? `${ordinal(selectedDate.number)} ${selectedDate.month}`
    : '';

  const slotSummary = selectedDate && selectedTimeSlot
    ? `${ordinal(selectedDate.number)} ${selectedDate.month}  |  ${formatSlotStart(selectedTimeSlot)} - ${addMinutesToSlot(selectedTimeSlot, effectiveSlotDuration)}`
    : '';

  const closeSchedule = () => {
    setScheduleStep(null);
    setIsConsentOpen(false);
    setScheduleError('');
    setBookingError('');
    setBookedAppointment(null);
  };

  const finishBookingFlow = () => {
    if (bookedAppointment) {
      onAppointmentBooked?.(bookedAppointment);
    }
    closeSchedule();
  };

  const buildLocalAppointment = () => buildCampDoctorAppointment(
    selectedDate,
    selectedTimeSlot,
    selectedCabin,
    selectedCabin?.slotDuration || effectiveSlotDuration,
    normalizedExpertType,
    isOnlineMode ? 'online' : 'offline',
  );

  const openConsentAfterBooking = () => {
    setScheduleStep(null);
    setIsConsentOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTimeSlot) {
      return false;
    }
    if (requiresCabinStep && !selectedCabin) {
      return false;
    }

    setIsBooking(true);
    setBookingError('');

    try {
      const apiDate = getApiDate(selectedDate);
      const apiSlot = formatDisplaySlotToApi(selectedTimeSlot);

      if (engagementId) {
        await bookExpertConsultation({
          engagementId,
          expertType: normalizedExpertType,
          date: apiDate,
          cabin: requiresCabinStep ? selectedCabin.key : undefined,
          slot: apiSlot,
        });
      }

      setBookedAppointment(buildLocalAppointment());
      return true;
    } catch (error) {
      console.error('Failed to book consultation:', error);
      setBookingError('Unable to confirm your appointment. Please try again.');
      return false;
    } finally {
      setIsBooking(false);
    }
  };

  const handleBookNow = async () => {
    if (!canLoadBackendSchedule) {
      setScheduleStep('date');
      return;
    }

    setIsLoadingSchedule(true);
    setScheduleError('');

    try {
      const schedule = isOnlineMode
        ? parseOnlineConsultationSchedule(
          await getExpertConsultationSlots(normalizedExpertType),
          normalizedExpertType,
        )
        : parseDoctorOfflineSchedule(
          await getEngagementByCode(engagementCode),
          normalizedExpertType,
        );

      if (!schedule.dateOptions.length) {
        setScheduleError('No consultation slots are available right now.');
        return;
      }

      const bookableDates = filterBookableDates(schedule.dateOptions, schedule, Date.now());
      if (!bookableDates.length) {
        setScheduleError('No upcoming consultation slots are available right now.');
        return;
      }

      setOfflineSchedule(schedule);
      const initial = getFirstBookable(bookableDates, schedule, Date.now());

      setSelectedDateId(initial.dateId);
      setSelectedTimeSlot(initial.slot);
      setSelectedCabinKey(null);
      setSelectedDayPart('morning');
      setScheduleStep('date');
    } catch (error) {
      console.error('Failed to load consultation schedule:', error);
      setScheduleError('Unable to load consultation slots. Please try again.');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const handleDateSelect = (item) => {
    setSelectedDateId(item.id);
    setSelectedCabinKey(null);
    setSelectedDayPart('morning');
    const nextSlots = offlineSchedule && item.apiDate
      ? (offlineSchedule.slotsByDate[item.apiDate] || []).map((slotItem) => slotItem.displaySlot)
      : TIME_SLOTS;
    const nextSlot = nextSlots.find((slot) => toAppointmentStart(item, slot).getTime() > nowMs);
    if (nextSlot) {
      setSelectedTimeSlot(nextSlot);
    }
  };

  const handleDateConfirm = () => {
    if (!selectedDate) {
      return;
    }
    setScheduleStep('time');
  };

  const handleTimeConfirm = () => {
    if (!selectedTimeSlot) {
      return;
    }
    if (requiresCabinStep) {
      setSelectedCabinKey(null);
      setScheduleStep('cabin');
      return;
    }
    void (async () => {
      const booked = await handleConfirmBooking();
      if (booked) {
        openConsentAfterBooking();
      }
    })();
  };

  const handleCabinConfirm = () => {
    if (!selectedCabin) {
      return;
    }
    void (async () => {
      const booked = await handleConfirmBooking();
      if (booked) {
        openConsentAfterBooking();
      }
    })();
  };

  return (
    <>
      {!scheduleStep && !isConsentOpen ? (
        <div
          className="camp-doctor-consult"
          role="dialog"
          aria-label={`Complimentary ${expertCopy.title}`}
        >
          <section className="camp-doctor-consult__card">
            <div className="camp-doctor-consult__row">
              <div className="camp-doctor-consult__copy">
                <p className="camp-doctor-consult__kicker">Complimentary</p>
                <h2 className="camp-doctor-consult__title">{expertCopy.title}</h2>
                {scheduleError ? (
                  <p className="camp-doctor-consult__error" role="alert">{scheduleError}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="camp-doctor-consult__cta"
                disabled={isLoadingSchedule}
                onClick={() => {
                  void handleBookNow();
                }}
              >
                {isLoadingSchedule ? 'Loading...' : 'Book Now'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {scheduleStep === 'date' ? (
        <div className="camp-doctor-schedule" role="dialog" aria-modal="true" aria-label="Select date">
          <button
            type="button"
            className="camp-doctor-schedule__backdrop"
            aria-label="Close"
            onClick={closeSchedule}
          />
          <div className="camp-doctor-schedule__stack">
            <button
              type="button"
              className="camp-doctor-schedule__close"
              aria-label="Close"
              onClick={closeSchedule}
            >
              <img src={closeIcon} alt="" className="camp-doctor-schedule__close-img" />
            </button>
            <div className="camp-doctor-schedule__sheet">
              <h2 className="camp-doctor-schedule__title">Schedule Appointment</h2>

              <div className="camp-doctor-schedule__label">
                <span className="camp-doctor-schedule__label-icon" aria-hidden="true">
                  <img src={calendarIcon} alt="" />
                </span>
                <span>Preferred Date</span>
              </div>
              <div className="camp-doctor-schedule__dates">
                {dates.map((item) => {
                  const isSelected = item.id === selectedDateId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`camp-doctor-schedule__date${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleDateSelect(item)}
                    >
                      <span className="camp-doctor-schedule__date-day">{item.day}</span>
                      <span className="camp-doctor-schedule__date-number">{item.number}</span>
                    </button>
                  );
                })}
              </div>

              <div className="camp-doctor-schedule__footer">
                <div className="camp-doctor-schedule__footer-copy">
                  <p className="camp-doctor-schedule__footer-label">Date selected</p>
                  <p className="camp-doctor-schedule__footer-value">{dateSummary || '—'}</p>
                </div>
                <button
                  type="button"
                  className="camp-doctor-schedule__confirm"
                  disabled={!selectedDate || dates.length === 0}
                  onClick={handleDateConfirm}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleStep === 'cabin' && requiresCabinStep ? (
        <div className="camp-doctor-schedule" role="dialog" aria-modal="true" aria-label="Select cabin">
          <button
            type="button"
            className="camp-doctor-schedule__backdrop"
            aria-label="Close"
            onClick={closeSchedule}
          />
          <div className="camp-doctor-schedule__stack">
            <button
              type="button"
              className="camp-doctor-schedule__close"
              aria-label="Close"
              onClick={closeSchedule}
            >
              <img src={closeIcon} alt="" className="camp-doctor-schedule__close-img" />
            </button>
            <div className="camp-doctor-schedule__sheet">
              <>
                <h2 className="camp-doctor-schedule__title">Select Cabin</h2>

                <div className="camp-doctor-schedule__label">
                  <span className="camp-doctor-schedule__label-icon" aria-hidden="true">🚪</span>
                  <span>Available Cabins</span>
                </div>

                <div className="camp-doctor-cabin__grid">
                  {availableCabins.map((cabin) => {
                    const isSelected = cabin.key === selectedCabinKey;
                    return (
                      <button
                        key={cabin.key}
                        type="button"
                        className={`camp-doctor-cabin__btn${isSelected ? ' is-selected' : ''}${!cabin.available ? ' is-disabled' : ''}`}
                        disabled={!cabin.available}
                        onClick={() => setSelectedCabinKey(cabin.key)}
                      >
                        <span className="camp-doctor-cabin__btn-label">{cabin.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="camp-doctor-schedule__footer">
                  <div className="camp-doctor-schedule__footer-copy">
                    <p className="camp-doctor-schedule__footer-label">Cabin selected</p>
                    <p className="camp-doctor-schedule__footer-value">{selectedCabin?.label || '—'}</p>
                    {bookingError ? (
                      <p className="camp-doctor-schedule__error" role="alert">{bookingError}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="camp-doctor-schedule__confirm"
                    disabled={!selectedCabin || availableCabins.length === 0 || isBooking}
                    onClick={handleCabinConfirm}
                  >
                    {isBooking ? 'Booking...' : 'Confirm'}
                  </button>
                </div>
              </>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleStep === 'time' ? (
        <div className="camp-doctor-schedule" role="dialog" aria-modal="true" aria-label="Select time">
          <button
            type="button"
            className="camp-doctor-schedule__backdrop"
            aria-label="Close schedule appointment"
            onClick={closeSchedule}
          />
          <div className="camp-doctor-schedule__stack">
            <button
              type="button"
              className="camp-doctor-schedule__close"
              aria-label="Close schedule appointment"
              onClick={closeSchedule}
            >
              <img src={closeIcon} alt="" className="camp-doctor-schedule__close-img" />
            </button>
            <div className="camp-doctor-schedule__sheet">
              <h2 className="camp-doctor-schedule__title">Schedule Appointment</h2>

              <div className="camp-doctor-schedule__daypart">
                <div className="camp-doctor-schedule__label">
                  <span className="camp-doctor-schedule__label-icon camp-doctor-schedule__label-icon--sun" aria-hidden="true">☀</span>
                  <span>Select part of the day</span>
                </div>
                <div className="camp-doctor-schedule__daypart-grid">
                  {DAY_PARTS.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      className={`camp-doctor-schedule__daypart-btn${part.id === selectedDayPart ? ' is-selected' : ''}`}
                      onClick={() => setSelectedDayPart(part.id)}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="camp-doctor-schedule__time-head">
                <div className="camp-doctor-schedule__label">
                  <span className="camp-doctor-schedule__label-icon" aria-hidden="true">
                    <img src={clockIcon} alt="" />
                  </span>
                  <span>Preferred Time Slot</span>
                </div>
                <p className="camp-doctor-schedule__time-note">
                  Each appointment is around {effectiveSlotDuration}-minutes
                </p>
              </div>

              <div className="camp-doctor-schedule__slots-wrap">
                <div className="camp-doctor-schedule__slots">
                  {availableSlots.length > 0 ? availableSlots.map((slotItem) => {
                    const slot = slotItem.displaySlot;
                    const isSelected = slot === selectedTimeSlot;
                    const spotsLeft = Number(slotItem.spotLeft);
                    const spotsLabel = Number.isFinite(spotsLeft) && spotsLeft > 0
                      ? `${spotsLeft} left`
                      : null;
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`camp-doctor-schedule__slot${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setSelectedTimeSlot(slot)}
                      >
                        <span className="camp-doctor-schedule__slot-label">{slot}</span>
                        {spotsLabel ? (
                          <span className="camp-doctor-schedule__slot-spots">{spotsLabel}</span>
                        ) : null}
                      </button>
                    );
                  }) : (
                    <p className="camp-doctor-schedule__empty">No slots available for this date.</p>
                  )}
                </div>
              </div>

              <div className="camp-doctor-schedule__footer">
                <div className="camp-doctor-schedule__footer-copy">
                  <p className="camp-doctor-schedule__footer-label">Slot selected</p>
                  <p className="camp-doctor-schedule__footer-value">{slotSummary}</p>
                  {!requiresCabinStep && bookingError ? (
                    <p className="camp-doctor-schedule__error" role="alert">{bookingError}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="camp-doctor-schedule__confirm"
                  disabled={!selectedTimeSlot || availableSlots.length === 0 || isBooking}
                  onClick={handleTimeConfirm}
                >
                  {!requiresCabinStep && isBooking ? 'Booking...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConsultationHealthDataConsentSheet
        open={isConsentOpen}
        engagementId={engagementId}
        expertType={normalizedExpertType}
        onClose={() => {
          finishBookingFlow();
        }}
        onContinue={() => {
          finishBookingFlow();
        }}
      />
    </>
  );
};

export default CampDoctorConsultationPage;
