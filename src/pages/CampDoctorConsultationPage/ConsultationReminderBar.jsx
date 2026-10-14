import { useEffect, useState } from 'react';
import './CampDoctorConsultationPage.css';
import { getAppointmentEndMs } from '../../utils/campAppointments';
import chevronIcon from '../../images/camp-doctor-chevron.svg';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

const formatReminder = (appointment) => {
  const startMs = Number(appointment?.startsAt || 0);
  const start = new Date(startMs);
  const hasStart = Number.isFinite(startMs) && startMs > 0 && !Number.isNaN(start.getTime());
  const hours24 = hasStart ? start.getHours() : 0;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const minutes = hasStart ? String(start.getMinutes()).padStart(2, '0') : '00';
  const isClinic = Boolean(appointment?.cabinKey)
    || String(appointment?.consultationMode || '').toLowerCase() === 'offline';

  return {
    dateLabel: hasStart
      ? `${WEEKDAYS[start.getDay()]}, ${start.getDate()} ${MONTHS[start.getMonth()]}`
      : String(appointment?.reminderDate || '').toUpperCase(),
    time: hasStart ? `${String(hours12).padStart(2, '0')}:${minutes}` : '--:--',
    period: hasStart ? period : '',
    mode: isClinic ? 'In Clinic' : 'Online Call',
    title: appointment?.title || (appointment?.category === 'nutritionist'
      ? 'Nutritionist Consultation'
      : 'Doctor Consultation'),
  };
};

export default function ConsultationReminderBar({ appointment, onOpen }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  const endMs = getAppointmentEndMs(appointment);
  if (!appointment || (endMs > 0 && endMs <= nowMs)) {
    return null;
  }

  const reminder = formatReminder(appointment);

  return (
    <button
      type="button"
      className="camp-doctor-reminder"
      onClick={() => onOpen?.(appointment)}
      aria-label={`${reminder.title} at ${reminder.time} ${reminder.period}`}
    >
      <span className="camp-doctor-reminder__when">
        <span className="camp-doctor-reminder__kicker">{reminder.dateLabel}</span>
        <span className="camp-doctor-reminder__clock">
          <strong>{reminder.time}</strong>
          <span>{reminder.period}</span>
        </span>
      </span>
      <span className="camp-doctor-reminder__rule" aria-hidden="true" />
      <span className="camp-doctor-reminder__copy">
        <span className="camp-doctor-reminder__kicker">{reminder.mode}</span>
        <span className="camp-doctor-reminder__title">{reminder.title}</span>
      </span>
      <span className="camp-doctor-reminder__chevron" aria-hidden="true">
        <img src={chevronIcon} alt="" width="20" height="20" />
      </span>
    </button>
  );
}
