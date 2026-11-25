// Données de démonstration de l'API simulée (identiques aux maquettes)
import type { ClassificationNode } from '@/features/classification';
import type { CurrentUser } from '@/types/user';

export const organization = { id: 'org-exsa', code: 'EXSA', name: 'Société Exemple SA' };

export const users: Array<CurrentUser & { password: string }> = [
  {
    id: 'u-admin',
    email: 'admin@exemple.com',
    password: 'demo1234',
    fullName: 'Administrateur',
    organization,
    roles: ['Administrateur'],
    permissions: ['*'],
  },
  {
    id: 'u-sa',
    email: 's.amrani@exemple.com',
    password: 'demo1234',
    fullName: 'S. Amrani',
    organization,
    roles: ['Archiviste'],
    permissions: ['physical.manage', 'audit.read'],
  },
];

export const classificationNodes: ClassificationNode[] = [
  {
    id: 'n-fin',
    parentId: null,
    type: 'FONDS',
    code: 'FIN',
    title: 'Direction financière',
    depth: 0,
    documentCount: 0,
  },
  {
    id: 'n-cpt',
    parentId: 'n-fin',
    type: 'SERIE',
    code: 'FIN/CPT',
    title: 'Comptabilité',
    depth: 1,
    documentCount: 0,
  },
  {
    id: 'n-ff25',
    parentId: 'n-cpt',
    type: 'DOSSIER',
    code: 'FIN/CPT/FF-2025',
    title: 'Factures fournisseurs 2025',
    depth: 2,
    documentCount: 6,
  },
  {
    id: 'n-fc25',
    parentId: 'n-cpt',
    type: 'DOSSIER',
    code: 'FIN/CPT/FC-2025',
    title: 'Factures clients 2025',
    depth: 2,
    documentCount: 41,
  },
  {
    id: 'n-paie',
    parentId: 'n-fin',
    type: 'SERIE',
    code: 'FIN/PAIE',
    title: 'Paie',
    depth: 1,
    documentCount: 94,
  },
  {
    id: 'n-rh',
    parentId: null,
    type: 'FONDS',
    code: 'RH',
    title: 'Ressources humaines',
    depth: 0,
    documentCount: 0,
  },
  {
    id: 'n-dp',
    parentId: 'n-rh',
    type: 'SERIE',
    code: 'RH/DP',
    title: 'Dossiers du personnel',
    depth: 1,
    documentCount: 230,
  },
  { id: 'n-jur', parentId: null, type: 'FONDS', code: 'JUR', title: 'Juridique', depth: 0, documentCount: 0 },
  {
    id: 'n-ctr',
    parentId: 'n-jur',
    type: 'SERIE',
    code: 'JUR/CTR',
    title: 'Contrats',
    depth: 1,
    documentCount: 52,
  },
  {
    id: 'n-pv',
    parentId: 'n-jur',
    type: 'SERIE',
    code: 'JUR/PV',
    title: 'Procès-verbaux',
    depth: 1,
    documentCount: 36,
  },
];
