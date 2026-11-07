import { expect, it } from 'vitest';
import { createDemoBandTimeline } from './demo-band-timeline';

it('projects six windows of known band power from the demo recording', () => {
  const columns = createDemoBandTimeline();
  const bandNames = ['Sub-bass', 'Bass', 'Low mids', 'Mids', 'High mids', 'Treble', 'Air'];
  const expectedTones = [
    { band: 'Bass', amplitude: 1 },
    { band: 'Bass', amplitude: 1 },
    null,
    null,
    { band: 'High mids', amplitude: 0.5 },
    { band: 'High mids', amplitude: 0.5 },
  ];
  const fixturePowerTolerance = 1e-7;

  expect(columns).toHaveLength(expectedTones.length);
  expectedTones.forEach((tone, index) => {
    const { startTimeSeconds, endTimeSeconds, bands } = columns[index]!;
    expect(startTimeSeconds).toBe(index * 4096 / 40960);
    expect(endTimeSeconds).toBe((index + 1) * 4096 / 40960);
    expect(bands.map(({ name }) => name)).toEqual(bandNames);

    for (const { name, power } of bands) {
      expect(Number.isFinite(power)).toBe(true);
      expect(power).toBeGreaterThanOrEqual(0);
      if (tone === null) {
        expect(power).toBe(0);
      } else {
        // The tone and both periodic Hann neighbors fall inside the same band.
        const expectedPower = name === tone.band ? tone.amplitude ** 2 / 2 : 0;
        expect(Math.abs(power - expectedPower)).toBeLessThanOrEqual(fixturePowerTolerance);
      }
    }
  });
});
