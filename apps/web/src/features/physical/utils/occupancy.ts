export interface Occupancy {
  /** Pourcentage affiché, borné entre 0 et 100 */
  percent: number;
  level: 'ok' | 'high' | 'full';
}

/** Taux de remplissage d'une boîte ; sans capacité définie, la barre reste vide et neutre. */
export function occupancy(count: number, capacity: number | null): Occupancy {
  if (!capacity) return { percent: 0, level: 'ok' };
  const ratio = count / capacity;
  return {
    percent: Math.min(100, Math.round(ratio * 100)),
    level: ratio >= 1 ? 'full' : ratio >= 0.85 ? 'high' : 'ok',
  };
}
