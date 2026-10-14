import doctorBanner from '../../images/supercare/supercare-banner-1.jpg';
import nutritionBanner from '../../images/supercare/nutrition/profile-banner.png';
import ayurvedaBanner from '../../images/supercare/ayurveda/profile-banner.jpg';
import portrait from '../../images/supercare/supercare-doctor.jpg';
import ratingStar from '../../images/supercare/supercare-star.svg';
import backIcon from '../../images/supercare/profile/back.svg';
import badgeIcon from '../../images/supercare/profile/badge.svg';
import videoIcon from '../../images/supercare/profile/video.svg';
import languageIcon from '../../images/supercare/profile/language.svg';
import timeIcon from '../../images/supercare/profile/time.svg';
import pageMesh from '../../images/supercare/profile/background.svg';
import closeIcon from '../../images/supercare/profile/close.svg';
import calendarIcon from '../../images/supercare/profile/calendar.svg';
import dayPartIcon from '../../images/supercare/profile/day-part.svg';
import clockIcon from '../../images/supercare/profile/clock.svg';
import dotIcon from '../../images/supercare/profile/dot.svg';
import successCheck from '../../images/supercare/profile/success-check.svg';
import downloadIcon from '../../images/supercare/profile/download.svg';
import confirmedCheck from '../../images/supercare/profile/confirmed-check.svg';
import confirmedCalendar from '../../images/supercare/profile/confirmed-calendar.svg';
import confirmedClock from '../../images/supercare/profile/confirmed-clock.svg';
import reviewStar from '../../images/supercare/profile/star.svg';
import verifiedIcon from '../../images/supercare/profile/verified.svg';
import { reviewsForExpert } from './expertReviews';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RAZORPAY_KEY_ID } from '../../config/appConfig';
import { confirmConsultationBooking, createConsultationPayOrder } from '../../services/bookingService';
import { getExpertConsultationSlots } from '../../services/expertsService';
import { formatApiSlotToDisplay, parseOnlineConsultationSchedule } from '../../utils/campDoctorOfflineSchedule';
import { formatExpertRupees } from '../../utils/expertsCatalog';
import './DoctorProfilePage.css';

const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayCheckout = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Payment checkout is not available in this browser.'));
  }
  if (typeof window.Razorpay === 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      if (typeof window.Razorpay === 'function') {
        resolve();
        return;
      }
      reject(new Error('Payment checkout could not be loaded. Please try again.'));
    };
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', finish);
      existing.addEventListener('error', () => reject(new Error('Payment checkout could not be loaded. Please try again.')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('Payment checkout could not be loaded. Please try again.'));
    document.body.appendChild(script);
  });
};

const readablePayError = (error) => {
  const message = String(error?.message || '').trim();
  if (!message || message.includes('WEBPACK') || message.includes('is not a function')) {
    return 'Payment could not start. Please try again.';
  }
  return message;
};

const PROFILE_BANNERS = {
  doctor: { banner: doctorBanner, bannerFit: 'crop' },
  nutritionist: { banner: nutritionBanner, bannerFit: 'cover' },
  ayurveda: { banner: ayurvedaBanner, bannerFit: 'cover' },
};

const splitExpertName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts;
  }
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
};

function ReviewStars({ count }) {
  return (
    <div className="doctor-profile__stars" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <img
          key={index}
          className={index < count ? undefined : 'is-empty'}
          src={reviewStar}
          alt=""
          width="11.6667"
          height="11.0833"
        />
      ))}
    </div>
  );
}

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

export default function DoctorProfilePage({
  onBack,
  onGoHome,
  onViewAppointments,
  profileKind = 'doctor',
  expert = null,
  bookingUserId = null,
}) {
  const profile = useMemo(() => {
    const kind = expert?.kind || profileKind || 'doctor';
    const shell = PROFILE_BANNERS[kind] || PROFILE_BANNERS.doctor;
    const fee = Number(expert?.feePaise);
    const original = Number(expert?.originalFeePaise);
    const hasDiscount = Number.isFinite(original) && Number.isFinite(fee) && original > fee;
    return {
      banner: shell.banner,
      bannerFit: shell.bannerFit,
      name: expert?.name || '',
      nameLines: splitExpertName(expert?.name),
      badge: expert?.specialty || '',
      showBadgeIcon: kind === 'doctor' && Boolean(expert?.specialty),
      qualifications: expert?.qualifications || '',
      experienceStat: expert?.experienceStat || '',
      patientsLabel: expert?.patientsLabel || '',
      about: expert?.about || '',
      modeLabel: expert?.modeLabel || '',
      languagesLabel: expert?.languagesLabel || '',
      durationLabel: expert?.durationLabel || '',
      rating: expert?.rating || '',
      photo: expert?.photo || portrait,
      price: expert?.price || '',
      priceOld: expert?.priceOld || '',
      discount: expert?.discount || '',
      consultationAmount: hasDiscount ? formatExpertRupees(original) : (Number.isFinite(fee) ? formatExpertRupees(fee) : ''),
      discountAmount: hasDiscount ? `-${formatExpertRupees(original - fee)}` : '',
      totalAmount: Number.isFinite(fee) ? formatExpertRupees(fee) : '',
      successAmount: Number.isFinite(fee) ? `${formatExpertRupees(fee)}/-` : '',
      sessionNote: expert?.sessionDurationMins
        ? `Each appointment is around ${expert.sessionDurationMins}-minutes`
        : '',
    };
  }, [expert, profileKind]);
  const [sheet, setSheet] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [slotsStatus, setSlotsStatus] = useState('idle');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [payError, setPayError] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const paymentHandlerInvokedRef = useRef(false);

  useEffect(() => {
    if (sheet !== 'schedule') {
      return undefined;
    }
    const expertId = expert?.expertId;
    const expertType = expert?.expertType || expert?.kind;
    if (!expertId || !expertType) {
      setSchedule(null);
      setSlotsStatus('error');
      return undefined;
    }

    let active = true;
    setSlotsStatus('loading');
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
      });

    return () => {
      active = false;
    };
  }, [sheet, expert]);

  const dateOptions = schedule?.dateOptions || [];
  const chosenDateOption = dateOptions.find((item) => item.apiDate === selectedDate) || null;
  const daySlots = schedule?.slotsByDate?.[selectedDate] || [];
  const availableParts = partsForSlots(daySlots);
  const visibleSlots = daySlots.filter((slot) => partForSlot(slot.apiSlot) === selectedPart);
  const chosenSlot = daySlots.find((slot) => slot.apiSlot === selectedSlotId) || null;
  const chosenDate = chosenDateOption
    ? {
      label: `${ordinalDay(chosenDateOption.number)} ${chosenDateOption.month}`,
      card: `${chosenDateOption.number} ${chosenDateOption.month}`,
    }
    : { label: '', card: '' };
  const profileReviews = useMemo(() => reviewsForExpert(expert), [expert]);
  const slotDuration = chosenSlot?.durationMinutes || schedule?.slotDurationMinutes || expert?.sessionDurationMins;
  const sessionNote = slotDuration ? `Each appointment is around ${slotDuration}-minutes` : profile.sessionNote;

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

  useEffect(() => {
    if (!sheet) return undefined;
    const scroller = document.querySelector('.app-scroll');
    if (!scroller) return undefined;
    scroller.scrollTop = 0;
    const previousOverflow = scroller.style.overflow;
    scroller.style.overflow = 'hidden';
    return () => {
      scroller.style.overflow = previousOverflow;
    };
  }, [sheet]);

  const handleConfirmAndPay = async () => {
    if (paySubmitting) return;
    setPayError('');
    const userId = Number(bookingUserId);
    const expertId = Number(expert?.expertId);
    const expertType = String(expert?.expertType || expert?.kind || '').trim();
    const date = String(selectedDate || '').trim();
    const slotMatch = String(chosenSlot?.apiSlot || '').match(/^(\d{1,2}):(\d{2})$/);
    const slot = slotMatch
      ? `${String(Number(slotMatch[1])).padStart(2, '0')}:${slotMatch[2]}`
      : '';

    if (!Number.isInteger(userId) || userId <= 0) {
      setPayError('Please log in to complete payment.');
      return;
    }
    if (!Number.isInteger(expertId) || expertId <= 0 || !expertType) {
      setPayError('This expert cannot be booked right now.');
      return;
    }
    if (!date || !slot) {
      setPayError('Select a date and time before paying.');
      return;
    }

    paymentHandlerInvokedRef.current = false;
    setPaySubmitting(true);
    try {
      await loadRazorpayCheckout();
      const order = await createConsultationPayOrder({
        members: [
          {
            user_id: userId,
            expert_type: expertType,
            expert_id: expertId,
            date,
            slot,
          },
        ],
      });
      const key = order.keyId || RAZORPAY_KEY_ID;
      if (!key) {
        throw new Error('Payment could not start. The server did not return a Razorpay key.');
      }

      const amountRupees = Number(order.raw?.amount_rupees);
      const amountLabel = Number.isFinite(amountRupees)
        ? `₹${Number.isInteger(amountRupees) ? amountRupees : amountRupees.toFixed(2)}/-`
        : `${formatExpertRupees(order.amount)}/-`;

      const options = {
        key,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.orderId,
        name: 'Super Shyft',
        description: profile.name ? `Consultation with ${profile.name}` : 'Consultation booking',
        theme: { color: '#296359' },
        handler(response) {
          paymentHandlerInvokedRef.current = true;
          setPaySubmitting(true);
          void (async () => {
            try {
              const confirmed = await confirmConsultationBooking(response);
              setPaymentReceipt({
                transactionId: confirmed?.razorpay_payment_id || response.razorpay_payment_id || order.orderId,
                amountLabel,
              });
              setPayError('');
              setSheet('success');
            } catch (error) {
              setPayError(readablePayError(error) || 'Payment succeeded, but the consultation could not be scheduled.');
            } finally {
              setPaySubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss() {
            if (paymentHandlerInvokedRef.current) return;
            setPayError('Payment was cancelled.');
            setPaySubmitting(false);
          },
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on('payment.failed', (response) => {
        paymentHandlerInvokedRef.current = true;
        setPayError(response?.error?.description || 'Payment could not be completed.');
        setPaySubmitting(false);
      });
      checkout.open();
    } catch (error) {
      setPayError(readablePayError(error));
      setPaySubmitting(false);
    }
  };

  if (sheet === 'success') {
    return (
      <div className="doctor-profile doctor-profile--success">
        <div className="doctor-profile__success-hero">
          <div className="doctor-profile__success-badge">
            <span className="doctor-profile__success-ring doctor-profile__success-ring--lg" />
            <span className="doctor-profile__success-ring doctor-profile__success-ring--md" />
            <span className="doctor-profile__success-ring doctor-profile__success-ring--sm" />
            <img src={successCheck} alt="" width="35.8" height="27.3" />
          </div>
        </div>
        <div className="doctor-profile__success-copy">
          <h1>Payment Successful!</h1>
          <p>Your transaction has been processed securely.</p>
          <article className="doctor-profile__success-card">
            <header>
              <h2>Transaction Details</h2>
              <img src={downloadIcon} alt="" width="16" height="16" />
            </header>
            <dl>
              <div>
                <dt>Transaction ID</dt>
                <dd>{paymentReceipt?.transactionId || '—'}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="is-amount">{paymentReceipt?.amountLabel || profile.successAmount}</dd>
              </div>
            </dl>
          </article>
        </div>
        <button type="button" className="doctor-profile__success-continue" onClick={() => setSheet('confirmed')}>Continue</button>
      </div>
    );
  }

  return (
    <div className={`doctor-profile${sheet ? ' doctor-profile--booking' : ''}${sheet === 'payment' || sheet === 'confirmed' ? ' doctor-profile--payment' : ''}`}>
      <img className="doctor-profile__mesh" src={pageMesh} alt="" width="390" height="1095" />
      <div className="doctor-profile__scroll">
        <header className="doctor-profile__hero">
          <div className={`doctor-profile__banner${profile.bannerFit === 'cover' ? ' doctor-profile__banner--cover' : ''}`} aria-hidden="true">
            <img src={profile.banner} alt="" />
          </div>
          <button type="button" className="doctor-profile__back" onClick={onBack} aria-label="Go back">
            <img src={backIcon} alt="" width="24" height="24" />
          </button>
          {profile.rating ? (
            <span className="doctor-profile__rating">
              <span>{profile.rating}</span>
              <img src={ratingStar} alt="" width="11.6667" height="11.0833" />
            </span>
          ) : null}
          <div className="doctor-profile__identity">
            <span className="doctor-profile__avatar">
              <img
                src={profile.photo}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = portrait;
                }}
              />
            </span>
            <div className="doctor-profile__identity-copy">
              <h1>
                {profile.nameLines.map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {index > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </h1>
              {profile.badge ? (
                <span className="doctor-profile__badge">
                  {profile.showBadgeIcon ? (
                    <img src={badgeIcon} alt="" width="12.8361" height="12.8361" />
                  ) : null}
                  {profile.badge}
                </span>
              ) : null}
            </div>
          </div>
        </header>
        <div className="doctor-profile__fade" aria-hidden="true" />

        <div className="doctor-profile__content">
          {(profile.experienceStat || profile.qualifications || profile.patientsLabel) ? (
            <div className="doctor-profile__stats">
              {profile.experienceStat ? (
                <div>
                  <span>Experience</span>
                  <strong>{profile.experienceStat}</strong>
                </div>
              ) : null}
              {profile.qualifications ? (
                <div>
                  <span>Qualifications</span>
                  <strong>{profile.qualifications}</strong>
                </div>
              ) : null}
              {profile.patientsLabel ? (
                <div>
                  <span>Patients</span>
                  <strong>{profile.patientsLabel}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          {profile.about ? (
            <section className="doctor-profile__section doctor-profile__section--about">
              <h2>About</h2>
              <p>
                {profile.about}
              </p>
            </section>
          ) : null}

          {(profile.modeLabel || profile.languagesLabel || profile.durationLabel) ? (
            <section className="doctor-profile__section doctor-profile__section--about">
              <h2>Consultation Details</h2>
              <div className="doctor-profile__modes">
                {profile.modeLabel ? (
                  <div>
                    <span className="doctor-profile__mode-icon">
                      <img src={videoIcon} alt="" width="32" height="32" />
                    </span>
                    <p>{profile.modeLabel}</p>
                  </div>
                ) : null}
                {profile.languagesLabel ? (
                  <div>
                    <span className="doctor-profile__mode-icon">
                      <img src={languageIcon} alt="" width="32" height="32" />
                    </span>
                    <p>{profile.languagesLabel}</p>
                  </div>
                ) : null}
                {profile.durationLabel ? (
                  <div>
                    <span className="doctor-profile__mode-icon">
                      <img src={timeIcon} alt="" width="26.6667" height="29.0853" />
                    </span>
                    <p>{profile.durationLabel}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {profileReviews.length > 0 ? (
            <section className="doctor-profile__section">
              <h2 className="doctor-profile__reviews-title">Reviews</h2>
              <div className="doctor-profile__reviews">
                {profileReviews.map((review) => (
                  <article key={review.id} className="doctor-profile__review">
                    <ReviewStars count={review.stars} />
                    <p>{review.quote}</p>
                    <footer>
                      <strong>{review.name}</strong>
                      <span>
                        <img src={verifiedIcon} alt="" width="11" height="10.5" />
                        Verified
                      </span>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {sheet ? null : (
      <div className="doctor-profile__bar">
        <div className="doctor-profile__fee">
          <span>Consultation Fee</span>
          <p>
            <strong>{profile.price ? `${profile.price}/-` : ''}</strong>
            {profile.priceOld ? <s>{profile.priceOld}/-</s> : null}
            {profile.discount ? <em>{profile.discount}</em> : null}
          </p>
        </div>
        <button type="button" className="doctor-profile__book" onClick={() => setSheet('schedule')}>BOOK</button>
      </div>
      )}

      {sheet === 'schedule' ? (
        <div className="doctor-profile__schedule">
          <button type="button" className="doctor-profile__schedule-close" onClick={() => setSheet(null)} aria-label="Close">
            <img src={closeIcon} alt="" width="32" height="32" />
          </button>
          <div className="doctor-profile__schedule-sheet" role="dialog" aria-labelledby="schedule-appointment-title">
            <h2 id="schedule-appointment-title">Schedule Appointment</h2>
            <div className="doctor-profile__schedule-form">
              <section>
                <p className="doctor-profile__schedule-label">
                  <span className="doctor-profile__schedule-icon doctor-profile__schedule-icon--calendar">
                    <img src={calendarIcon} alt="" width="16.6667" height="18.3333" />
                  </span>
                  Preferred Date
                </p>
                <div className="doctor-profile__dates">
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
                  <p className="doctor-profile__schedule-status">Loading available slots...</p>
                ) : null}
                {slotsStatus === 'error' ? (
                  <p className="doctor-profile__schedule-status">Unable to load appointment slots.</p>
                ) : null}
                {slotsStatus === 'ready' && dateOptions.length === 0 ? (
                  <p className="doctor-profile__schedule-status">No appointment slots are available.</p>
                ) : null}
              </section>
              {availableParts.length > 0 ? (
              <section>
                <p className="doctor-profile__schedule-label">
                  <span className="doctor-profile__schedule-icon doctor-profile__schedule-icon--day">
                    <img src={dayPartIcon} alt="" width="22" height="21" />
                  </span>
                  Select part of the day
                </p>
                <div className="doctor-profile__parts">
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
                <div className="doctor-profile__schedule-label-block">
                  <p className="doctor-profile__schedule-label">
                    <span className="doctor-profile__schedule-icon">
                      <img src={clockIcon} alt="" width="20" height="20" />
                    </span>
                    Preferred Time Slot
                  </p>
                  {sessionNote ? (
                    <p className="doctor-profile__schedule-note">{sessionNote}</p>
                  ) : null}
                </div>
                <div className="doctor-profile__slots">
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
            <footer className="doctor-profile__schedule-footer">
              <div>
                <span>Slot selected</span>
                <strong>{chosenSlot ? `${chosenDate.label}  |  ${formatSlotRange(chosenSlot.apiSlot, chosenSlot.durationMinutes || slotDuration)}` : 'Select a slot'}</strong>
              </div>
              <button type="button" className="doctor-profile__book" disabled={!chosenSlot} onClick={() => setSheet('payment')}>Confirm</button>
            </footer>
          </div>
        </div>
      ) : null}

      {sheet === 'payment' ? (
        <div className="doctor-profile__schedule doctor-profile__schedule--pay">
          <button type="button" className="doctor-profile__schedule-close" onClick={() => setSheet(null)} aria-label="Close">
            <img src={closeIcon} alt="" width="32" height="32" />
          </button>
          <div className="doctor-profile__pay-sheet" role="dialog" aria-label="Payment">
            <div className="doctor-profile__pay-body">
              <article className="doctor-profile__pay-doctor">
                <span className="doctor-profile__pay-avatar">
                  <img
                    src={profile.photo}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = portrait;
                    }}
                  />
                </span>
                <div>
                  <p className="doctor-profile__pay-name">{profile.name}</p>
                  <span>{profile.badge}</span>
                  <p className="doctor-profile__pay-meta">
                    <span>{chosenDate.card}</span>
                    <img src={dotIcon} alt="" width="4" height="4" />
                    <span>{chosenSlot?.displaySlot || ''}</span>
                    {profile.modeLabel ? (
                      <>
                        <img src={dotIcon} alt="" width="4" height="4" />
                        <span>{profile.modeLabel}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </article>
              <label className="doctor-profile__pay-promo">
                <span>Promo Code</span>
                <span className="doctor-profile__pay-promo-field">
                  <input
                    type="text"
                    value={promoCode}
                    placeholder="Enter promo code here"
                    onChange={(event) => setPromoCode(event.target.value)}
                  />
                  <button type="button">APPLY</button>
                </span>
              </label>
              <dl className="doctor-profile__pay-bill">
                <div>
                  <dt>Consultation</dt>
                  <dd>{profile.consultationAmount}</dd>
                </div>
                {profile.discountAmount ? (
                  <div>
                    <dt>
                      Discount
                      {profile.discount ? <em>{profile.discount}</em> : null}
                    </dt>
                    <dd>{profile.discountAmount}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Platform Fee</dt>
                  <dd>Free</dd>
                </div>
                <div className="doctor-profile__pay-total">
                  <dt>Total Amount</dt>
                  <dd>{profile.totalAmount}</dd>
                </div>
              </dl>
            </div>
            {payError ? <p className="doctor-profile__pay-error">{payError}</p> : null}
            <button
              type="button"
              className="doctor-profile__pay"
              disabled={paySubmitting}
              onClick={handleConfirmAndPay}
            >
              {paySubmitting ? 'Please wait...' : 'Confirm & Pay'}
            </button>
          </div>
        </div>
      ) : null}

      {sheet === 'confirmed' ? (
        <div className="doctor-profile__schedule doctor-profile__schedule--confirmed">
          <button type="button" className="doctor-profile__schedule-close" onClick={() => setSheet(null)} aria-label="Close">
            <img src={closeIcon} alt="" width="32" height="32" />
          </button>
          <div className="doctor-profile__confirm" role="dialog" aria-label="Appointment Confirmed">
            <div className="doctor-profile__confirm-head">
              <span className="doctor-profile__confirm-badge">
                <img src={confirmedCheck} alt="" width="32" height="32" />
              </span>
              <h2>Appointment Confirmed</h2>
            </div>
            <div className="doctor-profile__confirm-body">
              <article className="doctor-profile__confirm-doctor">
                <span className="doctor-profile__confirm-avatar">
                  <img
                    src={profile.photo}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = portrait;
                    }}
                  />
                </span>
                <div>
                  <p>{profile.name}</p>
                  <span>{profile.badge}</span>
                </div>
              </article>
              <div className="doctor-profile__confirm-tiles">
                <article>
                  <span className="doctor-profile__confirm-glyph">
                    <img src={confirmedCalendar} alt="" width="34" height="36" />
                  </span>
                  <span>DATE</span>
                  <strong>{chosenDate.card}</strong>
                </article>
                <article>
                  <span className="doctor-profile__confirm-glyph doctor-profile__confirm-glyph--clock">
                    <img src={confirmedClock} alt="" width="36" height="36" />
                  </span>
                  <span>TIME</span>
                  <strong>{chosenSlot?.displaySlot || ''}</strong>
                </article>
              </div>
            </div>
            <div className="doctor-profile__confirm-actions">
              <button type="button" className="doctor-profile__pay" onClick={onViewAppointments}>View Appointment</button>
              <button type="button" className="doctor-profile__confirm-home" onClick={onGoHome}>Go To Home</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
