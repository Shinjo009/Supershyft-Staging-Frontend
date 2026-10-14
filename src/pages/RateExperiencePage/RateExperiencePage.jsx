import React, { useState } from 'react';
import './RateExperiencePage.css';
import { submitExperienceReview } from '../../services/usersService';

const MOOD_OPTIONS = [
  { id: 'excellent', emoji: '😍', label: 'Excellent' },
  { id: 'very-good', emoji: '😊', labelLines: ['Very', 'Good'] },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'could-be-better', emoji: '😐', labelLines: ['Could Be', 'Better'] },
  { id: 'bad', emoji: '😞', label: 'Bad' },
];

const RATING_CATEGORIES = [
  { id: 'blood_collection', label: 'Blood Collection' },
  { id: 'bio_ai_reports', label: 'Bio-AI Reports' },
  { id: 'consultations', label: 'Consultations' },
];

const IMPROVEMENT_OPTIONS = [
  { id: 'delay-report', label: 'Delay in report delivery' },
  { id: 'questionnaire-long', label: 'Questionnaire too long' },
  { id: 'follow-up', label: 'Follow-up support' },
  { id: 'difficult-understand', label: 'Difficult to understand' },
  { id: 'blood-collection-team', label: 'Blood collection team' },
  { id: 'app-experience', label: 'App experience' },
];

const STOOD_OUT_OPTIONS = [
  { id: 'personalized-insights', label: 'Personalized insights' },
  { id: 'report-clarity', label: 'Report clarity' },
  { id: 'follow-up-support', label: 'Follow-up support' },
  { id: 'easy-to-understand', label: 'Easy to understand' },
  { id: 'great-team', label: 'Great team of experts' },
  { id: 'smooth-experience', label: 'Smooth experience' },
];

const NEGATIVE_MOODS = new Set(['could-be-better', 'bad']);

const FeedbackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M4.5 7.875H13.5M4.5 10.125H10.125M5.625 2.25H12.375C13.6176 2.25 14.625 3.25736 14.625 4.5V11.25C14.625 12.4926 13.6176 13.5 12.375 13.5H9.28125L6.1875 15.75V13.5H5.625C4.38236 13.5 3.375 12.4926 3.375 11.25V4.5C3.375 3.25736 4.38236 2.25 5.625 2.25Z" stroke="#F38EB1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ThreeStarsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3.375 12.375L4.79625 7.11188L1.125 4.21875L6.3 3.79688L8.4375 0L10.575 3.79688L15.75 4.21875L12.0788 7.11188L13.5 12.375L8.4375 9.63281L3.375 12.375Z" stroke="#F7DE30" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M11.25 2.25L12.0938 4.78125L14.625 5.625L12.0938 6.46875L11.25 9L10.4062 6.46875L7.875 5.625L10.4062 4.78125L11.25 2.25Z" fill="#F7DE30" />
  </svg>
);

const PersonFeedbackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 9.75C10.6569 9.75 12 8.40685 12 6.75C12 5.09315 10.6569 3.75 9 3.75C7.34315 3.75 6 5.09315 6 6.75C6 8.40685 7.34315 9.75 9 9.75Z" stroke="#3F9CFF" strokeWidth="1.2" />
    <path d="M3.75 15.375C3.75 12.6826 6.05761 10.5 9 10.5C11.9424 10.5 14.25 12.6826 14.25 15.375" stroke="#3F9CFF" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M13.875 4.875L15.75 6.75M15.75 4.875L13.875 6.75" stroke="#3F9CFF" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3.375L14.5125 8.4625L20.25 9.2875L16.125 13.3125L17.025 19.0125L12 16.3875L6.975 19.0125L7.875 13.3125L3.75 9.2875L9.4875 8.4625L12 3.375Z"
      fill={filled ? '#F7DE30' : 'none'}
      stroke={filled ? '#F7DE30' : 'rgba(255,255,255,0.35)'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const SectionHeading = ({ tone, icon, title }) => (
  <div className="rate-experience-page__section-heading">
    <span className={`rate-experience-page__section-icon rate-experience-page__section-icon--${tone}`}>
      {icon}
    </span>
    <h2 className="rate-experience-page__section-title">{title}</h2>
  </div>
);

const StarRatingRow = ({ value, onChange, label }) => (
  <div className="rate-experience-page__rating-row">
    <p className="rate-experience-page__rating-label">{label}</p>
    <div className="rate-experience-page__stars" role="group" aria-label={`${label} rating`}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const filled = starValue <= value;
        return (
          <button
            key={starValue}
            type="button"
            className={`rate-experience-page__star-btn${filled ? ' is-filled' : ''}`}
            aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
            onClick={() => onChange(starValue)}
          >
            <StarIcon filled={filled} />
          </button>
        );
      })}
    </div>
  </div>
);

const RateExperiencePage = ({ onBack, currentUserId = null }) => {
  const [overallMood, setOverallMood] = useState('');
  const [categoryRatings, setCategoryRatings] = useState({
    blood_collection: 0,
    bio_ai_reports: 0,
    consultations: 0,
  });
  const [selectedImprovements, setSelectedImprovements] = useState([]);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isNegativeMood = NEGATIVE_MOODS.has(overallMood);
  const feedbackOptions = isNegativeMood ? IMPROVEMENT_OPTIONS : STOOD_OUT_OPTIONS;
  const feedbackTitle = isNegativeMood ? 'What could be done better?' : 'What stood out?';

  const selectMood = (moodId) => {
    setOverallMood((current) => {
      const nextIsNegative = NEGATIVE_MOODS.has(moodId);
      const currentIsNegative = NEGATIVE_MOODS.has(current);
      if (current && nextIsNegative !== currentIsNegative) {
        setSelectedImprovements([]);
      }
      return moodId;
    });
  };

  const toggleImprovement = (id) => {
    setSelectedImprovements((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const updateCategoryRating = (categoryId, value) => {
    setCategoryRatings((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
  };

  const canSubmit = Boolean(overallMood)
    && RATING_CATEGORIES.every(({ id }) => categoryRatings[id] > 0);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await submitExperienceReview({
        userId: currentUserId,
        overallMood,
        categoryRatings,
        improvementTags: selectedImprovements,
        comments: comments.trim(),
      });
      onBack?.();
    } catch (error) {
      console.error('Failed to submit experience review:', error);
      setSubmitError(error?.message || 'Unable to submit your review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rate-experience-page">
      <header className="rate-experience-page__header">
        <button
          type="button"
          className="rate-experience-page__back-btn"
          aria-label="Go back"
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="rate-experience-page__title">Rate Your Experience</h1>
      </header>

      <div className="rate-experience-page__content">
        <section className="rate-experience-page__section rate-experience-page__mood-section">
          <SectionHeading tone="pink" icon={<FeedbackIcon />} title="Overall Experience" />
          <div className="rate-experience-page__mood-grid" role="radiogroup" aria-label="Overall experience">
            {MOOD_OPTIONS.map((option) => {
              const isSelected = overallMood === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`rate-experience-page__mood-btn${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectMood(option.id)}
                >
                  <span className="rate-experience-page__mood-emoji" aria-hidden="true">{option.emoji}</span>
                  <span className="rate-experience-page__mood-label">
                    {option.labelLines ? (
                      option.labelLines.map((line) => <span key={line}>{line}</span>)
                    ) : (
                      option.label
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rate-experience-page__section">
          <SectionHeading tone="yellow" icon={<ThreeStarsIcon />} title="How did we do?" />
          <div className="rate-experience-page__ratings">
            {RATING_CATEGORIES.map((category) => (
              <StarRatingRow
                key={category.id}
                label={category.label}
                value={categoryRatings[category.id]}
                onChange={(value) => updateCategoryRating(category.id, value)}
              />
            ))}
          </div>
        </section>

        {overallMood ? (
          <>
            <section className="rate-experience-page__section rate-experience-page__section--feedback">
              <SectionHeading tone="blue" icon={<PersonFeedbackIcon />} title={feedbackTitle} />
              <div className="rate-experience-page__chips">
                {feedbackOptions.map((option) => {
                  const isSelected = selectedImprovements.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`rate-experience-page__chip${isSelected ? ' is-selected' : ''}`}
                      onClick={() => toggleImprovement(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <label className="rate-experience-page__textarea-wrap">
                <span className="rate-experience-page__sr-only">Additional comments</span>
                <textarea
                  className="rate-experience-page__textarea"
                  placeholder="Tell us about your experience..."
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  rows={4}
                />
              </label>
            </section>

            {submitError ? (
              <p className="rate-experience-page__error" role="alert">{submitError}</p>
            ) : null}

            <button
              type="button"
              className={`rate-experience-page__submit${canSubmit ? ' is-enabled' : ''}`}
              disabled={!canSubmit || isSubmitting}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RateExperiencePage;
