// types.ts
export interface User {
  id: number;
  name: string;
  birthDate: string;
}

export interface Document {
  id: number;
  title: string;
  content: string;
}

// Add other entity interfaces here...

export type Entity = User | Document; // Extend this union type with other entities

export interface SEContextType {
  users: User[];
  documents: Document[];
  addEntity: <T extends Entity>(entity: T, entityType: 'users' | 'documents') => void;
  setEntityList: <T extends Entity>(newEntities: T[], entityType: 'users' | 'documents') => void;
  // Add other entity management methods here...
}
