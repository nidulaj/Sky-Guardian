import { describe, expect, it } from 'vitest';
import { weatherImage, weatherScene } from '@/components/weather/weatherDisplay';

const DAY = '2026-10-06T14:00:00+05:30';
const NIGHT = '2026-10-06T22:00:00+05:30';

describe('weatherScene', () => {
  it.each([
    [0, 'clear'], [1, 'clear'], [2, 'cloudy'], [3, 'cloudy'],
    [45, 'fog'], [48, 'fog'],
    [51, 'rain'], [57, 'rain'], [61, 'rain'], [67, 'rain'], [80, 'rain'], [82, 'rain'],
    [71, 'snow'], [77, 'snow'], [85, 'snow'], [86, 'snow'],
    [95, 'storm'], [96, 'storm'], [99, 'storm'],
  ])('maps WMO code %i to %s in the day', (code, scene) => {
    expect(weatherScene(code, DAY)).toBe(scene);
  });

  it('uses the night photo for clear and partly cloudy skies after dark', () => {
    expect(weatherScene(0, NIGHT)).toBe('night');
    expect(weatherScene(2, NIGHT)).toBe('night');
    expect(weatherScene(3, NIGHT)).toBe('cloudy');
    expect(weatherScene(63, NIGHT)).toBe('rain');
  });

  it('has no photo for missing or unknown codes', () => {
    expect(weatherScene(null, DAY)).toBeNull();
    expect(weatherScene(42, DAY)).toBeNull();
    expect(weatherImage(null, DAY)).toBeNull();
  });

  it('builds the public image path', () => {
    expect(weatherImage(95, DAY)).toBe('/images/weather/storm.jpg');
  });
});
