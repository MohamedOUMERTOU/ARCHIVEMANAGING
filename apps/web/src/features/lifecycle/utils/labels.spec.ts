import { daysUntil, dueLabel, selectionBlocker } from './labels';

const today = '2026-11-23';
const free = { legalHold: false, pendingListNumber: null, status: 'ACTIVE', retentionUntil: '2023-12-31' };

describe('échéances', () => {
  it('compte les jours jusqu’à l’échéance', () => {
    expect(daysUntil('2026-12-31', today)).toBe(38);
    expect(daysUntil('2026-11-23', today)).toBe(0);
    expect(daysUntil('2026-11-20', today)).toBe(-3);
  });

  it('formule l’échéance en clair', () => {
    expect(dueLabel('2026-12-31', today)).toBe('dans 38 jours');
    expect(dueLabel('2023-12-31', today)).toBe('échu depuis 2 ans');
    expect(dueLabel('2026-05-01', today)).toBe('échu depuis 6 mois');
    expect(dueLabel(today, today)).toBe("aujourd'hui");
  });
});

describe('sélection pour un bordereau', () => {
  it('accepte un document échu et libre', () => {
    expect(selectionBlocker(free, today)).toBeNull();
  });

  it('refuse un document gelé, déjà inscrit, figé ou non échu', () => {
    expect(selectionBlocker({ ...free, legalHold: true }, today)).toBe('Sous gel juridique');
    expect(selectionBlocker({ ...free, pendingListNumber: 'ELIM-2026-001' }, today)).toContain(
      'ELIM-2026-001',
    );
    expect(selectionBlocker({ ...free, status: 'A_ELIMINER' }, today)).not.toBeNull();
    expect(selectionBlocker({ ...free, retentionUntil: '2026-12-31' }, today)).toBe('Pas encore échu');
  });
});
