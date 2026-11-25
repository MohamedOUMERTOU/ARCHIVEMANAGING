// API publique de la fonctionnalité « archives physiques »
export { physicalApi, physicalKeys } from './api/physical.api';
export type { Loan, LocationDetail, PhysicalLocation } from './api/physical.api';
export { LoanDialog } from './components/LoanDialog';
export { LocationSelect } from './components/LocationSelect';
export { OriginalCard } from './components/OriginalCard';
export { usePhysicalMutation } from './hooks/usePhysical';
