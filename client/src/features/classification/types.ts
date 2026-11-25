export type NodeType = 'FONDS' | 'SERIE' | 'SOUS_SERIE' | 'DOSSIER';

/** Nœud tel que renvoyé par GET /classification/tree (liste à plat). */
export interface ClassificationNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  code: string;
  title: string;
  depth: number;
  documentCount: number;
}
