import { useEffect, useState } from 'react';
import { fetchLatestAssessmentReport } from '../../services/reportService';
import { buildReportScreenMarkers } from '../../utils/reportScreenMarkers';
import foodIcon from '../../images/allergy-icon-food.svg';
import environmentIcon from '../../images/allergy-icon-environment.svg';
import petsIcon from '../../images/allergy-icon-pets.svg';
import drugsIcon from '../../images/allergy-icon-drugs.svg';
import workplaceIcon from '../../images/allergy-icon-workplace.svg';
import infoIcon from '../../images/allergy-info.svg';
import igeGlow from '../../images/allergy-ige-glow.png';
import statDivider from '../../images/allergy-stat-divider.svg';
import './AllergySensitivityPage.css';

const iconForProfile = (name) => {
  const key = String(name || '').toLowerCase();
  if (key.includes('environment') || /grass|mould|mold|yeast|weed|tree/.test(key)) {
    return { icon: environmentIcon, iconWidth: 16.9955, iconHeight: 16.9923 };
  }
  if (key.includes('pet') || key.includes('animal')) {
    return { icon: petsIcon, iconWidth: 24, iconHeight: 24 };
  }
  if (key.includes('drug')) {
    return { icon: drugsIcon, iconWidth: 19.3101, iconHeight: 19.2755 };
  }
  if (key.includes('work') || key.includes('occupational')) {
    return { icon: workplaceIcon, iconWidth: 20, iconHeight: 20 };
  }
  return { icon: foodIcon, iconWidth: 15, iconHeight: 15 };
};

export default function AllergySensitivityPage({ onBack, onSeeMore }) {
  const [report, setReport] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLatestAssessmentReport((assessmentId) => `/reports/${assessmentId}/blood-parameters`)
      .then(({ assessmentId, response }) => {
        if (!active) {
          return;
        }
        const markers = buildReportScreenMarkers(response, assessmentId);
        setReport(markers.hasAllergy ? markers : null);
        setHasLoaded(true);
      })
      .catch(() => {
        if (active) {
          setHasLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = report?.allergySummary;
  const profiles = (report?.profiles || []).map((item) => ({ ...item, ...iconForProfile(item.name) }));

  return (
    <div className="allergy-page">
      <header className="allergy-page__header">
        <button type="button" className="allergy-page__icon-btn" onClick={onBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="allergy-page__title">Allergy Sensitivity</h1>
        <button type="button" className="allergy-page__icon-btn allergy-page__icon-btn--end" aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 21L16.65 16.65" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <div className="allergy-page__body">
        {hasLoaded && !summary ? (
          <p className="allergy-page__note" role="status">No Allergy Markers Detected</p>
        ) : summary ? (
          <>
        <div className="allergy-page__summary">
        <div className="allergy-page__hero">
          <div className="allergy-page__field" aria-hidden="true">
            <img src={igeGlow} alt="" width="288" height="286" />
            <span className="allergy-page__field-spark" />
          </div>
          <div className="allergy-page__heading">
            <p className="allergy-page__heading-label">Total IgE level</p>
            <img className="allergy-page__info" src={infoIcon} alt="" width="14" height="14" />
          </div>

          <div className="allergy-page__orb">
            <span className="allergy-page__ring allergy-page__ring--outer" />
            <span className="allergy-page__ring allergy-page__ring--middle" />
            <span className="allergy-page__ring allergy-page__ring--inner" />
            <span className="allergy-page__spark allergy-page__spark--a" />
            <span className="allergy-page__spark allergy-page__spark--b" />
            <span className="allergy-page__spark allergy-page__spark--c" />
            <span className="allergy-page__spark allergy-page__spark--d" />
            <p className="allergy-page__score">{summary.value || '--'}</p>
            <p className="allergy-page__unit">{summary.unit || 'IU/ml'}</p>
          </div>

          <span className="allergy-page__level">{summary.levelLabel || ''}</span>
        </div>

        <div className="allergy-page__scale">
          <div className="allergy-page__track">
            <span className="allergy-page__marker" />
          </div>
          <div className="allergy-page__scale-labels">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
        </div>

        <p className="allergy-page__note">{summary.note || ''}</p>
        </div>

        <div className="allergy-page__stats">
          <p><strong>{summary.tested ?? '0'}</strong><span>Tested</span></p>
          <span className="allergy-page__stat-rule">
            <img src={statDivider} alt="" width="40.59" height="1" />
          </span>
          <p><strong className="allergy-page__stat--sensitive">{summary.sensitive ?? '0'}</strong><span>Sensitive</span></p>
          <span className="allergy-page__stat-rule">
            <img src={statDivider} alt="" width="40.59" height="1" />
          </span>
          <p><strong className="allergy-page__stat--clear">{summary.clear ?? '0'}</strong><span>Clear</span></p>
        </div>

        <div className="allergy-page__profile">
          <div className="allergy-page__profile-head">
            <h2>Allergy Profile</h2>
            <button type="button" className="allergy-page__see-more" onClick={onSeeMore}>
              See more
            </button>
          </div>
          <div className="allergy-page__rows">
            {profiles.map((item) => (
              <article key={item.id} className="allergy-page__row">
                <div className="allergy-page__row-main">
                  <span className={`allergy-page__row-icon allergy-page__row-icon--${item.tone}`}>
                    <img src={item.icon} alt="" width={item.iconWidth} height={item.iconHeight} />
                  </span>
                  <span className="allergy-page__row-copy">
                    <span className="allergy-page__row-name">{item.name}</span>
                    <span className="allergy-page__row-count">{item.count}</span>
                  </span>
                </div>
                <span className={`allergy-page__row-status allergy-page__row-status--${item.tone}`}>
                  {item.status}
                </span>
              </article>
            ))}
          </div>
        </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
