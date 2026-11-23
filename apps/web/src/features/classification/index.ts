// API publique de la fonctionnalité : les autres fonctionnalités n'importent que d'ici
export { classificationKeys } from './api/classification.api';
export { useClassificationTree } from './hooks/useClassificationTree';
export { ClassificationTree } from './components/ClassificationTree';
export type { ClassificationNode, NodeType } from './types';
