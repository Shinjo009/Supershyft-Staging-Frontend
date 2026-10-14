import './AllergySensitivitySection.css';

export default function AllergySensitivitySection({ onSeeMore, summary = null }) {
  if (!summary) {
    return null;
  }

  const content = {
    value: summary.value || '--',
    badge: summary.badge || '',
    sensitivities: summary.sensitivities ?? '0',
  };

  return (
    <section className="allergy-sensitivity" aria-label="Allergy Sensitivity">
      <div className="allergy-sensitivity__header">
        <div className="allergy-sensitivity__copy">
          <h3 className="allergy-sensitivity__title">Allergy Sensitivity</h3>
          <p className="allergy-sensitivity__subtitle">Tap the card to know more</p>
        </div>
        <button type="button" className="allergy-sensitivity__see-more" onClick={onSeeMore}>
          See more
        </button>
      </div>

      <div className={`allergy-sensitivity__card allergy-sensitivity__card--${summary.variant === 'low' ? 'low' : 'moderate'}`}>
        <div className="allergy-sensitivity__gauge-col">
          <div className="allergy-sensitivity__gauge">
            <span className="allergy-sensitivity__spark allergy-sensitivity__spark--large" />
            <span className="allergy-sensitivity__spark allergy-sensitivity__spark--small" />
            <p className="allergy-sensitivity__label">Total IGE</p>
            <p className="allergy-sensitivity__value">{content.value}</p>
            <p className="allergy-sensitivity__unit">IU/ml</p>
          </div>
          <span className="allergy-sensitivity__badge">{content.badge}</span>
        </div>

        <div className="allergy-sensitivity__summary">
          <div className="allergy-sensitivity__summary-top">
            <span className="allergy-sensitivity__method">ELISA Method</span>
            <p className="allergy-sensitivity__summary-title">Allergen Screening Summary</p>
          </div>
          <div className="allergy-sensitivity__stats">
            <div>
              <p className="allergy-sensitivity__stat">{summary.tested ?? '0'}</p>
              <p className="allergy-sensitivity__stat-label">screened</p>
            </div>
            <div>
              <p className="allergy-sensitivity__stat">{content.sensitivities}</p>
              <p className="allergy-sensitivity__stat-label">sensitivities</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
