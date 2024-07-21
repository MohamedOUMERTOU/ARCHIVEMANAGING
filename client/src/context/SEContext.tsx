// SEContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User, Document, Entity, SEContextType } from './types'; // Adjust the path as needed

const SEContext = createContext<SEContextType | undefined>(undefined);

export const useSEContext = () => {
  const context = useContext(SEContext);
  if (context === undefined) {
    throw new Error('useSEContext must be used within a SEContextProvider');
  }
  return context;
};

export const SEContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const addEntity = <T extends Entity>(entity: T, entityType: 'users' | 'documents') => {
    if (entityType === 'users') {
      setUsers(prevUsers => [...prevUsers, entity as User]);
    } else if (entityType === 'documents') {
      setDocuments(prevDocuments => [...prevDocuments, entity as Document]);
    }
  };

  const setEntityList = <T extends Entity>(newEntities: T[], entityType: 'users' | 'documents') => {
    if (entityType === 'users') {
      setUsers(newEntities as User[]);
    } else if (entityType === 'documents') {
      setDocuments(newEntities as Document[]);
    }
  };

  return (
    <SEContext.Provider value={{ users, documents, addEntity, setEntityList }}>
      {children}
    </SEContext.Provider>
  );
};
