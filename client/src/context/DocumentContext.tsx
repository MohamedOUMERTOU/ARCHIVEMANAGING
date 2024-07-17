import React, { createContext, useContext, useState, ReactNode } from 'react';


interface DocumentContextType {
  documentId: string | null;
  setDocumentId: (id: string) => void;
}


const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documentId, setDocumentId] = useState<string | null>(null);

  return (
    <DocumentContext.Provider value={{ documentId, setDocumentId }}>
      {children}
    </DocumentContext.Provider>
  );
};

// Custom hook to use the DocumentContext
export const useDocument = (): DocumentContextType => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};
