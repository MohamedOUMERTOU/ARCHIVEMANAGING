import { formatDate, formatDay, formatSize, shortHash } from './format';

describe('format', () => {
  it('formate les dates au format français', () => {
    expect(formatDate('2025-03-14')).toBe('14/03/2025');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('pas une date')).toBe('—');
    expect(formatDay('2026-11-22')).toBe('22 novembre 2026');
  });

  it('formate les tailles avec les unités françaises', () => {
    expect(formatSize(512)).toBe('512 o');
    expect(formatSize(412_345)).toBe('403 Ko');
    expect(formatSize(1_258_291)).toBe('1,2 Mo');
    expect(formatSize(null)).toBe('—');
  });

  it("abrège l'empreinte", () => {
    expect(shortHash('9f2c0000000000000000e81a')).toBe('9f2c…e81a');
  });
});
