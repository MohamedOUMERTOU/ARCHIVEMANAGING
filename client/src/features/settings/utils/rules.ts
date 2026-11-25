import type { FinalAction, StartEvent } from '../api/settings.api';

const START: Record<StartEvent, string> = {
  DATE_DOCUMENT: 'la date du document',
  CLOTURE_DOSSIER: 'la clôture du dossier',
  DATE_CREATION: 'son dépôt',
};
const FINAL: Record<FinalAction, string> = {
  CONSERVER: 'il est conservé définitivement',
  VERSER: 'il est versé aux archives définitives',
  DETRUIRE: 'il est proposé à l’élimination',
};

/** Phrase lisible résumant une règle de conservation. */
export function describeRule(r: {
  durationYears: number | null;
  startEvent: StartEvent;
  finalAction: FinalAction;
}): string {
  if (r.durationYears === null) return 'Le document est conservé sans limite de durée.';
  const years = `${String(r.durationYears)} an${r.durationYears > 1 ? 's' : ''}`;
  return `Le document est conservé ${years} à compter de ${START[r.startEvent]}, jusqu’au 31 décembre de l’année d’échéance ; ensuite ${FINAL[r.finalAction]}.`;
}
