import { describe, expect, it } from 'vitest';
import { boundingBox, distanceMiles, isOpenNow, timeZoneForState, toUnit } from './geo.js';

describe('distanceMiles', () => {
  it('matches known great-circle distances', () => {
    // Portland city hall to Seattle city hall ≈ 145 mi; LAX to JFK ≈ 2,470 mi (spherical).
    expect(distanceMiles(45.5152, -122.6784, 47.6062, -122.3321)).toBeCloseTo(145.2, 0);
    expect(distanceMiles(33.9416, -118.4085, 40.6413, -73.7781)).toBeCloseTo(2470, -1);
  });

  it('is zero for the same point and symmetric', () => {
    expect(distanceMiles(45.52, -122.68, 45.52, -122.68)).toBe(0);
    expect(distanceMiles(45.52, -122.68, 45.49, -122.8)).toBeCloseTo(
      distanceMiles(45.49, -122.8, 45.52, -122.68),
      10,
    );
  });

  it('converts to kilometres', () => {
    expect(toUnit(10, 'km')).toBeCloseTo(16.09, 2);
    expect(toUnit(10, 'mi')).toBe(10);
  });
});

describe('boundingBox', () => {
  it('contains points at the radius in every direction', () => {
    const box = boundingBox(45.52, -122.68, 25);
    const north = 45.52 + 25 / 69;
    expect(box.maxLat).toBeGreaterThan(north);
    expect(distanceMiles(45.52, -122.68, 45.52, box.maxLng)).toBeGreaterThan(25);
    expect(distanceMiles(45.52, -122.68, 45.52, box.minLng)).toBeGreaterThan(25);
  });
});

describe('isOpenNow', () => {
  const hours = {
    mon: null,
    thu: { open: '11:00', close: '20:00' },
    fri: { open: '20:00', close: '02:00' },
  };
  const tz = timeZoneForState('OR');

  it('uses the store local time, not UTC', () => {
    // Thu 2026-11-26 12:00 PST is 20:00 UTC.
    expect(isOpenNow(hours, tz, new Date('2026-11-26T20:00:00Z'))).toBe(true);
    // Thu 21:00 PST is already Friday 05:00 in UTC.
    expect(isOpenNow(hours, tz, new Date('2026-11-27T05:00:00Z'))).toBe(false);
  });

  it('treats close as exclusive and null days as closed', () => {
    expect(isOpenNow(hours, tz, new Date('2026-11-27T04:00:00Z'))).toBe(false); // Thu 20:00
    expect(isOpenNow(hours, tz, new Date('2026-11-23T20:00:00Z'))).toBe(false); // Mon noon
  });

  it('keeps late-night hours open past midnight', () => {
    expect(isOpenNow(hours, tz, new Date('2026-11-28T09:00:00Z'))).toBe(true); // Sat 01:00
    expect(isOpenNow(hours, tz, new Date('2026-11-28T10:00:00Z'))).toBe(false); // Sat 02:00
  });

  it('treats malformed hours as closed', () => {
    const bad = { thu: { open: 'noon', close: '20:00' } };
    expect(isOpenNow(bad, tz, new Date('2026-11-26T20:00:00Z'))).toBe(false);
  });
});

describe('timeZoneForState', () => {
  it('maps states to their main zone', () => {
    expect(timeZoneForState('OR')).toBe('America/Los_Angeles');
    expect(timeZoneForState('NY')).toBe('America/New_York');
    expect(timeZoneForState('AZ')).toBe('America/Phoenix');
  });
});
