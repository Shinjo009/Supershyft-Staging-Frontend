import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TrendsChart.css';
import { fetchBloodParameterTrends, fetchReportTrends } from '../../services/reportService';
import {
  TRENDS_BAND_BACKGROUNDS,
  TRENDS_BAND_HEIGHT,
  TRENDS_CHART_HEIGHT,
  TRENDS_DOT_SPHERE_STOPS,
  buildSmoothTrendPath,
  buildTrendSummaryText,
  buildTrendsYAxisLabels,
  formatTrendDateLabel,
  getDotColorForMarkerPercent,
  getTrendPointsForMarker,
  markerPercentToChartY,
  normalizeBloodParameterTrendsByKey,
  normalizeTrendsPayload,
  resolveTrendsValueDomain,
  valueToMarkerPercent,
} from '../../utils/trendsChartUtils';

const getChartHorizontalInset = (plotWidth) => Math.max(14, Math.round(plotWidth * 0.1));

const getSphereStops = (color) => (
  TRENDS_DOT_SPHERE_STOPS[color] || {
    highlight: '#FFFFFF',
    mid: color,
    edge: color,
  }
);
const formatTrendPointValue = (value, unit = '') => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }

  const rounded = Math.round(numeric * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

  const unitLabel = String(unit || '').trim();
  return unitLabel ? `${text} ${unitLabel}` : text;
};

const TrendsChartPlot = ({
  points,
  variant,
  normalMin,
  normalMax,
  unit = '',
}) => {
  const plotRef = useRef(null);
  const gradientId = React.useId().replace(/:/g, '');
  const [plotWidth, setPlotWidth] = useState(0);
  const [activePointIndex, setActivePointIndex] = useState(null);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) {
      return undefined;
    }

    const updateWidth = () => {
      setPlotWidth(element.clientWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setActivePointIndex(null);
  }, [points]);

  useEffect(() => {
    if (activePointIndex == null) {
      return undefined;
    }

    const clearActive = () => setActivePointIndex(null);
    const handlePointerDown = (event) => {
      if (plotRef.current && !plotRef.current.contains(event.target)) {
        clearActive();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activePointIndex]);

  const valueDomain = useMemo(() => (
    resolveTrendsValueDomain({
      points,
      variant,
      normalMin,
      normalMax,
    })
  ), [normalMax, normalMin, points, variant]);

  const chartPoints = useMemo(() => {
    if (!Array.isArray(points) || points.length === 0 || plotWidth <= 0) {
      return [];
    }

    const horizontalInset = getChartHorizontalInset(plotWidth);
    const usableWidth = Math.max(plotWidth - horizontalInset * 2, 1);
    const xStep = points.length === 1 ? 0 : usableWidth / (points.length - 1);

    return points.map((point, index) => {
      // Linear Y: tooltip value matches axis position (11 near 11, not risk-mapped).
      const markerPercent = valueToMarkerPercent(
        point.value,
        valueDomain.min,
        valueDomain.max,
      );

      const x = points.length === 1
        ? plotWidth / 2
        : horizontalInset + (xStep * index);

      return {
        ...point,
        index,
        x,
        y: markerPercentToChartY(markerPercent, TRENDS_CHART_HEIGHT),
        markerPercent,
        color: getDotColorForMarkerPercent(markerPercent),
        label: formatTrendPointValue(point.value, unit),
      };
    });
  }, [plotWidth, points, unit, valueDomain.max, valueDomain.min]);
  const trendPath = useMemo(() => buildSmoothTrendPath(chartPoints), [chartPoints]);

  const datePositions = useMemo(() => {
    if (!chartPoints.length || plotWidth <= 0) {
      return [];
    }

    return chartPoints.map((point) => ({
      key: `date-${point.index}`,
      date: point.date,
      label: formatTrendDateLabel(point.date),
      leftPercent: (point.x / plotWidth) * 100,
    }));
  }, [chartPoints, plotWidth]);

  const activePoint = activePointIndex != null
    ? chartPoints.find((point) => point.index === activePointIndex) || null
    : null;

  if (!points.length) {
    return (
      <div className="trends-chart-section__plot-wrap">
        <p className="trends-chart-section__status">No trend data available yet.</p>
      </div>
    );
  }

  return (
    <div className="trends-chart-section__plot-wrap">
      <div
        className="trends-chart-section__plot"
        ref={plotRef}
        style={{ height: `${TRENDS_CHART_HEIGHT}px` }}
        onMouseLeave={() => setActivePointIndex(null)}
      >
        {plotWidth > 0 ? (
          <>
            <svg
              className="trends-chart-section__svg"
              style={{ height: `${TRENDS_CHART_HEIGHT}px` }}
              viewBox={`0 0 ${plotWidth} ${TRENDS_CHART_HEIGHT}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {TRENDS_BAND_BACKGROUNDS.map((fill, index) => (
                <rect
                  key={`band-${index}`}
                  x="0"
                  y={index * TRENDS_BAND_HEIGHT}
                  width={plotWidth}
                  height={TRENDS_BAND_HEIGHT}
                  fill={fill}
                />
              ))}

              {Array.from({ length: TRENDS_BAND_BACKGROUNDS.length + 1 }, (_, index) => (
                <line
                  key={`h-grid-${index}`}
                  x1="0"
                  y1={index * TRENDS_BAND_HEIGHT}
                  x2={plotWidth}
                  y2={index * TRENDS_BAND_HEIGHT}
                  stroke="rgba(241, 241, 241, 0.30)"
                  strokeWidth="0.657"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {chartPoints.map((point) => (
                <line
                  key={`v-grid-${point.index}`}
                  x1={point.x}
                  y1="0"
                  x2={point.x}
                  y2={TRENDS_CHART_HEIGHT}
                  stroke="rgba(196, 196, 196, 0.30)"
                  strokeWidth="0.657"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              <defs>
                {chartPoints.length > 1 ? (
                  <linearGradient
                    id={gradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={chartPoints[0].x}
                    y1={chartPoints[0].y}
                    x2={chartPoints[chartPoints.length - 1].x}
                    y2={chartPoints[chartPoints.length - 1].y}
                  >
                    {chartPoints.map((point) => (
                      <stop
                        key={`stop-${point.index}`}
                        offset={`${(point.index / Math.max(chartPoints.length - 1, 1)) * 100}%`}
                        stopColor={point.color}
                      />
                    ))}
                  </linearGradient>
                ) : null}

                {chartPoints.map((point) => {
                  const sphere = getSphereStops(point.color);
                  return (
                    <radialGradient
                      key={`sphere-def-${point.index}`}
                      id={`${gradientId}-sphere-${point.index}`}
                      cx="32%"
                      cy="28%"
                      r="72%"
                      fx="28%"
                      fy="24%"
                    >
                      <stop offset="0%" stopColor={sphere.highlight} />
                      <stop offset="45%" stopColor={sphere.mid} />
                      <stop offset="100%" stopColor={sphere.edge} />
                    </radialGradient>
                  );
                })}
              </defs>

              {trendPath ? (
                <path
                  d={trendPath}
                  fill="none"
                  stroke={chartPoints.length > 1 ? `url(#${gradientId})` : chartPoints[0]?.color || '#DAC15A'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {chartPoints.map((point) => (
                <circle
                  key={`dot-${point.index}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={`url(#${gradientId}-sphere-${point.index})`}
                />
              ))}
            </svg>
            {chartPoints.map((point) => (
              <button
                key={`hit-${point.index}`}
                type="button"
                className={`trends-chart-section__point-hit${activePointIndex === point.index ? ' is-active' : ''}`}
                style={{
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                }}
                aria-label={point.label || `Trend value ${point.value}`}
                onMouseEnter={() => setActivePointIndex(point.index)}
                onFocus={() => setActivePointIndex(point.index)}
                onBlur={() => setActivePointIndex((current) => (
                  current === point.index ? null : current
                ))}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePointIndex((current) => (
                    current === point.index ? null : point.index
                  ));
                }}
              />
            ))}

            {activePoint?.label ? (
              <div
                className="trends-chart-section__tooltip"
                style={{
                  left: `${activePoint.x}px`,
                  top: `${Math.max(activePoint.y - 10, 18)}px`,
                }}
                role="tooltip"
              >
                <span className="trends-chart-section__tooltip-label">{activePoint.label}</span>
                <span className="trends-chart-section__tooltip-stem" aria-hidden="true" />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {datePositions.length > 0 ? (
        <div className="trends-chart-section__dates" aria-hidden="true">
          {datePositions.map((item) => (
            <span
              key={item.key}
              className="trends-chart-section__date"
              style={{
                position: 'absolute',
                left: `${item.leftPercent}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const TrendsChart = ({
  variant = 'blood',
  bloodParameter = null,
  diseaseCode = null,
  preloadedPoints = null,
  normalMin = null,
  normalMax = null,
  unit: unitProp = '',
  className = '',
  subtitle = 'We recommend testing every 16 weeks',
}) => {
  const [points, setPoints] = useState([]);
  const [unit, setUnit] = useState(String(unitProp || '').trim());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const hasBloodRange = Number.isFinite(Number(normalMin)) && Number.isFinite(Number(normalMax));

  useEffect(() => {
    setUnit(String(unitProp || '').trim());
  }, [unitProp]);

  useEffect(() => {
    let isActive = true;
    const queryKey = variant === 'disease' ? diseaseCode : bloodParameter;

    const loadTrends = async () => {
      const hasPreloadedTrend = Array.isArray(preloadedPoints) && preloadedPoints.length > 1;
      if (!queryKey || (variant === 'blood' && !hasBloodRange && !hasPreloadedTrend)) {
        if (isActive) {
          setPoints([]);
          setIsLoading(false);
          setLoadError(false);
        }
        return;
      }

      if (isActive) {
        setIsLoading(true);
        setLoadError(false);
      }

      try {
        if (Array.isArray(preloadedPoints) && preloadedPoints.length > 0) {
          if (isActive) {
            setPoints(preloadedPoints);
            setLoadError(false);
          }
          return;
        }

        if (variant === 'blood') {
          const response = await fetchBloodParameterTrends({ ttlMs: 60000 });
          if (!isActive) {
            return;
          }

          const byKey = normalizeBloodParameterTrendsByKey(response);
          const nextPoints = getTrendPointsForMarker({
            parameter_key: queryKey,
            title: queryKey,
            marker: queryKey,
          }, byKey);
          setPoints(nextPoints);
          const matched = byKey[String(queryKey || '').trim().toLowerCase()];
          if (matched?.unit) {
            setUnit(matched.unit);
          }
          setLoadError(false);
          return;
        }

        const response = await fetchReportTrends({ disease: queryKey });

        if (!isActive) {
          return;
        }

        const normalized = normalizeTrendsPayload(response, variant);
        setPoints(normalized.points);
        if (normalized.unit) {
          setUnit(normalized.unit);
        }
        setLoadError(false);
      } catch {
        if (isActive) {
          setPoints([]);
          setLoadError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadTrends();

    return () => {
      isActive = false;
    };
  }, [bloodParameter, diseaseCode, hasBloodRange, normalMax, normalMin, preloadedPoints, variant]);

  const summaryText = useMemo(() => {
    if (variant === 'blood' && !hasBloodRange) {
      return null;
    }

    return buildTrendSummaryText({
      points,
      variant,
      normalMin: Number(normalMin),
      normalMax: Number(normalMax),
    });
  }, [hasBloodRange, normalMax, normalMin, points, variant]);

  const valueDomain = useMemo(() => (
    resolveTrendsValueDomain({
      points,
      variant,
      normalMin: Number(normalMin),
      normalMax: Number(normalMax),
    })
  ), [normalMax, normalMin, points, variant]);

  const yAxisLabels = useMemo(() => (
    buildTrendsYAxisLabels(valueDomain.min, valueDomain.max, TRENDS_CHART_HEIGHT)
  ), [valueDomain.max, valueDomain.min]);

  const queryKey = variant === 'disease' ? diseaseCode : bloodParameter;
  const canFetchTrends = Boolean(queryKey) && (
    variant !== 'blood'
    || hasBloodRange
    || (Array.isArray(preloadedPoints) && preloadedPoints.length > 1)
    || points.length > 1
  );
  const hasTrendData = !isLoading && !loadError && points.length > 1;

  if (!canFetchTrends || !hasTrendData) {
    return null;
  }

  const sectionClassName = [
    'trends-chart-section',
    variant === 'disease' ? 'trends-chart-section--disease' : 'trends-chart-section--blood',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClassName} aria-label="Trends">
      <h2 className="trends-chart-section__title">Trends</h2>
      <p className="trends-chart-section__subtitle">{subtitle}</p>

      <div className="trends-chart-section__shell">
        <div className="trends-chart-section__body">
          <div
            className="trends-chart-section__y-labels"
            style={{ height: `${TRENDS_CHART_HEIGHT}px` }}
            aria-hidden="true"
          >
            {yAxisLabels.map(({ label, centerY }, index) => (
              <span
                key={`${label}-${index}`}
                className="trends-chart-section__y-label"
                style={{ top: `${centerY}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <TrendsChartPlot
            points={points}
            variant={variant}
            normalMin={Number(normalMin)}
            normalMax={Number(normalMax)}
            unit={unit}
          />
        </div>
      </div>

      {summaryText ? (
        <p className="trends-chart-section__summary">{summaryText}</p>
      ) : null}
    </section>
  );
};

export default TrendsChart;
