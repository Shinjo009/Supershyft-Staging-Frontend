import { useMemo } from 'react';
import pancreaticIcon from '../../images/cancer-marker-pancreatic.svg';
import colorectalIcon from '../../images/cancer-marker-colorectal.svg';
import prostateIcon from '../../images/cancer-marker-prostate.svg';
import lowRiskTrendIcon from '../../images/cancer-trend-low.svg';
import optimalTrendIcon from '../../images/cancer-trend-optimal.svg';

const READING_TONE = {
  high: {
    value: '#E95D5C',
    glow: '0 0 4px rgba(233, 93, 92, 0.25)',
    dim: '#FF6B6A',
    solid: '#FF6B6A',
    shadow: '0 0 12px 0 rgba(233, 93, 92, 0.4)',
  },
  moderate: {
    value: '#F7EC33',
    glow: '0 0 4px rgba(247, 236, 51, 0.25)',
    dim: '#DAC15A',
    solid: '#F7EC33',
    shadow: '0 0 12px 0 rgba(218, 193, 90, 0.4)',
  },
  low: {
    value: '#4ADE80',
    glow: '0 0 4px rgba(74, 222, 128, 0.25)',
    dim: '#66FF82',
    solid: '#66FF82',
    shadow: '0 0 12px 0 rgba(102, 255, 130, 0.4)',
  },
};

const readingTone = (risk) => READING_TONE[risk] || READING_TONE.low;

const capsuleIsSolid = (count, index) => {
  if (count === 9) return index >= 2 && index <= 6;
  if (count === 4) return index === 1 || index === 2;
  return index % 3 === 1;
};

function CancerMarkerCard({ group }) {
  const readings = Array.isArray(group.readings) ? group.readings : [];
  const dashesPerPoint = readings.length <= 1 ? 9 : readings.length === 2 ? 4 : 3;

  return (
    <article className={`blood-markers-page__cancer-card blood-markers-page__cancer-card--${group.status}`}>
      <div className="blood-markers-page__cancer-card-head">
        <div className="blood-markers-page__cancer-card-name">
          <span className="blood-markers-page__cancer-card-accent" style={{ background: group.accent }} />
          <span>
            <span className="blood-markers-page__cancer-card-marker">{group.marker}</span>
            <span className="blood-markers-page__cancer-card-unit">{group.unit}</span>
          </span>
        </div>
        <span className={`blood-markers-page__cancer-badge blood-markers-page__cancer-badge--${group.status}`}>
          {group.statusLabel}
          <img src={group.trendIcon} alt="" width="11.4229" height="6.75391" />
        </span>
      </div>
      <div className="blood-markers-page__history-bars" aria-label="Previous results">
        {readings.map((reading, index) => {
          const tone = readingTone(reading.risk);
          return (
            <div key={`${reading.date}-${index}`} className="blood-markers-page__history-bars-col">
              <span
                className={`blood-markers-page__history-bars-value${reading.latest ? ' is-latest' : ''}`}
                style={{
                  color: tone.value,
                  textShadow: reading.latest ? tone.glow : undefined,
                }}
              >
                {reading.value}
              </span>
              <span className="blood-markers-page__history-bars-track" aria-hidden="true">
                {Array.from({ length: dashesPerPoint }, (_, dashIndex) => {
                  const solid = capsuleIsSolid(dashesPerPoint, dashIndex);
                  return (
                    <span
                      key={`${group.id}-dash-${index}-${dashIndex}`}
                      className="blood-markers-page__history-bars-dash"
                      style={{
                        background: solid ? tone.solid : tone.dim,
                        opacity: solid ? 1 : 0.5,
                        boxShadow: tone.shadow,
                      }}
                    />
                  );
                })}
              </span>
              <span className={`blood-markers-page__history-bars-date${reading.latest ? ' is-latest' : ''}`}>
                {reading.date}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

const CANCER_ICONS = [pancreaticIcon, colorectalIcon, prostateIcon];

export default function CancerMarkersView({ query = '', groups: reportGroups = null }) {
  const groups = useMemo(() => {
    if (!Array.isArray(reportGroups)) {
      return null;
    }
    const source = reportGroups.map((group, index) => ({
      ...group,
      icon: CANCER_ICONS[index % CANCER_ICONS.length],
      tone: group.status === 'optimal' ? 'optimal' : 'high',
      trendIcon: group.status === 'optimal' ? optimalTrendIcon : lowRiskTrendIcon,
    }));
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return source;
    }
    return source.filter((group) => (
      group.title.toLowerCase().includes(normalized)
      || group.marker.toLowerCase().includes(normalized)
    ));
  }, [query, reportGroups]);

  if (!groups) {
    return null;
  }

  if (groups.length === 0) {
    return <p className="blood-markers-page__empty" role="status">No Cancer Markers Detected</p>;
  }

  return (
    <div className="blood-markers-page__cancer-list">
      {groups.map((group) => (
        <section key={group.id} className="blood-markers-page__cancer-group">
          <div className="blood-markers-page__cancer-group-head">
            <span className={`blood-markers-page__cancer-icon blood-markers-page__cancer-icon--${group.tone}`}>
              <img src={group.icon} alt="" width="20" height="20" />
            </span>
            <span className="blood-markers-page__cancer-copy">
              <span className="blood-markers-page__cancer-title">{group.title}</span>
              <span className="blood-markers-page__cancer-count">1 parameter</span>
            </span>
          </div>
          <CancerMarkerCard group={group} />
        </section>
      ))}
    </div>
  );
}
