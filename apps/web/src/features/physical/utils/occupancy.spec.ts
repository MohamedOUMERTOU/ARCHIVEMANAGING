import { occupancy } from './occupancy';

describe('occupancy', () => {
  it('calcule le remplissage et signale une boîte presque pleine', () => {
    expect(occupancy(12, 40)).toEqual({ percent: 30, level: 'ok' });
    expect(occupancy(38, 40)).toEqual({ percent: 95, level: 'high' });
    expect(occupancy(40, 40)).toEqual({ percent: 100, level: 'full' });
  });

  it('borne à 100 % et reste neutre sans capacité', () => {
    expect(occupancy(45, 40).percent).toBe(100);
    expect(occupancy(7, null)).toEqual({ percent: 0, level: 'ok' });
  });
});
