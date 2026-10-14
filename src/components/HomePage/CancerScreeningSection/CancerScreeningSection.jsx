import colorectalIcon from '../../../images/cancer-icon-colorectal.svg';
import './CancerScreeningSection.css';

const SCALE = [
  { label: '01', labelColor: '#90df9e', color: '#90df9e', size: 10, shadow: '0 0 8px rgba(6, 255, 85, 0.4)' },
  { label: '02', labelColor: '#90df9e', color: '#90df9e', size: 10, shadow: '0 0 8px rgba(6, 255, 85, 0.4)' },
  { label: '03', labelColor: '#90df9e', color: '#90df9e', size: 10, shadow: '0 0 8px rgba(6, 255, 85, 0.4)' },
  { label: '04', labelColor: '#f6b624', color: '#f7de30', size: 12, shadow: '0 0 20px rgba(247, 222, 48, 0.4)' },
  { label: '05', labelColor: '#e95d5c', color: '#e95d5c', size: 16, shadow: '0 0 30px #e95d5c' },
];

const STATUS_LABEL = {
  attention: 'ATTENTION',
  high: 'HIGH RISK',
  optimal: 'OPTIMAL',
};

function CancerAreaRow({ area }) {
  return (
    <div className="cancer-screening__row">
      <div className="cancer-screening__row-name">
        <img className="cancer-screening__row-icon" src={area.icon} alt="" />
        <span>{area.name}</span>
      </div>
      <div className={`cancer-screening__status cancer-screening__status--${area.status}`}>
        <span className="cancer-screening__status-dot" />
        <span>{STATUS_LABEL[area.status]}</span>
      </div>
    </div>
  );
}

export default function CancerScreeningSection({ onSeeMore, areas = null, count = null }) {
  const rows = Array.isArray(areas) ? areas : [];
  if (rows.length === 0) {
    return null;
  }
  const screened = String(Number.isFinite(Number(count)) ? Number(count) : rows.length).padStart(2, '0');
  return (
    <section className="cancer-screening" aria-label="Cancer Screening">
      <div className="cancer-screening__header">
        <div className="cancer-screening__copy">
          <h3 className="cancer-screening__title">Cancer Screening</h3>
          <p className="cancer-screening__subtitle">Tap the card to know more</p>
        </div>
        <button
          type="button"
          className="cancer-screening__see-more"
          onClick={onSeeMore}
        >
          See more
        </button>
      </div>

      <div className="cancer-screening__card">
        <div className="cancer-screening__summary">
          <div className="cancer-screening__count-block">
            <p className="cancer-screening__count">{screened}</p>
            <p className="cancer-screening__count-label">AREAS SCREENED</p>
          </div>
          <div className="cancer-screening__scale" aria-hidden="true">
            <span className="cancer-screening__scale-line" />
            {SCALE.map((step) => (
              <div key={step.label} className="cancer-screening__scale-step">
                <span className="cancer-screening__scale-label" style={{ color: step.labelColor }}>
                  {step.label}
                </span>
                <span className="cancer-screening__scale-dot-slot">
                  <span
                    className="cancer-screening__scale-dot"
                    style={{
                      width: step.size,
                      height: step.size,
                      background: step.color,
                      boxShadow: step.shadow,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cancer-screening__divider" />
        <div className="cancer-screening__rows">
          {rows.map((area) => (
            <CancerAreaRow key={area.id} area={{ ...area, icon: area.icon || colorectalIcon }} />
          ))}
        </div>
      </div>
    </section>
  );
}
