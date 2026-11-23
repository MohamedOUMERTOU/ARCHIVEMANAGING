import { http } from '@/services/api/http';

export interface Level {
  id: string;
  code: string;
  name: string;
  isRoot: boolean;
  canHoldDocuments: boolean;
  capacity: number | null;
  childLevelIds: string[];
  locationCount: number;
  /** Clé du catalogue LEVEL_ICONS */
  icon: string | null;
}
export type LevelInput = Pick<Level, 'code' | 'name' | 'isRoot' | 'canHoldDocuments' | 'capacity' | 'icon'>;

export interface PhysicalLocation {
  id: string;
  parentId: string | null;
  levelId: string;
  levelName: string;
  code: string;
  label: string;
  barcode: string | null;
  depth: number;
  active: boolean;
  canHoldDocuments: boolean;
  capacity: number | null;
  documentCount: number;
  childCount: number;
  onLoan: boolean;
  levelIcon: string | null;
}

export interface Loan {
  id: string;
  locationId: string | null;
  locationLabel: string | null;
  locationPath: string | null;
  documentId: string | null;
  documentTitle: string | null;
  documentReference: string | null;
  borrower: string;
  kind: 'PRET' | 'CONSULTATION';
  reason: string | null;
  outAt: string;
  dueAt: string;
  returnedAt: string | null;
  overdue: boolean;
  documentCount: number;
}

export interface LocationDetail {
  location: PhysicalLocation;
  path: string;
  allowedChildLevelIds: string[];
  openLoan: Loan | null;
}

export interface LocationInput {
  parentId?: string | null;
  levelId?: string;
  code: string;
  label: string;
  barcode: string | null;
  active?: boolean;
}

export type LoanFilter = 'open' | 'overdue' | 'returned' | 'all';
export interface LoanInput {
  locationId?: string | null;
  documentId?: string | null;
  borrower: string;
  kind: 'PRET' | 'CONSULTATION';
  reason: string | null;
  dueAt: string;
}

const P = '/physical';
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const physicalApi = {
  levels: () => data(http.get<Level[]>(`${P}/levels`)),
  createLevel: (input: LevelInput) => data(http.post<Level>(`${P}/levels`, input)),
  updateLevel: (id: string, input: LevelInput) => data(http.put<Level>(`${P}/levels/${id}`, input)),
  setChildren: (id: string, childLevelIds: string[]) =>
    data(http.put<Level>(`${P}/levels/${id}/children`, { childLevelIds })),
  deleteLevel: (id: string) => data(http.delete<undefined>(`${P}/levels/${id}`)),

  locations: () => data(http.get<PhysicalLocation[]>(`${P}/locations`)),
  location: (id: string) => data(http.get<LocationDetail>(`${P}/locations/${id}`)),
  createLocation: (input: LocationInput) => data(http.post<LocationDetail>(`${P}/locations`, input)),
  updateLocation: (id: string, input: LocationInput) =>
    data(http.put<LocationDetail>(`${P}/locations/${id}`, input)),
  moveLocation: (id: string, newParentId: string) =>
    data(http.post<LocationDetail>(`${P}/locations/${id}/move`, { newParentId })),
  deleteLocation: (id: string) => data(http.delete<undefined>(`${P}/locations/${id}`)),

  placeDocument: (documentId: string, locationId: string | null) =>
    data(http.put<LocationDetail | null>(`/documents/${documentId}/location`, { locationId })),

  loans: (status: LoanFilter) => data(http.get<Loan[]>(`${P}/loans`, { params: { status } })),
  createLoan: (input: LoanInput) => data(http.post<Loan>(`${P}/loans`, input)),
  returnLoan: (id: string) => data(http.post<Loan>(`${P}/loans/${id}/return`)),
};

export const physicalKeys = {
  all: ['physical'] as const,
  levels: ['physical', 'levels'] as const,
  locations: ['physical', 'locations'] as const,
  location: (id: string) => ['physical', 'location', id] as const,
  loans: (status: LoanFilter) => ['physical', 'loans', status] as const,
};
