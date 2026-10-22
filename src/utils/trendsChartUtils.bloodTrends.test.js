import {
  flattenBloodParameterTrendPoints,
  getTrendPointsForMarker,
  mergeBloodMarkerHistorySources,
  normalizeBloodParameterTrendsByKey,
} from './trendsChartUtils';

const samplePayload = {
  data: [
    {
      date: '2025-12-04',
      engagement_id: 1048,
      data_points: [
        { parameter_name: 'Albumin', parameter_key: 'albumin', unit: 'g/dl', value: 4.05 },
        { parameter_name: 'Zinc', parameter_key: 'zinc', unit: 'µg/dL', value: 51 },
      ],
    },
    {
      date: '2026-09-14',
      engagement_id: 1049,
      data_points: [
        { parameter_name: 'Albumin', parameter_key: 'albumin', unit: 'g/dl', value: 3.63 },
      ],
    },
  ],
};

describe('normalizeBloodParameterTrendsByKey', () => {
  it('indexes all dates by parameter_key and keeps last-year-only markers', () => {
    const byKey = normalizeBloodParameterTrendsByKey(samplePayload);

    expect(byKey.albumin.points.map((point) => point.value)).toEqual([4.05, 3.63]);
    expect(byKey.zinc.points).toEqual([
      { date: '2025-12-04', value: 51, engagementId: 1048 },
    ]);
    expect(byKey.zinc.unit).toBe('µg/dL');
  });

  it('looks up a card by title when parameter_key is missing', () => {
    const byKey = flattenBloodParameterTrendPoints(
      normalizeBloodParameterTrendsByKey(samplePayload),
    );

    expect(getTrendPointsForMarker({ title: 'Albumin' }, byKey).map((point) => point.value))
      .toEqual([4.05, 3.63]);
  });

  it('matches Fasting Sugar to glucose_fasting trends', () => {
    const payload = {
      data: [{
        date: '2025-12-04',
        engagement_id: 1,
        data_points: [
          { parameter_name: 'glucose_fasting', parameter_key: 'glucose_fasting', unit: 'mg/dl', value: 76.73 },
        ],
      }, {
        date: '2026-09-14',
        engagement_id: 2,
        data_points: [
          { parameter_name: 'glucose_fasting', parameter_key: 'glucose_fasting', unit: 'mg/dl', value: 80.1 },
        ],
      }],
    };
    const byKey = normalizeBloodParameterTrendsByKey(payload);

    expect(getTrendPointsForMarker({ title: 'FASTING SUGAR' }, byKey).map((point) => point.value))
      .toEqual([76.73, 80.1]);
  });

  it('merges current-report history with prior-year trend points', () => {
    const merged = mergeBloodMarkerHistorySources(
      [{ date: '2026-09-14', value: 3.63 }],
      [{ date: '2025-12-04', value: 4.05 }, { date: '2026-09-14', value: 3.63 }],
    );

    expect(merged.map((point) => point.date)).toEqual(['2025-12-04', '2026-09-14']);
  });
});
