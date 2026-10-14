import React, { useEffect, useMemo, useState } from 'react';
import closeIcon from '../../images/supercare/profile/close.svg';
import calendarIcon from '../../images/supercare/profile/calendar.svg';
import dayPartIcon from '../../images/supercare/profile/day-part.svg';
import clockIcon from '../../images/supercare/profile/clock.svg';
import { getExpertConsultationSlots, rescheduleExpertConsultation } from '../../services/expertsService';
import { formatApiSlotToDisplay, parseOnlineConsultationSchedule } from '../../utils/campDoctorOfflineSchedule';
import './RescheduleConsultationSheet.css';

const DAY_PARTS = [
  { id: 'Morning', start: 0, end: 12 },
  { id: 'Noon', start: 12, end: 14 },
  { id: 'Afternoon', start: 14, end: 17 },
  { id: 'Evening', start: 17, end: 24 },
];

const ordinalDay = (day) => {
  const value = Number(day);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const slotHour = (apiSlot) => {
  const match = String(apiSlot || '').match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : null;
};

const partForSlot = (apiSlot) => {
  const hour = slotHour(apiSlot);
  return DAY_PARTS.find((part) => hour !== null && hour >= part.start && hour < part.end)?.id || 'Morning';
};

const partsForSlots = (slots) => {
  const present = new Set((slots || []).map((slot) => partForSlot(slot.apiSlot)));
  return DAY_PARTS.map((part) => part.id).filter((id) => present.has(id));
};

const formatSlotRange = (apiSlot, durationMinutes) => {
  const match = String(apiSlot || '').match(/^(\d{1,2}):(\d{2})$/);
  const minutes = Number(durationMinutes);
  if (!match || !Number.isFinite(minutes) || minutes <= 0) {
    return formatApiSlotToDisplay(apiSlot);
  }
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = start + minutes;
  const endApi = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  const startLabel = formatApiSlotToDisplay(apiSlot);
  const endLabel = formatApiSlotToDisplay(endApi);
  const startPeriod = startLabel.slice(-2);
  const endPeriod = endLabel.slice(-2);
  if (startPeriod === endPeriod) {
    return `${startLabel.slice(0, -3)} - ${endLabel}`;
  }
  return `${startLabel} - ${endLabel}`;
};

const resolveCabinPayload = (appointment) => {
  if (appointment?.cabin !== undefined && appointment?.cabin !== null && String(appointment.cabin).trim() !== '') {
    return String(appointment.cabin).trim();
  }
  if (appointment?.cabinId) {
    return String(appointment.cabinId);
  }
  const label = String(appointment?.cabinLabel || '').trim();
  const match = label.match(/(\d+)/);
  if (match) {
    return match[1];
  }
  return null;
};

const RescheduleConsultationSheet = ({ appointment, onClose, onSuccess }) => {
  const [schedule, setSchedule] = useState(null);
  const [slotsStatus, setSlotsStatus] = useState('idle');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const expertType = String(appointment?.expertType || appointment?.category || '').trim().toLowerCase();
  const expertId = appointment?.expertId ?? null;
  const engagementId = appointment?.engagementId ?? null;

  useEffect(() => {
    if (!expertType) {
      setSlotsStatus('error');
      setError('This appointment cannot be rescheduled.');
      return undefined;
    }

    let active = true;
    setSlotsStatus('loading');
    setError('');
    getExpertConsultationSlots(expertType, { expertId })
      .then((data) => {
        if (!active) return;
        const parsed = parseOnlineConsultationSchedule({ data }, expertType);
        const firstDate = parsed.dateOptions[0];
        const firstSlots = firstDate ? (parsed.slotsByDate[firstDate.apiDate] || []) : [];
        const firstPart = partsForSlots(firstSlots)[0] || '';
        const firstSlot = firstSlots.find((slot) => partForSlot(slot.apiSlot) === firstPart);
        setSchedule(parsed);
        setSelectedDate(firstDate?.apiDate || '');
        setSelectedPart(firstPart);
        setSelectedSlotId(firstSlot?.apiSlot || '');
        setSlotsStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setSchedule(null);
        setSelectedDate('');
        setSelectedPart('');
        setSelectedSlotId('');
        setSlotsStatus('error');
        setError('Unable to load appointment slots.');
      });

    return () => {
      active = false;
    };
  }, [expertType, expertId]);

  useEffect(() => {
    const scroller = document.querySelector('.app-scroll');
    if (!scroller) return undefined;
    const previousOverflow = scroller.style.overflow;
    scroller.style.overflow = 'hidden';
    return () => {
      scroller.style.overflow = previousOverflow;
    };
  }, []);

  const dateOptions = schedule?.dateOptions || [];
  const chosenDateOption = dateOptions.find((item) => item.apiDate === selectedDate) || null;
  const daySlots = schedule?.slotsByDate?.[selectedDate] || [];
  const availableParts = partsForSlots(daySlots);
  const visibleSlots = daySlots.filter((slot) => partForSlot(slot.apiSlot) === selectedPart);
  const chosenSlot = daySlots.find((slot) => slot.apiSlot === selectedSlotId) || null;
  const slotDuration = chosenSlot?.durationMinutes || schedule?.slotDurationMinutes || null;
  const chosenDateLabel = chosenDateOption
    ? `${ordinalDay(chosenDateOption.number)} ${chosenDateOption.month}`
    : '';

  const selectDate = (dateKey) => {
    const slots = schedule?.slotsByDate?.[dateKey] || [];
    const nextPart = partsForSlots(slots)[0] || '';
    const nextSlot = slots.find((slot) => partForSlot(slot.apiSlot) === nextPart);
    setSelectedDate(dateKey);
    setSelectedPart(nextPart);
    setSelectedSlotId(nextSlot?.apiSlot || '');
  };

  const selectPart = (part) => {
    const nextSlot = daySlots.find((slot) => partForSlot(slot.apiSlot) === part);
    setSelectedPart(part);
    setSelectedSlotId(nextSlot?.apiSlot || '');
  };

  const footerLabel = useMemo(() => {
    if (!chosenSlot) {
      return 'Select a slot';
    }
    return `${chosenDateLabel}  |  ${formatSlotRange(chosenSlot.apiSlot, chosenSlot.durationMinutes || slotDuration)}`;
  }, [chosenSlot, chosenDateLabel, slotDuration]);

  const handleConfirm = async () => {
    if (submitting || !chosenSlot || !selectedDate) {
      return;
    }
    if (!Number.isFinite(Number(engagementId)) || Number(engagementId) <= 0) {
      setError('Missing engagement for this appointment.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await rescheduleExpertConsultation({
        engagementId,
        expertType,
        date: selectedDate,
        slot: chosenSlot.apiSlot,
        cabin: resolveCabinPayload(appointment),
      });
      if (typeof onSuccess === 'function') {
        onSuccess(result, {
          date: result?.date || selectedDate,
          slot: result?.slot || chosenSlot.apiSlot,
          cabin: result?.cabin ?? resolveCabinPayload(appointment),
        });
      } else if (typeof onClose === 'function') {
        onClose();
      }
    } catch (err) {
      setError(String(err?.message || 'Unable to reschedule. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reschedule-sheet">
      <button
        type="button"
        className="reschedule-sheet__backdrop"
        aria-label="Close reschedule"
        onClick={onClose}
      />
      <div className="reschedule-sheet__panel" role="dialog" aria-labelledby="reschedule-appointment-title">
        <button type="button" className="reschedule-sheet__close" onClick={onClose} aria-label="Close">
          <img src={closeIcon} alt="" width="32" height="32" />
        </button>
        <h2 id="reschedule-appointment-title">Reschedule Appointment</h2>
        <div className="reschedule-sheet__form">
          <section>
            <p className="reschedule-sheet__label">
              <span className="reschedule-sheet__icon reschedule-sheet__icon--calendar">
                <img src={calendarIcon} alt="" width="16.6667" height="18.3333" />
              </span>
              Preferred Date
            </p>
            <div className="reschedule-sheet__dates">
              {dateOptions.map((item) => (
                <button
                  key={item.apiDate}
                  type="button"
                  className={item.apiDate === selectedDate ? 'is-selected' : undefined}
                  onClick={() => selectDate(item.apiDate)}
                >
                  <span>{item.day}</span>
                  <strong>{item.number}</strong>
                </button>
              ))}
            </div>
            {slotsStatus === 'loading' ? (
              <p className="reschedule-sheet__status">Loading available slots...</p>
            ) : null}
            {slotsStatus === 'error' ? (
              <p className="reschedule-sheet__status">{error || 'Unable to load appointment slots.'}</p>
            ) : null}
            {slotsStatus === 'ready' && dateOptions.length === 0 ? (
              <p className="reschedule-sheet__status">No appointment slots are available.</p>
            ) : null}
          </section>

          {availableParts.length > 0 ? (
            <section>
              <p className="reschedule-sheet__label">
                <span className="reschedule-sheet__icon reschedule-sheet__icon--day">
                  <img src={dayPartIcon} alt="" width="22" height="21" />
                </span>
                Select part of the day
              </p>
              <div className="reschedule-sheet__parts">
                {availableParts.map((part) => (
                  <button
                    key={part}
                    type="button"
                    className={part === selectedPart ? 'is-selected' : undefined}
                    onClick={() => selectPart(part)}
                  >
                    {part}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="reschedule-sheet__label-block">
              <p className="reschedule-sheet__label">
                <span className="reschedule-sheet__icon">
                  <img src={clockIcon} alt="" width="20" height="20" />
                </span>
                Preferred Time Slot
              </p>
              {slotDuration ? (
                <p className="reschedule-sheet__note">{`Each appointment is around ${slotDuration}-minutes`}</p>
              ) : null}
            </div>
            <div className="reschedule-sheet__slots">
              {visibleSlots.map((slot) => (
                <button
                  key={slot.apiSlot}
                  type="button"
                  className={slot.apiSlot === selectedSlotId ? 'is-selected' : undefined}
                  onClick={() => setSelectedSlotId(slot.apiSlot)}
                >
                  {slot.displaySlot}
                </button>
              ))}
            </div>
          </section>
        </div>

        {error && slotsStatus !== 'error' ? (
          <p className="reschedule-sheet__error">{error}</p>
        ) : null}

        <footer className="reschedule-sheet__footer">
          <div>
            <span>Slot selected</span>
            <strong>{footerLabel}</strong>
          </div>
          <button
            type="button"
            className="reschedule-sheet__confirm"
            disabled={!chosenSlot || submitting || slotsStatus !== 'ready'}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RescheduleConsultationSheet;
